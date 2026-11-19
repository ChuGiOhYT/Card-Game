/**
 * Estado global de la aplicación. Todo lo que sobrevive entre pantallas vive
 * aquí; las pantallas nunca se hablan entre ellas directamente.
 */
window.Game = window.Game || {};

window.Game.State = {
  /** Perfil persistente (se guarda en disco). */
  perfil: {
    razaSeleccionada: null,
    progresoHistoria: {}, // { razaId: capituloAlcanzado }
    // [{ nombre, raza, personajes: [id x5], acciones: [id x8] }]
    equiposGuardados: [],
    partidasJugadas: 0,
    // Pasos del tutorial ya mostrados, y si se saltó del todo.
    tutorialVisto: [],
    tutorialSaltado: false,
    // Mandos del mezclador, de 0 a 1. 1 = la mezcla tal y como se diseñó.
    volumenes: { musica: 1, botones: 1, efectos: 1, narrador: 1 },
    // Narrador de las cinemáticas: 'apagado' | 'normal' | 'suave' (ui/narrador.js).
    narrador: 'apagado',
    nombreRemoto: '',
    // Ids de raza cuyo Eternal ha caído. Las cuatro abren la historia final.
    gemas: [],
    historiaFinalVista: false,
    // El aviso de la recompensa es de un solo uso: una vez leído estorba, que
    // ocupa el sitio de la ficha de la estirpe.
    recompensaFinalAnunciada: false
  },

  /**
   * Calabozos que hay que TERMINAR —las 6 etapas, jefe incluido— para abrir la
   * historia oculta, y con ella el modo solo, el constructor y los mercenarios.
   * Son los cuatro: cada Eternal deja un cristal y hacen falta todos.
   *
   * Se deja como constante porque el número es una decisión de diseño, no un
   * detalle: si algún día se añade un quinto calabozo, esto y
   * `historiaFinalDesbloqueada()` tienen que seguir contando lo mismo.
   */
  CALABOZOS_PARA_DESBLOQUEAR: 4,

  /** Estado volátil de la sesión actual. */
  sesion: {
    modo: null, // 'historia' | 'solo' | 'constructor'
    raza: null,
    mazoActivo: null
  },

  // Un guardado corrupto o inaccesible nunca debe impedir jugar: se registra
  // el fallo y se continúa con el perfil por defecto.
  async cargar() {
    if (!window.gameAPI) return; // ejecutándose fuera de Electron
    try {
      const res = await window.gameAPI.loadGame();
      if (res.ok && res.data) {
        this.perfil = { ...this.perfil, ...res.data };
      } else if (!res.ok) {
        console.warn('No se pudo leer el guardado:', res.error);
      }
    } catch (err) {
      console.warn('No se pudo leer el guardado:', err.message);
    }
  },

  async guardar() {
    if (!window.gameAPI) return;
    try {
      await window.gameAPI.saveGame(this.perfil);
    } catch (err) {
      console.warn('No se pudo guardar la partida:', err.message);
    }
  },

  /** Capítulo alcanzado en la historia de una raza (0 = sin empezar). */
  progresoDe(razaId) {
    return this.perfil.progresoHistoria[razaId] || 0;
  },

  /** Etapas superadas sumando todos los calabozos. */
  etapasCompletadas() {
    return Object.values(this.perfil.progresoHistoria || {}).reduce(
      (s, n) => s + (Number(n) || 0),
      0
    );
  },

  /** ¿Está terminado el calabozo de esta raza, jefe incluido? */
  calabozoCompleto(razaId) {
    const cal = (window.Game.DUNGEONS || {})[razaId];
    return !!cal && this.progresoDe(razaId) >= cal.etapas.length;
  },

  /** Calabozos terminados de principio a fin. */
  calabozosCompletados() {
    return Object.keys(window.Game.DUNGEONS || {}).filter((r) =>
      this.calabozoCompleto(r)
    ).length;
  },

  /**
   * La campaña es lineal: cada calabozo se abre al terminar el anterior,
   * en el orden de `RACE_ORDER`. El primero está siempre disponible.
   */
  calabozoDisponible(razaId) {
    const orden = window.Game.RACE_ORDER || [];
    const i = orden.indexOf(razaId);
    if (i <= 0) return i === 0;
    return this.calabozoCompleto(orden[i - 1]);
  },

  /** Qué raza hay que terminar antes de poder entrar en esta. */
  requisitoDe(razaId) {
    const orden = window.Game.RACE_ORDER || [];
    const i = orden.indexOf(razaId);
    if (i <= 0) return null;
    const previa = orden[i - 1];
    return {
      raza: previa,
      nombre: window.Game.RACES[previa]?.nombre || previa,
      calabozo: (window.Game.DUNGEONS || {})[previa]?.nombre || ''
    };
  },

  /**
   * Lo más lejos que has llegado en cualquier calabozo, para poder decirle
   * al jugador cuánto le queda en vez de un «bloqueado» a secas.
   */
  mejorAvance() {
    const dungeons = window.Game.DUNGEONS || {};
    let mejor = null;
    for (const raza of Object.keys(dungeons)) {
      const hechas = this.progresoDe(raza);
      const total = dungeons[raza].etapas.length;
      if (!mejor || hechas > mejor.hechas) {
        mejor = { raza, nombre: dungeons[raza].nombre, hechas, total };
      }
    }
    return mejor;
  },

  /**
   * ¿Puede entrar ya al modo solo y al constructor de equipos?
   *
   * La llave es la RECOMPENSA de la historia oculta, no el número de calabozos:
   * hay que reunir los cuatro cristales y leerla. Antes bastaba con terminar un
   * calabozo (`CALABOZOS_PARA_DESBLOQUEAR`), y eso abría los dos modos a mitad
   * de campaña; ahora los mercenarios y los dos modos llegan juntos, como
   * premio del final.
   *
   * Ojo con los guardados anteriores: quien tuviera un calabozo hecho y los
   * modos abiertos los verá cerrados hasta terminar la campaña. Es el cambio
   * pedido, no un fallo.
   */
  desbloqueado() {
    return this.recompensaFinalRecibida();
  },

  marcarProgreso(razaId, capitulo) {
    const actual = this.progresoDe(razaId);
    if (capitulo > actual) {
      this.perfil.progresoHistoria[razaId] = capitulo;
      this.guardar();
    }
  },

  /* ------------------------------ Gemas -------------------------------- */

  /**
   * Las gemas no se usan para nada: son constancia de haber derribado a un
   * Eternal, y las cuatro juntas abren la historia final.
   */
  tieneGema(razaId) {
    return (this.perfil.gemas || []).includes(razaId);
  },

  /** @returns {boolean} si era nueva; false si ya la tenías. */
  otorgarGema(razaId) {
    if (!window.Game.gemaDe(razaId)) return false;
    this.perfil.gemas = this.perfil.gemas || [];
    if (this.perfil.gemas.includes(razaId)) return false;
    this.perfil.gemas.push(razaId);
    this.guardar();
    return true;
  },

  /** Las gemas conseguidas, en el orden de la campaña. */
  gemas() {
    return (window.Game.RACE_ORDER || []).filter((r) => this.tieneGema(r));
  },

  /**
   * Repara el inventario a partir del progreso. Hace falta porque las gemas
   * llegaron después: quien ya tenía calabozos terminados se quedaría sin la
   * suya para siempre. Solo añade, nunca quita, así que es inofensivo llamarla
   * en cada arranque.
   */
  sincronizarGemas() {
    let nuevas = 0;
    for (const raza of Object.keys(window.Game.DUNGEONS || {})) {
      if (this.calabozoCompleto(raza) && !this.tieneGema(raza)) {
        this.perfil.gemas = this.perfil.gemas || [];
        this.perfil.gemas.push(raza);
        nuevas++;
      }
    }
    if (nuevas) this.guardar();
    return nuevas;
  },

  /** Las cuatro reunidas abren la historia secreta. */
  historiaFinalDesbloqueada() {
    const total = Object.keys(window.Game.DUNGEONS || {}).length;
    return total > 0 && this.gemas().length >= total;
  },

  historiaFinalVista() {
    return !!this.perfil.historiaFinalVista;
  },

  /**
   * Leer la historia oculta ES recibir su recompensa: los mercenarios, el modo
   * solo y el constructor. Se comprueba también el desbloqueo por si un
   * guardado manipulado trajera la marca sin las cuatro gemas.
   */
  recompensaFinalRecibida() {
    return this.historiaFinalVista() && this.historiaFinalDesbloqueada();
  },

  /** Los mercenarios son la recompensa: antes de ella no están disponibles. */
  mercenariosDisponibles() {
    return this.recompensaFinalRecibida();
  },

  marcarHistoriaFinalVista() {
    if (this.perfil.historiaFinalVista) return;
    this.perfil.historiaFinalVista = true;
    this.guardar();
  },

  /**
   * ¿Queda por anunciar la recompensa? El aviso se enseña una vez y se cierra:
   * dejarlo fijo hunde la ficha de la estirpe fuera de la pantalla.
   */
  recompensaPorAnunciar() {
    return this.recompensaFinalRecibida() && !this.perfil.recompensaFinalAnunciada;
  },

  marcarRecompensaAnunciada() {
    if (this.perfil.recompensaFinalAnunciada) return;
    this.perfil.recompensaFinalAnunciada = true;
    this.guardar();
  },

  /* --------------------------- Reiniciar aventura ------------------------ */

  /** ¿Hay algo que perder? Sin esto, el botón se ofrecería a un perfil nuevo. */
  hayAventuraQueReiniciar() {
    const p = this.perfil;
    return (
      this.etapasCompletadas() > 0 ||
      (p.gemas || []).length > 0 ||
      !!p.razaSeleccionada ||
      !!p.historiaFinalVista
    );
  },

  /**
   * Vuelve la campaña a cero: el modo historia, sus cuatro cristales, la
   * historia oculta y el tutorial (para que se repita, que es parte de
   * empezar de verdad desde el principio).
   *
   * Deliberadamente NO toca `volumenes` (preferencia de sonido, no progreso),
   * `equiposGuardados` (son creaciones del jugador en el constructor, no
   * avance de campaña) ni `partidasJugadas` (estadística acumulada, no ligada
   * solo a la historia). Borrar eso también sería más destructivo de lo que
   * se pidió: «reiniciar la aventura», no «vaciar el perfil entero».
   */
  reiniciarAventura() {
    const p = this.perfil;
    p.progresoHistoria = {};
    p.gemas = [];
    p.historiaFinalVista = false;
    p.recompensaFinalAnunciada = false;
    p.razaSeleccionada = null;
    p.tutorialVisto = [];
    p.tutorialSaltado = false;
    this.sesion.raza = null;
    this.sesion.modo = null;
    this.guardar();
  }
};
