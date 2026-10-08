/**
 * Motor de turnos.
 *
 * La sangre es vida y poder a la vez: cada jugador arranca con 30 sangres
 * intactas. Lo derramado se resta a la vida y, simultáneamente, marca cuánta
 * energía tiene disponible (no se gasta: es un umbral).
 *
 * Un jugador puede tener varios personajes en posición a la vez, hasta
 * `maxActivos`. Para el jugador humano ese límite es SIEMPRE 1, tanto en
 * duelo como en calabozo: el resto de su equipo espera en la reserva. Solo
 * el lado del calabozo lo sube, para desplegar toda su oleada de criaturas.
 *
 * Fases del turno: personaje → accion → ataque → fin
 * Al cerrar el turno se derrama 1 sangre de CADA jugador.
 */
window.Game = window.Game || {};

window.Game.SANGRE_TOTAL = 30;
window.Game.FASES = ['personaje', 'accion', 'ataque', 'fin'];

window.Game.ETIQUETA_FASE = {
  personaje: 'Personaje',
  accion: 'Acción',
  ataque: 'Ataque',
  fin: 'Fin de turno'
};

/** Letra de cada fase para el indicador de la mesa. */
window.Game.INICIAL_FASE = {
  personaje: 'P',
  accion: 'A',
  ataque: 'C',
  fin: 'F'
};

/** Nombre largo del indicador. La letra «C» es de combate, no de ataque, así
 *  que el rótulo del punto no puede reutilizar `ETIQUETA_FASE` sin chirriar. */
window.Game.NOMBRE_FASE = {
  personaje: 'Toma de posición',
  accion: 'Toma de acción',
  ataque: 'Combate',
  fin: 'Final'
};

let contadorUid = 0;

window.Game.crearJugador = function (
  nombre,
  razaId,
  equipo,
  acciones,
  esIA = false,
  opciones = {}
) {
  return {
    nombre,
    raza: razaId,
    esIA,
    equipo: [...equipo],
    acciones: [...acciones],
    // Cuántos personajes puede sostener en posición a la vez.
    maxActivos: opciones.maxActivos || 1,
    // Las criaturas de calabozo entran a campo sin pagar coste.
    ignoraCoste: !!opciones.ignoraCoste,
    // Sale a campo en el orden en que se escribió el equipo, en vez de por
    // potencia. Lo usan las oleadas de calabozo para respetar su escalada.
    ordenFijo: !!opciones.ordenFijo,
    sangre: { pila: window.Game.SANGRE_TOTAL, gasto: 0, fuera: 0 },
    reserva: equipo.map((id) => ({
      uid: `u${++contadorUid}`,
      personaje: id,
      accion: null,
      modificadores: { ataque: 0, defensa: 0 }
    })),
    /** Personajes en posición. Nunca más de `maxActivos`. */
    activos: [],
    hades: [],
    /**
     * El vacío: zona adyacente al Hades, un paso más lejos. Solo se llega
     * desde el Hades y solo se vuelve al Hades, nunca al campo directamente,
     * así que sacar algo de aquí cuesta dos movimientos. Hoy la mueve Errante.
     */
    vacio: [],
    revelados: new Set()
  };
};

window.Game.TurnEngine = class TurnEngine {
  constructor({ jugador, oponente, alCambiar }) {
    this.jugadores = [jugador, oponente];
    this.turnoDe = 0;
    this.numeroTurno = 1;
    this.fase = 'personaje';
    this.alCambiar = alCambiar || (() => {});
    this.terminada = false;
    this.ganador = null;
    this.perdedor = null;
    /** 'sangre' | 'personajes' — por qué acabó el duelo. */
    this.motivoFin = null;
    this.registro = [];
    this.atacaronEsteTurno = new Set(); // uids que ya golpearon
    // Puestos por las herramientas manuales: [{jugador, cartaId, turnos}]
    this.bloqueos = [];
    this.accionesNegadas = false;

    // Efectos con caducidad de las habilidades de jefe. Una «serie» de las
    // cartas se traduce aquí como un turno.
    // [{ jugadorIdx, uid, ataque, defensa, turnos, motivo }] — al caducar se
    // restan los mismos números, así que el personaje vuelve a lo que era.
    this.efectosTemporales = [];
    // [{ jugadorIdx, turnos }] — sin cambiar de personaje ni de acción.
    this.aturdidos = [];
    // Ataque declarado y aún sin resolver: {atacanteUid, defensorUid}
    this.ataquePendiente = null;
  }

  get jugadorActivo() {
    return this.jugadores[this.turnoDe];
  }

  get jugadorInactivo() {
    return this.jugadores[1 - this.turnoDe];
  }

  vidaDe(j) {
    return j.sangre.pila;
  }

  energiaDe(j) {
    return j.sangre.gasto;
  }

  /** Atajo para el caso de un solo activo (duelos). */
  activoDe(j) {
    return j.activos[0] || null;
  }

  instancia(jugador, uid) {
    return (
      jugador.activos.find((i) => i.uid === uid) ||
      jugador.reserva.find((i) => i.uid === uid) ||
      jugador.hades.find((i) => i.uid === uid) ||
      jugador.vacio.find((i) => i.uid === uid) ||
      null
    );
  }

  log(texto) {
    this.registro.push({ turno: this.numeroTurno, texto });
  }

  notificar() {
    this.alCambiar(this);
  }

  iniciar() {
    this.log(`Comienza el duelo. ${this.jugadorActivo.nombre} abre.`);
    this.notificar();
  }

  /* ------------------- Efectos con caducidad (jefes) -------------------- */

  /** ¿Este jugador no puede cambiar de personaje ni de acción? (Cegar) */
  estaAturdido(jugador) {
    const idx = this.jugadores.indexOf(jugador);
    return this.aturdidos.some((a) => a.jugadorIdx === idx);
  }

  /**
   * Mientras el jefe tenga esbirros en posición, no se le puede atacar a él.
   * Lo dicen las cuatro cartas de «Convocar».
   * @returns {boolean} true si `inst` es un Eternal protegido por esbirros.
   */
  /**
   * ¿Hay un esbirro vivo que cubra a este Eternal?
   *
   * Mira los puestos Y la zona de espera. Antes solo miraba `activos`, y con
   * eso la regla no llegaba a aplicarse nunca: la oleada de calabozo tiene
   * `maxActivos: 1`, así que el Eternal y un esbirro no pueden compartir
   * posición por definición. La condición era imposible y el código, muerto.
   *
   * El Hades no cuenta: de ahí no cubre nadie mientras algo no lo devuelva.
   */
  eternalProtegido(jugador, inst) {
    if (!inst) return false;
    const c = window.Game.CHARACTERS_BY_ID[inst.personaje];
    if (!c || c.raza !== 'eternal') return false;
    return this.esbirrosVivos(jugador).length > 0;
  }

  /** Esbirros en pie de ese bando, en posición o esperando. */
  esbirrosVivos(jugador) {
    return [...jugador.activos, ...jugador.reserva].filter((i) => {
      const c = window.Game.CHARACTERS_BY_ID[i.personaje];
      return c && c.esEsbirro;
    });
  }

  /**
   * Quién encajaría un golpe dirigido a `inst`, SIN mover nada.
   *
   * Existe aparte de `interponerEsbirro` porque esa sí mueve el tablero, y una
   * previsión que reordenase la oleada solo por pasar el ratón sería un
   * desastre. El orden de `esbirrosVivos` —posición antes que espera— es el
   * mismo que usa la interposición, así que las dos coinciden.
   */
  defensorEfectivo(jugador, inst) {
    if (!this.eternalProtegido(jugador, inst)) return inst;
    return this.esbirrosVivos(jugador)[0] || inst;
  }

  /**
   * Pone un esbirro delante del jefe y devuelve quién encaja el golpe.
   *
   * Si ya hay uno en posición, ese. Si no, sale de la reserva: el Eternal cede
   * el puesto y se repliega, que es la misma maniobra que hace `Convocar`. Así
   * se cumple «si hay un esbirro en campo no puedes atacar al eternal» sin
   * tocar la regla de un solo personaje en posición por bando.
   */
  interponerEsbirro(jugador, jefeInst) {
    const esEsbirro = (i) => {
      const c = window.Game.CHARACTERS_BY_ID[i.personaje];
      return c && c.esEsbirro;
    };

    const yaDelante = jugador.activos.find(esEsbirro);
    if (yaDelante) return yaDelante;

    const enEspera = jugador.reserva.find(esEsbirro);
    if (!enEspera) return null;

    // Solo se repliega el jefe si no queda hueco: con varios puestos, el
    // esbirro entra sin echar a nadie.
    if (jugador.activos.length >= jugador.maxActivos) {
      this.retirar(jugador, jefeInst);
    }
    jugador.reserva = jugador.reserva.filter((i) => i !== enEspera);
    jugador.activos.push(enEspera);

    const nJefe = window.Game.CHARACTERS_BY_ID[jefeInst.personaje].nombre;
    const nEsb = window.Game.CHARACTERS_BY_ID[enEspera.personaje].nombre;
    this.log(
      `🛡 ${nEsb} se planta delante de ${nJefe}, que se repliega: habrá que ` +
        `derribar al esbirro para volver a tenerlo a tiro.`
    );
    return enEspera;
  }

  /* ---------------------------- Sangre --------------------------------- */

  /** pila -> gasto. Pierde vida, gana energía. */
  derramar(jugador, n, motivo) {
    if (n <= 0) return 0;
    const real = Math.min(n, jugador.sangre.pila);
    jugador.sangre.pila -= real;
    jugador.sangre.gasto += real;
    this.log(
      `${jugador.nombre} derrama ${real} sangre (${motivo}). ` +
        `Vida ${this.vidaDe(jugador)}, energía ${this.energiaDe(jugador)}.`
    );
    this.comprobarFin();
    return real;
  }

  /** gasto -> fuera del juego. Coste real de las cartas que dicen «paga». */
  pagar(jugador, n, motivo) {
    if (n <= 0) return true;
    if (jugador.sangre.gasto < n) return false;
    jugador.sangre.gasto -= n;
    jugador.sangre.fuera += n;
    this.log(
      `${jugador.nombre} paga ${n} sangre (${motivo}); sale del juego. ` +
        `Energía ${this.energiaDe(jugador)}.`
    );
    return true;
  }

  /** gasto -> pila. Cura a costa de energía (Devoción). */
  recuperar(jugador, n, motivo) {
    if (n <= 0) return 0;
    const real = Math.min(n, jugador.sangre.gasto);
    jugador.sangre.gasto -= real;
    jugador.sangre.pila += real;
    this.log(
      `${jugador.nombre} recupera ${real} sangre (${motivo}). ` +
        `Vida ${this.vidaDe(jugador)}, energía ${this.energiaDe(jugador)}.`
    );
    return real;
  }

  /* ------------------------------ Hades -------------------------------- */

  /** Retira una carta del campo dejándola revelada para siempre. */
  revelar(jugador, cartaId) {
    if (cartaId) jugador.revelados.add(cartaId);
  }

  enviarAlHades(jugador, inst, motivo = 'efecto') {
    if (!inst) return false;

    const enPosicion = jugador.activos.includes(inst);
    const enReserva = jugador.reserva.includes(inst);
    if (!enPosicion && !enReserva) return false;

    if (enPosicion) jugador.activos = jugador.activos.filter((i) => i !== inst);
    if (enReserva) jugador.reserva = jugador.reserva.filter((i) => i !== inst);

    this.revelar(jugador, inst.personaje);
    if (inst.accion) {
      this.revelar(jugador, inst.accion);
      inst.accion = null;
    }
    inst.modificadores = { ataque: 0, defensa: 0 };

    jugador.hades.push(inst);
    this.log(
      `${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre} va al Hades ` +
        `(${motivo}). Hades de ${jugador.nombre}: ${jugador.hades.length}.`
    );
    // Perder al último personaje también termina el duelo.
    this.comprobarFin();
    // El panel de Herramientas llama aquí directamente, así que sin avisar
    // la mesa se quedaba sin repintar: la carta seguía viéndose en posición
    // y el contador del Hades sin subir hasta el siguiente cambio de estado.
    this.notificar();
    return true;
  }

  recuperarDelHades(jugador, uid, { costeSangre = 0, motivo = 'efecto' } = {}) {
    const inst = jugador.hades.find((i) => i.uid === uid);
    if (!inst) return false;

    if (costeSangre > 0 && !this.pagar(jugador, costeSangre, motivo)) {
      this.log(
        `${jugador.nombre} no tiene ${costeSangre} de sangre derramada ` +
          `para recuperar del Hades.`
      );
      return false;
    }

    jugador.hades = jugador.hades.filter((i) => i !== inst);
    jugador.reserva.push(inst);
    this.log(
      `${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre} vuelve del ` +
        `Hades a la zona de equipo (${motivo}).`
    );
    this.notificar();
    return true;
  }

  /* ----------------------------- El vacío ------------------------------ */

  /**
   * Hades → vacío. Un paso más lejos del campo: de aquí no se vuelve a la
   * mesa, solo al Hades, así que rescatar algo cuesta dos movimientos.
   *
   * Es adyacente al Hades a propósito y solo se comunica con él: no se puede
   * mandar al vacío algo que está en posición ni en la reserva. Si hiciera
   * falta, primero al Hades.
   */
  enviarAlVacio(jugador, uid, motivo = 'efecto') {
    const inst = jugador.hades.find((i) => i.uid === uid);
    if (!inst) return false;

    jugador.hades = jugador.hades.filter((i) => i !== inst);
    jugador.vacio.push(inst);
    this.log(
      `${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre} pasa del Hades ` +
        `al vacío (${motivo}). Vacío de ${jugador.nombre}: ${jugador.vacio.length}.`
    );
    this.notificar();
    return true;
  }

  /** Vacío → Hades. La única salida, y deja la carta a un paso del campo. */
  recuperarDelVacio(jugador, uid, motivo = 'efecto') {
    const inst = jugador.vacio.find((i) => i.uid === uid);
    if (!inst) return false;

    jugador.vacio = jugador.vacio.filter((i) => i !== inst);
    jugador.hades.push(inst);
    this.log(
      `${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre} vuelve del ` +
        `vacío al Hades (${motivo}).`
    );
    this.notificar();
    return true;
  }

  /* --------------------------- Personajes ------------------------------ */

  puedeDesplegar(jugador, inst) {
    if (jugador.ignoraCoste) return true;
    const p = window.Game.CHARACTERS_BY_ID[inst.personaje];
    return p.coste <= this.energiaDe(jugador);
  }

  /** Saca un personaje de posición y lo devuelve a la reserva, revelado. */
  retirar(jugador, inst) {
    jugador.activos = jugador.activos.filter((i) => i !== inst);
    this.revelar(jugador, inst.personaje);
    this.revelar(jugador, inst.accion);
    inst.accion = null;
    inst.modificadores = { ataque: 0, defensa: 0 };
    jugador.reserva.push(inst);
    this.log(
      `${jugador.nombre} retira a ` +
        `${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre}.`
    );
  }

  /**
   * Pone un personaje en posición. Si los puestos están llenos, el más
   * antiguo se retira (en un duelo, con un solo puesto, esto es el cambio
   * de personaje activo de toda la vida).
   */
  desplegar(uid, { saltarFase = false } = {}) {
    if (!saltarFase && this.fase !== 'personaje') return false;
    if (this.terminada) return false;
    if (this.estaAturdido(this.jugadorActivo)) return false;

    const j = this.jugadorActivo;
    const inst = j.reserva.find((i) => i.uid === uid);
    if (!inst || !this.puedeDesplegar(j, inst)) return false;

    if (j.activos.length >= j.maxActivos) this.retirar(j, j.activos[0]);

    j.reserva = j.reserva.filter((i) => i.uid !== uid);
    j.activos.push(inst);
    // Queda marcado que esta instancia ya pisó el campo. Sirve para distinguir
    // «replegado» de «todavía no ha salido», que desde el estado son
    // indistinguibles: en los dos casos está en la reserva con alguien delante.
    // Los jefes lo usan para seguir lanzando habilidades desde detrás.
    inst.salioAlCampo = true;
    this.log(
      `${j.nombre} despliega a ` +
        `${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre}.`
    );
    this.notificar();
    return true;
  }

  /* ---------------------------- Acciones ------------------------------- */

  /** Acciones libres: las del equipo menos las acopladas a algún activo. */
  accionesDisponibles(jugador) {
    const enUso = new Set(jugador.activos.map((i) => i.accion).filter(Boolean));
    return jugador.acciones.filter((id) => !enUso.has(id));
  }

  /**
   * Acopla una acción a un personaje en posición.
   * @param {string} accionId
   * @param {string} [uid] personaje destino; por defecto el primero.
   */
  equipar(accionId, uid = null, { saltarFase = false } = {}) {
    if (!saltarFase && this.fase !== 'accion') return false;
    if (this.terminada) return false;
    if (this.estaAturdido(this.jugadorActivo)) return false;

    const j = this.jugadorActivo;
    const destino = uid
      ? j.activos.find((i) => i.uid === uid)
      : j.activos[0];
    if (!destino) return false;
    if (!j.acciones.includes(accionId)) return false;
    // No se puede duplicar una acción ya acoplada a otro personaje.
    if (j.activos.some((i) => i !== destino && i.accion === accionId)) return false;

    if (destino.accion) this.revelar(j, destino.accion);
    destino.accion = accionId;

    const accion = window.Game.ACTIONS_BY_ID[accionId];
    this.log(
      `${j.nombre} acopla «${accion.nombre}» a ` +
        `${window.Game.CHARACTERS_BY_ID[destino.personaje].nombre}.`
    );
    // El efecto impreso todavía no se ejecuta solo: queda en el registro.
    if (accion.texto) this.log(`  ↳ ${accion.texto}`);

    this.notificar();
    return true;
  }

  /* ----------------------------- Ataque -------------------------------- */

  /** Personajes propios que aún pueden golpear este turno. */
  atacantesDisponibles(jugador = this.jugadorActivo) {
    return jugador.activos.filter(
      (i) =>
        !this.atacaronEsteTurno.has(i.uid) &&
        window.Game.Combat.puedeAtacar(i)
    );
  }

  puedeAtacar() {
    return (
      this.fase === 'ataque' &&
      !this.terminada &&
      this.atacantesDisponibles().length > 0
    );
  }

  /**
   * Declara un ataque sin resolverlo. Queda pendiente para que se puedan
   * aplicar los efectos de «Fase de combate» (Finta, Acrobático, Bloquear…)
   * antes de calcular el resultado.
   *
   * Sin `defensorUid` apunta al primer activo rival; si el campo está vacío el
   * daño irá directo a la sangre.
   */
  declararAtaque(atacanteUid = null, defensorUid = null) {
    if (this.fase !== 'ataque' || this.terminada) return false;
    if (this.ataquePendiente) return false;

    const atacante = this.jugadorActivo;
    const defensor = this.jugadorInactivo;

    const insAtacante = atacanteUid
      ? atacante.activos.find((i) => i.uid === atacanteUid)
      : this.atacantesDisponibles()[0];
    if (!insAtacante) return false;
    if (this.atacaronEsteTurno.has(insAtacante.uid)) return false;
    if (!window.Game.Combat.puedeAtacar(insAtacante)) return false;

    let insDefensor = defensorUid
      ? defensor.activos.find((i) => i.uid === defensorUid)
      : defensor.activos[0] || null;

    // Con esbirros en pie, el Eternal no es un objetivo válido: el esbirro se
    // interpone y encaja el golpe, para que el ataque no se pierda por un clic.
    if (this.eternalProtegido(defensor, insDefensor)) {
      const esbirro = this.interponerEsbirro(defensor, insDefensor);
      if (esbirro) insDefensor = esbirro;
    }

    this.ataquePendiente = {
      atacanteUid: insAtacante.uid,
      defensorUid: insDefensor ? insDefensor.uid : null
    };

    const nAtk = window.Game.CHARACTERS_BY_ID[insAtacante.personaje].nombre;
    const nDef = insDefensor
      ? window.Game.CHARACTERS_BY_ID[insDefensor.personaje].nombre
      : 'la sangre rival';
    this.log(`⚔ ${nAtk} declara ataque contra ${nDef}. Aplica efectos y resuelve.`);
    this.notificar();

    // Si el defensor es la IA, aplica AQUÍ su carta defensiva: ya está el
    // ataque declarado pero sin resolver, así que la previsión que ve el
    // jugador incluye el efecto y el rival no queda inerte mientras le pegan.
    // El efecto puede cancelar el ataque (Bloquear 1/6, Acrobático 5/6), y en
    // ese caso `ataquePendiente` queda a null: quien llame debe comprobarlo.
    if (defensor.esIA && insDefensor && window.Game.AccionesIA) {
      window.Game.AccionesIA.alSerAtacada(this, defensor, insDefensor, {
        atacanteInst: insAtacante,
        atacanteJugador: atacante,
        atacante
      });
    }

    return true;
  }

  /** Instancias implicadas en el ataque pendiente, o null. */
  implicadosAtaque() {
    if (!this.ataquePendiente) return null;
    const { atacanteUid, defensorUid } = this.ataquePendiente;
    return {
      atacante: this.jugadorActivo.activos.find((i) => i.uid === atacanteUid) || null,
      defensor: defensorUid
        ? this.jugadorInactivo.activos.find((i) => i.uid === defensorUid) || null
        : null
    };
  }

  /**
   * Cómo quedaría el ataque pendiente con los valores de AHORA MISMO, sin
   * aplicarlo. La interfaz lo repinta cada vez que tocas una herramienta.
   */
  previsionAtaque() {
    const imp = this.implicadosAtaque();
    if (!imp || !imp.atacante) return null;
    return window.Game.Combat.resolver(imp.atacante, imp.defensor);
  }

  cancelarAtaque() {
    if (!this.ataquePendiente) return false;
    this.ataquePendiente = null;
    this.log('⚔ Ataque retirado antes de resolverse.');
    this.notificar();
    return true;
  }

  /** Resuelve el ataque declarado con los valores que tenga en este momento. */
  resolverAtaque() {
    const imp = this.implicadosAtaque();
    if (!imp || !imp.atacante) {
      this.ataquePendiente = null;
      return null;
    }

    const atacante = this.jugadorActivo;
    const defensor = this.jugadorInactivo;
    const res = window.Game.Combat.resolver(imp.atacante, imp.defensor);
    this.log(res.mensaje);
    this.atacaronEsteTurno.add(imp.atacante.uid);
    this.ataquePendiente = null;

    if (res.destruido && imp.defensor) {
      this.enviarAlHades(defensor, imp.defensor, 'destruido en combate');
    }
    if (res.danoSangre > 0) {
      this.derramar(defensor, res.danoSangre, 'daño de combate');
    }
    // El reflejo del escudo va contra QUIEN ATACÓ, que es lo único de todo el
    // combate que sangra en el lado del atacante. Se coge `jugadorActivo` antes
    // de nada: derramar puede terminar la partida y cambiar el turno.
    if (res.danoReflejado > 0) {
      this.derramar(atacante, res.danoReflejado, 'reflejo del escudo');
    }

    // Va al final, ya cobrado todo: si se anotara antes, un repintado
    // intermedio —`enviarAlHades` notifica— animaría sobre un tablero a medio
    // resolver.
    this.anotarGolpe({
      atacante,
      defensor,
      atacanteInst: imp.atacante,
      defensorInst: imp.defensor,
      destruido: res.destruido,
      danoSangre: res.danoSangre,
      danoReflejado: res.danoReflejado
    });

    this.notificar();
    return res;
  }

  /**
   * Deja el parte del último golpe para quien pinte: quién lo encajó y cuánto
   * dolió. El motor no anima nada —no toca el DOM—, solo deja el dato; la
   * pantalla decide si lo convierte en movimiento.
   *
   * Vive aquí, y no en cada sitio que golpea, porque el contador `n` tiene que
   * ser uno solo: lo escriben `resolverAtaque` y el golpe al grupo de los
   * jefes, que son vías distintas del mismo suceso.
   *
   * `n` es un contador y no una marca de tiempo a propósito: la pantalla
   * repinta varias veces por golpe y necesita distinguir «otro golpe» de «el
   * mismo otra vez». Comparar turno y uid no bastaría —dos golpes iguales en
   * el mismo turno se verían como uno—.
   *
   * Todos los campos son opcionales salvo el daño: un golpe al grupo sin nadie
   * en posición no tiene defensor, y un jefe del que no se sabe el bando no
   * tiene atacante localizable. La pantalla ya tolera los huecos.
   */
  anotarGolpe({
    atacante = null,
    defensor = null,
    atacanteInst = null,
    defensorInst = null,
    destruido = false,
    danoSangre = 0,
    danoReflejado = 0
  } = {}) {
    this.ultimoGolpe = {
      n: (this.ultimoGolpe ? this.ultimoGolpe.n : 0) + 1,
      atacanteUid: atacanteInst ? atacanteInst.uid : null,
      defensorUid: defensorInst ? defensorInst.uid : null,
      // Índices y no referencias: la pantalla los resuelve al repintar.
      atacanteIdx: atacante ? this.jugadores.indexOf(atacante) : -1,
      defensorIdx: defensor ? this.jugadores.indexOf(defensor) : -1,
      destruido: !!destruido,
      danoSangre: danoSangre || 0,
      danoReflejado: danoReflejado || 0,
      turno: this.numeroTurno
    };
    return this.ultimoGolpe;
  }

  /** Declara y resuelve de una vez. Lo usa la IA, que no aplica efectos. */
  atacar(atacanteUid = null, defensorUid = null) {
    if (!this.declararAtaque(atacanteUid, defensorUid)) return null;
    return this.resolverAtaque();
  }

  /* ------------------------------ Fases -------------------------------- */

  siguienteFase() {
    if (this.terminada) return;
    // Con un ataque declarado hay que resolverlo o retirarlo antes de seguir:
    // si no, se perdería sin aplicarse.
    if (this.ataquePendiente) return;
    const i = window.Game.FASES.indexOf(this.fase);
    if (i < window.Game.FASES.length - 1) {
      this.fase = window.Game.FASES[i + 1];
      this.notificar();
    } else {
      this.finalizarTurno();
    }
  }

  finalizarTurno() {
    if (this.terminada) return;
    this.ataquePendiente = null;

    // Derrame automático de fin de turno: 1 sangre de cada jugador.
    for (const j of this.jugadores) {
      this.derramar(j, 1, 'fin de turno');
      if (this.terminada) return;
    }

    // Los bloqueos manuales caducan solos.
    this.bloqueos = this.bloqueos
      .map((b) => ({ ...b, turnos: b.turnos - 1 }))
      .filter((b) => {
        if (b.turnos > 0) return true;
        this.log(`⛓ «${window.Game.Manual.nombreCarta(b.cartaId)}» queda libre.`);
        return false;
      });
    this.accionesNegadas = false;

    // Los modificadores temporales se revierten restando lo mismo que se
    // sumó, en vez de poner a cero: así no se llevan por delante los bonus
    // permanentes que el jugador haya aplicado a mano.
    this.efectosTemporales = this.efectosTemporales
      .map((e) => ({ ...e, turnos: e.turnos - 1 }))
      .filter((e) => {
        if (e.turnos > 0) return true;
        const j = this.jugadores[e.jugadorIdx];
        const inst = [...j.activos, ...j.reserva].find((i) => i.uid === e.uid);
        if (inst && inst.modificadores) {
          inst.modificadores.ataque -= e.ataque;
          inst.modificadores.defensa -= e.defensa;
          this.log(`⏳ Se pasa el efecto «${e.motivo}».`);
        }
        return false;
      });

    this.aturdidos = this.aturdidos
      .map((a) => ({ ...a, turnos: a.turnos - 1 }))
      .filter((a) => {
        if (a.turnos > 0) return true;
        this.log(`⏳ ${this.jugadores[a.jugadorIdx].nombre} deja de estar aturdido.`);
        return false;
      });

    this.turnoDe = 1 - this.turnoDe;
    this.numeroTurno++;
    this.fase = 'personaje';
    this.atacaronEsteTurno.clear();
    this.log(`— Turno ${this.numeroTurno}: ${this.jugadorActivo.nombre} —`);
    this.notificar();
  }

  /**
   * ¿Le quedan personajes con los que seguir? Los del Hades no cuentan
   * mientras no los recupere una carta.
   */
  sinPersonajes(jugador) {
    return jugador.activos.length === 0 && jugador.reserva.length === 0;
  }

  /**
   * Dos formas de perder: quedarse sin sangre en la pila, o sin un solo
   * personaje en pie. Se comprueba tras derramar y tras cada destrucción.
   */
  comprobarFin() {
    if (this.terminada) return true;

    for (let i = 0; i < this.jugadores.length; i++) {
      const j = this.jugadores[i];

      let motivo = null;
      if (j.sangre.pila <= 0) motivo = 'sangre';
      else if (this.sinPersonajes(j)) motivo = 'personajes';
      if (!motivo) continue;

      this.terminada = true;
      this.ganador = this.jugadores[1 - i];
      this.perdedor = j;
      this.motivoFin = motivo;
      this.log(
        motivo === 'sangre'
          ? `${j.nombre} se queda sin sangre. Gana ${this.ganador.nombre}.`
          : `${j.nombre} se queda sin personajes en pie. ` +
            `Gana ${this.ganador.nombre}.`
      );
      return true;
    }
    return false;
  }
};
