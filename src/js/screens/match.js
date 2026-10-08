window.Game = window.Game || {};
window.Game.Screens = window.Game.Screens || {};

/**
 * Mesa de duelo. El jugador humano es siempre jugadores[0].
 */
window.Game.Screens.partida = {
  motor: null,
  contenedor: null,
  iaEnCurso: false,
  temporizador: null,

  render(contenedor, params = {}) {
    this.contenedor = contenedor;
    this.iaEnCurso = false;
    this.params = params;
    this.resultadoRegistrado = false;
    this.cineFinLanzada = false;
    this.recordatorios = [];
    this.uidsRecordados = new Set();
    this.eco = null;
    this.limpiarBurbujaRecordatorio();

    const razaJugador = params.raza || 'lunaria';
    const esCalabozo = params.modo === 'historia' && params.etapa;

    let jugador, rival;

    if (esCalabozo) {
      // Modo historia: un personaje en posición contra una oleada.
      const cal = window.Game.calabozoDe(razaJugador);
      const etapa = cal.etapas.find((e) => e.n === params.etapa);
      const eq = window.Game.equipoDeHistoria(razaJugador, params.etapa - 1);

      // Tu equipo crece etapa a etapa, pero en posición solo cabe uno: el
      // resto espera en la zona de equipo. Lo que crece es a quién puedes
      // sacar, no cuántos sostienes a la vez.
      jugador = window.Game.crearJugador(
        'Tu equipo',
        razaJugador,
        eq.personajes,
        eq.acciones,
        false,
        { maxActivos: 1 }
      );
      // La oleada también se turna: una criatura en posición y el resto
      // esperando en su zona. Sus costes son 0, así que pasan la regla de
      // energía por sí solas, sin necesidad de saltársela.
      rival = window.Game.crearJugador(
        etapa.titulo,
        'criatura',
        etapa.criaturas,
        // Acotado por etapa: las dos primeras van solo con Finta y Acrobático.
        window.Game.accionesDeOleada(etapa.n),
        true,
        { maxActivos: 1, ordenFijo: true }
      );
      this.etapa = etapa;
    } else {
      const razaRival =
        params.razaRival || window.Game.RACE_ORDER.find((r) => r !== razaJugador);
      const eqJugador = this.equipoPara(razaJugador);
      const eqRival = window.Game.Team.equipoPredeterminado(razaRival);

      jugador = window.Game.crearJugador(
        'Tú',
        razaJugador,
        eqJugador.personajes,
        eqJugador.acciones
      );
      rival = window.Game.crearJugador(
        'IA',
        razaRival,
        eqRival.personajes,
        eqRival.acciones,
        true
      );
      this.etapa = null;
    }

    // El ambiente de la estirpe solo acompaña a sus misiones de historia; un
    // duelo suelto del modo solo se queda con el fondo neutro de siempre.
    const ambiente = esCalabozo ? window.Game.RACES[razaJugador] : null;

    contenedor.innerHTML = `
      ${window.Game.Ambiente.html(ambiente)}
      <div class="pantalla mesa">
        <header class="mesa-cabecera">
          <button class="btn-volver" id="btn-salir-partida">← Abandonar</button>
          <!-- El mezclador es una capa suelta, no una pantalla: se puede abrir
               a media partida sin perderla. -->
          <button class="mesa-sonido" id="btn-sonido-mesa"
                  title="Ajustes de sonido">🔊</button>
          <div class="mesa-fase">
            <span id="mesa-turno"></span>
            <span class="mesa-fase-nombre" id="mesa-fase"></span>
          </div>
        </header>

        <div class="mesa-tablero">
          <div id="panel-rival"></div>
          <div class="mesa-centro">
            <ol class="fases" id="mesa-fases" aria-label="Fase del turno">
              ${window.Game.FASES.map(
                (f) => `
                <li class="fase-punto" data-fase="${f}"
                    title="${window.Game.NOMBRE_FASE[f]}">
                  <span class="fase-letra">${window.Game.INICIAL_FASE[f]}</span>
                </li>`
              ).join('')}
            </ol>
            <div class="mesa-linea"></div>
            <div class="mesa-veredicto" id="mesa-veredicto"></div>
            <div class="mesa-linea"></div>
            <!-- El dado, en la mesa y no en Herramientas: es la primitiva que
                 más se usa y estaba a dos clics detrás de una pestaña. Vive en
                 el esqueleto, que pintar() no reescribe, así que el último
                 resultado aguanta los repintados sin tener que conservarlo. -->
            <div class="mesa-dado">
              <button type="button" id="btn-dado" class="mesa-dado-btn"
                      title="Tirar un d6">🎲</button>
              <span class="mesa-dado-valor" id="mesa-dado-valor">—</span>
            </div>
          </div>
          <div id="panel-jugador"></div>

          <!-- Retratos flotantes de quien está en posición. Capa aparte y
               decorativa: se pinta por separado de los paneles para que el
               repintado de cada cambio de estado no reinicie la flotación. -->
          <div class="mesa-flotantes" id="mesa-flotantes" aria-hidden="true">
            <div class="flotantes-lado rival" data-lado="rival"></div>
            <div class="flotantes-lado jugador" data-lado="jugador"></div>
          </div>

          <div class="aviso-jefe oculto" id="aviso-jefe"></div>
        </div>

        <aside class="mesa-lateral">
          <div class="lupa" id="lupa">
            <div class="lupa-vacia">Pasa el ratón por una carta para verla</div>
          </div>
          <div class="lateral-pestanas">
            <button class="pestana activa" data-panel="registro-lista">Registro</button>
            <button class="pestana" data-panel="herramientas">Herramientas</button>
            <button class="pestana" data-panel="recordatorios" id="pestana-recordatorios">
              Recordatorios
            </button>
          </div>
          <div id="registro-lista" class="lateral-panel"></div>
          <div id="herramientas" class="lateral-panel oculto"></div>
          <div id="recordatorios" class="lateral-panel oculto"></div>
        </aside>

        <footer class="mesa-controles" id="mesa-controles"></footer>
      </div>
      <div class="mesa-fin oculto" id="mesa-fin"></div>
    `;

    this.motor = new window.Game.TurnEngine({
      jugador,
      oponente: rival,
      alCambiar: () => this.pintar()
    });

    // Abandonar tira el duelo entero y no hay forma de retomarlo, así que
    // pasa por la confirmación genérica. Con el duelo YA terminado no
    // pregunta nada: ahí el botón es solo la puerta de salida y preguntar
    // sería ruido.
    contenedor.querySelector('#btn-salir-partida').addEventListener('click', async () => {
      if (!this.motor.terminada) {
        const ok = await window.Game.Confirmar.preguntar({
          titulo: 'Abandonar el duelo',
          texto: this.etapa
            ? `Se pierde lo jugado en «${this.etapa.titulo}» y la etapa se ` +
              'queda sin superar: tendrás que empezarla de nuevo desde el ' +
              'principio. El avance de las etapas anteriores no se toca.'
            : 'Se pierde el duelo en curso. No se puede retomar donde lo dejaste.',
          textoOk: 'Abandonar'
        });
        if (!ok) return;
      }
      window.Game.Router.ir('mainMenu');
    });

    // Los atajos de la carta van por DELEGACIÓN: `pintar()` rehace los dos
    // paneles enteros en cada cambio de estado, así que un oyente puesto en el
    // botón moriría en el primer repintado. El contenedor sí sobrevive.
    contenedor.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.ct-btn');
      if (!btn || btn.disabled) return;
      const caja = btn.closest('[data-uid-tool]');
      const m = this.motor;
      if (!caja || !m || m.terminada) return;

      // Se busca por uid en vez de guardar la instancia en el DOM: el HTML se
      // rehace constantemente y una referencia guardada quedaría obsoleta.
      const destino = m.jugadores
        .flatMap((j) => j.activos)
        .find((i) => i.uid === caja.dataset.uidTool);
      if (!destino) return;

      // Las mismas primitivas y el mismo motivo que el panel: un atajo no
      // puede dejar un rastro distinto en el registro que la ruta larga.
      const M = window.Game.Manual;
      if (btn.dataset.tool === 'limpiar') {
        M.limpiarModificadores(m, destino, 'manual');
        return;
      }
      const n = Number(btn.dataset.n);
      M.modificar(
        m,
        destino,
        btn.dataset.tool === 'atq' ? { ataque: n } : { defensa: n },
        'manual'
      );
    });

    // Sangre, por la misma vía delegada y por el mismo motivo: los paneles se
    // rehacen enteros en cada repintado.
    contenedor.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.sg-flecha');
      const m = this.motor;
      if (!btn || btn.disabled || !m || m.terminada) return;

      const j = m.jugadores[Number(btn.dataset.jugador)];
      if (!j) return;

      // Las mismas llamadas y el mismo motivo que el panel largo. Ninguna de
      // las tres notifica por su cuenta, de ahí el notificar() final; y
      // derramar() puede terminar la partida, así que se comprueba después.
      const op = btn.dataset.sangre;
      if (op === 'derramar') m.derramar(j, 1, 'efecto manual');
      if (op === 'pagar') m.pagar(j, 1, 'efecto manual');
      if (op === 'recuperar') m.recuperar(j, 1, 'efecto manual');
      m.notificar();
    });

    contenedor.querySelector('#btn-dado').addEventListener('click', (ev) => {
      if (!this.motor || this.motor.terminada) return;
      // La tirada ocurre YA, entera: lo que se retrasa es solo enseñarla. Así
      // el registro y el motor nunca dependen de una animación.
      const r = window.Game.Manual.dado(this.motor, 0, 'tirada manual');
      // Después de `dado()`, que ya repintó: esta caja no la toca `pintar()`,
      // así que el resultado se queda a la vista hasta la siguiente tirada.
      this.mostrarTirada(ev.currentTarget, r.resultado);
    });

    contenedor.querySelector('#btn-sonido-mesa').addEventListener('click', () => {
      window.Game.Mezclador.abrir();
    });

    contenedor.querySelectorAll('.pestana').forEach((btn) => {
      btn.addEventListener('click', () => {
        contenedor.querySelectorAll('.pestana').forEach((b) => {
          b.classList.toggle('activa', b === btn);
        });
        contenedor.querySelectorAll('.lateral-panel').forEach((p) => {
          p.classList.toggle('oculto', p.id !== btn.dataset.panel);
        });
        // Un panel `display: none` mide 0, así que mientras estuvo oculto no
        // se le pudo poner el scroll: al volver a enseñarlo hay que llevarlo
        // al fondo a mano, o el registro aparece por su primera línea.
        if (btn.dataset.panel === 'registro-lista') this.registroAlFondo();
      });
    });

    window.Game.Ambiente.conectar(contenedor);
    window.Game.Recordatorios.reiniciar();
    window.Game.Audio.ponerMusica('batalla');
    this.motor.iniciar();
  },

  /** Usa el último equipo guardado de esa raza; si no hay, el predeterminado. */
  equipoPara(razaId) {
    const guardados = window.Game.State.perfil.equiposGuardados.filter(
      (e) => e.raza === razaId
    );
    const ultimo = guardados[guardados.length - 1];
    if (ultimo) {
      return { personajes: ultimo.personajes, acciones: ultimo.acciones };
    }
    return window.Game.Team.equipoPredeterminado(razaId);
  },

  /** Las criaturas no tienen raza jugable: se pinta con un color propio. */
  colorLado(j) {
    const r = window.Game.RACES[j.raza];
    if (r) return r;
    return {
      nombre: 'Corrupción',
      sigil: '☣',
      colorPrimario: '#8fd94a',
      colorSecundario: '#2c4a12'
    };
  },

  /* ----------------------------- Pintado ------------------------------- */

  pintar() {
    const m = this.motor;
    const c = this.contenedor;
    if (!m || !c) return;

    const [humano, ia] = m.jugadores;

    c.querySelector('#mesa-turno').textContent =
      `Turno ${m.numeroTurno} · ${m.jugadorActivo.nombre}`;
    c.querySelector('#mesa-fase').textContent =
      window.Game.ETIQUETA_FASE[m.fase] || m.fase;

    // Indicador de fase: se enciende la actual y se marcan las ya pasadas,
    // que el turno siempre avanza en el orden de `Game.FASES`.
    const iFase = window.Game.FASES.indexOf(m.fase);
    c.querySelectorAll('#mesa-fases .fase-punto').forEach((el, i) => {
      el.classList.toggle('activa', i === iFase);
      el.classList.toggle('cumplida', i < iFase);
    });

    // Los recordatorios se calculan antes de los paneles, que los pintan como
    // distintivo en la carta. `observar` va aquí porque detecta retiradas
    // comparando con la revisión anterior.
    window.Game.Recordatorios.observar(m);
    this.recordatorios = window.Game.Recordatorios.pendientes(m);
    this.uidsRecordados = window.Game.Recordatorios.uidsConPendientes(this.recordatorios);

    c.querySelector('#panel-rival').innerHTML = this.panel(ia, true);
    c.querySelector('#panel-jugador').innerHTML = this.panel(humano, false);
    // La banda central sirve dos cosas que nunca coinciden: TU previsión de
    // ataque y lo que la IA acaba de acoplar en SU turno. Comparten hueco a
    // propósito, para no añadir una fila que le quite altura al tablero.
    c.querySelector('#mesa-veredicto').innerHTML =
      this.veredicto() || this.avisoEfectoEquipado();

    // `pintar()` rehace el registro entero, y eso devuelve su scroll a cero:
    // con historial largo eso dejaría a la vista las líneas MÁS VIEJAS, justo
    // lo contrario de lo que hace falta. Se mira si estaba pegado al fondo
    // ANTES de rehacerlo y se le devuelve el sitio. Solo se re-pega si ya
    // estaba abajo: si subiste a leer algo, el turno de la IA no te arrastra.
    const lista = c.querySelector('#registro-lista');
    const pegadoAlFondo =
      lista.scrollHeight - lista.scrollTop - lista.clientHeight < this.MARGEN_FONDO;
    lista.innerHTML = m.registro
      .slice(-this.LINEAS_REGISTRO)
      .map((e) => `<p><span>T${e.turno}</span> ${e.texto}</p>`)
      .join('');
    if (pegadoAlFondo) lista.scrollTop = lista.scrollHeight;

    this.pintarControles();
    this.pintarHerramientas();
    this.pintarRecordatorios();
    this.abrirRecordatoriosSiTeAtacan();
    this.pintarFlotantes();
    this.conectarLupa();
    // Antes del corte por partida terminada: el golpe que cierra el duelo
    // también tiene que sonar.
    this.reaccionarASucesos();

    // Las burbujas se colocan sobre zonas ya pintadas, así que van al final.
    window.Game.Tutorial.alCerrar = () => this.pintar();
    // Se pasa la pantalla porque algún paso mira su estado, como los
    // recordatorios pendientes, que no viven en el motor.
    window.Game.Tutorial.revisar(c, m, this.params, this);

    if (m.terminada) {
      this.pintarFin();
      return;
    }

    // Turno de la IA: se juega solo, con una pausa para que se pueda seguir.
    if (m.jugadorActivo.esIA && !this.iaEnCurso) {
      // Antes de mover, el jefe lanza una de sus cuatro habilidades al azar
      // y se enseña lo que ha hecho. Es la única excepción a que los efectos
      // impresos los aplique el jugador: al jefe no lo maneja nadie.
      if (this.avisoJefePendiente()) {
        this.lanzarHabilidadesJefe();
        this.pintarAvisoJefe();
        return;
      }
      // Ataque suyo declarado y sin resolver: el turno queda en tus manos
      // para que puedas defenderte antes de que se aplique.
      if (m.ataquePendiente) return;

      this.iaEnCurso = true;
      this.temporizador = setTimeout(() => this.pasoIA(), this.RITMO_IA);
    }
  },

  /** Pausa entre fases del rival, en ms. */
  RITMO_IA: 620,

  /**
   * Cuántas líneas de registro se pintan. Eran 14, que en un turno de jefe
   * —varias habilidades, cada una con su detalle— se comían todo lo anterior
   * y dejaban sin explicación lo que acababa de pasar. El panel ya tenía
   * `overflow-y: auto`, así que lo único que faltaba era darle qué desplazar.
   * `motor.registro` no tiene tope, de ahí el recorte: es para no repintar
   * cientos de párrafos en cada cambio de estado, no un límite de la partida.
   */
  LINEAS_REGISTRO: 80,

  /** Holgura para considerar que el registro «está abajo», en píxeles. */
  MARGEN_FONDO: 24,

  /**
   * Lo que dura el dado rodando, en ms. Lo declara el JS y lo empuja al CSS
   * como custom property (`--dado-giro`), igual que hace `cinematica.js`: con
   * el número escrito en los dos sitios se desincronizan a la primera.
   *
   * Corto a propósito. La IA juega a `RITMO_IA` (620 ms) por fase, y una
   * animación más larga se solaparía con el repintado siguiente.
   */
  MS_DADO: 420,

  /**
   * Enseña el resultado del dado con el tumbo delante.
   *
   * La tirada ya ocurrió antes de llamar aquí —está en el registro— así que
   * esto es puro adorno: si algo fallara, el número sigue estando en el
   * panel. Nada del juego depende de que la animación termine.
   */
  mostrarTirada(boton, resultado) {
    const caja = this.contenedor.querySelector('#mesa-dado-valor');
    if (!caja) return;

    // Quien pidió menos movimiento no lo recibe: se escribe y ya.
    if (this.sinMovimiento() || !boton) {
      caja.textContent = resultado;
      return;
    }

    boton.style.setProperty('--dado-giro', `${this.MS_DADO}ms`);
    // Quitar, forzar reflujo y volver a poner: sin esto, una segunda tirada
    // durante la primera no reinicia la animación y el dado se queda quieto
    // aunque el motor sí haya tirado.
    boton.classList.remove('girando');
    caja.classList.remove('nuevo');
    void boton.offsetWidth;
    boton.classList.add('girando');
    caja.classList.add('girando');

    // Testigo por si llega otra tirada mientras esta rueda: solo escribe la
    // última, y así no se pisan dos resultados en desorden.
    const mia = (this.nTirada = (this.nTirada || 0) + 1);
    setTimeout(() => {
      if (mia !== this.nTirada || !this.contenedor) return;
      boton.classList.remove('girando');
      caja.classList.remove('girando');
      caja.textContent = resultado;
      caja.classList.add('nuevo');
    }, this.MS_DADO);
  },

  /** Lleva el registro a su última línea. */
  registroAlFondo() {
    const lista = this.contenedor.querySelector('#registro-lista');
    if (lista) lista.scrollTop = lista.scrollHeight;
  },

  /**
   * El turno del rival, fase a fase y con una pausa entre cada una.
   *
   * Antes se resolvía entero dentro de un solo `setTimeout`: como todo
   * ocurría en el mismo tick, el indicador P·A·C·F saltaba directamente al
   * final y su turno parecía instantáneo. Ahora se ve pasar por las cuatro.
   *
   * `iaEnCurso` sigue puesto mientras dura la cadena, así que el `pintar()`
   * de cada fase no engancha un segundo turno en paralelo.
   */
  pasoIA() {
    const m = this.motor;
    if (!m || m.terminada) {
      this.iaEnCurso = false;
      if (m) this.pintar();
      return;
    }

    const seguia = m.jugadorActivo.esIA;
    const queda = seguia
      ? window.Game.AI.jugarFase(m, { pausarEnAtaques: true })
      : false;

    // Se suelta el cerrojo ANTES de repintar cuando la cadena termina: si no,
    // `pintar()` vería la IA en curso y no arrancaría el turno siguiente.
    if (!queda || !m.jugadorActivo.esIA) {
      this.iaEnCurso = false;
      this.pintar();
      return;
    }

    this.pintar();
    this.temporizador = setTimeout(() => this.pasoIA(), this.RITMO_IA);
  },

  /* --------------------------- Aviso del jefe ---------------------------- */

  /** Criaturas rivales en posición que tienen habilidades impresas. */
  jefesEnCampo() {
    return this.instanciasJefe().map((i) =>
      window.Game.CHARACTERS_BY_ID[i.personaje]
    );
  },

  /**
   * Lo mismo, pero las instancias: las habilidades necesitan el uid.
   *
   * Los jefes son la EXCEPCIÓN a que solo actúe quien está en posición:
   * escondido detrás de un esbirro sigue lanzando, porque esconderse no es
   * retirarse. Pero solo si ya había salido al campo (`salioAlCampo`): un jefe
   * que aún espera su turno al fondo de la oleada no está replegado, está por
   * llegar, y dejarle lanzar desde ahí adelantaría el castigo a la etapa 6
   * entera desde el primer turno.
   */
  instanciasJefe() {
    const m = this.motor;
    if (!m) return [];
    const ia = m.jugadores[1];
    const tieneHabilidades = (i) => {
      const c = window.Game.CHARACTERS_BY_ID[i.personaje];
      return c && Array.isArray(c.habilidades) && c.habilidades.length;
    };
    return [
      ...ia.activos.filter(tieneHabilidades),
      ...ia.reserva.filter((i) => tieneHabilidades(i) && i.salioAlCampo)
    ];
  },

  /**
   * Cada jefe en campo lanza UNA de sus cuatro al azar. Se guarda el parte
   * por turno para que `pintar()`, que corre en cada cambio de estado, no las
   * vuelva a lanzar mientras el aviso siga en pantalla.
   */
  lanzarHabilidadesJefe() {
    if (this.habilidadesLanzadasEn === this.motor.numeroTurno) return;
    this.habilidadesLanzadasEn = this.motor.numeroTurno;

    this.parteJefe = this.instanciasJefe()
      .map((inst) => {
        const informe = window.Game.Jefes.lanzar(this.motor, inst);
        if (!informe) return null;
        return { criatura: window.Game.CHARACTERS_BY_ID[inst.personaje], ...informe };
      })
      .filter(Boolean);
  },

  avisoJefePendiente() {
    return (
      this.jefesEnCampo().length > 0 &&
      this.avisoResueltoEn !== this.motor.numeroTurno
    );
  },

  pintarAvisoJefe() {
    const m = this.motor;
    const el = this.contenedor.querySelector('#aviso-jefe');
    if (!el) return;

    const parte = this.parteJefe || [];
    const bloques = parte
      .map(
        (p) => `
        <div class="aviso-jefe-carta">
          <div class="mini-carta" title="${p.criatura.nombre}">
            <img src="${p.criatura.imagen}" alt="${p.criatura.nombre}">
          </div>
          <div class="aviso-jefe-lista">
            <strong>${p.criatura.nombre}</strong>
            <div class="habilidad lanzada">
              <span class="habilidad-num">${p.n}</span>
              <div>
                <strong>${p.nombre}</strong>
                <p>${p.texto}</p>
                <p class="habilidad-efecto">→ ${p.detalle}</p>
              </div>
            </div>
          </div>
        </div>`
      )
      .join('');

    el.classList.remove('oculto');
    el.innerHTML = `
      <div class="aviso-jefe-caja">
        <h3>Turno de ${m.jugadores[1].nombre}</h3>
        <p class="nota">
          ${
            parte.length
              ? 'Lanza una de sus cuatro habilidades, al azar. Ya está aplicada.'
              : 'Sin habilidades que lanzar.'
          }
        </p>
        ${bloques}
        <button class="btn-primario" id="btn-aviso-seguir">Continuar</button>
      </div>
    `;

    el.querySelector('#btn-aviso-seguir').addEventListener('click', () => {
      this.avisoResueltoEn = m.numeroTurno;
      el.classList.add('oculto');
      this.pintar();
    });
  },

  /** Ficha de un jugador: sangre, personaje activo, reserva y revelados. */
  panel(j, esRival) {
    const m = this.motor;
    const r = this.colorLado(j);
    const vida = m.vidaDe(j);
    const energia = m.energiaDe(j);
    // Ancho de cada tramo de la barra respecto al total de 30.
    const pct = (n) => `${(n / window.Game.SANGRE_TOTAL) * 100}%`;

    const activo = j.activos.length
      ? j.activos.map((i) => this.cartaActiva(i, esRival)).join('')
      : '<div class="slot-vacio">Sin personaje activo</div>';

    // La oleada de calabozo es información pública: ya la viste en la
    // pantalla de la etapa. Se enseña quién espera turno para salir.
    const esperando =
      esRival && this.etapa && j.reserva.length
        ? `<div class="espera">
             <span class="espera-titulo">Esperando ${j.reserva.length}</span>
             <div class="espera-cartas">
               ${j.reserva
                 .map((i) => {
                   const p = window.Game.CHARACTERS_BY_ID[i.personaje];
                   const lista = m.puedeDesplegar(j, i);
                   return `<div class="espera-carta ${lista ? '' : 'cara'}"
                                data-lupa="${p.imagen}" data-lupa-nombre="${p.nombre}"
                                title="${p.nombre}${
                                  lista ? '' : ` — necesita ${p.coste} de energía`
                                }">
                             <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
                             <span class="espera-stats">⚔${p.ataque} 🛡${p.defensa}</span>
                           </div>`;
                 })
                 .join('')}
             </div>
           </div>`
        : '';

    // Lo que está en el Hades ya se ve entero abajo: no lo repitas aquí.
    const enHades = new Set(j.hades.map((i) => i.personaje));
    const revelados = [...j.revelados]
      .filter((id) => !enHades.has(id))
      .map(
        (id) =>
          window.Game.CHARACTERS_BY_ID[id]?.nombre ||
          window.Game.ACTIONS_BY_ID[id]?.nombre
      )
      .filter(Boolean);

    const hades = j.hades.length
      ? `<div class="hades">
           <span class="hades-titulo" title="Zona abierta: ambos jugadores la ven">
             Hades ${j.hades.length}
           </span>
           <div class="hades-cartas">
             ${j.hades
               .map((i) => {
                 const p = window.Game.CHARACTERS_BY_ID[i.personaje];
                 return `<div class="hades-carta" data-lupa="${p.imagen}"
                              data-lupa-nombre="${p.nombre}" title="${p.nombre}">
                           <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
                         </div>`;
               })
               .join('')}
           </div>
         </div>`
      : '';

    // El vacío se pinta pegado al Hades porque es su zona adyacente, y solo
    // cuando hay algo: una caja vacía permanente sería ruido en toda partida
    // que no toque a Errante.
    const vacio = j.vacio.length
      ? `<div class="hades es-vacio">
           <span class="hades-titulo" title="Adyacente al Hades: solo se entra y se sale por él">
             Vacío ${j.vacio.length}
           </span>
           <div class="hades-cartas">
             ${j.vacio
               .map((i) => {
                 const p = window.Game.CHARACTERS_BY_ID[i.personaje];
                 return `<div class="hades-carta" data-lupa="${p.imagen}"
                              data-lupa-nombre="${p.nombre}" title="${p.nombre}">
                           <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
                         </div>`;
               })
               .join('')}
           </div>
         </div>`
      : '';

    return `
      <div class="mesa-lado ${esRival ? 'es-rival' : 'es-jugador'} ${
        // En calabozo las criaturas se pintan a mayor tamaño: son el
        // espectáculo de la etapa, no un rival simétrico.
        esRival && this.etapa ? 'es-oleada' : ''
      }"
           style="--raza-primario:${r.colorPrimario};--raza-secundario:${r.colorSecundario}">
        <div class="lado-info">
          <span class="mesa-sigil">${r.sigil}</span>
          <div>
            <strong>${j.nombre}</strong>
            <span class="mesa-raza">${r.nombre}</span>
          </div>
          <div class="sangre">
            <div class="sangre-marcadores">
              <div class="sm sm-vida" title="Pila inicial: sangre intacta. Si llega a 0, pierdes.">
                <span class="sm-num">${vida}</span>
                <span class="sm-lbl">Vida</span>
              </div>
              ${this.flechasDeSangre(j, esRival, 'vida-energia')}
              <div class="sm sm-energia"
                   title="Pila de gasto: sangre derramada. Puedes desplegar personajes de coste ${energia} o menos.">
                <span class="sm-num">${energia}</span>
                <span class="sm-lbl">Energía</span>
              </div>
              ${this.flechasDeSangre(j, esRival, 'energia-fuera')}
              <div class="sm sm-fuera ${j.sangre.fuera ? '' : 'vacio'}"
                   title="Sangre pagada: fuera del juego para siempre.">
                <span class="sm-num">${j.sangre.fuera}</span>
                <span class="sm-lbl">Fuera</span>
              </div>
            </div>

            <!-- Las tres pilas suman siempre 30: la barra lo hace evidente. -->
            <div class="sangre-barra" title="Las tres pilas suman 30 sangres">
              <div class="seg seg-vida" style="width:${pct(j.sangre.pila)}"></div>
              <div class="seg seg-gasto" style="width:${pct(j.sangre.gasto)}"></div>
              <div class="seg seg-fuera" style="width:${pct(j.sangre.fuera)}"></div>
            </div>

            <div class="sangre-pie">
              <span>de ${window.Game.SANGRE_TOTAL}</span>
              <span class="sangre-zonas">
                <span title="En reserva">👥 ${j.reserva.length}</span>
                <span title="En el Hades">✖ ${j.hades.length}</span>
              </span>
            </div>
          </div>
        </div>
        <div class="lado-fila">
          <div class="lado-campo">${activo}</div>
          ${esperando}
        </div>
        ${
          revelados.length
            ? `<div class="revelados" title="Cartas que pisaron el campo y se retiraron">
                 <span class="revelados-titulo">Revelado:</span>
                 ${revelados.map((n) => `<span class="revelado">${n}</span>`).join('')}
               </div>`
            : ''
        }
        ${hades}
        ${vacio}
      </div>
    `;
  },

  /**
   * Personaje activo con su acción acoplada, ambos como carta real.
   * La acción del rival permanece boca abajo hasta que se revele.
   */
  /* ------------------------- Retratos flotantes -------------------------- */

  /**
   * Muestra sobre la mesa el arte recortado de quien esté en posición, uno
   * por lado. Solo aparecen los personajes que tienen `imagenFlotante`: el
   * resto simplemente no flota, sin hueco ni error.
   */
  pintarFlotantes() {
    const m = this.motor;
    const capa = this.contenedor && this.contenedor.querySelector('#mesa-flotantes');
    if (!m || !capa) return;

    const [humano, ia] = m.jugadores;
    this.pintarLadoFlotante(capa.querySelector('[data-lado="rival"]'), ia);
    this.pintarLadoFlotante(capa.querySelector('[data-lado="jugador"]'), humano);
  },

  pintarLadoFlotante(cont, jugador) {
    if (!cont) return;

    const enPosicion = jugador.activos
      .map((inst) => ({ inst, p: window.Game.CHARACTERS_BY_ID[inst.personaje] }))
      .filter(({ p }) => p && p.imagenFlotante);

    // `pintar()` se llama en cada cambio de estado. Si se rehiciera el DOM
    // cada vez, la animación de flotación volvería al principio y el retrato
    // daría un tirón. Solo se toca cuando cambia quién está en posición.
    const firma = enPosicion.map(({ inst, p }) => inst.uid + ':' + p.imagenFlotante).join('|');
    if (cont.dataset.firma === firma) return;
    cont.dataset.firma = firma;

    // Quien se va —a revelado, a la mano o al Hades— se desvanece en vez de
    // esfumarse de golpe. Se marcan y se quitan al acabar la transición.
    cont.querySelectorAll('.flotante:not(.saliendo)').forEach((el) => {
      el.classList.add('saliendo');
      setTimeout(() => el.remove(), 400);
    });

    enPosicion.forEach(({ p }) => {
      const fig = document.createElement('figure');
      fig.className = 'flotante';
      const img = document.createElement('img');
      img.src = p.imagenFlotante;
      img.alt = '';
      fig.appendChild(img);
      cont.appendChild(fig);
    });
  },

  cartaActiva(inst, esRival = false) {
    const p = window.Game.CHARACTERS_BY_ID[inst.personaje];
    const a = inst.accion ? window.Game.ACTIONS_BY_ID[inst.accion] : null;
    const postura = window.Game.Combat.postura(inst);
    const atk = window.Game.Combat.ataqueEfectivo(inst);
    const def = window.Game.Combat.defensaEfectiva(inst);

    // Los efectos los aplica el jugador a mano, así que solo su lado lleva
    // distintivo: la IA no usa las Herramientas.
    const recordados = (!esRival && this.recordatorios) || [];
    const marca = (zona) => {
      const r = recordados.find((x) => x.uid === inst.uid && x.zona === zona);
      if (!r) return '';
      return `<span class="recordatorio-marca" title="${r.timing}: efecto sin aplicar">⚡</span>`;
    };

    // La acción acoplada del rival se enseña a cara descubierta. Antes iba
    // boca abajo y se confundía con «no tiene acción»: el dorso «?» no
    // distinguía entre carta oculta y hueco vacío. Se ve cuál es, pero su
    // efecto impreso lo sigue sin ejecutar nadie.
    const cartaAccion = a
      ? `<div class="mini-carta accion-equipada tipo-${a.tipo}"
                data-uid-accion="${inst.uid}"
                data-lupa="${a.imagen}" data-lupa-nombre="${a.nombre}">
             <img src="${a.imagen}" alt="${a.nombre}" loading="lazy">
             ${marca('accion')}
           </div>`
      : '<div class="mini-carta vacia" title="Sin acción">—</div>';

    return `
      <div class="campo-par">
        <div class="mini-carta personaje postura-${postura}"
             data-uid-personaje="${inst.uid}"
             data-lupa="${p.imagen}" data-lupa-nombre="${p.nombre}">
          <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
          ${marca('posicion')}
          <div class="mini-stats">
            <span class="stat-atq ${atk > 0 ? 'activo' : ''}">⚔ ${
              atk > 0 ? atk : p.ataque
            }</span>
            <span class="stat-def ${def > 0 ? 'activo' : ''}">🛡 ${
              def > 0 ? def : p.defensa
            }</span>
          </div>
        </div>
        ${cartaAccion}
        ${this.atajosDeCarta(inst)}
      </div>
    `;
  },

  /**
   * Las flechas que mueven sangre, EN EL HUECO ENTRE DOS PILAS.
   *
   * Las tres operaciones del reglamento son traslados entre pilas contiguas,
   * así que puestas en el hueco se explican solas y no hay que recordar qué
   * hacía cada verbo:
   *
   *   Vida  →  Energía   derramar
   *   Vida  ←  Energía   recuperar
   *          Energía  →  Fuera     pagar   (y de ahí no vuelve nada)
   *
   * Por eso el hueco Energía|Fuera lleva UNA sola flecha: la sangre pagada
   * sale del juego para siempre, y una flecha de vuelta mentiría sobre la
   * regla.
   *
   * Se deshabilitan cuando no hay de dónde sacar. Un botón que no hace nada al
   * pulsarlo es peor que uno apagado, y aquí el motor ya lo rechaza por su
   * cuenta: pagar() devuelve false sin energía, y derramar() y recuperar()
   * recortan a lo que haya.
   */
  flechasDeSangre(j, esRival, hueco) {
    const lado = esRival ? 1 : 0;
    const boton = (op, glifo, titulo, activo) =>
      `<button type="button" class="sg-flecha" data-sangre="${op}"
               data-jugador="${lado}" title="${titulo}"
               ${activo ? '' : 'disabled'}>${glifo}</button>`;

    if (hueco === 'vida-energia') {
      return `
        <div class="sg-flechas">
          ${boton('derramar', '→', 'Derramar: Vida → Energía', j.sangre.pila > 0)}
          ${boton('recuperar', '←', 'Recuperar: Energía → Vida', j.sangre.gasto > 0)}
        </div>`;
    }
    return `
      <div class="sg-flechas">
        ${boton('pagar', '→', 'Pagar: Energía → Fuera (sale del juego para siempre)', j.sangre.gasto > 0)}
      </div>`;
  },

  /**
   * Los atajos de ⚔ y 🛡 pegados a la propia carta.
   *
   * Existen porque aplicar un +1 exigía abrir Herramientas, elegir el objetivo
   * en un desplegable y pulsar: tres pasos para la operación más frecuente del
   * juego, con el panel encima escondido detrás de otra pestaña. Aquí el
   * objetivo es implícito —es la carta donde están—, que es el paso que más
   * estorbaba.
   *
   * Van en los DOS lados a propósito: hay efectos que recortan al rival
   * (Acrobático, sin ir más lejos), y Herramientas ya dejaba apuntarle. Esto
   * no añade poder, solo acorta el camino: por debajo llama a la misma
   * `Manual.modificar` y escribe el mismo «⚙ …(manual)» en el registro.
   *
   * `.campo-par` es una fila flex, así que esto crece a lo ANCHO. Importa:
   * en esta mesa lo escaso es el alto —las cartas ya se encogen en ventanas
   * bajas— y una fila nueva le habría quitado sitio al tablero.
   */
  atajosDeCarta(inst) {
    const fila = (tool, icono, nombre) => `
      <div class="ct-fila">
        <span class="ct-icono" aria-hidden="true">${icono}</span>
        <button type="button" class="ct-btn" data-tool="${tool}" data-n="1"
                title="${nombre} +1" aria-label="${nombre} más uno">▲</button>
        <button type="button" class="ct-btn" data-tool="${tool}" data-n="-1"
                title="${nombre} −1" aria-label="${nombre} menos uno">▼</button>
      </div>`;

    // Deshacer. No lo pide ninguna carta —no sale en el recuento del mazo—,
    // lo pide haber puesto el ±1 a un clic: equivocarse es ahora mucho más
    // fácil que antes, y sin esto rectificar obligaba a ir a Herramientas.
    // Apagado cuando no hay nada que quitar, como las flechas de sangre.
    const mods = inst.modificadores || { ataque: 0, defensa: 0 };
    const hayQueLimpiar = !!(mods.ataque || mods.defensa);

    return `
      <div class="campo-atajos" data-uid-tool="${inst.uid}">
        ${fila('atq', '⚔', 'Ataque')}
        ${fila('def', '🛡', 'Defensa')}
        <div class="ct-fila ct-fila-limpiar">
          <button type="button" class="ct-btn ct-limpiar" data-tool="limpiar"
                  title="Quitar los modificadores puestos a mano"
                  aria-label="Quitar los modificadores"
                  ${hayQueLimpiar ? '' : 'disabled'}>↺</button>
        </div>
      </div>`;
  },

  conectarLupa() {
    window.Game.Lupa.conectar(this.contenedor);
  },

  /** Previsualiza qué pasaría si el humano atacase ahora. */
  veredicto() {
    const m = this.motor;
    const [humano, ia] = m.jugadores;
    if (m.terminada) return '';
    if (m.jugadorActivo !== humano || m.fase !== 'ataque') return '';
    const atacante = m.atacantesDisponibles(humano)[0];
    if (!atacante) {
      return '<span class="veredicto-nulo">Sin ataque activado</span>';
    }
    const atk = window.Game.Combat.ataqueEfectivo(atacante);
    // Contra quien de verdad encajaría: si el jefe está cubierto, el golpe irá
    // al esbirro, y prever con los números del jefe sería mentir.
    const enPuesto = ia.activos[0] || null;
    const objetivo = enPuesto ? m.defensorEfectivo(ia, enPuesto) : null;
    const postura = window.Game.Combat.postura(objetivo);
    if (!objetivo) return `<span class="veredicto-bien">${atk} directo a la sangre</span>`;
    if (postura === 'neutral')
      return `<span class="veredicto-bien">Neutral: ${atk} a la sangre</span>`;
    // Aviso antes de declarar si su escudo va a devolverte el golpe: es la
    // única forma de que la regla no se descubra a base de sangrar.
    if (postura === 'defensiva') {
      const def = window.Game.Combat.defensaEfectiva(objetivo);
      if (def > atk) {
        return `<span class="veredicto-mal">Su escudo (${def}) supera tu ${atk}: ` +
          `te reflejaría ${def - atk}</span>`;
      }
    }
    return `<span class="veredicto-duda">Golpe de ${atk} contra postura de ${postura}</span>`;
  },

  /* ------------------------ Sonidos de la mesa -------------------------- */

  /**
   * Suena lo que acaba de pasar: personaje en posición, acción equipada y
   * ataque resuelto.
   *
   * Se deduce comparando con el repintado anterior en vez de dispararse desde
   * los botones, por dos razones: las jugadas de la IA no pasan por ningún
   * clic, y un ataque se resuelve desde tres sitios distintos. Y vive en la
   * pantalla, no en el motor, porque `tools/simular.js` carga `core/` en Node
   * puro, donde no hay `Audio`.
   */
  /**
   * UN detector, DOS salidas: sonido y movimiento.
   *
   * La detección ya existía para los sonidos, y las animaciones necesitan
   * exactamente la misma señal por las mismas dos razones: las jugadas de la
   * IA no pasan por ningún clic, y un ataque se resuelve desde tres sitios
   * distintos. Duplicar el diff habría sido tener dos verdades sobre «qué
   * acaba de pasar».
   */
  reaccionarASucesos() {
    const s = this.detectarSucesos();
    // Primer pintado: solo se toma la foto, ni suena ni se mueve nada.
    if (!s) return;
    this.sonarSucesos(s);
    this.animarSucesos(s);
  },

  /**
   * Qué ha cambiado desde el repintado anterior. Devuelve `null` la primera
   * vez, que es cuando solo hay que quedarse con la foto.
   */
  detectarSucesos() {
    const m = this.motor;

    const activos = new Set();
    const equipadas = new Set();
    m.jugadores.forEach((j, idx) => {
      j.activos.forEach((i) => {
        activos.add(`${idx}:${i.uid}`);
        if (i.accion) equipadas.add(`${idx}:${i.uid}:${i.accion}`);
      });
    });
    const foto = {
      activos,
      equipadas,
      turno: m.numeroTurno,
      ataques: m.atacaronEsteTurno.size,
      // Contador de golpes que pone `resolverAtaque`. Se compara él y no el
      // turno ni los uids: dos golpes iguales en el mismo turno se verían
      // como uno solo.
      golpe: m.ultimoGolpe ? m.ultimoGolpe.n : 0
    };

    // El primer pintado solo toma la foto: si no, lo que ya estuviera en la
    // mesa sonaría de golpe al entrar.
    if (!this.eco) {
      this.eco = foto;
      return null;
    }

    const hayNuevo = (ahora, antes) => [...ahora].some((k) => !antes.has(k));
    // `atacaronEsteTurno` crece con cada ataque resuelto y se limpia al cerrar
    // el turno, así que la cuenta solo se puede comparar dentro del mismo.
    const base = m.numeroTurno === this.eco.turno ? this.eco.ataques : 0;

    const sucesos = {
      enPosicion: hayNuevo(activos, this.eco.activos),
      acoplada: hayNuevo(equipadas, this.eco.equipadas),
      ataque: m.atacaronEsteTurno.size > base,
      golpe: foto.golpe > this.eco.golpe ? m.ultimoGolpe : null
    };

    this.eco = foto;
    return sucesos;
  },

  /** Lo que acaba de pasar, en sonido. */
  sonarSucesos(s) {
    const A = window.Game.Audio;
    if (s.enPosicion) A.reproducir('posicion');
    if (s.acoplada) A.reproducir('accion');
    if (s.ataque) A.reproducir('ataque');
  },

  /** Lo que acaba de pasar, en movimiento. */
  animarSucesos(s) {
    if (s.golpe) {
      this.golpeVivo = { n: s.golpe.n, desde: Date.now(), golpe: s.golpe };
    }
    this.pintarGolpe();
  },

  /** Lo que dura el impacto, en ms. Por debajo de `RITMO_IA` (620). */
  MS_IMPACTO: 380,

  /** ¿El sistema pidió menos movimiento? */
  sinMovimiento() {
    return !!(
      window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  },

  /**
   * Sacude la carta que encajó y hace destellar la sangre de quien sangró.
   *
   * Se vuelve a aplicar en CADA repintado mientras el golpe siga vivo, y no
   * una sola vez: `pintar()` rehace los paneles enteros y se llevaría la clase
   * por delante —`pasoIA` repinta otra vez justo después de que el motor
   * resuelva, así que la animación moriría a los pocos milisegundos—.
   *
   * Para que volver a aplicarla no la reinicie desde el principio, se le pasa
   * un `animation-delay` NEGATIVO igual a lo ya transcurrido: el navegador la
   * retoma por donde iba. Sin eso, cada repintado sería una sacudida nueva y
   * el golpe duraría lo que durasen los repintados.
   */
  pintarGolpe() {
    const vivo = this.golpeVivo;
    if (!vivo || !this.contenedor) return;

    const transcurrido = Date.now() - vivo.desde;
    if (transcurrido >= this.MS_IMPACTO) {
      this.golpeVivo = null;
      return;
    }
    if (this.sinMovimiento()) return;

    const g = vivo.golpe;
    const panelDe = (idx) =>
      this.contenedor.querySelector(idx === 0 ? '#panel-jugador' : '#panel-rival');

    const arrancar = (el, clase) => {
      if (!el) return;
      el.style.setProperty('--impacto', `${this.MS_IMPACTO}ms`);
      el.style.animationDelay = `-${transcurrido}ms`;
      el.classList.add(clase);
    };

    // La carta que encajó. Si murió ya no está en el DOM: entonces no hay a
    // quién sacudir y queda solo el destello de sangre.
    const panelDef = panelDe(g.defensorIdx);
    if (panelDef && g.defensorUid) {
      arrancar(
        panelDef.querySelector(`[data-uid-personaje="${g.defensorUid}"]`),
        'encaja-golpe'
      );
    }

    // La sangre destella en quien la perdió, que NO siempre es el defensor: el
    // reflejo del escudo sangra a quien atacó. Pueden encenderse los dos lados
    // en el mismo golpe, y es correcto.
    if (g.danoSangre > 0 && panelDef) {
      arrancar(panelDef.querySelector('.sangre-barra'), 'sangre-golpeada');
    }
    if (g.danoReflejado > 0) {
      const panelAtk = panelDe(g.atacanteIdx);
      if (panelAtk) arrancar(panelAtk.querySelector('.sangre-barra'), 'sangre-golpeada');
    }
  },

  /* -------------------------- Recordatorios ----------------------------- */

  /**
   * Lista lo que toca aplicar a mano ahora mismo, sin ejecutar nada. La cuenta
   * va en la pestaña para que se vea sin abrirla.
   *
   * La burbuja sale UNA vez por recordatorio; a partir de ahí queda el
   * distintivo en la carta y esta lista. Con 16 cartas de «En posición», una
   * burbuja en cada repintado sería insufrible.
   */
  pintarRecordatorios() {
    const cont = this.contenedor.querySelector('#recordatorios');
    if (!cont) return;
    const lista = this.recordatorios || [];

    const pestana = this.contenedor.querySelector('#pestana-recordatorios');
    if (pestana) {
      pestana.textContent = lista.length ? `Recordatorios ${lista.length}` : 'Recordatorios';
      pestana.classList.toggle('con-pendientes', lista.length > 0);
    }

    cont.innerHTML = lista.length
      ? lista
          .map(
            (r) => `
        <div class="recordatorio" data-clave="${r.clave}">
          <div class="mini-carta" data-lupa="${r.imagen}" data-lupa-nombre="${r.nombre}">
            <img src="${r.imagen}" alt="${r.nombre}" loading="lazy">
          </div>
          <div class="recordatorio-cuerpo">
            <strong>${r.nombre}</strong>
            <span class="recordatorio-timing">${r.timing}</span>
            <p>${r.texto}</p>
            <p class="nota">${r.nota}</p>
            <button class="recordatorio-hecho" type="button" data-clave="${r.clave}">
              Ya está aplicado
            </button>
          </div>
        </div>`
          )
          .join('')
      : `<p class="nota">
           Nada pendiente ahora mismo. Aquí aparece el efecto impreso de tus
           cartas en el momento en que toca aplicarlo.
         </p>`;

    cont.querySelectorAll('.recordatorio-hecho').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.Game.Recordatorios.descartar(btn.dataset.clave);
        this.pintar();
      });
    });

    this.burbujaRecordatorio(lista);
  },

  /**
   * Enseña el primero que no se haya enseñado nunca, anclado a su carta.
   *
   * No pisa al tutorial —que enseña a jugar y va primero— ni interrumpe la
   * cadena de la IA, que se pinta fase a fase.
   */
  burbujaRecordatorio(lista) {
    if (this.burbujaViva) return;
    if (window.Game.Tutorial.activo) return;

    // En el turno del rival no se interrumpe la cadena de fases... salvo
    // cuando te ha declarado un ataque: ahí el turno es tuyo de hecho, y es
    // justo el momento en que las defensivas de «Fase de combate» importan.
    const m = this.motor;
    const defendiendo = !!m.ataquePendiente && m.jugadorActivo.esIA;
    if (!defendiendo && (this.iaEnCurso || m.jugadorActivo.esIA)) return;

    const R = window.Game.Recordatorios;
    const r = lista.find((x) => !R.yaVisto(x.clave));
    if (!r) return;

    const objetivo = this.anclaDe(r);
    if (!objetivo) return;

    R.marcarVisto(r.clave);

    const burbuja = document.createElement('div');
    burbuja.className = 'recordatorio-burbuja';
    burbuja.innerHTML = `
      <h4>${r.timing}</h4>
      <p><strong>${r.nombre}</strong></p>
      <p>${r.texto}</p>
      <p class="recordatorio-nota">${r.nota}</p>
      <div class="recordatorio-pie">
        <button class="recordatorio-luego" type="button">Luego</button>
        <button class="btn-primario recordatorio-ok" type="button">Ya está</button>
      </div>
    `;
    document.body.appendChild(burbuja);
    this.burbujaViva = burbuja;
    window.Game.Tutorial.colocar(burbuja, objetivo);

    const cerrar = (aplicado) => {
      burbuja.remove();
      this.burbujaViva = null;
      if (aplicado) R.descartar(r.clave);
      this.pintar();
    };
    burbuja.querySelector('.recordatorio-ok').addEventListener('click', () => cerrar(true));
    burbuja.querySelector('.recordatorio-luego').addEventListener('click', () => cerrar(false));
  },

  /** La carta a la que se ancla la burbuja, según de dónde salga el aviso. */
  anclaDe(r) {
    const c = this.contenedor;
    if (r.zona === 'posicion' && r.uid)
      return c.querySelector(`#panel-jugador [data-uid-personaje="${r.uid}"]`);
    if (r.zona === 'accion' && r.uid)
      return c.querySelector(`#panel-jugador [data-uid-accion="${r.uid}"]`);
    if (r.zona === 'hades') return c.querySelector('#panel-jugador .hades');
    // Reveladas y retiradas viven en la reserva, que no se pinta carta a
    // carta: se ancla al panel del jugador.
    return c.querySelector('#panel-jugador');
  },

  limpiarBurbujaRecordatorio() {
    document.querySelectorAll('.recordatorio-burbuja').forEach((b) => b.remove());
    this.burbujaViva = null;
  },

  /* --------------------------- Herramientas ----------------------------- */

  /**
   * Panel para aplicar a mano los efectos impresos de las cartas. El motor no
   * los ejecuta: aquí están las primitivas y decides tú cuándo usarlas.
   */
  pintarHerramientas() {
    const m = this.motor;
    const cont = this.contenedor.querySelector('#herramientas');
    if (!cont) return;

    // El panel se repinta en cada cambio de estado; sin esto perderías la
    // selección a media jugada.
    const previo = {
      objetivo: cont.querySelector('#h-objetivo')?.value,
      carta: cont.querySelector('#h-carta')?.value,
      ocultar: cont.querySelector('#h-ocultar')?.value,
      hades: cont.querySelector('#h-hades')?.value,
      vacio: cont.querySelector('#h-vacio')?.value,
      dado: cont.querySelector('#h-dado')?.textContent
    };

    const [humano, rival] = m.jugadores;
    const M = window.Game.Manual;

    // Todas las cartas en posición, de ambos lados, para elegir objetivo.
    const objetivos = [
      ...humano.activos.map((i) => ({ i, j: humano, lado: 'Tú' })),
      ...rival.activos.map((i) => ({ i, j: rival, lado: rival.nombre }))
    ];

    const opcionesObjetivo = objetivos.length
      ? objetivos
          .map(
            (o, k) =>
              `<option value="${k}">${o.lado} · ${
                window.Game.CHARACTERS_BY_ID[o.i.personaje].nombre
              }</option>`
          )
          .join('')
      : '<option value="">— nadie en posición —</option>';
    this._objetivos = objetivos;

    // Hades y vacío de los dos bandos, para poder moverlos entre sí. Se
    // guardan igual que los objetivos: la opción lleva el índice y la lista
    // vive en la pantalla, que es más robusto que codificar lado y uid en el
    // value y volver a parsearlo.
    const enZona = (zona) => [
      ...humano[zona].map((i) => ({ i, j: humano, lado: 'Tú' })),
      ...rival[zona].map((i) => ({ i, j: rival, lado: rival.nombre }))
    ];
    this._enHades = enZona('hades');
    this._enVacio = enZona('vacio');

    const opcionesZona = (lista, vacio) =>
      lista.length
        ? lista
            .map(
              (o, k) =>
                `<option value="${k}">${o.lado} · ${
                  window.Game.CHARACTERS_BY_ID[o.i.personaje].nombre
                }</option>`
            )
            .join('')
        : `<option value="">— ${vacio} —</option>`;

    // Cartas del rival que aún no has visto, para revelarlas.
    const ocultasRival = [
      ...rival.reserva.map((i) => i.personaje),
      ...rival.activos.map((i) => i.accion).filter(Boolean),
      ...rival.acciones
    ].filter((id, k, arr) => id && arr.indexOf(id) === k && !rival.revelados.has(id));

    const bloqueadas = m.bloqueos.map(
      (b) =>
        `<span class="chip-bloqueo">${M.nombreCarta(b.cartaId)} · ${b.turnos}t</span>`
    );

    cont.innerHTML = `
      <p class="herr-intro">
        Los efectos de las cartas no se ejecutan solos. Aplícalos aquí y
        quedarán anotados en el registro.
      </p>

      <div class="herr-bloque">
        <h5>Objetivo</h5>
        <select id="h-objetivo" class="herr-select">${opcionesObjetivo}</select>
        <div class="herr-fila">
          <button data-mod="atq" data-n="1">⚔ +1</button>
          <button data-mod="atq" data-n="2">⚔ +2</button>
          <button data-mod="atq" data-n="3">⚔ +3</button>
          <button data-mod="atq" data-n="-1">⚔ −1</button>
          <button data-mod="atq" data-n="-2">⚔ −2</button>
        </div>
        <div class="herr-fila">
          <button data-mod="def" data-n="1">🛡 +1</button>
          <button data-mod="def" data-n="2">🛡 +2</button>
          <button data-mod="def" data-n="3">🛡 +3</button>
          <button data-mod="def" data-n="-1">🛡 −1</button>
          <button data-mod="def" data-n="-2">🛡 −2</button>
        </div>
        <div class="herr-fila">
          <button data-dup="ataque">Duplicar ⚔</button>
          <button data-dup="defensa">Duplicar 🛡</button>
          <button data-limpiar="1">Limpiar</button>
        </div>
        <div class="herr-fila">
          <button data-hades="1">Enviar al Hades</button>
          <button data-retirar="1">Retirar de posición</button>
        </div>
      </div>

      <div class="herr-bloque">
        <h5>Hades y vacío</h5>
        <p class="herr-nota">
          El vacío es adyacente al Hades: solo se entra y se sale por ahí.
        </p>
        <select id="h-hades" class="herr-select">
          ${opcionesZona(this._enHades, 'Hades vacío')}
        </select>
        <div class="herr-fila">
          <button data-al-vacio="1">Hades → vacío</button>
        </div>
        <select id="h-vacio" class="herr-select">
          ${opcionesZona(this._enVacio, 'nada en el vacío')}
        </select>
        <div class="herr-fila">
          <button data-del-vacio="1">Vacío → Hades</button>
        </div>
      </div>

      <div class="herr-bloque">
        <h5>Dado</h5>
        <div class="herr-fila">
          <button data-dado="0">🎲 d6</button>
          <button data-dado="1">🎲 +1</button>
          <button data-dado="-1">🎲 −1</button>
        </div>
        <div class="herr-resultado" id="h-dado">—</div>
      </div>

      <div class="herr-bloque">
        <h5>Sangre</h5>
        <div class="herr-fila">
          <span class="herr-etiqueta">Tú</span>
          <button data-sangre="derramar" data-quien="0">Derramar 1</button>
          <button data-sangre="pagar" data-quien="0">Pagar 1</button>
          <button data-sangre="recuperar" data-quien="0">Recuperar 1</button>
        </div>
        <div class="herr-fila">
          <span class="herr-etiqueta">Rival</span>
          <button data-sangre="derramar" data-quien="1">Derramar 1</button>
          <button data-sangre="pagar" data-quien="1">Pagar 1</button>
          <button data-sangre="recuperar" data-quien="1">Recuperar 1</button>
        </div>
      </div>

      <div class="herr-bloque">
        <h5>Información</h5>
        <select id="h-carta" class="herr-select">
          ${
            ocultasRival.length
              ? ocultasRival
                  .map((id) => `<option value="${id}">${M.nombreCarta(id)}</option>`)
                  .join('')
              : '<option value="">— nada oculto —</option>'
          }
        </select>
        <div class="herr-fila">
          <button data-revelar="1">👁 Revelar</button>
          <button data-bloquear="1">⛓ Bloquear 1t</button>
          <button data-bloquear="2">⛓ 2t</button>
        </div>
        <div class="herr-fila">
          <select id="h-ocultar" class="herr-select">
            ${
              [...rival.revelados].length
                ? [...rival.revelados]
                    .map((id) => `<option value="${id}">${M.nombreCarta(id)}</option>`)
                    .join('')
                : '<option value="">— nada revelado —</option>'
            }
          </select>
          <button data-ocultar="1">🌑 Ocultar</button>
        </div>
        ${bloqueadas.length ? `<div class="herr-chips">${bloqueadas.join('')}</div>` : ''}
      </div>

      <div class="herr-bloque">
        <h5>Turno</h5>
        <div class="herr-fila">
          <button data-negar="1" class="${m.accionesNegadas ? 'activo' : ''}">
            🚫 Negar acciones
          </button>
        </div>
      </div>
    `;

    // Restaura lo que estuviera elegido, si la opción sigue existiendo.
    const restaurar = (sel, valor) => {
      if (!valor) return;
      const el = cont.querySelector(sel);
      if (el && [...el.options].some((o) => o.value === valor)) el.value = valor;
    };
    restaurar('#h-objetivo', previo.objetivo);
    restaurar('#h-carta', previo.carta);
    restaurar('#h-ocultar', previo.ocultar);
    restaurar('#h-hades', previo.hades);
    restaurar('#h-vacio', previo.vacio);
    if (previo.dado && previo.dado !== '—') {
      cont.querySelector('#h-dado').textContent = previo.dado;
    }

    this.conectarHerramientas(cont);
  },

  objetivoElegido() {
    const sel = this.contenedor.querySelector('#h-objetivo');
    if (!sel || sel.value === '') return null;
    return this._objetivos[Number(sel.value)] || null;
  },

  conectarHerramientas(cont) {
    const m = this.motor;
    const M = window.Game.Manual;
    const conObjetivo = (fn) => () => {
      const o = this.objetivoElegido();
      if (o) fn(o);
    };

    const conZona = (lista, selector, fn) => () => {
      const sel = cont.querySelector(selector);
      const o = lista[Number(sel && sel.value)];
      if (o) fn(o);
    };

    cont.querySelector('[data-al-vacio]').addEventListener(
      'click',
      conZona(this._enHades, '#h-hades', (o) =>
        m.enviarAlVacio(o.j, o.i.uid, 'efecto manual')
      )
    );
    cont.querySelector('[data-del-vacio]').addEventListener(
      'click',
      conZona(this._enVacio, '#h-vacio', (o) =>
        m.recuperarDelVacio(o.j, o.i.uid, 'efecto manual')
      )
    );

    cont.querySelectorAll('[data-mod]').forEach((b) => {
      b.addEventListener(
        'click',
        conObjetivo((o) => {
          const n = Number(b.dataset.n);
          M.modificar(
            m,
            o.i,
            b.dataset.mod === 'atq' ? { ataque: n } : { defensa: n },
            'manual'
          );
        })
      );
    });

    cont.querySelectorAll('[data-dup]').forEach((b) => {
      b.addEventListener('click', conObjetivo((o) => M.duplicar(m, o.i, b.dataset.dup)));
    });
    cont.querySelector('[data-limpiar]').addEventListener(
      'click',
      conObjetivo((o) => M.limpiarModificadores(m, o.i))
    );
    cont.querySelector('[data-hades]').addEventListener(
      'click',
      conObjetivo((o) => m.enviarAlHades(o.j, o.i, 'efecto manual'))
    );
    cont.querySelector('[data-retirar]').addEventListener(
      'click',
      conObjetivo((o) => M.retirarDePosicion(m, o.j, o.i, 'efecto manual'))
    );

    cont.querySelectorAll('[data-dado]').forEach((b) => {
      b.addEventListener('click', () => {
        const r = M.dado(m, Number(b.dataset.dado), 'tirada manual');
        const caja = this.contenedor.querySelector('#h-dado');
        if (caja) caja.textContent = `🎲 ${r.resultado}`;
      });
    });

    cont.querySelectorAll('[data-sangre]').forEach((b) => {
      b.addEventListener('click', () => {
        const j = m.jugadores[Number(b.dataset.quien)];
        const op = b.dataset.sangre;
        if (op === 'derramar') m.derramar(j, 1, 'efecto manual');
        if (op === 'pagar') m.pagar(j, 1, 'efecto manual');
        if (op === 'recuperar') m.recuperar(j, 1, 'efecto manual');
        m.notificar();
      });
    });

    const rival = m.jugadores[1];
    cont.querySelector('[data-revelar]').addEventListener('click', () => {
      const sel = cont.querySelector('#h-carta');
      if (sel && sel.value) M.revelar(m, rival, sel.value, 'efecto manual');
    });
    cont.querySelectorAll('[data-bloquear]').forEach((b) => {
      b.addEventListener('click', () => {
        const sel = cont.querySelector('#h-carta');
        if (sel && sel.value) {
          M.bloquear(m, rival, sel.value, Number(b.dataset.bloquear), 'efecto manual');
        }
      });
    });
    cont.querySelector('[data-ocultar]').addEventListener('click', () => {
      const sel = cont.querySelector('#h-ocultar');
      if (sel && sel.value) M.ocultar(m, rival, sel.value, 'efecto manual');
    });
    cont.querySelector('[data-negar]').addEventListener('click', () => {
      M.negarAcciones(m, 'manual');
    });
  },

  /* ------------------------- Combate en dos pasos ------------------------ */

  /** Paso 1: eliges quién golpea y a quién, y declaras. */
  cuerpoDeclararAtaque(humano, rival) {
    const m = this.motor;
    const listos = m.atacantesDisponibles(humano);

    if (!listos.length) {
      return `<p class="nota">${
        humano.activos.length
          ? 'Ninguno de tus personajes puede atacar ya este turno.'
          : 'No tienes personajes en posición.'
      }</p>`;
    }

    const nombre = (i) => window.Game.CHARACTERS_BY_ID[i.personaje].nombre;

    const atacantes = listos
      .map(
        (i) =>
          `<option value="${i.uid}">${nombre(i)} · ⚔ ${window.Game.Combat.ataqueEfectivo(
            i
          )}</option>`
      )
      .join('');

    const objetivos = rival.activos.length
      ? rival.activos
          .map((i) => {
            const postura = window.Game.Combat.postura(i);
            const valor =
              postura === 'ofensiva'
                ? `⚔ ${window.Game.Combat.ataqueEfectivo(i)}`
                : postura === 'defensiva'
                  ? `🛡 ${window.Game.Combat.defensaEfectiva(i)}`
                  : 'neutral';
            // Un Eternal con esbirros vivos no es alcanzable: al declarar se
            // interpone uno de ellos. Se avisa aquí para que el cambio de
            // objetivo no parezca un fallo del juego.
            const cubierto = m.eternalProtegido(rival, i);
            return `<option value="${i.uid}">${nombre(i)} · ${valor}${
              cubierto ? ' — cubierto por sus esbirros' : ''
            }</option>`;
          })
          .join('')
      : '<option value="">Campo vacío — daño directo</option>';

    return `
      <div class="controles-titulo">
        Declara un ataque
        ${listos.length > 1 ? `<span class="controles-pista">${listos.length} listos</span>` : ''}
      </div>
      <div class="ataque-selectores">
        <label>Atacante <select id="sel-atacante">${atacantes}</select></label>
        <span class="ataque-flecha">→</span>
        <label>Objetivo <select id="sel-objetivo">${objetivos}</select></label>
        <button class="btn-primario" id="btn-declarar">Declarar</button>
      </div>`;
  },

  /**
   * Paso 2: el ataque está declarado pero sin resolver. Aquí se ve la
   * previsión en vivo, que cambia según apliques efectos desde Herramientas.
   */
  /**
   * Qué activó la IA para ESTE ataque, si activó algo. Vive en la ventana de
   * «ataque pendiente» —siempre visible mientras hay un ataque sin resolver—
   * a propósito: es lo único de la mesa que no desaparece detrás de otra
   * pestaña justo cuando declaran un ataque, así que es el único sitio donde
   * un dado que cayó en «sin bonus» se distingue de una carta que no hizo
   * nada. Lee `motor.ultimosEfectosIA.combate`, que pone `AccionesIA.aplicar()`.
   */
  efectoIAParaEsteAtaque(imp) {
    const m = this.motor;
    const e = (m.ultimosEfectosIA || {}).combate;
    if (!e || e.turno !== m.numeroTurno) return '';
    const implicado = [imp.atacante, imp.defensor]
      .filter(Boolean)
      .some((i) => i.uid === e.uid);
    if (!implicado) return '';

    return `
      <div class="ap-efecto-ia">
        <span class="ap-efecto-ia-titulo">✦ ${e.nombre} (IA)</span>
        ${this.lineasDeEfecto(e).map((l) => `<span>${l}</span>`).join('')}
      </div>
    `;
  },

  /**
   * Lo que la IA acaba de activar al ACOPLAR una carta.
   *
   * Va en la banda central porque ahí el jugador ya está mirando —es donde se
   * mueven los puntos P·A·C·F durante el turno del rival— y porque ese hueco
   * está vacío justo entonces: `veredicto()` solo pinta en TU fase de ataque,
   * así que los dos nunca compiten por el sitio. Además ya está en la rejilla,
   * de modo que no le quita altura al tablero como haría una fila nueva.
   *
   * Sin modal ni clic, a diferencia del aviso del jefe: aquello ocurre una vez
   * por turno suyo y es gordo; esto puede pasar en cada turno, y obligar a
   * confirmar sería insufrible.
   *
   * En el calabozo la única carta que llega aquí es Ruego. Las que de verdad
   * desconciertan —Captura, que te arrastra un personaje a posición— solo
   * salen en modo solo, porque no están en `ACCIONES_CALABOZO`.
   */
  avisoEfectoEquipado() {
    const m = this.motor;
    if (m.terminada || !m.jugadorActivo.esIA) return '';
    const e = (m.ultimosEfectosIA || {}).equipar;
    // El turno acota la vigencia sola: `numeroTurno` sube en cada turno de
    // cada bando, así que al pasar a tu turno el aviso se apaga sin borrarlo.
    if (!e || e.turno !== m.numeroTurno) return '';

    return `
      <div class="veredicto-efecto-ia">
        <span class="vei-titulo">✦ ${e.nombre}</span>
        ${this.lineasDeEfecto(e).map((l) => `<span>${l}</span>`).join('')}
      </div>
    `;
  },

  /**
   * Las líneas que escribió el efecto, aseadas para leerlas fuera del
   * registro: sin sus flechas y sin el «(Carta (IA))» con el que cada línea se
   * identifica allí. En el registro eso hace falta, porque van sueltas entre
   * las demás; aquí ya lo dice el título, y además duplica el paréntesis.
   */
  lineasDeEfecto(e) {
    return e.lineas
      .map((l) => l.replace(/^\s*[↳↪⚙]\s*/, '').trim())
      .map((l) => l.replace(/\s*\([^()]*\(IA\)\)/g, '').trim())
      .filter(Boolean);
  },

  cuerpoAtaquePendiente() {
    const m = this.motor;
    const imp = m.implicadosAtaque();
    const prev = m.previsionAtaque();
    if (!imp || !prev) return '<p class="nota">Ataque inválido.</p>';

    const nombre = (i) => window.Game.CHARACTERS_BY_ID[i.personaje].nombre;

    // El mismo resultado se lee al revés según ataques o te ataquen.
    const defiendo = m.jugadorActivo !== m.jugadores[0];
    const veredicto = defiendo
      ? {
          choque_ganado: ['mal', 'Pierdes al defensor y te pasan daño'],
          defensa_rota: ['mal', 'Rompen tu defensa: pierdes al defensor'],
          atraviesa: ['mal', 'El golpe te atraviesa: todo a tu sangre'],
          directo: ['mal', 'Daño directo a tu sangre'],
          // Te atacan y tu escudo aguanta: el reflejo sangra a QUIEN ATACÓ.
          escudo_refleja: ['bien', 'Tu escudo aguanta y le devuelve el golpe'],
          fallido: ['bien', 'Aguantas: su ataque falla'],
          sin_ataque: ['bien', 'No tiene ataque activado']
        }[prev.resultado] || ['duda', prev.resultado]
      : {
          choque_ganado: ['bien', 'Destruyes al defensor y pasas daño'],
          defensa_rota: ['bien', 'Destruyes al defensor, sin daño a la sangre'],
          atraviesa: ['bien', 'El golpe lo atraviesa: todo a la sangre'],
          directo: ['bien', 'Daño directo a la sangre'],
          escudo_refleja: ['mal', 'Su escudo te supera: te devuelve el golpe'],
          fallido: ['mal', 'Ataque fallido: nadie muere'],
          sin_ataque: ['mal', 'Sin ataque activado']
        }[prev.resultado] || ['duda', prev.resultado];

    // El rótulo va DENTRO del bloque, no en una `.controles-titulo` propia:
    // esa fila suelta costaba ~23 px de pie, que salen del tablero y lo
    // obligaban a desplazarse justo cuando más falta hace verlo entero. La
    // pista de «puedes responder» se cayó a propósito por redundante: cuando
    // hay algo que aplicar, la tira de abajo ya se titula «Puedes responder
    // con»; y cuando no lo hay, no había nada que anunciar.
    return `
      <div class="ataque-pendiente">
        <span class="ap-rotulo">
          ${defiendo ? 'Te atacan' : 'Ataque declarado'}
          <em>sin resolver</em>
        </span>
        <div class="ap-lado">
          <strong>${nombre(imp.atacante)}</strong>
          <span class="ap-valor atk">⚔ ${prev.atacanteValor}</span>
        </div>
        <span class="ataque-flecha">vs</span>
        <div class="ap-lado">
          <strong>${imp.defensor ? nombre(imp.defensor) : 'Sangre rival'}</strong>
          <span class="ap-valor def">${
            imp.defensor ? prev.defensorValor : '—'
          }</span>
        </div>
        <div class="ap-veredicto ${veredicto[0]}">
          ${veredicto[1]}
          ${prev.danoSangre > 0 ? `<span class="ap-dano">${prev.danoSangre} de daño</span>` : ''}
          ${
            // El reflejo se marca aparte y con su etiqueta: va contra el
            // atacante, al revés que el resto del daño, y confundirlos sería
            // leer el combate del lado equivocado.
            prev.danoReflejado > 0
              ? `<span class="ap-dano es-reflejo">${prev.danoReflejado} reflejado al atacante</span>`
              : ''
          }
        </div>
        ${this.efectoIAParaEsteAtaque(imp)}
        ${this.bloqueRespuesta(defiendo)}
        <div class="ap-botones">
          <button class="btn-primario" id="btn-resolver">
            ${defiendo ? 'Encajar el golpe' : 'Resolver'}
          </button>
          ${
            // Solo puedes retirar TU propio ataque, no el del rival.
            defiendo
              ? ''
              : '<button class="btn-secundario" id="btn-cancelar-ataque">Retirar</button>'
          }
        </div>
      </div>`;
  },

  /**
   * Lo que puedes aplicar sin salir de la ventana del ataque.
   *
   * Antes esto solo vivía en la pestaña de Recordatorios y el rótulo te
   * mandaba «a Herramientas», que además está oculta detrás de otra pestaña:
   * defenderse exigía adivinar dónde mirar mientras un golpe esperaba sin
   * resolverse. Aquí van el texto impreso y el atajo al panel.
   */
  bloqueRespuesta(defiendo) {
    const lista = this.recordatorios || [];
    if (!lista.length) return '';

    return `
      <div class="ap-respuesta">
        <span class="ap-respuesta-titulo">
          ${defiendo ? 'Puedes responder con' : 'Por aplicar'}
        </span>
        ${lista
          .map(
            (r) => `
          <span class="ap-respuesta-carta" title="${r.texto.replace(/"/g, '&quot;')}">
            <strong>${r.nombre}</strong>
            <span class="recordatorio-timing">${r.timing}</span>
            <button class="recordatorio-hecho" type="button" data-clave="${r.clave}">
              ya está
            </button>
          </span>`
          )
          .join('')}
        <button class="ap-abrir-herramientas" type="button" id="btn-abrir-herramientas">
          Herramientas →
        </button>
      </div>`;
  },

  /**
   * Al declararse un ataque contra ti, saca la pestaña de Recordatorios sin
   * que tengas que buscarla: ahí está el texto impreso entero, que en la tira
   * del pie no cabe. Una sola vez por ataque —con la firma del pendiente—,
   * porque `pintar()` corre en cada cambio y si no te robaría la pestaña cada
   * vez que tocas una herramienta.
   */
  abrirRecordatoriosSiTeAtacan() {
    const m = this.motor;
    if (!m.ataquePendiente || !m.jugadorActivo.esIA) {
      this.ataqueAnunciado = null;
      return;
    }
    // La tira de respuesta engorda el pie y el tablero se queda sin sitio, así
    // que se asoma a TU lado: eres quien decide, y decides mirando a tu
    // defensor. Se reaplica en cada `pintar()` a propósito: rehacer el HTML de
    // los paneles devuelve el scroll a cero, así que hacerlo una sola vez al
    // declararse el ataque no aguanta el primer repintado.
    const tablero = this.contenedor.querySelector('.mesa-tablero');
    if (tablero) tablero.scrollTop = tablero.scrollHeight;

    // La pestaña, en cambio, solo una vez por ataque: si no, te la robaría
    // cada vez que tocas una herramienta.
    const firma = `${m.numeroTurno}:${m.ataquePendiente.atacanteUid}`;
    if (this.ataqueAnunciado === firma) return;
    this.ataqueAnunciado = firma;
    if (!(this.recordatorios || []).length) return;
    this.contenedor.querySelector('[data-panel="recordatorios"]')?.click();
  },

  /** Conecta los botones del bloque de respuesta, en cualquiera de sus sitios. */
  conectarRespuesta(cont) {
    cont.querySelectorAll('.recordatorio-hecho').forEach((btn) => {
      btn.addEventListener('click', () => {
        window.Game.Recordatorios.descartar(btn.dataset.clave);
        this.pintar();
      });
    });
    cont.querySelector('#btn-abrir-herramientas')?.addEventListener('click', () => {
      this.contenedor.querySelector('[data-panel="herramientas"]')?.click();
    });
  },

  /* ---------------------------- Controles ------------------------------ */

  pintarControles() {
    const m = this.motor;
    const cont = this.contenedor.querySelector('#mesa-controles');
    const humano = m.jugadores[0];

    if (m.terminada) {
      cont.innerHTML = '';
      return;
    }

    if (m.jugadorActivo !== humano) {
      // Te está atacando: puedes defenderte antes de que se resuelva.
      if (m.ataquePendiente) {
        cont.innerHTML = `<div class="controles-cuerpo">${this.cuerpoAtaquePendiente()}</div>`;
        cont.querySelector('#btn-resolver')?.addEventListener('click', () => {
          m.resolverAtaque();
        });
        this.conectarRespuesta(cont);
        return;
      }
      cont.innerHTML = '<p class="nota">Turno del rival…</p>';
      return;
    }

    let cuerpo = '';

    if (m.fase === 'personaje') {
      // Sin atributo `disabled`: así las cartas inasequibles siguen
      // respondiendo al hover y pueden verse en la lupa.
      const opciones = humano.reserva
        .map((i) => {
          const p = window.Game.CHARACTERS_BY_ID[i.personaje];
          const puede = m.puedeDesplegar(humano, i);
          return `
            <button class="opcion-carta ${puede ? '' : 'inasequible'}"
                    data-uid="${i.uid}"
                    data-lupa="${p.imagen}" data-lupa-nombre="${p.nombre}"
                    title="${
                      puede
                        ? p.nombre
                        : `${p.nombre} — necesitas ${p.coste} sangres derramadas`
                    }">
              <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
              <span class="opcion-coste">${p.coste}</span>
              <span class="opcion-stats">⚔${p.ataque} 🛡${p.defensa}</span>
            </button>`;
        })
        .join('');
      // Con alguien ya en posición, su efecto de «En posición» toca aplicarlo
      // ahora desde Herramientas: el motor no lo ejecuta por su cuenta.
      cuerpo = `
        <div class="controles-titulo">
          Pon o cambia tu personaje activo
          <span class="controles-pista">energía disponible: ${m.energiaDe(humano)}</span>
          ${
            humano.activos.length
              ? '<span class="controles-pista">activa efectos y resuelve</span>'
              : ''
          }
        </div>
        <div class="controles-opciones">${opciones || '<p class="nota">Sin reservas.</p>'}</div>`;
    } else if (m.fase === 'accion') {
      if (!humano.activos.length) {
        cuerpo = '<p class="nota">Necesitas un personaje activo para acoplar una acción.</p>';
      } else {
        const opciones = m
          .accionesDisponibles(humano)
          .map((id) => window.Game.ACTIONS_BY_ID[id])
          .map((a) => {
            const inerte = a.razaRequerida && a.razaRequerida !== humano.raza;
            return `
            <button class="opcion-carta accion tipo-${a.tipo} ${inerte ? 'inerte' : ''}"
                    data-accion="${a.id}"
                    data-lupa="${a.imagen}" data-lupa-nombre="${a.nombre}"
                    title="${a.nombre}${inerte ? ' — exige otra raza' : ''}">
              <img src="${a.imagen}" alt="${a.nombre}" loading="lazy">
              <span class="opcion-tipo tipo-${a.tipo}">${a.tipo[0].toUpperCase()}</span>
            </button>`;
          })
          .join('');
        // Igual que arriba: con una acción ya acoplada, su efecto impreso
        // espera a que lo apliques tú.
        const yaAcoplada = humano.activos.some((i) => i.accion);
        cuerpo = `
          <div class="controles-titulo">
            Acopla una acción
            ${
              yaAcoplada
                ? '<span class="controles-pista">activa efectos y resuelve</span>'
                : ''
            }
          </div>
          <div class="controles-opciones">${opciones}</div>`;
      }
    } else if (m.fase === 'ataque') {
      cuerpo = m.ataquePendiente
        ? this.cuerpoAtaquePendiente()
        : this.cuerpoDeclararAtaque(humano, m.jugadores[1]);
    } else {
      cuerpo = '<p class="nota">Al cerrar el turno, ambos derramáis 1 sangre.</p>';
    }

    const etiquetaAvance =
      m.fase === 'fin' ? 'Finalizar turno' : 'Siguiente fase →';
    // Con un ataque declarado no se avanza: primero resuélvelo o retíralo.
    const avanceBloqueado = !!m.ataquePendiente;

    cont.innerHTML = `
      <div class="controles-cuerpo">${cuerpo}</div>
      <button class="btn-primario" id="btn-avanzar" ${
        avanceBloqueado ? 'disabled title="Resuelve o retira el ataque declarado"' : ''
      }>${etiquetaAvance}</button>
    `;

    cont.querySelectorAll('[data-uid]').forEach((el) => {
      el.addEventListener('click', () => {
        if (el.classList.contains('inasequible')) return;
        m.desplegar(el.dataset.uid);
      });
    });
    cont.querySelectorAll('[data-accion]').forEach((el) => {
      el.addEventListener('click', () => m.equipar(el.dataset.accion));
    });
    cont.querySelector('#btn-declarar')?.addEventListener('click', () => {
      const a = cont.querySelector('#sel-atacante')?.value || null;
      const d = cont.querySelector('#sel-objetivo')?.value || null;
      m.declararAtaque(a, d || null);
    });
    cont.querySelector('#btn-resolver')?.addEventListener('click', () => {
      m.resolverAtaque();
    });
    cont.querySelector('#btn-cancelar-ataque')?.addEventListener('click', () => {
      m.cancelarAtaque();
    });
    cont.querySelector('#btn-avanzar').addEventListener('click', () => {
      m.siguienteFase();
    });
    this.conectarRespuesta(cont);
  },

  /** Cuenta la partida y, si era un capítulo ganado, desbloquea el siguiente. */
  registrarResultado(gano) {
    if (this.resultadoRegistrado) return;
    this.resultadoRegistrado = true;

    const perfil = window.Game.State.perfil;
    perfil.partidasJugadas++;

    if (gano && this.params.modo === 'historia' && this.params.etapa) {
      window.Game.State.marcarProgreso(this.params.raza, this.params.etapa);

      // Derribar al Eternal deja su gema. Se guarda si era nueva, para poder
      // enseñar el mensaje solo la primera vez: repetir la etapa no vuelve a
      // «dar» algo que ya tienes.
      if (this.etapa && this.etapa.esJefe) {
        this.gemaNueva = window.Game.State.otorgarGema(this.params.raza);
      }
    } else {
      window.Game.State.guardar();
    }
  },

  /** Explica en una frase cómo se decidió el duelo. */
  textoMotivo(gano) {
    const m = this.motor;
    const quien = m.perdedor ? m.perdedor.nombre : 'El perdedor';

    if (m.motivoFin === 'personajes') {
      return gano
        ? `No le queda ni un personaje en pie: ${quien} cae con toda su ` +
          `formación en el Hades.`
        : `Te quedaste sin personajes en pie. Los del Hades no cuentan ` +
          `mientras nada los devuelva.`;
    }
    return gano
      ? `${quien} derramó sus 30 sangres.`
      : `Derramaste tus 30 sangres.`;
  },

  /**
   * La gema del Eternal caído. No es una recompensa jugable —no se equipa ni
   * se usa—, así que va aparte del bloque de recompensas: es constancia.
   *
   * Se pinta también al repetir la etapa, pero cambiando el tono: la primera
   * vez la consigues, las siguientes solo se te recuerda que ya la tienes.
   */
  bloqueGema(gano) {
    if (!gano || !this.etapa || !this.etapa.esJefe) return '';
    const gema = window.Game.gemaDe(this.params.raza);
    if (!gema) return '';

    const S = window.Game.State;
    const tengo = S.gemas().length;
    const total = window.Game.gemasTotales().length;
    const nueva = this.gemaNueva;

    return `
      <div class="fin-gema ${nueva ? 'nueva' : ''}">
        <span class="fin-gema-sigil">${gema.sigil}</span>
        <div class="fin-gema-cuerpo">
          <strong>${nueva ? gema.nombre : `${gema.nombre} · ya en tu poder`}</strong>
          <p>${gema.mensaje}</p>
          <p class="nota">
            ${tengo} de ${total} cristales.
            ${
              S.historiaFinalDesbloqueada()
                ? 'Están los cuatro: la historia final ya no está cerrada.'
                : 'No se usa para nada todavía: es constancia de que cayó.'
            }
          </p>
        </div>
      </div>`;
  },

  pintarFin() {
    const m = this.motor;
    const gano = m.ganador === m.jugadores[0];
    this.registrarResultado(gano);

    // La cinemática de la etapa superada va ANTES del cartel de Victoria: se
    // lee el desenlace y luego se ve la recompensa. `pintar()` corre en cada
    // cambio de estado, así que hace falta la bandera para no relanzarla; y al
    // volver hay que comprobar el contenedor, porque el jugador puede haber
    // abandonado durante el fundido.
    const cine = gano && this.etapa ? this.etapa.cineVictoria : null;
    if (cine && !this.cineFinLanzada) {
      this.cineFinLanzada = true;
      window.Game.Cinematica.mostrar(cine.texto, cine.segundos).then(() => {
        if (this.contenedor && this.motor) this.pintarFin();
      });
      return;
    }

    const el = this.contenedor.querySelector('#mesa-fin');
    el.classList.remove('oculto');
    // Al superar una etapa del calabozo se muestra la recompensa narrada.
    const recompensa =
      gano && this.etapa && this.etapa.recompensa
        ? (() => {
            // Una recompensa puede traer personaje, acción o solo una de las
            // dos: la etapa 2 del Oasis no da personaje, porque los espíritus
            // acompañantes ya vienen en el equipo desde la primera.
            const r = this.etapa.recompensa;
            const p = r.personaje ? window.Game.CHARACTERS_BY_ID[r.personaje] : null;
            const a = r.accion ? window.Game.ACTIONS_BY_ID[r.accion] : null;
            const cartas = [p, a].filter(Boolean);
            const nombres = [];
            if (p) nombres.push(p.nombre);
            if (a) nombres.push(`«${a.nombre}»`);
            return `
              <p class="fin-narracion">${this.etapa.textoRecompensa}</p>
              <div class="fin-recompensa">
                ${cartas
                  .map(
                    (c) => `
                  <div class="mini-carta" title="${c.nombre}">
                    <img src="${c.imagen}" alt="${c.nombre}">
                  </div>`
                  )
                  .join('')}
              </div>
              <p class="nota">
                ${nombres.length > 1 ? 'Se unen' : 'Se une'} a tu banda:
                ${nombres.join(' y ')}.
              </p>`;
          })()
        : '';

    const volverA = this.params.modo === 'historia' ? 'historia' : 'mainMenu';

    el.innerHTML = `
      <div class="fin-caja">
        ${this.bloqueGema(gano)}
        <h2 class="${gano ? 'fin-victoria' : 'fin-derrota'}">
          ${gano ? 'Victoria' : 'Derrota'}
        </h2>
        <p class="fin-motivo">${this.textoMotivo(gano)}</p>
        ${recompensa}
        <button class="btn-primario" id="btn-fin-menu">
          ${volverA === 'historia' ? 'Seguir la historia' : 'Volver al menú'}
        </button>
      </div>
    `;
    el.querySelector('#btn-fin-menu').addEventListener('click', () => {
      window.Game.Router.ir(volverA, { raza: this.params.raza });
    });
  },

  destruir() {
    clearTimeout(this.temporizador);
    window.Game.Tutorial.alCerrar = null;
    window.Game.Tutorial.limpiar();
    // La burbuja cuelga de `body`, así que vaciar el contenedor no se la lleva.
    this.limpiarBurbujaRecordatorio();
    window.Game.Audio.quitarMusica();
    this.iaEnCurso = false;
    this.recordatorios = [];
    this.motor = null;
    this.contenedor = null;
  }
};
