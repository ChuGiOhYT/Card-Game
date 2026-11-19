window.Game = window.Game || {};
window.Game.Screens = window.Game.Screens || {};

/**
 * Mesa de duelo. Tú eres `jugadores[this.yoIdx]` (`this.tu()`): 0 contra la
 * IA, en el calabozo y como anfitrión de un duelo remoto; 1 como invitado,
 * que juega con el motor espejo de core/dueloRed.js. El rival es `this.suyo()`.
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
    this.condicionAvisada = false;
    this.recordatorios = [];
    this.uidsRecordados = new Set();
    this.eco = null;
    this.anunciosVistos = 0;
    this.vivas = [];
    this.limpiarBurbujaRecordatorio();
    // Duelo remoto (core/dueloRed.js): el anfitrión corre el motor de verdad y
    // el invitado juega con un espejo. Tú eres el 0 o el 1.
    this.remoto = params.modo === 'remoto' ? params : null;
    this.yoIdx = this.remoto && this.remoto.rol === 'invitado' ? 1 : 0;
    this.eleccionEnviada = null;
    this.desconexion = false;
    this.mantenerRed = false;
    // Revancha: quién la ha pedido ya, y si el rival se fue de la sala.
    this.revancha = { yo: false, rival: false, fuera: false };

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
        { maxActivos: 1, ordenFijo: true, sangre: etapa.sangre }
      );
      this.etapa = etapa;
    } else if (this.remoto) {
      // Los equipos los acordó la sala (screens/remoto.js). El invitado no
      // crea jugadores: los recibe en la foto del anfitrión.
      if (this.remoto.rol === 'anfitrion') {
        const p = this.remoto;
        jugador = window.Game.crearJugador(p.nombre, p.raza, p.equipo.personajes, p.equipo.acciones);
        rival = window.Game.crearJugador(p.nombreRival, p.razaRival, p.equipoRival.personajes, p.equipoRival.acciones);
      }
      this.etapa = null;
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
          <button class="btn-salir-mesa" id="btn-salir-partida"
                  title="Abandonar" aria-label="Abandonar">
            <span class="bsm-ico" aria-hidden="true">←</span><span class="bsm-txt">Abandonar</span>
          </button>
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
          <!-- El plano de la mesa, inclinado: se ve en diagonal, con el lado
               rival al fondo. Los retratos van DENTRO para compartir el mismo
               contexto de apilado que las cartas: fuera, la inclinación
               dejaría los atajos de la carta (z-index 8) debajo de ellos. -->
          <!-- La mano del rival, oculta: sus reversos dicen cuántos personajes
               le esperan y cuántas acciones tiene libres, sin decir cuáles.
               Espejo de la tuya: personajes a la izquierda, acciones a la
               derecha y su placa en medio. -->
          <div class="mesa-manos mesa-manos-rival">
            <div class="mano mano-rival">
              <span class="mano-titulo" id="titulo-rival-personajes">Personajes</span>
              <div class="mano-cartas" id="mano-rival-personajes"></div>
            </div>
            <div class="placa-slot" id="placa-rival"></div>
            <div class="mano mano-rival mano-acciones">
              <span class="mano-titulo" id="titulo-rival-acciones">Acciones</span>
              <div class="mano-cartas" id="mano-rival-acciones"></div>
            </div>
          </div>
          <div class="mesa-plano" style="${this.estiloTapete(razaJugador)}">
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
            <div class="mesa-atacar" id="mesa-atacar"></div>
            <div class="mesa-dado">
              <button type="button" id="btn-dado" class="mesa-dado-btn"
                      title="Tirar un d6" aria-label="Tirar un dado de seis caras">
                <span class="dado" id="mesa-dado-cara" data-v="6"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
              </button>
            </div>
            <div class="mesa-avanzar" id="mesa-avanzar"></div>
          </div>
          <div id="panel-jugador"></div>

          <!-- Retratos flotantes de quien está en posición. Capa aparte y
               decorativa: se pinta por separado de los paneles para que el
               repintado de cada cambio de estado no reinicie la flotación. -->
          <div class="mesa-flotantes" id="mesa-flotantes" aria-hidden="true">
            <div class="flotantes-lado rival" data-lado="rival"></div>
            <div class="flotantes-lado jugador" data-lado="jugador"></div>
          </div>
          </div>

          <!-- Tu mano, bajo la mesa y sin inclinar: personajes a la izquierda,
               acciones a la derecha, siempre a la vista. Se pulsan en su fase. -->
          <div class="mesa-manos">
            <div class="mano mano-personajes">
              <span class="mano-titulo">Personajes</span>
              <div class="mano-cartas" id="mesa-controles"></div>
            </div>
            <div class="placa-slot" id="placa-jugador"></div>
            <div class="mano mano-acciones">
              <span class="mano-titulo">Acciones</span>
              <div class="mano-cartas" id="mano-acciones"></div>
            </div>
          </div>

          <div class="aviso-jefe oculto" id="aviso-jefe"></div>
          <!-- Cuando una carta tuya da a elegir: el turno espera tu respuesta. -->
          <div class="eleccion oculto" id="eleccion" role="dialog" aria-live="polite"></div>
          <!-- Aviso de cambio de turno. En el esqueleto, que pintar() no
               reescribe: si viviera en los paneles, el primer repintado lo
               cortaría a medio mostrar. -->
          <div class="aviso-turno" id="aviso-turno" aria-live="polite"></div>
        </div>

        <aside class="mesa-lateral">
          <div class="lupa" id="lupa">
            <div class="lupa-vacia">Pasa el ratón por una carta para verla</div>
          </div>
          <div class="lateral-pestanas">
            <button class="pestana activa" data-panel="registro-lista" title="Registro">
              <span class="pestana-ico" aria-hidden="true">📜</span><span class="pestana-txt">Registro</span>
            </button>
            ${this.remoto ? '' : `<button class="pestana" data-panel="herramientas" title="Herramientas">
              <span class="pestana-ico" aria-hidden="true">🛠</span><span class="pestana-txt">Herramientas</span>
            </button>`}
            <button class="pestana" data-panel="recordatorios" id="pestana-recordatorios" title="Recordatorios">
              <span class="pestana-ico" aria-hidden="true">⚡</span><span class="pestana-txt">Recordatorios</span>
              <span class="pestana-num" hidden></span>
            </button>
          </div>
          <div id="registro-lista" class="lateral-panel"></div>
          <div id="herramientas" class="lateral-panel oculto"></div>
          <div id="recordatorios" class="lateral-panel oculto"></div>
        </aside>

      </div>
      <div class="mesa-fin oculto" id="mesa-fin"></div>
    `;

    // Los personajes hablan en los duelos de campaña (ui/bocadillos.js).
    window.Game.Bocadillos?.iniciar(this, esCalabozo ? { raza: razaJugador, etapa: this.etapa } : null);

    window.Game.Recordatorios.yoIdx = this.remoto ? this.yoIdx : null;
    if (this.remoto && this.remoto.rol === 'invitado') {
      this.motor = window.Game.DueloRed.invitado({ red: window.Game.Red, alCambiar: () => this.pintar() });
    } else {
      this.motor = new window.Game.TurnEngine({
        jugador,
        oponente: rival,
        alCambiar: () => this.pintar()
      });
      if (this.remoto) this.sesionRed = window.Game.DueloRed.anfitrion({ motor: this.motor, red: window.Game.Red });
    }
    // Si se corta, se avisa mientras se reconecta (core/red.js lo intenta
    // solo); si el rival se va o no hay manera, el duelo se interrumpe.
    this.soltarRed = this.remoto
      ? window.Game.Red.on('estado', (estado, detalle) => {
        this.mostrarReconexion(estado === 'reconectando');
        if (estado === 'cerrado' || estado === 'error') this.rivalDesconectado(detalle);
      })
      : null;
    this.soltarMensajesSala = this.remoto
      ? window.Game.Red.on('mensaje', (d) => this.mensajeDeSala(d))
      : null;

    // Abandonar tira el duelo entero y no hay forma de retomarlo, así que
    // pasa por la confirmación genérica. Con el duelo YA terminado no
    // pregunta nada: ahí el botón es solo la puerta de salida y preguntar
    // sería ruido.
    contenedor.querySelector('#btn-salir-partida').addEventListener('click', async () => {
      if (!this.motor.terminada && !this.desconexion) {
        const ok = await window.Game.Confirmar.preguntar({
          titulo: 'Abandonar el duelo',
          texto: this.remoto
            ? 'El duelo termina para los dos y se cierra la sala. No se puede retomar.'
            : this.etapa
            ? `Se pierde lo jugado en «${this.etapa.titulo}» y la etapa se ` +
              'queda sin superar: tendrás que empezarla de nuevo desde el ' +
              'principio. El avance de las etapas anteriores no se toca.'
            : 'Se pierde el duelo en curso. No se puede retomar donde lo dejaste.',
          textoOk: 'Abandonar'
        });
        if (!ok) return;
      }
      // En historia se vuelve al MAPA del calabozo, igual que al terminar la
      // etapa: mandar al menú obligaba a navegar de vuelta para reintentarla.
      if (this.params.modo === 'historia') {
        window.Game.Router.ir('historia', { raza: this.params.raza });
      } else if (this.remoto) {
        window.Game.Red.cerrar();
        window.Game.Router.ir('remoto');
      } else {
        window.Game.Router.ir('mainMenu');
      }
    });

    // Los atajos de la carta van por DELEGACIÓN: `pintar()` rehace los dos
    // paneles enteros en cada cambio de estado, así que un oyente puesto en el
    // botón moriría en el primer repintado. El contenedor sí sobrevive.
    // El botón redondo de cada carta abre y cierra su abanico. Se toca la
    // clase en el DOM que ya está (así la transición se ve) y se recuerda el
    // uid, para que los repintados lo pinten ya abierto.
    contenedor.addEventListener('click', (ev) => {
      const gatillo = ev.target.closest('.ct-gatillo');
      if (!gatillo) return;
      const caja = gatillo.closest('[data-uid-tool]');
      const abrir = this.atajoAbierto !== caja.dataset.uidTool;
      this.cerrarAbanico();
      if (abrir) {
        this.atajoAbierto = caja.dataset.uidTool;
        caja.classList.add('abierto');
        gatillo.setAttribute('aria-expanded', 'true');
      }
    });
    contenedor.addEventListener('pointerdown', (ev) => {
      if (this.atajoAbierto && !ev.target.closest('.campo-atajos')) this.cerrarAbanico();
    });
    contenedor.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && this.atajoAbierto) this.cerrarAbanico();
    });

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
      // En remoto solo ajustas a los tuyos; el invitado se lo pide al anfitrión.
      if (this.remoto && !this.tu().activos.includes(destino)) return;
      const n = Number(btn.dataset.n);
      if (m.esEspejo) {
        if (btn.dataset.tool === 'limpiar') m.intento('limpiarModificadores', destino);
        else m.intento('modificar', destino, btn.dataset.tool === 'atq' ? { ataque: n } : { defensa: n });
        return;
      }
      if (btn.dataset.tool === 'limpiar') {
        M.limpiarModificadores(m, destino, 'manual');
        return;
      }
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
      // En remoto solo mueves tu sangre (en el invitado, el espejo convierte
      // derramar/pagar/recuperar en una intención para el anfitrión).
      if (this.remoto && j !== this.tu()) return;

      // Las mismas llamadas y el mismo motivo que el panel largo. Ninguna de
      // las tres notifica por su cuenta, de ahí el notificar() final; y
      // derramar() puede terminar la partida, así que se comprueba después.
      const op = btn.dataset.sangre;
      if (op === 'derramar') m.derramar(j, 1, 'efecto manual');
      if (op === 'pagar') m.pagar(j, 1, 'efecto manual');
      if (op === 'recuperar') m.recuperar(j, 1, 'efecto manual');
      m.notificar();
    });

    // Avance automático de fases: elegir carta (desplegar o acoplar) vuelve a
    // programar el paso con el retardo corto; tocar CUALQUIER otra cosa de la
    // mesa durante la cuenta atrás la cancela para esta fase (estás haciendo
    // algo: aplicar un efecto, mirar Herramientas…). El botón de avanzar sigue
    // funcionando a mano siempre.
    contenedor.addEventListener('pointerdown', (ev) => {
      if (!this.avance) return;
      if (ev.target.closest('#btn-avanzar, #btn-resolver')) return;
      if (this.avance.atk) {
        this.cancelarAvance();
        this.ataqueManual = true;
        this.pintarBotonResolver();
        return;
      }
      if (ev.target.closest('.opcion-carta')) {
        this.cancelarAvance();
        this.entroListo = false;
        return;
      }
      this.cancelarAvance();
      this.faseManual = true;
      this.pintarBotonAvance();
    }, true);

    contenedor.addEventListener('click', (ev) => {
      if (ev.target.closest('#btn-atacar-mesa')) this.atacarDesdeMesa();
      // Revelar pinchando el reverso en la mano del rival (es la misma
      // respuesta que el botón «… oculta N» de la placa).
      const dorso = ev.target.closest('[data-revelar]');
      const m = this.motor;
      if (dorso && m && m.eleccionPendiente && m.eleccionPendiente.jugadorIdx === this.yoIdx) {
        this.responder(dorso.dataset.revelar);
      }
    });

    // Brillo «foil»: la carta en juego (y la de la lupa) se inclina hacia el
    // cursor y un reflejo la cruza. Delegado, porque pintar() rehace las
    // cartas: si la que tenías debajo se rehízo, el siguiente movimiento
    // engancha a la nueva.
    contenedor.addEventListener('pointermove', (ev) => {
      const carta = ev.target.closest('.campo-par .mini-carta, .lupa img');
      if (carta !== this.foilCarta) this.soltarFoil();
      if (!carta || this.sinMovimiento()) return;
      this.foilCarta = carta;
      const r = carta.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width;
      const y = (ev.clientY - r.top) / r.height;
      carta.classList.add('foil');
      carta.style.setProperty('--rx', `${((x - 0.5) * 18).toFixed(1)}deg`);
      carta.style.setProperty('--ry', `${((0.5 - y) * 18).toFixed(1)}deg`);
      carta.style.setProperty('--mx', `${Math.round(x * 100)}%`);
      carta.style.setProperty('--my', `${Math.round(y * 100)}%`);
    });
    contenedor.addEventListener('pointerleave', () => this.soltarFoil());

    contenedor.querySelector('#btn-dado').addEventListener('click', (ev) => {
      if (!this.motor || this.motor.terminada) return;
      // La tirada ocurre YA, entera: lo que se retrasa es solo enseñarla. Así
      // el registro y el motor nunca dependen de una animación.
      // La tirada la enseña pintar(), que vigila motor.ultimaTirada: así rueda
      // igual la del botón que la de una Finta o la de la IA.
      if (this.motor.esEspejo) this.motor.intento('dado');
      else window.Game.Manual.dado(this.motor, 0, 'tirada manual');
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
    // El invitado no arranca nada: espera la primera foto del anfitrión. En
    // las revanchas abre uno y otro por turnos (`abre`).
    if (!this.motor.esEspejo) {
      if (this.remoto && this.remoto.abre === 1) this.motor.turnoDe = 1;
      // En el calabozo abre la OLEADA (Oscar): con la regla de que quien abre
      // no ataca, abriendo tú la etapa 1 (un solo personaje) la rata te lo
      // mataba antes de poder pegar (34 % de victorias en el Bosque).
      if (this.etapa) this.motor.turnoDe = 1;
      this.motor.iniciar();
    }
  },

  /* ------------------------ Duelo remoto: la sala ------------------------ */

  /** Velo sobre la mesa mientras core/red.js recupera la conexión. */
  mostrarReconexion(si) {
    const tab = this.contenedor && this.contenedor.querySelector('.mesa-tablero');
    if (!tab) return;
    let velo = tab.querySelector('.aviso-red');
    if (!si) { if (velo) velo.remove(); return; }
    if (velo) return;
    velo = document.createElement('div');
    velo.className = 'aviso-red';
    const quien = this.motor && this.motor.jugadores ? this.suyo().nombre : 'tu rival';
    velo.innerHTML = `<div class="aviso-red-caja"><span class="remoto-luz"></span>
      Se cortó la conexión con ${quien}. Reconectando…<small>La partida sigue donde estaba.</small></div>`;
    tab.appendChild(velo);
  },

  /** Revancha, vuelta a la sala y arranque de la revancha (invitado). */
  mensajeDeSala(d) {
    if (!d || !this.motor) return;
    if (d.tipo === 'revancha') {
      this.revancha.rival = true;
      if (this.motor.terminada) this.pintarFin();
      this.revisarRevancha();
    } else if (d.tipo === 'sala') {
      this.mantenerRed = true;
      window.Game.Router.ir('remoto');
    } else if (d.tipo === 'empezar' && this.remoto.rol === 'invitado') {
      this.mantenerRed = true;
      window.Game.Router.ir('partida', { modo: 'remoto', rol: 'invitado', raza: this.remoto.raza });
    }
  },

  pedirRevancha() {
    if (this.revancha.yo || this.revancha.fuera) return;
    this.revancha.yo = true;
    window.Game.Red.enviar({ tipo: 'revancha' });
    this.pintarFin();
    this.revisarRevancha();
  },

  /** Los dos la quieren: el anfitrión arranca otra, abriendo el otro jugador. */
  revisarRevancha() {
    if (!this.revancha.yo || !this.revancha.rival || this.remoto.rol !== 'anfitrion') return;
    window.Game.Red.enviar({ tipo: 'empezar' });
    this.mantenerRed = true;
    window.Game.Router.ir('partida', { ...this.remoto, abre: this.remoto.abre === 1 ? 0 : 1 });
  },

  volverALaSala() {
    window.Game.Red.enviar({ tipo: 'sala' });
    this.mantenerRed = true;
    window.Game.Router.ir('remoto');
  },

  /** El cartel de fin de un duelo remoto: revancha, sala o salir. */
  finRemoto(el, gano) {
    const R = window.Game.Red;
    const rival = this.suyo().nombre;
    const r = this.revancha;
    const estado = r.fuera
      ? `${rival} salió de la sala.`
      : r.yo && !r.rival ? `Esperando a que ${rival} acepte…`
        : !r.yo && r.rival ? `${rival} quiere la revancha.` : '';
    el.innerHTML = `
      <div class="fin-caja">
        <h2 class="${gano ? 'fin-victoria' : 'fin-derrota'}">${gano ? 'Victoria' : 'Derrota'}</h2>
        <div class="fin-motivo">${this.textoMotivo(gano)}</div>
        ${estado ? `<p class="nota fin-revancha-estado">${estado}</p>` : ''}
        <div class="fin-botones">
          <button class="btn-primario" id="btn-revancha" ${r.yo || r.fuera ? 'disabled' : ''}>
            ${r.rival && !r.yo ? 'Aceptar la revancha' : 'Revancha'}</button>
          <button class="btn-secundario" id="btn-a-sala" ${r.fuera ? 'disabled' : ''}>Volver a la sala</button>
          <button class="btn-secundario" id="btn-fin-menu">Salir</button>
        </div>
      </div>`;
    el.querySelector('#btn-revancha').addEventListener('click', () => this.pedirRevancha());
    el.querySelector('#btn-a-sala').addEventListener('click', () => this.volverALaSala());
    el.querySelector('#btn-fin-menu').addEventListener('click', () => {
      R.cerrar();
      window.Game.Router.ir('remoto');
    });
  },

  /** Tú y tu rival en esta mesa (ver la cabecera del archivo). */
  tu() {
    return this.motor.jugadores[this.yoIdx];
  },

  suyo() {
    return this.motor.jugadores[1 - this.yoIdx];
  },

  /**
   * Responder la pregunta de la placa. En el invitado la respuesta viaja al
   * anfitrión y la placa se esconde hasta la foto siguiente: así un doble clic
   * no contesta también la pregunta que venga detrás.
   */
  responder(id) {
    const m = this.motor;
    const e = m.eleccionPendiente;
    if (!e) return;
    if (m.esEspejo) {
      if (this.eleccionEnviada === e.n) return;
      this.eleccionEnviada = e.n;
      this.contenedor.querySelector('#eleccion')?.classList.add('oculto');
    }
    m.resolverEleccion(id);
  },

  /** Se fue el rival o se cortó: el duelo no puede seguir. */
  rivalDesconectado(detalle) {
    if (!this.contenedor || !this.motor) return;
    // Con el duelo ya terminado, solo se apaga la revancha.
    if (this.motor.terminada) {
      this.revancha.fuera = true;
      this.pintarFin();
      return;
    }
    if (this.desconexion) return;
    this.desconexion = true;
    this.cancelarAvance();
    const el = this.contenedor.querySelector('#mesa-fin');
    el.classList.remove('oculto');
    el.innerHTML = `
      <div class="fin-caja">
        <h2 class="fin-derrota">Duelo interrumpido</h2>
        <p class="fin-motivo">${detalle || 'Se perdió la conexión con tu rival.'}</p>
        <button class="btn-primario" id="btn-fin-menu">Volver</button>
      </div>`;
    el.querySelector('#btn-fin-menu').addEventListener('click', () => window.Game.Router.ir('remoto'));
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
    // El invitado no pinta nada hasta la primera foto del anfitrión.
    if (m.esEspejo && !m.listo) return;

    const humano = this.tu(), ia = this.suyo();

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
    // Lo que el juego sabe aplicar se aplica solo, sin preguntar. Aplicar
    // repinta entero, así que este pintado ya no tiene nada que hacer.
    if (this.autoAplicar()) return;
    this.uidsRecordados = window.Game.Recordatorios.uidsConPendientes(this.recordatorios);

    // La barra de sangre se mide ANTES de rehacer los paneles y se anima
    // después desde ese ancho: ver animarBarras().
    const barrasAntes = this.medirBarras();
    c.querySelector('#panel-rival').innerHTML = this.panel(ia, true);
    c.querySelector('#panel-jugador').innerHTML = this.panel(humano, false);
    c.querySelector('#placa-rival').innerHTML = this.placaConSangre(ia, true);
    c.querySelector('#placa-jugador').innerHTML = this.placaConSangre(humano, false);
    this.pintarManoRival();
    this.animarBarras(barrasAntes);
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
    if (!this.remoto) window.Game.Tutorial.revisar(c, m, this.params, this);
    this.mostrarAnuncios();
    this.rodarSiHuboTirada();
    this.pintarEleccion();

    // Al FINAL: la burbuja de recordatorio y el tutorial se crean más arriba
    // en este mismo pintado, y el avance no puede correr con ellos abiertos.
    this.revisarAvanceAutomatico();

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
      // para que puedas defenderte antes de que se aplique. Y si una carta te
      // pide elegir en su turno, también espera.
      if (m.ataquePendiente || m.eleccionPendiente) return;

      this.iaEnCurso = true;
      this.temporizador = setTimeout(() => this.pasoIA(), this.RITMO_IA);
    }
  },

  /** Pausa entre fases del rival, en ms. */
  RITMO_IA: 620,

  /**
   * Avance automático de TUS fases de personaje y de acción. Pasarlas a mano
   * cuando ya no queda nada que hacer en ellas era el clic más repetido del
   * juego. Retardo corto si acabas de jugar (para ver la carta entrar), más
   * largo si la fase empezó ya «hecha» —alguien en posición o acción puesta
   * desde el turno anterior—, por si quieres cambiarlo. El ataque solo pasa
   * solo cuando ya nadie puede atacar: si aún puedes, decides tú. El fin de
   * turno no tiene nada que hacer y se cierra con la misma cuenta atrás.
   */
  AUTO_MS_TRAS_JUGADA: 600,
  AUTO_MS_AL_ENTRAR: 1400,
  /** Personaje, acción y fin: pasan casi al instante (lo justo para ver la carta entrar). */
  AUTO_MS_RAPIDO: 450,

  /**
   * Flujo del turno (Oscar): poner un personaje —o cambiarlo— pasa SOLO a la
   * fase de acción, y acoplar una acción pasa sola al ataque. Si ya había
   * alguien en posición, o la acción venía puesta del turno anterior, no hay
   * cuenta atrás: se confirma con «Mantener …» (el botón de avanzar). La única
   * fase que da tiempo —para tirar dados y aplicar efectos— es la de ataque.
   */
  firmaAcciones(j) {
    return j.activos.map((i) => `${i.uid}:${i.accion || '-'}:${i.tilos ? i.tilos.tipo : '-'}`).join('|');
  },

  /** ¿La fase actual ya no pide nada al jugador? */
  faseCumplida() {
    const m = this.motor;
    const humano = this.tu();
    // Personaje: solo cuando ya desplegaste (uno por turno). Mantener a quien
    // ya estaba se confirma a mano.
    if (m.fase === 'personaje') return !!m.desplegoEsteTurno;
    if (m.fase === 'accion') {
      if (!humano.activos.length) return true;
      const C = window.Game.Combat;
      if (!humano.activos.every((i) => C._accion(i))) return false;
      // Solo si la acción se puso EN esta fase; la que venía puesta se mantiene a mano.
      return this.firmaAccionAlEntrar !== undefined && this.firmaAcciones(humano) !== this.firmaAccionAlEntrar;
    }
    // Ataque: solo cuando ya nadie puede atacar. Si aún puedes, decides tú.
    if (m.fase === 'ataque') return !m.ataquePendiente && !m.atacantesDisponibles(humano).length;
    // Fin de turno: no hay nada que hacer en él.
    if (m.fase === 'fin') return true;
    return false;
  },

  /** Rótulo del botón de avanzar: «Mantener …» cuando confirmar es lo que toca. */
  etiquetaAvanzar() {
    const m = this.motor;
    const humano = this.tu();
    if (m.fase === 'fin') return 'Finalizar turno';
    if (m.fase === 'personaje' && humano.activos.length && !m.desplegoEsteTurno) return 'Mantener posición →';
    if (m.fase === 'accion' && humano.activos.length && humano.activos.every((i) => window.Game.Combat._accion(i))) {
      return 'Mantener acción →';
    }
    return 'Siguiente fase →';
  },

  cancelarAvance() {
    if (this.avance) clearTimeout(this.avance.timer);
    this.avance = null;
  },

  /**
   * Un ataque declarado —tuyo o contra ti— se resuelve solo tras una cuenta
   * atrás corta: la previsión ya está a la vista y los efectos automáticos ya
   * se aplicaron al declararlo. Tocar cualquier cosa de la mesa la detiene y
   * vuelven Resolver/Retirar a mano, como con las fases.
   */
  AUTO_MS_RESOLVER: 1600,

  revisarResolucion() {
    const m = this.motor;
    const atk = m.ataquePendiente;
    if (atk !== this.ataqueVisto) {
      this.ataqueVisto = atk;
      this.ataqueManual = false;
      this.nAtaque = (this.nAtaque || 0) + 1;
      // El golpe recién declarado, tuyo o contra ti, como emergente rojo.
      const texto = atk && this.textoGolpe();
      if (texto) this.emergente(texto, { clase: 'combate' });
    }
    const clave = `atk:${this.nAtaque}`;
    const avisoJefe = this.contenedor.querySelector('#aviso-jefe:not(.oculto)');
    // En remoto lo resuelve solo quien ataca (el que encaja tiene «Encajar»):
    // si no, los dos PC lo mandarían a la vez.
    const puede = !m.terminada && atk && !this.ataqueManual && !m.eleccionPendiente
      && (!this.remoto || m.jugadorActivo === this.tu())
      && !window.Game.Tutorial.activo && !avisoJefe;
    if (!puede) {
      if (this.avance && this.avance.atk) this.cancelarAvance();
      this.pintarBotonResolver();
      return !!atk;
    }
    if (!this.avance || this.avance.clave !== clave) {
      this.cancelarAvance();
      const ms = this.AUTO_MS_RESOLVER;
      this.avance = {
        clave, ms, atk: true, desde: Date.now(),
        timer: setTimeout(() => {
          const sigue = this.avance && this.avance.clave === clave;
          this.avance = null;
          if (sigue && this.motor === m && m.ataquePendiente === atk && !window.Game.Tutorial.activo) {
            m.resolverAtaque();
          } else {
            this.pintarBotonResolver();
          }
        }, ms)
      };
    }
    this.pintarBotonResolver();
    return true;
  },

  pintarBotonResolver() {
    const btn = this.contenedor && this.contenedor.querySelector('#btn-resolver');
    if (!btn) return;
    const a = this.avance && this.avance.atk ? this.avance : null;
    btn.classList.toggle('auto', !!a);
    if (a) {
      const defiendo = this.motor.jugadorActivo !== this.tu();
      btn.textContent = defiendo ? 'Encajando…' : 'Resolviendo…';
      btn.style.setProperty('--auto-ms', `${a.ms}ms`);
      btn.style.setProperty('--auto-desde', `-${Date.now() - a.desde}ms`);
    } else {
      btn.textContent = btn.dataset.etiqueta || 'Resolver';
    }
  },

  revisarAvanceAutomatico() {
    const m = this.motor;
    if (!m) return;
    // A media aplicación de un efecto (su dado repinta) el golpe aún no lleva
    // el bonus: se espera al pintado de después para no anunciarlo a medias.
    if (this.aplicando) return;
    // Con una elección pendiente no corre ninguna cuenta atrás: espera.
    if (m.eleccionPendiente) {
      this.cancelarAvance();
      this.pintarBotonAvance();
      this.pintarBotonResolver();
      return;
    }
    // Con un ataque en el aire manda su resolución, no el paso de fase.
    if (this.revisarResolucion()) return;
    const humano = this.tu();
    const clave = `${m.numeroTurno}:${m.fase}`;
    if (this.claveFase !== clave) {
      this.claveFase = clave;
      this.faseManual = false;
      this.cancelarAvance();
      this.firmaAccionAlEntrar = m.fase === 'accion' ? this.firmaAcciones(humano) : undefined;
      this.entroListo = this.faseCumplida();
    }
    const avisoJefe = this.contenedor.querySelector('#aviso-jefe:not(.oculto)');
    const puede = !m.terminada
      && m.jugadorActivo === humano
      && !m.ataquePendiente
      && !this.faseManual
      && !window.Game.Tutorial.activo
      && !this.burbujaViva
      && !avisoJefe
      && this.faseCumplida();
    if (!puede) {
      this.cancelarAvance();
      this.pintarBotonAvance();
      return;
    }
    if (!this.avance || this.avance.clave !== clave) {
      const ms = m.fase !== 'ataque' ? this.AUTO_MS_RAPIDO
        : this.entroListo ? this.AUTO_MS_AL_ENTRAR : this.AUTO_MS_TRAS_JUGADA;
      this.avance = {
        clave, ms, desde: Date.now(),
        timer: setTimeout(() => {
          const sigue = this.avance && this.avance.clave === clave;
          this.avance = null;
          this.pintarBotonAvance();
          // Se vuelve a mirar al disparar: puede haber salido una burbuja o el
          // tutorial durante la cuenta atrás.
          if (sigue && this.motor === m && `${m.numeroTurno}:${m.fase}` === clave && !m.ataquePendiente
              && !window.Game.Tutorial.activo && !this.burbujaViva) {
            m.siguienteFase();
          }
        }, ms)
      };
    }
    this.pintarBotonAvance();
  },

  /**
   * El botón de avanzar enseña la cuenta atrás como una barra que se llena.
   * El HTML se rehace en cada repintado, así que la barra retoma donde iba con
   * un retraso negativo (mismo truco que las animaciones de la mesa).
   */
  pintarBotonAvance() {
    const btn = this.contenedor && this.contenedor.querySelector('#btn-avanzar');
    if (!btn) return;
    const a = this.avance;
    const estaba = btn.classList.contains('auto');
    btn.classList.toggle('auto', !!a);
    if (!a && estaba) btn.textContent = this.etiquetaAvanzar();
    if (a) {
      btn.textContent = {
        personaje: 'Pasando a Acción…',
        accion: 'Pasando a Ataque…',
        ataque: 'Pasando a Fin de turno…',
        fin: 'Cerrando el turno…'
      }[this.motor.fase] || 'Pasando…';
      btn.style.setProperty('--auto-ms', `${a.ms}ms`);
      btn.style.setProperty('--auto-desde', `-${Date.now() - a.desde}ms`);
    }
  },

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
    const cara = this.contenedor.querySelector('#mesa-dado-cara');
    if (!cara || !boton) return;

    // Quien pidió menos movimiento no lo recibe: cambia la cara y ya.
    if (this.sinMovimiento()) {
      cara.dataset.v = resultado;
      return;
    }

    boton.style.setProperty('--dado-giro', `${this.MS_DADO}ms`);
    // Quitar, forzar reflujo y volver a poner: sin esto, una segunda tirada
    // durante la primera no reinicia la animación y el dado se queda quieto
    // aunque el motor sí haya tirado.
    boton.classList.remove('girando', 'dorado');
    void boton.offsetWidth;
    boton.classList.add('girando');

    // Testigo por si llega otra tirada mientras esta rueda: solo pinta la
    // última, y así no se pisan dos resultados en desorden. Mientras rueda,
    // las caras van cambiando al azar.
    const mia = (this.nTirada = (this.nTirada || 0) + 1);
    const baraja = setInterval(() => {
      if (mia !== this.nTirada) return clearInterval(baraja);
      cara.dataset.v = 1 + Math.floor(Math.random() * 6);
    }, 70);
    setTimeout(() => {
      clearInterval(baraja);
      if (mia !== this.nTirada || !this.contenedor) return;
      boton.classList.remove('girando');
      cara.dataset.v = resultado;
      // Destello dorado al caer, que se apaga solo.
      boton.classList.add('dorado');
      setTimeout(() => boton.classList.remove('dorado'), 900);
    }, this.MS_DADO);
  },

  soltarFoil() {
    const c = this.foilCarta;
    this.foilCarta = null;
    if (!c) return;
    c.classList.remove('foil');
    ['--rx', '--ry', '--mx', '--my'].forEach((v) => c.style.removeProperty(v));
  },

  /**
   * La mano oculta del rival: un reverso por cada personaje en su reserva y
   * por cada acción libre. En abanico, colgando hacia la mesa (giro y
   * desplazamiento al revés que en tu mano). El reverso es CSS: fondo oscuro,
   * marco dorado, el círculo de runas y el emblema de su estirpe. El arte
   * oficial (assets/cartas/reverso.webp) queda para las partidas contra
   * jugadores, por decisión de Oscar.
   */
  pintarManoRival() {
    const m = this.motor;
    const ia = this.suyo();
    const r = this.colorLado(ia);
    // Contra una persona, el reverso oficial (Oscar lo reservó para eso);
    // contra la IA y en el calabozo, el dibujado.
    const dorso = this.remoto
      ? `<div class="dorso-carta dorso-oficial" style="--raza-primario:${r.colorPrimario}">
          <img src="assets/cartas/reverso.webp" alt=""></div>`
      : `<div class="dorso-carta" style="--raza-primario:${r.colorPrimario}">
        ${this.RUNAS}<span class="dorso-sigil">${r.sigil}</span>
      </div>`;
    // Lo revelado va boca arriba; y mientras eliges qué revelar (Annia, Thiana,
    // Axel, Erem), los reversos elegibles brillan y se pueden pinchar.
    const e = m.eleccionPendiente;
    const elegibles = new Set(e && e.jugadorIdx === this.yoIdx ? e.opciones.filter((o) => o.revelar).map((o) => o.id) : []);
    const C = window.Game.CHARACTERS_BY_ID, A = window.Game.ACTIONS_BY_ID;
    const carta = (id) => {
      const c = C[id] || A[id];
      if (ia.revelados.has(id) && c) {
        return `<div class="dorso-carta revelada" data-lupa="${c.imagen}" data-lupa-nombre="${c.nombre}" title="${c.nombre}">
            <img src="${c.imagen}" alt="${c.nombre}"></div>`;
      }
      return elegibles.has(id)
        ? dorso.replace('<div class="dorso-carta', `<div data-revelar="${id}" title="Revelar esta carta" class="dorso-carta elegible`)
        : dorso;
    };
    const llenar = (sel, titulo, ids, nombre) => {
      const caja = this.contenedor.querySelector(sel);
      const n = ids.length;
      caja.innerHTML = ids.map(carta).join('');
      this.contenedor.querySelector(titulo).textContent = n ? `${nombre} ${n}` : nombre;
      const cartas = [...caja.children];
      const medio = (cartas.length - 1) / 2;
      cartas.forEach((el, i) => {
        const d = i - medio;
        el.style.setProperty('--giro', `${(-d * 6).toFixed(1)}deg`);
        el.style.setProperty('--alto', `${(-Math.abs(d) * Math.abs(d) * 0.9).toFixed(1)}px`);
        el.style.zIndex = i + 1;
      });
    };
    llenar('#mano-rival-personajes', '#titulo-rival-personajes', ia.reserva.map((i) => i.personaje), 'Personajes');
    llenar('#mano-rival-acciones', '#titulo-rival-acciones', m.accionesDisponibles(ia), 'Acciones');
  },

  /**
   * La elección pendiente de tu lado, como una placa sobre la mesa con una
   * opción por botón. Sin cuenta atrás (Oscar): es tu decisión. Solo se
   * rehace cuando cambia la elección, para que los repintados no la parpadeen.
   */
  pintarEleccion() {
    const el = this.contenedor.querySelector('#eleccion');
    if (!el) return;
    const e = this.motor.eleccionPendiente;
    if (!e || e.jugadorIdx !== this.yoIdx || this.motor.terminada || this.eleccionEnviada === e.n) {
      el.classList.add('oculto');
      if (!e || this.eleccionEnviada !== e.n) this.eleccionVista = null;
      return;
    }
    if (this.eleccionVista === e.n) return;
    this.eleccionVista = e.n;
    el.innerHTML = `
      <div class="eleccion-caja">
        <span class="eleccion-sup">Elige</span>
        <strong class="eleccion-titulo">${e.titulo}</strong>
        <div class="eleccion-opciones">
          ${e.opciones.map((o) => `<button type="button" class="eleccion-op" data-op="${o.id}">${o.texto}</button>`).join('')}
        </div>
      </div>`;
    el.classList.remove('oculto');
    el.querySelectorAll('[data-op]').forEach((b) => {
      b.addEventListener('click', () => this.responder(b.dataset.op));
    });
  },

  /** Pulsaste una carta con una pregunta esperando: la placa se sacude. */
  recordarEleccion() {
    const caja = this.contenedor.querySelector('#eleccion:not(.oculto) .eleccion-caja');
    if (!caja) return;
    caja.classList.remove('sacude');
    void caja.offsetWidth; // reflujo: reinicia la animación
    caja.classList.add('sacude');
    // Dentro de la placa: un emergente de la banda quedaría detrás de ella.
    if (!caja.querySelector('.eleccion-aviso')) {
      caja.insertAdjacentHTML('beforeend', '<span class="eleccion-aviso">Responde primero para seguir jugando</span>');
    }
  },

  /** Los estados con duración de una carta, como pastillas («⛨ 2»). */
  ICONO_ESTADO: { inmune: '⛨', personajeBloqueado: '⛓', sinAtaques: '☮' },

  chipsEstado(inst) {
    const lista = this.motor.estadosDe(inst);
    if (!lista.length) return '';
    return `<span class="estado-chips">${lista
      .map((e) => `<span class="estado-chip" title="${e.motivo}: ${e.turnos} ${e.turnos === 1 ? 'turno' : 'turnos'}">${this.ICONO_ESTADO[e.tipo] || '•'} ${e.turnos}</span>`)
      .join('')}</span>`;
  },

  placaDe(idx) {
    return this.contenedor.querySelector(idx === this.yoIdx ? '#placa-jugador' : '#placa-rival');
  },

  /** El tapete de la mesa: el suelo de la estirpe de quien juega en casa. */
  TAPETES: ['desterrado', 'lunaria', 'oxitron', 'reanimado'],

  estiloTapete(raza) {
    if (!this.TAPETES.includes(raza)) return '';
    // url() en línea y no en una variable CSS: en una variable se resolvería
    // contra la hoja de estilos y no cargaría (ver CLAUDE.md).
    return `background-image:linear-gradient(rgba(0,0,0,.22),rgba(0,0,0,.22)),url('assets/tapetes/${raza}.webp')`;
  },

  /**
   * El círculo de runas donde se pone el personaje en posición. Se dibuja en
   * el plano de la mesa, así que la inclinación lo aplana como un círculo
   * pintado en el suelo. `encendido` cuando a ese lado le toca elegir
   * personaje.
   */
  RUNAS: (() => {
    const glifos = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊ';
    const letras = [...glifos].map((g, i) => {
      const a = (i / glifos.length) * Math.PI * 2;
      const x = (50 + Math.cos(a) * 41).toFixed(1);
      const y = (50 + Math.sin(a) * 41).toFixed(1);
      const giro = ((a * 180) / Math.PI + 90).toFixed(0);
      return `<text x="${x}" y="${y}" transform="rotate(${giro} ${x} ${y})">${g}</text>`;
    }).join('');
    return `<svg class="runas" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" stroke-width="1.1"/>
      <circle cx="50" cy="50" r="34.5" fill="none" stroke="currentColor" stroke-width="0.8" stroke-dasharray="2 2.2"/>
      <g font-size="7" fill="currentColor" text-anchor="middle" dominant-baseline="central">${letras}</g>
    </svg>`;
  })(),

  zonaEncendida(esRival, fase) {
    const m = this.motor;
    const j = m.jugadores[esRival ? 1 : 0];
    return !m.terminada && m.jugadorActivo === j && m.fase === fase;
  },

  /** Si el motor tiró un dado desde el último pintado, lo hace rodar. */
  rodarSiHuboTirada() {
    const t = this.motor.ultimaTirada;
    if (!t || t.n === this.tiradaVista) return;
    this.tiradaVista = t.n;
    this.mostrarTirada(this.contenedor.querySelector('#btn-dado'), t.resultado);
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
    const ia = this.suyo();
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
        <h3>Turno de ${this.suyo().nombre}</h3>
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

    // Se cierra solo cuando ha dado tiempo a leerlo (al ritmo de las
    // cinemáticas, 20 car/s); «Continuar» lo cierra antes. Tocar el aviso
    // (no el botón) lo deja quieto para leer con calma.
    const seguir = el.querySelector('#btn-aviso-seguir');
    const letras = el.querySelector('.aviso-jefe-caja').textContent.replace(/\s+/g, ' ').length;
    const ms = Math.min(12000, Math.max(4000, (letras / 20) * 1000));
    let cerrado = false;
    const continuar = () => {
      if (cerrado) return;
      cerrado = true;
      clearTimeout(this.temporizadorJefe);
      this.avisoResueltoEn = m.numeroTurno;
      el.classList.add('oculto');
      this.pintar();
    };
    seguir.classList.add('auto');
    seguir.style.setProperty('--auto-ms', `${ms}ms`);
    seguir.addEventListener('click', continuar);
    el.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('#btn-aviso-seguir')) return;
      clearTimeout(this.temporizadorJefe);
      seguir.classList.remove('auto');
    });
    clearTimeout(this.temporizadorJefe);
    this.temporizadorJefe = setTimeout(continuar, ms);
  },

  /**
   * La placa del jugador: avatar redondo con marco dorado, el emblema de la
   * estirpe en una pastilla y el nombre. El avatar es quien da la cara: el
   * personaje en posición, o el primero que espera si no hay nadie. Con su
   * retrato flotante (un busto) si lo tiene; si no, el arte de su carta.
   * Brilla en dorado cuando es el turno de ese lado.
   */
  /**
   * La placa con la sangre dentro (Vida · Energía · Fuera, sus flechas y la
   * barra). Va FUERA de la mesa, en el esqueleto: la del rival arriba y la
   * tuya entre tus dos manos. Así los lados de la mesa quedan para el tapete y
   * las cartas. Las mismas clases de siempre (sangre-barra, sm-energia…), así
   * que las flechas, el destello de sangre y el tutorial siguen funcionando.
   */
  placaConSangre(j, esRival) {
    const m = this.motor;
    const r = this.colorLado(j);
    const vida = m.vidaDe(j);
    const energia = m.energiaDe(j);
    const total = j.sangreTotal || window.Game.SANGRE_TOTAL;
    const pct = (n) => `${(n / total) * 100}%`;
    const sangre = `
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

            <!-- Las tres pilas suman siempre lo mismo: la barra lo hace evidente. -->
            <div class="sangre-barra" title="Las tres pilas suman ${total} sangres">
              <div class="seg seg-vida" style="width:${pct(j.sangre.pila)}"></div>
              <div class="seg seg-gasto" style="width:${pct(j.sangre.gasto)}"></div>
              <div class="seg seg-fuera" style="width:${pct(j.sangre.fuera)}"></div>
            </div>

            <div class="sangre-pie">
              <span>de ${total}</span>
              <span class="sangre-zonas">
                <span title="En reserva">👥 ${j.reserva.length}</span>
                <span title="En el Hades">✖ ${j.hades.length}</span>
              </span>
            </div>
          </div>
`;
    return `<div class="placa-marco" style="--raza-primario:${r.colorPrimario};--raza-secundario:${r.colorSecundario}">
      ${this.placa(j, r, esRival, sangre)}
    </div>`;
  },

  placa(j, r, esRival, extra = '') {
    const m = this.motor;
    const inst = j.activos[0] || j.reserva[0] || j.hades[0] || null;
    const p = inst && window.Game.CHARACTERS_BY_ID[inst.personaje];
    const foto = p ? (p.imagenFlotante || p.imagen) : null;
    const enTurno = !m.terminada && m.jugadorActivo === j;
    return `
      <div class="placa ${enTurno ? 'en-turno' : ''}">
        <div class="placa-avatar">
          <div class="placa-foto ${p && p.imagenFlotante ? 'es-busto' : ''}">
            ${foto ? `<img src="${foto}" alt="" loading="lazy">` : ''}
          </div>
          <span class="placa-sigil" title="${r.nombre}">${r.sigil}</span>
        </div>
        <div class="placa-texto">
          <strong>${j.nombre}</strong>
          <span class="mesa-raza">${r.nombre}${p ? ` · ${p.nombre.split(',')[0]}` : ''}</span>
          ${extra}
        </div>
      </div>`;
  },

  /** Ficha de un jugador: sangre, personaje activo, reserva y revelados. */
  panel(j, esRival) {
    const m = this.motor;
    const r = this.colorLado(j);
    const vida = m.vidaDe(j);
    const energia = m.energiaDe(j);
    // Ancho de cada tramo de la barra respecto a la sangre con que empezó
    // (30, o la de la etapa si es una oleada).
    const total = j.sangreTotal || window.Game.SANGRE_TOTAL;
    const pct = (n) => `${(n / total) * 100}%`;

    const activo = j.activos.length
      ? j.activos.map((i) => this.cartaActiva(i, esRival)).join('')
      : `<div class="zona-runas vacia ${this.zonaEncendida(esRival, 'personaje') ? 'encendida' : ''}">
           ${this.RUNAS}<span class="zona-rotulo">Posición</span>
         </div>`;

    // Lo que está en el Hades ya se ve entero abajo: no lo repitas aquí.
    const enHades = new Set(j.hades.map((i) => i.personaje));
    // Lo que está en juego también cuenta como revelado (desde que se usa),
    // pero ya se ve en la mesa: la lista es para lo usado que volvió a la mano.
    const enJuego = new Set(j.activos.flatMap((i) => [i.personaje, i.accion]).filter(Boolean));
    const revelados = [...j.revelados]
      .filter((id) => !enHades.has(id) && !enJuego.has(id))
      .map(
        (id) =>
          window.Game.CHARACTERS_BY_ID[id]?.nombre ||
          window.Game.ACTIONS_BY_ID[id]?.nombre
      )
      .filter(Boolean);

    // Hades y destierro (el vacío): dos zonas de verdad junto al personaje en
    // posición, siempre a la vista (zonaFuera).
    const hades = this.zonaFuera(j.hades, 'hades');
    const vacio = this.zonaFuera(j.vacio || [], 'destierro');

    return `
      <div class="mesa-lado ${esRival ? 'es-rival' : 'es-jugador'} ${
        // En calabozo las criaturas se pintan a mayor tamaño: son el
        // espectáculo de la etapa, no un rival simétrico.
        esRival && this.etapa ? 'es-oleada' : ''
      }"
           style="--raza-primario:${r.colorPrimario};--raza-secundario:${r.colorSecundario}">
        <div class="lado-fila">
          <div class="lado-campo">${activo}<div class="zonas-fuera">${hades}${vacio}</div></div>
        </div>
        ${
          revelados.length
            ? `<div class="revelados" title="Cartas que pisaron el campo y se retiraron">
                 <span class="revelados-titulo">Revelado:</span>
                 ${revelados.map((n) => `<span class="revelado">${n}</span>`).join('')}
               </div>`
            : ''
        }
      </div>
    `;
  },

  /** Cuántas cartas se ven en abanico en el Hades y el destierro (las últimas). */
  CARTAS_EN_ZONA: 5,

  /**
   * El Hades o el destierro (el vacío) como zona de la mesa: un hueco del
   * tamaño de una carta con las últimas en abanico (la de arriba, la más
   * reciente) y el total en una pastilla. Cada carta va a la lupa al tocarla.
   * Lleva también las clases viejas (`hades`, `casilla-hades`), que usan el
   * tutorial y los recordatorios para anclarse.
   */
  zonaFuera(lista, tipo) {
    const esHades = tipo === 'hades';
    const nombre = esHades ? 'Hades' : 'Destierro';
    const icono = esHades ? '☠' : '✧';
    const ayuda = esHades
      ? 'Hades: aquí van los destruidos. Zona abierta: los dos la ven.'
      : 'Destierro (el vacío): junto al Hades; solo se entra y se sale por él.';
    const visibles = lista.slice(-this.CARTAS_EN_ZONA);
    const cartas = visibles.map((i, k) => {
      const p = window.Game.CHARACTERS_BY_ID[i.personaje];
      if (!p) return '';
      return `<div class="zf-carta" style="--k:${k};--n:${visibles.length}"
                   data-lupa="${p.imagen}" data-lupa-nombre="${p.nombre}" title="${p.nombre}">
                <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
              </div>`;
    }).join('');
    const clases = esHades ? 'hades casilla-hades zf-hades' : 'hades es-vacio zf-destierro';
    return `
      <div class="zona-fuera ${clases} ${lista.length ? '' : 'vacia'}" title="${ayuda}">
        <div class="zf-pila">
          ${cartas || `<span class="zf-icono" aria-hidden="true">${icono}</span>`}
        </div>
        <span class="zf-rotulo">${nombre}${lista.length ? ` <b>${lista.length}</b>` : ''}</span>
      </div>`;
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

    const humano = this.tu(), ia = this.suyo();
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
      : `<div class="mini-carta vacia hueco-accion ${
          this.zonaEncendida(esRival, 'accion') ? 'encendida' : ''
        }" title="Sin acción"><span>Acción</span></div>`;

    return `
      <div class="campo-par">
        <div class="zona-runas ${this.zonaEncendida(esRival, 'personaje') ? 'encendida' : ''}">
        ${this.RUNAS}
        <div class="mini-carta personaje postura-${postura}"
             data-uid-personaje="${inst.uid}"
             data-lupa="${p.imagen}" data-lupa-nombre="${p.nombre}">
          <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
          ${marca('posicion')}
          ${this.chipsEstado(inst)}
          <div class="mini-stats">
            <span class="stat-atq ${atk > 0 ? 'activo' : ''}">⚔ ${
              atk > 0 ? atk : p.ataque
            }</span>
            <span class="stat-def ${def > 0 ? 'activo' : ''}">🛡 ${
              def > 0 ? def : p.defensa
            }</span>
          </div>
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
    const lado = this.motor.jugadores.indexOf(j);
    if (this.remoto && esRival) return '';
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
  /**
   * Abanico de la carta: un botón redondo que despliega los pequeños en arco
   * hacia la derecha. Cada uno lleva su ángulo como coseno y seno sin unidad;
   * el radio lo pone el CSS (--abanico-r), que lo acorta en ventanas bajas,
   * donde la fila de cartas —que recorta en vertical— es más baja.
   */
  ABANICO_GRADOS: [-62, -31, 0, 31, 62],

  cerrarAbanico() {
    this.atajoAbierto = null;
    this.contenedor?.querySelectorAll('.campo-atajos.abierto').forEach((c) => {
      c.classList.remove('abierto');
      c.querySelector('.ct-gatillo')?.setAttribute('aria-expanded', 'false');
    });
  },

  atajosDeCarta(inst) {
    // En remoto, los ± solo en tus cartas: las del rival las ajusta él.
    if (this.remoto && !this.tu().activos.includes(inst)) return '';
    let k = 0;
    const pequeno = (tool, n, glifo, titulo, extra = '') => {
      const g = (this.ABANICO_GRADOS[k] * Math.PI) / 180;
      const estilo = `--cx:${Math.cos(g).toFixed(3)};--cy:${Math.sin(g).toFixed(3)};--i:${k++}`;
      return `<button type="button" class="ct-btn" data-tool="${tool}" data-n="${n}"
                style="${estilo}" title="${titulo}" aria-label="${titulo}" ${extra}>${glifo}</button>`;
    };

    // Deshacer. No lo pide ninguna carta —no sale en el recuento del mazo—,
    // lo pide haber puesto el ±1 a un clic: equivocarse es ahora mucho más
    // fácil que antes, y sin esto rectificar obligaba a ir a Herramientas.
    // Apagado cuando no hay nada que quitar, como las flechas de sangre.
    const mods = inst.modificadores || { ataque: 0, defensa: 0 };
    const hayQueLimpiar = !!(mods.ataque || mods.defensa);

    const abierto = this.atajoAbierto === inst.uid;

    return `
      <div class="campo-atajos ${abierto ? 'abierto' : ''}" data-uid-tool="${inst.uid}">
        <button type="button" class="ct-gatillo ${hayQueLimpiar ? 'modificado' : ''}"
                aria-expanded="${abierto}" title="Ajustar ataque y defensa">
          <span class="ctg-cerrado" aria-hidden="true">±</span><span class="ctg-abierto" aria-hidden="true">×</span>
        </button>
        ${pequeno('atq', 1, '⚔+', 'Ataque +1')}
        ${pequeno('atq', -1, '⚔−', 'Ataque −1')}
        ${pequeno('limpiar', 0, '↺', 'Quitar los modificadores puestos a mano', hayQueLimpiar ? '' : 'disabled')}
        ${pequeno('def', 1, '🛡+', 'Defensa +1')}
        ${pequeno('def', -1, '🛡−', 'Defensa −1')}
      </div>`;
  },

  conectarLupa() {
    window.Game.Lupa.conectar(this.contenedor);
  },

  /**
   * «⚔ Atacar» en la banda central, entre los dos lados: donde ocurre la
   * batalla, y no abajo en el pie. Ataca con lo que digan los selectores del
   * pie si los hay (cuando hay de verdad entre qué elegir) o, si no, con el
   * único atacante contra el único objetivo.
   */
  botonAtacarMesa() {
    const m = this.motor;
    const humano = this.tu();
    if (m.terminada || m.jugadorActivo !== humano || m.fase !== 'ataque' || m.ataquePendiente) return '';
    if (!m.atacantesDisponibles(humano).length) return '';
    return '<button type="button" class="btn-atacar-mesa" id="btn-atacar-mesa">⚔ Atacar</button>';
  },

  atacarDesdeMesa() {
    const m = this.motor;
    const humano = this.tu();
    const rival = this.suyo();
    // Un solo puesto por bando en todos los modos: el único atacante contra
    // el único objetivo (o la sangre, si el campo rival está vacío).
    const a = (m.atacantesDisponibles(humano)[0] || {}).uid || null;
    const d = (rival.activos[0] || {}).uid || null;
    m.declararAtaque(a, d);
  },

  /** El golpe declarado, en una línea para el emergente rojo. */
  textoGolpe() {
    const prev = this.motor.previsionAtaque();
    if (!prev) return null;
    const v = `⚔ ${prev.atacanteValor}`;
    if (prev.destruido) return `${v} — lo destruye${prev.danoSangre ? ` y ${prev.danoSangre} a la sangre` : ''}`;
    if (prev.danoSangre) return `${v} — ${prev.danoSangre} de daño`;
    if (prev.danoReflejado) return `${v} — el escudo refleja ${prev.danoReflejado}`;
    return `${v} — no pasa`;
  },

  /** Previsualiza qué pasaría si el humano atacase ahora. */
  veredicto() {
    const m = this.motor;
    const humano = this.tu(), ia = this.suyo();
    if (m.terminada) return '';
    const paz = m.estados.find((e) => e.tipo === 'sinAtaques');
    if (paz) return `<span class="veredicto-paz">☮ Nadie puede atacar · ${paz.turnos} ${paz.turnos === 1 ? 'turno' : 'turnos'}</span>`;
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
    window.Game.Bocadillos?.revisar(this, s);
    // Primer pintado: solo se toma la foto, ni suena ni se mueve nada… salvo
    // el aviso de turno, que también tiene que decir quién abre el duelo.
    if (!s) { this.mostrarAvisoTurno(); return; }
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
      turnoNuevo: m.numeroTurno !== this.eco.turno,
      // Claves «idx:uid» e «idx:uid:accion» de lo que acaba de aparecer.
      nuevosActivos: [...activos].filter((k) => !this.eco.activos.has(k)),
      nuevasAcciones: [...equipadas].filter((k) => !this.eco.equipadas.has(k)),
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
    if (s.turnoNuevo) this.mostrarAvisoTurno();
    if (s.golpe) this.numerosDeGolpe(s.golpe);
    const ahora = Date.now();
    for (const k of s.nuevosActivos || []) {
      const uid = k.split(':')[1];
      this.vivas.push({ sel: `[data-uid-personaje="${uid}"]`, clase: 'entra-campo', desde: ahora, ms: this.MS_ENTRADA });
    }
    for (const k of s.nuevasAcciones || []) {
      const uid = k.split(':')[1];
      this.vivas.push({ sel: `[data-uid-accion="${uid}"]`, clase: 'acopla-accion', desde: ahora, ms: this.MS_ENTRADA });
    }
    this.pintarVivas();
    if (s.golpe) {
      this.golpeVivo = { n: s.golpe.n, desde: Date.now(), golpe: s.golpe };
    }
    this.pintarGolpe();
  },

  /**
   * «Tu turno» / «Turno de …» en grande, un momento. Antes solo cambiaba un
   * texto chico en la cabecera, y en el turno de la IA costaba saber cuándo te
   * tocaba. No bloquea nada (`pointer-events: none`) ni para la cadena de la
   * IA: es un aviso, no un modal.
   */
  mostrarAvisoTurno() {
    const m = this.motor;
    const el = this.contenedor && this.contenedor.querySelector('#aviso-turno');
    if (!el || !m || m.terminada) return;
    const tuyo = m.jugadorActivo === this.tu();
    el.innerHTML = `
      <strong>${tuyo ? 'Tu turno' : `Turno de ${m.jugadorActivo.nombre}`}</strong>
      <span>Turno ${m.numeroTurno}</span>`;
    el.classList.toggle('es-rival', !tuyo);
    // Quitar, forzar reflujo y volver a poner: si el aviso anterior aún se
    // estaba viendo, sin esto no volvería a empezar.
    el.classList.remove('visible');
    void el.offsetWidth;
    el.classList.add('visible');
  },

  /* ---------------- Feedback visual: entradas, números, sangre ---------- */

  /** Duraciones en ms. Las manda el JS y el CSS las lee por `--dur`. */
  MS_ENTRADA: 460,
  MS_NUMERO: 1100,
  MS_SANGRE: 520,

  /** Animaciones de un solo uso que deben sobrevivir a los repintados. */
  vivas: [],

  /**
   * Reaplica las animaciones que siguen vivas. Mismo truco que pintarGolpe():
   * pintar() rehace los paneles y se llevaría la clase, así que se vuelve a
   * poner con un `animation-delay` NEGATIVO igual a lo ya transcurrido, para
   * que retome donde iba en vez de empezar de nuevo.
   */
  pintarVivas() {
    const ahora = Date.now();
    this.vivas = this.vivas.filter((v) => ahora - v.desde < v.ms);
    if (this.sinMovimiento() || !this.contenedor) return;
    for (const v of this.vivas) {
      const el = this.contenedor.querySelector(v.sel);
      if (!el) continue;
      el.style.setProperty('--dur', `${v.ms}ms`);
      el.style.animationDelay = `-${ahora - v.desde}ms`;
      el.classList.add(v.clase);
    }
  },

  /**
   * Número flotante sobre quien encajó el golpe: «−5» en rojo, «Destruido»,
   * el reflejo del escudo en dorado sobre QUIEN ATACÓ, y «Sin daño» si el
   * golpe no hizo nada. Se cuelga directamente del tablero, que pintar() no
   * reescribe (solo sus paneles), así que no hace falta reaplicarlo.
   */
  numerosDeGolpe(g) {
    const tab = this.contenedor && this.contenedor.querySelector('.mesa-tablero');
    if (!tab) return;
    const panelDe = (idx) => idx < 0 ? null
      : this.contenedor.querySelector(idx === this.yoIdx ? '#panel-jugador' : '#panel-rival');
    // Sobre la carta si sigue en la mesa; si no, sobre su barra de sangre.
    const sobre = (idx, uid) => {
      const p = panelDe(idx);
      if (!p) return null;
      return (uid && p.querySelector(`[data-uid-personaje="${uid}"]`))
        || this.placaDe(idx).querySelector('.sangre-barra') || p;
    };
    const poner = (el, texto, clase) => {
      if (!el) return;
      const rt = tab.getBoundingClientRect(), re = el.getBoundingClientRect();
      const n = document.createElement('div');
      n.className = `numero-golpe ${clase}`;
      n.textContent = texto;
      n.style.setProperty('--dur', `${this.MS_NUMERO}ms`);
      n.style.left = `${re.left - rt.left + tab.scrollLeft + re.width / 2}px`;
      n.style.top = `${re.top - rt.top + tab.scrollTop + re.height * 0.4}px`;
      tab.appendChild(n);
      setTimeout(() => n.remove(), this.MS_NUMERO + 150);
    };

    const def = sobre(g.defensorIdx, g.destruido ? null : g.defensorUid);
    if (g.destruido) {
      poner(def, g.danoSangre > 0 ? `Destruido −${g.danoSangre}` : 'Destruido', 'es-destruido');
    } else if (g.danoSangre > 0) {
      poner(def, `−${g.danoSangre}`, 'es-dano');
    }
    if (g.danoReflejado > 0) {
      poner(sobre(g.atacanteIdx, g.atacanteUid), `−${g.danoReflejado} reflejo`, 'es-reflejo');
    }
    if (!g.destruido && !g.danoSangre && !g.danoReflejado) {
      poner(def, 'Sin daño', 'es-nulo');
    }
  },

  /**
   * Los efectos de personaje que el juego aplicó solo (motor.anuncios), como
   * un rótulo amarillo sobre la carta que sube y se desvanece. Va colgado del
   * tablero, no de los paneles, para que los repintados no lo corten. Varios a
   * la vez se escalonan hacia arriba para no pisarse.
   */
  MS_ANUNCIO: 2600,

  mostrarAnuncios() {
    const m = this.motor;
    const visto = this.anunciosVistos || 0;
    const nuevos = m.anuncios.filter((a) => a.n > visto);
    if (m.anuncios.length) this.anunciosVistos = Math.max(visto, m.anuncios[m.anuncios.length - 1].n);
    if (!nuevos.length) return;
    nuevos.forEach((a, k) => {
      const panel = this.contenedor.querySelector(a.jugadorIdx === this.yoIdx ? '#panel-jugador' : '#panel-rival');
      const el = (a.uid && panel.querySelector(`[data-uid-personaje="${a.uid}"]`)) || panel;
      this.emergente(a.texto, { sobre: el, escalon: k, ms: this.MS_ANUNCIO });
    });
  },

  /** Ancho REAL (en %) de cada tramo de la barra de sangre, antes de repintar. */
  medirBarras() {
    const out = {};
    if (!this.contenedor) return out;
    for (const id of ['placa-jugador', 'placa-rival']) {
      const barra = this.contenedor.querySelector(`#${id} .sangre-barra`);
      // (los ids son los de las placas: la sangre ya no vive en el panel)
      const total = barra && barra.getBoundingClientRect().width;
      if (!total) continue;
      out[id] = [...barra.querySelectorAll('.seg')]
        .map((s) => (s.getBoundingClientRect().width / total) * 100);
    }
    return out;
  },

  /**
   * La barra de sangre que BAJA en vez de saltar.
   *
   * pintar() rehace el panel, así que la barra nueva nace ya con su ancho
   * final y el `transition` del CSS nunca llegaba a verse. Aquí se la pone un
   * instante en el ancho que tenía en pantalla (medido antes de repintar) y se
   * la deja transicionar hasta el nuevo. Como se mide el ancho REAL, un
   * repintado a mitad de camino continúa desde donde iba, sin saltos.
   */
  animarBarras(antes) {
    if (this.sinMovimiento()) return;
    for (const [id, anchos] of Object.entries(antes)) {
      const segs = [...this.contenedor.querySelectorAll(`#${id} .sangre-barra .seg`)];
      if (segs.length !== anchos.length) continue;
      const destino = segs.map((s) => s.style.width);
      if (segs.every((s, i) => Math.abs(parseFloat(destino[i]) - anchos[i]) < 0.3)) continue;
      segs.forEach((s, i) => { s.style.transition = 'none'; s.style.width = `${anchos[i]}%`; });
      void segs[0].offsetWidth;
      segs.forEach((s, i) => {
        s.style.transition = `width ${this.MS_SANGRE}ms cubic-bezier(0.2, 0.7, 0.2, 1)`;
        s.style.width = destino[i];
      });
    }
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
      this.contenedor.querySelector(idx === this.yoIdx ? '#panel-jugador' : '#panel-rival');

    const arrancar = (el, clase) => {
      if (!el) return;
      el.style.setProperty('--impacto', `${this.MS_IMPACTO}ms`);
      el.style.animationDelay = `-${transcurrido}ms`;
      el.classList.add(clase);
    };

    // La carta que encajó. Si murió ya no está en el DOM: entonces no hay a
    // quién sacudir y queda solo el destello de sangre.
    const panelDef = panelDe(g.defensorIdx);

    // El atacante EMBISTE: se lanza hacia su objetivo —la carta que encajó, o
    // la placa del rival si fue a la sangre o si el defensor ya cayó— y
    // vuelve. El rumbo se mide una sola vez, en el primer pintado del golpe,
    // y se guarda: en los repintados el defensor muerto ya no está.
    const panelAtk = g.atacanteIdx >= 0 ? panelDe(g.atacanteIdx) : null;
    const atk = panelAtk && g.atacanteUid
      && panelAtk.querySelector(`[data-uid-personaje="${g.atacanteUid}"]`);
    if (atk) {
      if (!vivo.rumbo) {
        const objetivo = (panelDef && g.defensorUid
          && panelDef.querySelector(`[data-uid-personaje="${g.defensorUid}"]`))
          || this.placaDe(g.defensorIdx).querySelector('.placa');
        const a = atk.getBoundingClientRect();
        const o = objetivo ? objetivo.getBoundingClientRect() : a;
        vivo.rumbo = {
          dx: (o.left + o.width / 2 - (a.left + a.width / 2)) * 0.55,
          dy: (o.top + o.height / 2 - (a.top + a.height / 2)) * 0.55
        };
      }
      atk.style.setProperty('--dx', `${Math.round(vivo.rumbo.dx)}px`);
      atk.style.setProperty('--dy', `${Math.round(vivo.rumbo.dy)}px`);
      arrancar(atk, 'embiste');
    }
    if (panelDef && g.defensorUid) {
      arrancar(
        panelDef.querySelector(`[data-uid-personaje="${g.defensorUid}"]`),
        'encaja-golpe'
      );
    }

    // La sangre destella en quien la perdió, que NO siempre es el defensor: el
    // reflejo del escudo sangra a quien atacó. Pueden encenderse los dos lados
    // en el mismo golpe, y es correcto.
    if (g.danoSangre > 0 && g.defensorIdx >= 0) {
      arrancar(this.placaDe(g.defensorIdx).querySelector('.sangre-barra'), 'sangre-golpeada');
    }
    if (g.danoReflejado > 0 && g.atacanteIdx >= 0) {
      arrancar(this.placaDe(g.atacanteIdx).querySelector('.sangre-barra'), 'sangre-golpeada');
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
      const num = pestana.querySelector('.pestana-num');
      num.textContent = lista.length || '';
      num.hidden = !lista.length;
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
            ${this.botonAplicar(r)}
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
    this.conectarAplicar(cont);

    this.burbujaRecordatorio(lista);
  },

  /**
   * Enseña el primero que no se haya enseñado nunca, anclado a su carta.
   *
   * No pisa al tutorial —que enseña a jugar y va primero— ni interrumpe la
   * cadena de la IA, que se pinta fase a fase.
   */
  /**
   * Ya NO es una burbuja con botones que para el juego: es un aviso de una
   * línea en lo alto de la mesa que se va solo. Lo automatizable ni llega
   * aquí (se aplica solo, ver autoAplicar); lo que queda es lo que aplicas tú
   * a mano, y para eso basta con saber que existe: el ⚡ de la carta y la
   * pestaña de Recordatorios lo guardan. Tocar el aviso abre esa pestaña.
   */
  MS_AVISO_RECORDATORIO: 5000,

  burbujaRecordatorio(lista) {
    if (window.Game.Tutorial.activo) return;

    // En el turno del rival no se interrumpe la cadena de fases... salvo
    // cuando te ha declarado un ataque: ahí el turno es tuyo de hecho, y es
    // justo el momento en que las defensivas de «Fase de combate» importan.
    const m = this.motor;
    const ajeno = m.jugadorActivo !== this.tu();
    const defendiendo = !!m.ataquePendiente && ajeno;
    if (!defendiendo && (this.iaEnCurso || ajeno)) return;

    const R = window.Game.Recordatorios;
    // Las acciones que el juego aplica solo no necesitan aviso: ya ocurrirán.
    const AI = window.Game.AccionesIA;
    const r = lista.find((x) => !R.yaVisto(x.clave)
      && !(x.zona === 'accion' && AI && AI.sabeUsar(x.cartaId)));
    if (!r) return;

    const objetivo = this.anclaDe(r);
    if (!objetivo) return;

    R.marcarVisto(r.clave);

    const tablero = this.contenedor.querySelector('.mesa-tablero');
    tablero.querySelector('.recordatorio-aviso')?.remove();
    const aviso = document.createElement('button');
    aviso.type = 'button';
    aviso.className = 'recordatorio-aviso';
    aviso.title = r.texto;
    aviso.innerHTML = `<span class="ra-rayo">⚡</span>
      <strong>${r.nombre}</strong> · ${r.timing} <span class="ra-ver">Ver</span>`;
    aviso.style.setProperty('--dur', `${this.MS_AVISO_RECORDATORIO}ms`);
    aviso.addEventListener('click', () => {
      aviso.remove();
      this.contenedor.querySelector('#pestana-recordatorios')?.click();
    });
    tablero.appendChild(aviso);
    setTimeout(() => aviso.remove(), this.MS_AVISO_RECORDATORIO);
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
    this.contenedor?.querySelector('.recordatorio-aviso')?.remove();
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
    // En remoto no hay Herramientas: todas las cartas se aplican solas y nadie
    // toca la mesa del otro a mano.
    if (!cont || this.remoto) return;

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

    const humano = this.tu(), rival = this.suyo();
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

    const rival = this.suyo();
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
    if (m.terminada || m.jugadorActivo === this.tu()) return '';
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

  /**
   * Al declararse un ataque contra ti, saca la pestaña de Recordatorios sin
   * que tengas que buscarla: ahí está el texto impreso entero, que en la tira
   * del pie no cabe. Una sola vez por ataque —con la firma del pendiente—,
   * porque `pintar()` corre en cada cambio y si no te robaría la pestaña cada
   * vez que tocas una herramienta.
   */
  abrirRecordatoriosSiTeAtacan() {
    const m = this.motor;
    if (!m.ataquePendiente || m.jugadorActivo === this.tu()) {
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

  /**
   * ¿Este recordatorio se puede aplicar con un clic? Solo las cartas de ACCIÓN
   * cuyo efecto ya sabe aplicar el juego (las mismas que usa la IA), y solo
   * cuando aplicarlas tiene sentido: una defensiva de combate gastada fuera de
   * un ataque no haría nada, así que el botón no se ofrece. En los demás casos
   * queda el «ya está» y Herramientas, como siempre.
   */
  instParaAplicar(r) {
    const m = this.motor;
    if (!m || m.terminada || r.zona !== 'accion') return null;
    const AI = window.Game.AccionesIA;
    if (!AI || !AI.sabeUsar(r.cartaId) || m.accionesNegadas) return null;
    const humano = this.tu();
    const inst = humano.activos.find((i) => i.uid === r.uid && i.accion === r.cartaId);
    if (!inst) return null;

    const accion = window.Game.ACTIONS_BY_ID[r.cartaId];
    if (AI.momentoDe(accion) === 'combate') {
      const teAtacan = !!m.ataquePendiente && m.jugadorActivo !== humano;
      if (accion.tipo === 'defensiva') {
        const imp = teAtacan ? m.implicadosAtaque() : null;
        if (!imp || !imp.defensor || imp.defensor.uid !== inst.uid) return null;
      } else if (m.jugadorActivo !== humano || m.fase !== 'ataque') {
        return null;
      }
    }
    return inst;
  },

  botonAplicar(r) {
    if (!this.instParaAplicar(r)) return '';
    return `<button class="recordatorio-aplicar" type="button" data-clave="${r.clave}"
                    title="Aplica el efecto impreso de la carta y lo deja en el registro">
              Aplicar
            </button>`;
  },

  /**
   * Tus cartas de acción automatizadas se aplican SOLAS en su momento, igual
   * que las de la IA: la ofensiva de combate al declarar tu ataque, la
   * defensiva cuando te atacan a esa carta, la de «Acción equipada» al
   * acoplarla. Antes salía una burbuja preguntando «¿aplicar?» por un efecto
   * que es obligatorio. Las que el juego no sabe aplicar siguen siendo tuyas.
   * Devuelve si aplicó algo (y por tanto ya repintó).
   */
  autoAplicar() {
    if (this.aplicando) return false;
    // Con una elección en el aire (Seluah, Yun…), nada se aplica encima: una
    // segunda pregunta pisaría a la primera.
    if (this.motor.eleccionPendiente) return false;
    const m = this.motor;
    const humano = this.tu();
    for (const r of this.recordatorios || []) {
      const inst = this.instParaAplicar(r);
      if (!inst) continue;
      const accion = window.Game.ACTIONS_BY_ID[r.cartaId];
      const deCombate = window.Game.AccionesIA.momentoDe(accion) === 'combate';
      // Tu ofensiva espera a que declares: aplicarla al entrar en la fase
      // gastaría el dado antes de saber a quién atacas.
      if (deCombate && accion.tipo !== 'defensiva'
          && !(m.ataquePendiente && m.jugadorActivo === humano)) continue;
      // Y la defensiva, cuando ya te han declarado el ataque: Escape, Campo
      // caótico o Biomecánica necesitan saber quién te pega.
      if (deCombate && accion.tipo === 'defensiva'
          && !(m.ataquePendiente && m.jugadorActivo !== humano)) continue;
      this.aplicarRecordatorio(r.clave);
      return true;
    }
    return false;
  },

  /** Aplica la carta del recordatorio con el mismo código que usa la IA. */
  aplicarRecordatorio(clave) {
    const m = this.motor;
    const r = (this.recordatorios || []).find((x) => x.clave === clave);
    const inst = r && this.instParaAplicar(r);
    if (!inst) return;
    const humano = this.tu(), rival = this.suyo();

    // Contexto que necesitan las de combate: a quién atacas, o quién te ataca.
    const contexto = { defensor: rival };
    if (m.ataquePendiente && m.jugadorActivo !== humano) {
      const imp = m.implicadosAtaque();
      Object.assign(contexto, {
        atacanteInst: imp && imp.atacante,
        atacanteJugador: m.jugadorActivo,
        atacante: m.jugadorActivo
      });
    }
    // Se da por hecho ANTES de aplicar: el dado del efecto notifica al motor y
    // repinta a mitad, y ese repintado —con autoAplicar— la volvía a aplicar
    // en cadena. Por lo mismo, el cerrojo. También evita el doble clic.
    window.Game.Recordatorios.descartar(clave);
    this.aplicando = true;
    try {
      // En el invitado la aplica el anfitrión, con el mismo código.
      if (m.esEspejo) m.intento('aplicar', inst, r.cartaId);
      else window.Game.AccionesIA.aplicarManual(m, humano, inst, contexto);
    } finally {
      this.aplicando = false;
    }
    this.pintar();
  },

  conectarAplicar(cont) {
    cont.querySelectorAll('.recordatorio-aplicar').forEach((btn) => {
      btn.addEventListener('click', () => this.aplicarRecordatorio(btn.dataset.clave));
    });
  },

  /* ---------------------------- Controles ------------------------------ */

  /**
   * Ya NO hay barra inferior. Lo que hay que ELEGIR va en tu «mano», dentro de
   * tu lado de la mesa (a la derecha de tu carta, como el «Esperando» de la
   * oleada en el suyo): los de la reserva en la fase de personaje, las
   * acciones libres en la de acción y, fuera de esas fases, la reserva a la
   * vista sin poder pulsarla. Los botones viven en la banda central: ⚔ Atacar
   * o Resolver/Retirar en #mesa-atacar y Siguiente fase en #mesa-avanzar. Todo
   * lo demás se cuenta con mensajes emergentes que se desvanecen (emergente).
   * #mesa-controles es ahora la mano y va dentro del panel, que pintar()
   * rehace justo antes de llamar aquí.
   */
  pintarControles() {
    const m = this.motor;
    const c = this.contenedor;
    const mano = c.querySelector('#mesa-controles');
    const manoAcciones = c.querySelector('#mano-acciones');
    const slotAtacar = c.querySelector('#mesa-atacar');
    const slotAvanzar = c.querySelector('#mesa-avanzar');
    const humano = this.tu();
    const miTurno = m.jugadorActivo === humano;

    if (m.terminada) {
      mano.innerHTML = '';
      manoAcciones.innerHTML = '';
      slotAtacar.innerHTML = '';
      slotAvanzar.innerHTML = '';
      return;
    }

    // --- La mano: personajes a la izquierda, acciones a la derecha ----------
    // Con una pregunta tuya en el aire (Erem, Tilos…) el motor no deja jugar
    // cartas: la mano se apaga para no parecer jugable (Oscar: «no puedo
    // clicar la acción» contra el jefe, con la pregunta de Erem esperando).
    const preguntaTuya = !!(m.eleccionPendiente && m.eleccionPendiente.jugadorIdx === this.yoIdx);
    const eligePersonaje = miTurno && m.fase === 'personaje' && !preguntaTuya;
    // Sin atributo disabled, para que las apagadas sigan respondiendo a la lupa.
    mano.innerHTML = humano.reserva
      .map((i) => {
        const p = window.Game.CHARACTERS_BY_ID[i.personaje];
        const puede = eligePersonaje && !m.desplegoEsteTurno && m.puedeDesplegar(humano, i);
        return `
          <button class="opcion-carta ${puede ? '' : 'inasequible'} ${eligePersonaje ? '' : 'pasiva'}"
                  data-uid="${i.uid}"
                  data-lupa="${p.imagen}" data-lupa-nombre="${p.nombre}"
                  title="${
                    !eligePersonaje || puede
                      ? p.nombre
                      : m.desplegoEsteTurno
                        ? `${p.nombre} — ya desplegaste este turno`
                        : `${p.nombre} — necesitas ${p.coste} sangres derramadas`
                  }">
            <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
            <span class="opcion-coste">${p.coste}</span>
            <span class="opcion-stats">⚔${p.ataque} 🛡${p.defensa}</span>
            ${this.chipsEstado(i)}
          </button>`;
      })
      .join('');

    const eligeAccion = miTurno && m.fase === 'accion' && humano.activos.length > 0 && !preguntaTuya;
    manoAcciones.innerHTML = m
      .accionesDisponibles(humano)
      .map((id) => window.Game.ACTIONS_BY_ID[id])
      .map((a) => {
        const inerte = a.razaRequerida && a.razaRequerida !== humano.raza;
        return `
        <button class="opcion-carta accion tipo-${a.tipo} ${inerte ? 'inerte' : ''} ${eligeAccion ? '' : 'pasiva'}"
                data-accion="${a.id}"
                data-lupa="${a.imagen}" data-lupa-nombre="${a.nombre}"
                title="${a.nombre}${inerte ? ' — exige otra raza' : ''}">
          <img src="${a.imagen}" alt="${a.nombre}" loading="lazy">
          <span class="opcion-tipo tipo-${a.tipo}">${a.tipo[0].toUpperCase()}</span>
        </button>`;
      })
      .join('');

    // En abanico: cada carta se gira un poco desde el centro y baja según se
    // aleja de él, como sostenidas en la mano. El orden de apilado sube hacia
    // la derecha para que se lea el borde de cada una.
    for (const caja of [mano, manoAcciones]) {
      const cartas = [...caja.children];
      const medio = (cartas.length - 1) / 2;
      cartas.forEach((el, i) => {
        const d = i - medio;
        el.style.setProperty('--giro', `${(d * 6).toFixed(1)}deg`);
        el.style.setProperty('--alto', `${(Math.abs(d) * Math.abs(d) * 2.2).toFixed(1)}px`);
        el.style.zIndex = i + 1;
      });
    }
    mano.closest('.mano').classList.toggle('eligiendo', eligePersonaje && !m.desplegoEsteTurno);
    // Lo que antes decía el pie: cuánta energía tienes. Sin ella no se entiende
    // por qué unas cartas salen apagadas (coste mayor que tu energía).
    mano.closest('.mano').querySelector('.mano-titulo').textContent = eligePersonaje
      ? (m.desplegoEsteTurno ? 'Personajes · ya desplegaste' : `Personajes · energía ${m.energiaDe(humano)}`)
      : 'Personajes';
    manoAcciones.closest('.mano').classList.toggle('eligiendo', eligeAccion);
    mano.querySelectorAll('[data-uid]').forEach((el) => {
      el.addEventListener('click', () => {
        if (preguntaTuya) return this.recordarEleccion();
        if (el.classList.contains('inasequible') || el.classList.contains('pasiva')) return;
        m.desplegar(el.dataset.uid);
      });
    });
    manoAcciones.querySelectorAll('[data-accion]').forEach((el) => {
      el.addEventListener('click', () => {
        if (preguntaTuya) return this.recordarEleccion();
        if (el.classList.contains('pasiva')) return;
        m.equipar(el.dataset.accion);
      });
    });

    // --- La banda central --------------------------------------------------
    if (m.ataquePendiente) {
      const defiendo = !miTurno;
      const etiqueta = defiendo ? 'Encajar' : 'Resolver';
      slotAtacar.innerHTML = `
        <button class="btn-primario btn-banda" id="btn-resolver" data-etiqueta="${etiqueta}">${etiqueta}</button>
        ${defiendo ? '' : '<button class="btn-secundario btn-banda" id="btn-cancelar-ataque">Retirar</button>'}`;
      slotAtacar.querySelector('#btn-resolver').addEventListener('click', () => m.resolverAtaque());
      slotAtacar.querySelector('#btn-cancelar-ataque')?.addEventListener('click', () => m.cancelarAtaque());
    } else {
      slotAtacar.innerHTML = this.botonAtacarMesa();
    }

    slotAvanzar.innerHTML = miTurno
      ? `<button class="btn-primario btn-banda" id="btn-avanzar" ${
          m.ataquePendiente ? 'disabled title="Resuelve o retira el ataque declarado"' : ''
        }>${this.etiquetaAvanzar()}</button>`
      : '';
    slotAvanzar.querySelector('#btn-avanzar')?.addEventListener('click', () => m.siguienteFase());

    this.avisarFase();
  },

  /**
   * Mensaje emergente genérico: un rótulo que aparece, sube un poco y se
   * desvanece, colgado del tablero (no de los paneles, que se rehacen). Si se
   * da un elemento, sale sobre él; si no, en el centro de la banda.
   * `clase`: 'efecto' (amarillo, lo aplicado solo), 'fase' (indicación),
   * 'combate' (el golpe declarado).
   */
  MS_EMERGENTE: 2200,

  emergente(texto, { sobre = null, clase = 'efecto', escalon = 0, ms = this.MS_EMERGENTE } = {}) {
    const tab = this.contenedor && this.contenedor.querySelector('.mesa-tablero');
    if (!tab) return;
    // Los del centro de la banda se relevan: el nuevo quita al anterior en
    // vez de pisarlo. Los de sobre una carta conviven (van escalonados).
    if (!sobre) tab.querySelectorAll('.anuncio-efecto.en-banda').forEach((x) => x.remove());
    // Los de la banda salen un poco por ENCIMA de ella, sobre la previsión:
    // justo en la banda taparían Resolver y Siguiente fase.
    const el = sobre || this.contenedor.querySelector('#mesa-veredicto') || this.contenedor.querySelector('.mesa-centro');
    const rt = tab.getBoundingClientRect();
    const re = el.getBoundingClientRect();
    const n = document.createElement('div');
    n.className = `anuncio-efecto es-${clase}${sobre ? '' : ' en-banda'}`;
    n.textContent = texto;
    n.style.setProperty('--dur', `${ms}ms`);
    n.style.left = `${re.left - rt.left + tab.scrollLeft + re.width / 2}px`;
    n.style.top = `${re.top - rt.top + tab.scrollTop + (sobre ? re.height * 0.15 : -26) - escalon * 30}px`;
    tab.appendChild(n);
    setTimeout(() => n.remove(), ms + 150);
  },

  /**
   * Lo que antes decía el pie, ahora como emergente: qué toca en esta fase.
   * Una vez por fase, solo en tu turno y solo si la fase pide algo (si ya
   * está hecha, avanza sola y el mensaje sobraría).
   */
  TEXTO_FASE: {
    personaje: 'Elige quién entra en posición',
    accion: 'Acopla una acción a tu personaje',
    ataque: 'Pulsa ⚔ Atacar o pasa de fase'
  },

  avisarFase() {
    const m = this.motor;
    // Al empezar el duelo, una vez: cómo se gana (Oscar: «no sé por qué gané»).
    let tras = 0;
    if (!this.condicionAvisada && m && !m.terminada) {
      this.condicionAvisada = true;
      tras = 4400; // el aviso de la fase espera a que se vaya este
      setTimeout(() => {
        if (this.motor !== m || m.terminada) return;
        this.emergente('Gana quien deje al rival sin sangre o sin personajes en pie', { clase: 'fase', ms: 4200 });
      }, 300);
    }
    if (m.jugadorActivo !== this.tu() || m.ataquePendiente) return;
    const clave = `${m.numeroTurno}:${m.fase}`;
    if (this.faseAvisada === clave) return;
    this.faseAvisada = clave;
    let texto = this.TEXTO_FASE[m.fase];
    const etiqueta = this.etiquetaAvanzar();
    if (etiqueta.startsWith('Mantener posición')) texto = 'Cambia a tu personaje o mantén la posición';
    if (etiqueta.startsWith('Mantener acción')) texto = 'Cambia la acción o mantenla';
    // Primer turno de quien abre: no se ataca. Se dice, o parecería un fallo.
    if (m.fase === 'ataque' && m.numeroTurno === 1) texto = 'Primer turno: todavía no se puede atacar';
    if (!texto || (this.faseCumplida() && !(m.fase === 'ataque' && m.numeroTurno === 1))) return;
    if (m.fase === 'ataque' && m.numeroTurno !== 1 && !m.atacantesDisponibles(this.tu()).length) return;
    // Al abrir el turno sale antes el aviso «Tu turno» en el mismo sitio: se
    // espera a que se vaya, y si para entonces la fase ya cambió, no sale.
    const espera = Math.max(tras, m.fase === 'personaje' ? 1200 : 0);
    setTimeout(() => {
      if (this.motor !== m || `${m.numeroTurno}:${m.fase}` !== clave || m.ataquePendiente) return;
      this.emergente(texto, { clase: 'fase' });
    }, espera);
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

  /**
   * El cartel de fin explica la condición de victoria y QUÉ la cumplió
   * (Oscar: «muchas victorias se sienten raras, no sé por qué gané»). La
   * causa la deja el motor en causaFin: lo último que derramó sangre o mandó
   * al Hades al perdedor.
   */
  textoMotivo(gano) {
    const m = this.motor;
    const quien = m.perdedor ? m.perdedor.nombre : 'El rival';
    const c = m.causaFin;
    let condicion;
    if (m.motivoFin === 'personajes') {
      condicion = gano
        ? `${quien} se quedó sin personajes en pie: ni en posición ni en la reserva.`
        : 'Te quedaste sin personajes en pie: ni en posición ni en la reserva.';
    } else {
      condicion = gano
        ? `${quien} se quedó sin sangre (0 de ${m.perdedor ? m.perdedor.sangreTotal : 30}).`
        : `Te quedaste sin sangre (0 de ${this.tu().sangreTotal}).`;
    }
    let decidio = '';
    if (c && c.tipo === 'sangre') {
      const lo = this.QUE_DERRAMA[c.motivo] || `el efecto «${c.motivo}»`;
      decidio = `La última gota: ${lo}${c.n > 1 ? ` (−${c.n})` : ''}.`;
    } else if (c && c.tipo === 'hades') {
      const como = /combate/.test(c.motivo) ? 'cayó en combate' : `fue al Hades (${c.motivo})`;
      decidio = `${c.personaje} ${como} y era el último que ${gano ? 'le' : 'te'} quedaba.`;
    }
    return `
      <span class="fin-regla">Se gana dejando al rival sin sangre o sin personajes en pie.</span>
      <span class="fin-causa">${condicion}</span>
      ${decidio ? `<span class="fin-decidio">${decidio}</span>` : ''}`;
  },

  /** Cómo se dice cada motivo de derrame en el cartel de fin. */
  QUE_DERRAMA: {
    'fin de turno': 'el derrame de fin de turno (cerrar un turno cuesta 1 sangre)',
    'daño de combate': 'un golpe que pasó a la sangre',
    'reflejo del escudo': 'el reflejo de un escudo más alto que el ataque',
    'Sadash: sangrado': 'el sangrado de Sadash al retirarse',
    'Bloquear: daño devuelto': 'el daño que devolvió Bloquear',
    'habilidad de jefe': 'una habilidad del jefe',
    'Aplacar': 'Aplacar'
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
    const gano = m.ganador === this.tu();
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
    if (this.remoto) {
      this.finRemoto(el, gano);
      return;
    }
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

    const volverA = this.params.modo === 'historia' ? 'historia' : this.remoto ? 'remoto' : 'mainMenu';

    el.innerHTML = `
      <div class="fin-caja">
        ${this.bloqueGema(gano)}
        <h2 class="${gano ? 'fin-victoria' : 'fin-derrota'}">
          ${gano ? 'Victoria' : 'Derrota'}
        </h2>
        <div class="fin-motivo">${this.textoMotivo(gano)}</div>
        ${recompensa}
        <button class="btn-primario" id="btn-fin-menu">
          ${volverA === 'historia' ? 'Seguir la historia' : volverA === 'remoto' ? 'Salir de la sala' : 'Volver al menú'}
        </button>
      </div>
    `;
    el.querySelector('#btn-fin-menu').addEventListener('click', () => {
      window.Game.Router.ir(volverA, { raza: this.params.raza });
    });
  },

  destruir() {
    clearTimeout(this.temporizador);
    clearTimeout(this.temporizadorJefe);
    // Una cuenta atrás de fase pendiente no puede disparar sobre otra pantalla.
    this.cancelarAvance();
    window.Game.Tutorial.alCerrar = null;
    window.Game.Tutorial.limpiar();
    // La burbuja cuelga de `body`, así que vaciar el contenedor no se la lleva.
    this.limpiarBurbujaRecordatorio();
    window.Game.Bocadillos?.parar();
    window.Game.Audio.quitarMusica();
    // Duelo remoto: se suelta la red y se cierra la sala.
    if (this.soltarRed) this.soltarRed();
    if (this.soltarMensajesSala) this.soltarMensajesSala();
    if (this.sesionRed) this.sesionRed.soltar();
    if (this.motor && this.motor.esEspejo) this.motor.soltar();
    // Revancha o vuelta a la sala: la conexión sigue viva.
    if (this.remoto && !this.mantenerRed) window.Game.Red.cerrar({ silencio: true });
    this.mantenerRed = false;
    this.soltarMensajesSala = null;
    this.soltarRed = null;
    this.sesionRed = null;
    this.desconexion = false;
    window.Game.Recordatorios.yoIdx = null;
    this.iaEnCurso = false;
    this.recordatorios = [];
    this.motor = null;
    this.contenedor = null;
  }
};
