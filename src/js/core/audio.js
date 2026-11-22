/**
 * Sonidos de interfaz.
 *
 * No toca el árbol del documento: crea objetos `Audio` sueltos que nunca se
 * insertan en la página, así que sigue valiendo la regla de que `core/` no
 * pinta nada.
 *
 * Quién suena y cuándo lo decide el oyente global de `app.js`, no las
 * pantallas: ninguna necesita saber que existe el sonido.
 */
window.Game = window.Game || {};

window.Game.Audio = {
  /**
   * El `volumen` de cada pista es la MEZCLA DE DISEÑO: el equilibrio entre
   * unas y otras, afinado a oído y que no se toca desde la interfaz. Lo que
   * mueve el jugador es el mando de su grupo, que multiplica a este número.
   * Con los tres mandos al 100% suena exactamente como se diseñó.
   */
  PISTAS: {
    // Menú, selección de estirpe, calabozo y demás pantallas de navegación.
    menu: { src: 'assets/audio/boton-menu.mp3', volumen: 0.6, grupo: 'botones' },
    // Dentro de la partida, a media voz: ahí habrá más cosas sonando.
    partida: { src: 'assets/audio/boton-partida.wav', volumen: 0.35, grupo: 'botones' },

    // Sucesos de la mesa. Suenan para los DOS bandos: el turno del rival se
    // juega fase a fase y estos avisos son parte de poder seguirlo.
    posicion: { src: 'assets/audio/posicion.mp3', volumen: 0.8, grupo: 'efectos' },
    accion: { src: 'assets/audio/accion.mp3', volumen: 0.5, grupo: 'efectos' },
    ataque: { src: 'assets/audio/ataque.mp3', volumen: 0.6, grupo: 'efectos' }
  },

  /**
   * Los tres mandos del mezclador, en el orden en que se pintan. `muestra` es
   * la pista que se hace sonar al soltar el deslizador, para oír el nivel que
   * acabas de poner; la música no la necesita porque ya está sonando.
   */
  GRUPOS: {
    musica: { etiqueta: 'Música', descripcion: 'Menú, estirpes y batalla', muestra: null },
    botones: { etiqueta: 'Botones', descripcion: 'Clics de la interfaz', muestra: 'menu' },
    efectos: {
      etiqueta: 'Efectos de batalla',
      descripcion: 'Posición, acción y golpes',
      muestra: 'ataque'
    },
    narrador: { etiqueta: 'Narrador', descripcion: 'La voz de las cinemáticas', muestra: null },
    voces: { etiqueta: 'Voces de personajes', descripcion: 'Lo que dicen los personajes', muestra: null }
  },

  /** Nivel de cada mando, de 0 a 1. Se guardan en el perfil. */
  niveles: { musica: 1, botones: 1, efectos: 1, narrador: 1, voces: 1 },

  /**
   * Música de fondo. Nada que ver con los efectos: aquí NO se clona nada,
   * porque solo puede haber una pieza sonando y hay que poder pararla.
   */
  MUSICA: {
    inicio: { src: 'assets/audio/menu-inicio.mp3', volumen: 0.5 },
    // Más baja que la del menú: dentro de la partida compite con los sucesos
    // de la mesa, que son información y no adorno.
    batalla: { src: 'assets/audio/batalla.mp3', volumen: 0.4 },

    // Un tema por estirpe. La clave ES el id de la raza a propósito: así
    // `ponerMusica(razaId)` funciona sin tabla de traducción por medio.
    desterrado: { src: 'assets/audio/desterrado.mp3', volumen: 0.5 },
    lunaria: { src: 'assets/audio/lunaria.mp3', volumen: 0.5 },
    oxitron: { src: 'assets/audio/oxitron.mp3', volumen: 0.5 },
    reanimado: { src: 'assets/audio/reanimado.mp3', volumen: 0.5 }
  },

  /** Elemento base por pista, solo para tener el archivo en caché. */
  _base: {},
  _musica: null,
  _musicaNombre: null,

  precargar() {
    this.cargarNiveles();
    for (const [nombre, pista] of Object.entries(this.PISTAS)) {
      const el = new Audio(pista.src);
      el.preload = 'auto';
      this._base[nombre] = el;
    }
  },

  /* ---------------------------- Mezclador ------------------------------- */

  /**
   * Lee los niveles del perfil. Tolerante con lo que encuentre: un guardado de
   * una versión anterior no los tiene, y uno manipulado a mano puede traer
   * cualquier cosa. Lo que no sea un número usable se queda en 1.
   */
  cargarNiveles() {
    const guardados = (window.Game.State && window.Game.State.perfil.volumenes) || {};
    for (const grupo of Object.keys(this.GRUPOS)) {
      const v = Number(guardados[grupo]);
      this.niveles[grupo] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
    }
    this.aplicarNiveles();
  },

  /** Nivel de un mando, de 0 a 1. */
  nivel(grupo) {
    const v = this.niveles[grupo];
    return Number.isFinite(v) ? v : 1;
  },

  /**
   * Mueve un mando. La música se entera en el acto —está sonando ahora
   * mismo—; los efectos y los botones lo notarán en su próximo disparo,
   * porque cada uno calcula su volumen al reproducirse.
   */
  ponerNivel(grupo, valor, { guardar = true } = {}) {
    if (!this.GRUPOS[grupo]) return;
    const v = Number(valor);
    this.niveles[grupo] = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
    this.aplicarNiveles();
    if (guardar && window.Game.State) {
      window.Game.State.perfil.volumenes = { ...this.niveles };
      window.Game.State.guardar();
    }
  },

  /** Empuja el nivel de música a la pieza que ya está sonando. */
  aplicarNiveles() {
    if (!this._musica || !this._musicaNombre) return;
    const pista = this.MUSICA[this._musicaNombre];
    if (pista) this._musica.volume = this.volumenDe(pista, 'musica');
  },

  /** Mezcla de diseño por el mando del grupo, sin salirse de 0..1. */
  volumenDe(pista, grupo) {
    const bruto = (pista.volumen || 0) * this.nivel(grupo);
    return Math.max(0, Math.min(1, bruto));
  },

  /**
   * Se clona el elemento en cada disparo para que dos clics seguidos suenen
   * los dos: reutilizar el mismo `Audio` cortaría el sonido anterior.
   */
  reproducir(nombre) {
    const pista = this.PISTAS[nombre];
    const base = this._base[nombre];
    if (!pista || !base) return;

    const son = base.cloneNode();
    son.volume = this.volumenDe(pista, pista.grupo);
    // El audio es un adorno: si el navegador se niega a reproducir, se calla
    // y no se lleva por delante el clic que lo disparó.
    const intento = son.play();
    if (intento) intento.catch(() => {});
  },

  /* ------------------------------ Música -------------------------------- */

  /**
   * Pone una pieza en bucle. Si ya está sonando esa misma no la reinicia:
   * volver al menú no tiene por qué cortar la música por la mitad.
   */
  ponerMusica(nombre) {
    // Una historia secreta suena con la música de su campaña de aspecto.
    const aspecto = window.Game.RACES && window.Game.RACES[nombre] && window.Game.RACES[nombre].aspecto;
    if (!this.MUSICA[nombre] && aspecto) nombre = aspecto;
    const pista = this.MUSICA[nombre];
    if (!pista) return;
    if (this._musicaNombre === nombre && this._musica) return;

    this.quitarMusica({ desvanecer: 0 });

    const el = new Audio(pista.src);
    el.loop = true;
    el.volume = this.volumenDe(pista, 'musica');
    this._musica = el;
    this._musicaNombre = nombre;
    this._arrancar(el);
  },

  /**
   * Chromium puede exigir un gesto del usuario antes de dejar sonar audio con
   * volumen. El vídeo del menú se libra porque va `muted`; la música, no. Si
   * el primer intento se rechaza, se reintenta con el primer clic o tecla.
   */
  _arrancar(el) {
    const intento = el.play();
    if (!intento) return;
    intento.catch(() => {
      const reintentar = () => {
        document.removeEventListener('pointerdown', reintentar, true);
        document.removeEventListener('keydown', reintentar, true);
        // Solo si sigue siendo la pieza vigente: puede haberse cambiado de
        // pantalla entre el rechazo y el primer clic.
        if (this._musica === el) {
          const otro = el.play();
          if (otro) otro.catch(() => {});
        }
      };
      document.addEventListener('pointerdown', reintentar, true);
      document.addEventListener('keydown', reintentar, true);
    });
  },

  /** Para la música. Con un desvanecido corto, que el corte seco canta. */
  quitarMusica({ desvanecer = 500 } = {}) {
    const el = this._musica;
    this._musica = null;
    this._musicaNombre = null;
    if (!el) return;

    if (!desvanecer) {
      el.pause();
      return;
    }
    const paso = el.volume / Math.max(1, desvanecer / 50);
    const temporizador = setInterval(() => {
      el.volume = Math.max(0, el.volume - paso);
      if (el.volume <= 0.001) {
        clearInterval(temporizador);
        el.pause();
      }
    }, 50);
  }
};
