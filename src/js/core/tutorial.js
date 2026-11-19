/**
 * Tutorial por burbujas.
 *
 * Dos clases de paso, y la diferencia importa:
 *
 * - **El recorrido** (`tour: true`): la primera etapa del Bosque Nocturno es la
 *   clase de manejo. Antes de la primera rata se repasa la interfaz entera en
 *   orden —mesa, sangre, fases, controles, lupa, los tres paneles laterales, el
 *   sonido y la salida—, cada burbuja anclada al elemento de verdad. Se enseña
 *   ahí y no antes porque un manual sobre una pantalla vacía no se retiene.
 *
 * - **Los contextuales**: aparecen cuando esa zona importa de verdad y no se
 *   pueden adelantar sin mentir —cómo se resuelve un golpe se explica con un
 *   golpe declarado delante—. Estos siguen valiendo en cualquier etapa.
 *
 * `revisar()` recorre `PASOS` en orden y saca el primero no visto cuya
 * condición se cumpla. Los del recorrido comparten condición, así que se
 * encadenan solos: al cerrar uno, `alCerrar` repinta, `revisar` vuelve a correr
 * y sale el siguiente.
 *
 * Los pasos vistos se guardan en el perfil, así que no se repiten. El
 * jugador puede saltarlos todos de una vez, y `reiniciar()` los devuelve.
 */
window.Game = window.Game || {};

window.Game.Tutorial = {
  /** Dónde se da la clase de manejo: la primera etapa de la campaña. */
  RECORRIDO_EN: { raza: 'desterrado', etapa: 1 },

  /**
   * `cuando(motor, params)` decide si el paso toca ahora. `ancla` es el
   * selector de la zona que se resalta, y `antes(contenedor)` prepara la
   * pantalla cuando esa zona está escondida —abrir su pestaña, por ejemplo—.
   */
  PASOS: [
    /* ---------------- El recorrido de la primera etapa ------------------ */
    {
      id: 't_bienvenida',
      tour: true,
      ancla: '.mesa-tablero',
      titulo: 'Esta es la mesa',
      texto:
        'Antes de pelear, un repaso de la pantalla. Arriba el enemigo, abajo ' +
        'tú. Puedes saltarte esto cuando quieras, pero son dos minutos y ' +
        'después el juego se entiende solo.'
    },
    {
      id: 't_lado_rival',
      tour: true,
      ancla: '#panel-rival',
      titulo: 'El lado del enemigo',
      texto:
        'Aquí sale la oleada del calabozo. Las criaturas entran de una en una ' +
        'y, cuando cae una, sale la siguiente. Arriba, junto a su placa, su ' +
        'mano boca abajo: cuántas quedan por venir y cuántas acciones tiene.'
    },
    {
      id: 't_lado_tuyo',
      tour: true,
      ancla: '#panel-jugador .lado-fila',
      titulo: 'Tu puesto en el campo',
      texto:
        'Solo cabe UN personaje tuyo en posición, con su carta de acción ' +
        'pegada al lado. El resto del equipo espera oculto hasta que decidas ' +
        'cambiarlo.'
    },
    {
      id: 't_sangre',
      tour: true,
      ancla: '#placa-jugador .sangre-marcadores',
      titulo: 'La sangre lo es todo',
      texto:
        'Tienes 30 sangres repartidas en tres pilas. <strong>Vida</strong> es ' +
        'la que te queda intacta: si llega a 0, pierdes. <strong>Energía</strong> ' +
        'es la que ya se derramó. <strong>Fuera</strong> es la que se pagó y no ' +
        'vuelve. Las tres suman 30 siempre.'
    },
    {
      id: 't_energia',
      tour: true,
      ancla: '#placa-jugador .sm-energia',
      titulo: 'Recibir daño te da poder',
      texto:
        'Esto es lo que hace raro a AETERNUM: la sangre que pierdes se ' +
        'convierte en energía, y la energía es lo que te deja desplegar ' +
        'personajes caros. Empiezas con 0, así que al principio solo entran ' +
        'los de coste 0.'
    },
    {
      id: 't_zonas',
      tour: true,
      ancla: '#placa-jugador .sangre-zonas',
      titulo: 'Reserva y Hades',
      texto:
        '👥 son los personajes que te esperan en la reserva. ✖ los que han ' +
        'caído al Hades. Quedarte sin ninguno en pie también es perder, así ' +
        'que vigila los dos números.'
    },
    {
      id: 't_fases',
      tour: true,
      ancla: '.mesa-fase',
      titulo: 'El turno va por fases',
      texto:
        'Cuatro, siempre en el mismo orden: <strong>P</strong>ersonaje, ' +
        '<strong>A</strong>cción, <strong>C</strong>ombate y <strong>F</strong>in. ' +
        'Arriba ves en cuál estás; los puntos de la izquierda marcan el ' +
        'recorrido. Al cerrar el turno ambos derramáis una sangre.'
    },
    {
      id: 't_controles',
      tour: true,
      ancla: '#mesa-controles',
      titulo: 'Tu mano',
      texto:
        'Aquí eliges: en la fase de personaje, a quién pones en posición; en ' +
        'la de acción, qué acción le acoplas. Ahora te ofrece a los de tu ' +
        'reserva con su coste.'
    },
    {
      id: 't_avanzar',
      tour: true,
      ancla: '#btn-avanzar',
      titulo: 'Pasar de fase',
      texto:
        'Las fases pasan solas cuando ya no queda nada que hacer; este botón ' +
        'las adelanta. Si tocas la mesa mientras cuenta, espera por ti.'
    },
    {
      id: 't_lupa',
      tour: true,
      ancla: '#lupa',
      titulo: 'La lupa',
      texto:
        'Pasa el ratón por cualquier carta —tuya, del rival, del Hades— y ' +
        'aparece aquí ampliada. Pulsa el panel para verla a pantalla completa y ' +
        'leer su texto sin forzar la vista.'
    },
    {
      id: 't_registro',
      tour: true,
      ancla: '.pestana[data-panel="registro-lista"]',
      titulo: 'El registro',
      texto:
        'Todo lo que pasa queda escrito aquí, turno por turno: quién entró, ' +
        'qué golpeó, cuánta sangre se derramó. Si te pierdes, la respuesta ' +
        'está en este panel.',
      antes: (c) => c.querySelector('.pestana[data-panel="registro-lista"]')?.click()
    },
    {
      id: 't_herramientas',
      tour: true,
      ancla: '#herramientas',
      titulo: 'Las Herramientas: los efectos los aplicas tú',
      texto:
        'AETERNUM no ejecuta solo lo que dicen las cartas, igual que en la ' +
        'mesa de verdad: lo aplicas tú desde aquí. Tienes el dado, los ' +
        'ajustes de ataque y defensa, la sangre, el Hades y el vacío. Todo lo ' +
        'que hagas queda anotado en el registro.',
      antes: (c) => c.querySelector('.pestana[data-panel="herramientas"]')?.click()
    },
    {
      id: 't_recordatorios',
      tour: true,
      ancla: '#pestana-recordatorios',
      titulo: 'Los recordatorios',
      texto:
        'Como los efectos son manuales, el juego te avisa cuándo toca cada ' +
        'uno. Esta pestaña lista lo que tienes pendiente y la carta te sale ' +
        'marcada con un ⚡ en la mesa. Pulsa «Ya está aplicado» cuando lo ' +
        'hayas hecho.',
      antes: (c) => c.querySelector('#pestana-recordatorios')?.click()
    },
    {
      id: 't_sonido',
      tour: true,
      ancla: '.mesa-sonido',
      titulo: 'El sonido',
      texto:
        'Ajusta música, botones y efectos por separado, sin salir de la ' +
        'partida. Se guarda solo.',
      // Se vuelve al registro, que es la pestaña con la que conviene empezar.
      antes: (c) => c.querySelector('.pestana[data-panel="registro-lista"]')?.click()
    },
    {
      id: 't_abandonar',
      tour: true,
      ancla: '#btn-salir-partida',
      titulo: 'Salir',
      texto:
        'Abandona la etapa y vuelve al calabozo. El progreso que ya tenías no ' +
        'se pierde, pero esta partida no cuenta.'
    },
    {
      id: 't_listo',
      tour: true,
      ancla: '#mesa-controles',
      titulo: 'Ya está: te toca',
      texto:
        'Pon a Annia en posición, acóplale una acción y pásale por encima a ' +
        'las ratas. Seguiré avisando de lo importante la primera vez que ' +
        'ocurra.'
    },

    /* -------------------- Los contextuales, en su momento ---------------
     * Los que hablan de TUS controles llevan `esMiTurno`: sin él saltaban
     * también durante el turno del rival —la fase de ataque de la IA cumple
     * «estás en fase de ataque» igual de bien— y el tutorial interrumpía su
     * cadena para explicarte un botón que en ese momento no es tuyo.
     */
    {
      id: 'desplegar',
      ancla: '#mesa-controles',
      titulo: 'Pon a alguien en posición',
      texto:
        'Solo puedes desplegar personajes cuyo coste sea menor o igual a tu ' +
        'energía. En el turno 1 tu energía es 0, así que solo entran los de ' +
        'coste 0.',
      cuando: (m) =>
        window.Game.Tutorial.esMiTurno(m) &&
        m.fase === 'personaje' &&
        m.jugadores[0].activos.length === 0
    },
    {
      id: 'accion',
      ancla: '#mesa-controles',
      titulo: 'La acción decide qué hace',
      texto:
        'Un personaje sin acción no ataca ni defiende. La ofensiva activa su ' +
        'ataque, la defensiva su defensa, y la neutral no activa nada: el ' +
        'daño lo atraviesa y va directo a tu sangre.',
      cuando: (m) =>
        window.Game.Tutorial.esMiTurno(m) &&
        m.fase === 'accion' &&
        m.jugadores[0].activos.length > 0
    },
    {
      id: 'lupa',
      ancla: '#lupa',
      titulo: 'Mira las cartas de cerca',
      texto:
        'Pasa el ratón por cualquier carta para verla aquí, y pulsa el panel ' +
        'para ampliarla a pantalla completa y leer su texto.',
      cuando: (m) => window.Game.Tutorial.esMiTurno(m) && m.fase === 'accion'
    },
    {
      id: 'ataque',
      ancla: '#mesa-atacar',
      titulo: 'Atacar son dos pasos',
      texto:
        'Pulsa ⚔ Atacar y verás la previsión en el centro. El golpe se ' +
        'resuelve solo en un momento; si tocas la mesa, espera a que pulses ' +
        'Resolver, por si quieres aplicar algo antes.',
      cuando: (m) =>
        window.Game.Tutorial.esMiTurno(m) && m.fase === 'ataque' && !m.ataquePendiente
    },
    {
      id: 'herramientas',
      ancla: '.pestana[data-panel="herramientas"]',
      titulo: 'Los efectos los aplicas tú',
      texto:
        'El juego no ejecuta solo los efectos de las cartas. Aquí tienes el ' +
        'dado, los ajustes de ataque y defensa, la sangre y el resto: ' +
        'aplícalos cuando la carta lo pida.',
      cuando: (m) => window.Game.Tutorial.esMiTurno(m) && m.fase === 'ataque'
    },
    {
      // Va ANTES de `combate` a propósito: cuando el golpe es del rival, lo
      // primero que hay que saber es que puedes responder, no cómo se calcula.
      id: 'defensa',
      ancla: '#mesa-atacar',
      titulo: 'Te atacan: puedes responder',
      texto:
        'El rival ha declarado y el golpe está en el aire. Tus defensas ' +
        'automáticas ya se aplicaron; si quieres ajustar algo más, toca la ' +
        'mesa para pararlo y pulsa «Encajar» cuando termines.',
      cuando: (m) => !!m.ataquePendiente && m.jugadorActivo.esIA
    },
    {
      id: 'combate',
      ancla: '#mesa-veredicto',
      titulo: 'Cómo se resuelve el golpe',
      texto:
        'Si el defensor está en ofensiva, se comparan ataques y la ' +
        'diferencia pasa como daño. Si está en defensiva, superarla lo ' +
        'destruye pero no hace sangrar. En neutral, sobrevive y el daño ' +
        'entero va a la sangre.',
      cuando: (m) => !!m.ataquePendiente
    },
    {
      id: 'hades',
      ancla: '#panel-rival .hades',
      titulo: 'El Hades',
      texto:
        'Los destruidos van aquí, a la vista de ambos. Ya no cuentan como ' +
        'personajes en pie: quedarte sin ninguno también es derrota.',
      cuando: (m) => m.jugadores[1].hades.length > 0
    },
    {
      id: 'marca_pendiente',
      ancla: '#pestana-recordatorios',
      titulo: 'Tienes un efecto sin aplicar',
      texto:
        'El ⚡ de una carta significa que su texto impreso pide algo y aún no ' +
        'lo has hecho. Aquí tienes la lista con el texto entero; aplícalo desde ' +
        'Herramientas y márcalo como hecho.',
      cuando: (m, params, pantalla) =>
        !!pantalla && (pantalla.recordatorios || []).length > 0
    }
  ],

  activo: null,

  /**
   * ¿Manda el humano ahora mismo? Lo usan los pasos que explican TUS controles.
   *
   * Sin esto se colaban en el turno del rival: la fase de ataque de la IA
   * cumple «estás en fase de ataque» exactamente igual, así que el tutorial
   * paraba su cadena para explicarte un botón que en ese momento no era tuyo.
   * Un ataque declarado por la IA es la excepción y tiene su propio paso.
   */
  esMiTurno(motor) {
    return !!motor && !motor.jugadorActivo.esIA;
  },

  vistos() {
    const p = window.Game.State.perfil;
    if (!Array.isArray(p.tutorialVisto)) p.tutorialVisto = [];
    return p.tutorialVisto;
  },

  /** ¿Debe enseñarse el tutorial en esta partida? */
  procede(params) {
    if (window.Game.State.perfil.tutorialSaltado) return false;
    // Solo en el modo historia: es donde se aprende.
    return params && params.modo === 'historia';
  },

  /**
   * El recorrido solo se da en la primera etapa de la campaña. Si se ofreciera
   * en cualquier etapa, sus dieciséis burbujas irían apareciendo sueltas por
   * calabozos donde ya no enseñan nada.
   */
  toca(paso, params, motor) {
    if (!paso.tour) return true;
    const r = this.RECORRIDO_EN;
    if (!params || params.raza !== r.raza || Number(params.etapa) !== r.etapa) {
      return false;
    }
    // Antes de mover ficha: en TU primer turno, en la fase de personaje. En
    // el calabozo abre la oleada, así que tu primer turno es el 2 (y la fase
    // de personaje no avanza sola: el recorrido no se corta).
    return motor.numeroTurno <= 2 && motor.jugadorActivo === motor.jugadores[0] && motor.fase === 'personaje';
  },

  /** Cuántos pasos tiene el recorrido y por cuál vas. */
  progresoTour() {
    const tour = this.PASOS.filter((p) => p.tour);
    const vistos = this.vistos();
    const hechos = tour.filter((p) => vistos.includes(p.id)).length;
    return { hechos, total: tour.length };
  },

  /**
   * Muestra el primer paso pendiente cuya condición se cumpla.
   * @param {object} [pantalla] La pantalla de partida, para los pasos que
   *   necesitan mirar su estado (los recordatorios pendientes, por ejemplo).
   */
  revisar(contenedor, motor, params, pantalla) {
    if (!this.procede(params)) return false;
    if (this.activo) return true; // ya hay una burbuja en pantalla

    const vistos = this.vistos();
    const paso = this.PASOS.find((p) => {
      if (vistos.includes(p.id)) return false;
      if (!this.toca(p, params, motor)) return false;
      // Un paso con `antes` puede tener su ancla escondida hasta prepararla,
      // así que ahí no se puede exigir que exista todavía.
      if (!p.antes && !contenedor.querySelector(p.ancla)) return false;
      if (!p.cuando) return true;
      try {
        return p.cuando(motor, params, pantalla);
      } catch {
        return false;
      }
    });
    if (!paso) return false;

    this.mostrar(contenedor, paso);
    return true;
  },

  mostrar(contenedor, paso) {
    this.activo = paso;
    // Prepara la pantalla si la zona está escondida: abrir su pestaña, etc.
    if (paso.antes) {
      try {
        paso.antes(contenedor);
      } catch {
        /* si falla, se intenta anclar de todos modos */
      }
    }
    const objetivo = contenedor.querySelector(paso.ancla);
    if (!objetivo) {
      // Sin ancla no hay burbuja que colocar. Se suelta el paso en vez de
      // dejar `activo` puesto, que bloquearía el tutorial entero.
      this.activo = null;
      return;
    }

    objetivo.classList.add('tutorial-foco');

    const paso_n = paso.tour ? this.progresoTour() : null;
    const burbuja = document.createElement('div');
    burbuja.className = 'tutorial-burbuja';
    burbuja.innerHTML = `
      ${
        paso_n
          ? `<span class="tutorial-cuenta">${paso_n.hechos + 1} de ${paso_n.total}</span>`
          : ''
      }
      <h4>${paso.titulo}</h4>
      <p>${paso.texto}</p>
      <div class="tutorial-pie">
        <button class="tutorial-saltar" type="button">Saltar tutorial</button>
        <button class="btn-primario tutorial-ok" type="button">
          ${paso.tour ? 'Siguiente' : 'Entendido'}
        </button>
      </div>
    `;
    document.body.appendChild(burbuja);
    this.colocar(burbuja, objetivo);

    const cerrar = (saltarTodo) => {
      objetivo.classList.remove('tutorial-foco');
      burbuja.remove();
      this.activo = null;
      if (saltarTodo) {
        window.Game.State.perfil.tutorialSaltado = true;
      } else if (!this.vistos().includes(paso.id)) {
        this.vistos().push(paso.id);
      }
      window.Game.State.guardar();
      if (this.alCerrar) this.alCerrar();
    };

    burbuja.querySelector('.tutorial-ok').addEventListener('click', () => cerrar(false));
    burbuja.querySelector('.tutorial-saltar').addEventListener('click', () => cerrar(true));
  },

  /** Coloca la burbuja junto a la zona, dentro de la ventana. */
  colocar(burbuja, objetivo) {
    const o = objetivo.getBoundingClientRect();
    const b = burbuja.getBoundingClientRect();
    const margen = 12;

    // Debajo si cabe; si no, encima.
    let top = o.bottom + margen;
    if (top + b.height > innerHeight - margen) top = o.top - b.height - margen;
    top = Math.max(margen, Math.min(top, innerHeight - b.height - margen));

    let left = o.left + o.width / 2 - b.width / 2;
    left = Math.max(margen, Math.min(left, innerWidth - b.width - margen));

    burbuja.style.top = `${Math.round(top)}px`;
    burbuja.style.left = `${Math.round(left)}px`;
  },

  /** Limpia lo que haya quedado al cambiar de pantalla. */
  limpiar() {
    document.querySelectorAll('.tutorial-burbuja').forEach((b) => b.remove());
    document
      .querySelectorAll('.tutorial-foco')
      .forEach((e) => e.classList.remove('tutorial-foco'));
    this.activo = null;
  },

  reiniciar() {
    const p = window.Game.State.perfil;
    p.tutorialVisto = [];
    p.tutorialSaltado = false;
    window.Game.State.guardar();
  }
};
