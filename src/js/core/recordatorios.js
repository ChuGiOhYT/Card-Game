/**
 * Recordatorios de efectos impresos.
 *
 * Los efectos de las cartas no se ejecutan solos: los aplica el jugador con
 * las primitivas de `core/manual.js`. Este módulo tampoco los ejecuta — solo
 * avisa de que toca, y para eso le basta el campo `timing`.
 *
 * Por qué avisar en vez de automatizar: las 45 cartas reparten 50 mecánicas
 * distintas y unas 35 aparecen una sola vez, así que programarlas no amortiza.
 * Pero solo hay 12 `timing`, y el texto impreso ya está capturado en la carta.
 * Una tabla de 12 entradas cubre el mazo entero.
 *
 * NO toca el DOM: devuelve la lista de lo pendiente y la pantalla la pinta.
 * Por eso vive aquí y no en `screens/` (`core/tutorial.js` sí pinta, y es una
 * inconsistencia que no conviene repetir).
 */
window.Game = window.Game || {};

window.Game.Recordatorios = {
  /**
   * `timing` impreso → cuándo toca recordarlo.
   *
   *   sujeto    de dónde sale la carta candidata: activo | accion | revelado |
   *             hades | retirado
   *   cuando    condición extra sobre el estado; sin ella basta con que exista
   *             el sujeto
   *   porTurno  el efecto se aplica en cada turno o batalla, así que el
   *             recordatorio vuelve a armarse al cambiar de turno. Sin esto se
   *             avisa una vez y no vuelve hasta que la carta se mueva.
   *   nota      qué se espera del jugador, en una línea
   */
  REGLAS: {
    'En posición': {
      sujeto: 'activo',
      nota: 'Aplícalo mientras siga en posición.'
    },
    'Revelado o en Posición': {
      sujeto: 'activo',
      nota: 'Sirve revelada o en posición: aplícalo cuando se dé el caso.'
    },
    Acción: {
      sujeto: 'activo',
      cuando: (m) => m.fase === 'accion',
      porTurno: true,
      nota: 'Toca ahora, en la fase de acción.'
    },
    'Acción Ataque / Acción Defensa': {
      sujeto: 'activo',
      cuando: (m, j, inst) => !!inst.accion,
      porTurno: true,
      nota: 'Mira el tipo de la acción equipada y aplica la mitad que toque.'
    },
    // Como la anterior pero con tres ramas —ofensiva, defensiva y neutra—, que
    // es lo que trae Errante. Sin acción acoplada no hay nada que decidir.
    'Acción equipada por tipo': {
      sujeto: 'activo',
      cuando: (m, j, inst) => !!inst.accion,
      porTurno: true,
      nota: 'Según el tipo de la acción equipada, aplica la rama que corresponda.'
    },
    Batalla: {
      sujeto: 'activo',
      cuando: (m) => m.fase === 'ataque',
      porTurno: true,
      nota: 'Toca en el combate de este turno.'
    },
    'Aliados revelados': {
      sujeto: 'activo',
      cuando: (m, j) => j.revelados.size > 0,
      porTurno: true,
      nota: 'Cuenta los aliados revelados y aplica el total.'
    },
    Revelado: {
      sujeto: 'revelado',
      nota: 'Está revelada en tu zona de equipo: su efecto ya cuenta.'
    },
    Hades: {
      sujeto: 'hades',
      cuando: (m, j) => j.activos.length > 0,
      porTurno: true,
      nota: 'Cuenta lo que tengas en el Hades y aplícalo a tu personaje en posición.'
    },
    Retirada: {
      sujeto: 'retirado',
      nota: 'Acaba de volver a la reserva: su efecto se aplica ahora.'
    },
    'Acción equipada': {
      sujeto: 'accion',
      nota: 'Está equipada: su efecto toca ya.'
    },
    'Fase de combate': {
      sujeto: 'accion',
      cuando: (m) => m.fase === 'ataque',
      porTurno: true,
      nota: 'Toca en el combate de este turno.'
    },
    'Cualquier fase': {
      sujeto: 'accion',
      nota: 'Puedes usarla en cualquier momento de tu turno.'
    }
  },

  /** Claves ya marcadas como hechas por el jugador. */
  descartados: new Set(),
  /** Claves cuya burbuja ya se enseñó: la segunda vez solo queda el aviso. */
  vistos: new Set(),
  /** Retiradas detectadas y aún sin avisar. */
  retirados: [],
  /** Quién estaba en posición en la última revisión, por jugador. */
  ultimosActivos: {},

  /** Se llama al arrancar cada partida: nada sobrevive de la anterior. */
  reiniciar() {
    this.descartados = new Set();
    this.vistos = new Set();
    this.retirados = [];
    this.ultimosActivos = {};
  },

  /** El lado que aplica efectos a mano. La IA no usa las Herramientas. */
  humano(motor) {
    return motor.jugadores.find((j) => !j.esIA) || motor.jugadores[0];
  },

  /**
   * Detecta las salidas de posición comparando con la revisión anterior.
   * Es lo único que no se deduce del estado actual: «Retirada» es un cambio,
   * no una situación. Idempotente, así que da igual cuántas veces la llame
   * `pintar()` sin que nada se mueva.
   */
  observar(motor) {
    if (!motor) return;
    motor.jugadores.forEach((j, idx) => {
      const ahora = new Set(j.activos.map((i) => i.uid));
      const antes = this.ultimosActivos[idx];
      this.ultimosActivos[idx] = ahora;
      if (!antes) return;

      antes.forEach((uid) => {
        if (ahora.has(uid)) return;
        // Dejar la posición re-arma sus recordatorios: si vuelve al campo, su
        // efecto de «En posición» vuelve a tocar.
        this.olvidar(uid);
        if (j.esIA) return;

        // Retirarse es volver a la reserva. Si acabó en el Hades lo mataron, y
        // que te maten no es retirarse.
        const inst = j.reserva.find((i) => i.uid === uid);
        if (!inst) return;
        const carta = window.Game.CHARACTERS_BY_ID[inst.personaje];
        const regla = carta && this.REGLAS[carta.timing];
        if (!regla || regla.sujeto !== 'retirado') return;

        this.retirados.push({
          uid,
          cartaId: inst.personaje,
          clave: `${uid}:${inst.personaje}:r${motor.numeroTurno}`
        });
      });
    });
  },

  /** Olvida lo apuntado sobre una instancia: sus recordatorios se re-arman. */
  olvidar(uid) {
    for (const set of [this.descartados, this.vistos]) {
      [...set].forEach((clave) => {
        if (clave.startsWith(`${uid}:`)) set.delete(clave);
      });
    }
  },

  /**
   * Lo que el jugador tiene pendiente de aplicar ahora mismo.
   * @returns {Array<{clave,cartaId,nombre,imagen,texto,timing,nota,zona,uid}>}
   */
  pendientes(motor) {
    if (!motor || motor.terminada) return [];
    const j = this.humano(motor);
    const lista = [];

    const anadir = (carta, { uid = null, zona, sufijo = null }) => {
      const regla = this.REGLAS[carta.timing];
      if (!regla) return;
      const cola = sufijo || (regla.porTurno ? `t${motor.numeroTurno}` : 'x');
      const clave = `${uid || carta.id}:${carta.id}:${cola}`;
      if (this.descartados.has(clave)) return;
      lista.push({
        clave,
        cartaId: carta.id,
        nombre: carta.nombre,
        imagen: carta.imagen,
        texto: carta.texto,
        timing: carta.timing,
        nota: regla.nota,
        zona,
        uid
      });
    };

    const toca = (carta, sujeto, inst) => {
      const regla = carta && this.REGLAS[carta.timing];
      if (!regla || regla.sujeto !== sujeto) return false;
      if (!regla.cuando) return true;
      try {
        return !!regla.cuando(motor, j, inst);
      } catch {
        return false;
      }
    };

    // En posición, y la acción que lleve acoplada.
    j.activos.forEach((inst) => {
      const p = window.Game.CHARACTERS_BY_ID[inst.personaje];
      if (toca(p, 'activo', inst)) anadir(p, { uid: inst.uid, zona: 'posicion' });

      if (!inst.accion) return;
      const a = window.Game.ACTIONS_BY_ID[inst.accion];
      if (toca(a, 'accion', inst)) anadir(a, { uid: inst.uid, zona: 'accion' });
    });

    // Reveladas en la zona de equipo. Las que están en posición ya se avisaron
    // arriba, y avisar dos veces de la misma carta sobra.
    const enPosicion = new Set(j.activos.map((i) => i.personaje));
    j.revelados.forEach((id) => {
      if (enPosicion.has(id)) return;
      const carta = window.Game.CHARACTERS_BY_ID[id];
      if (toca(carta, 'revelado', null)) anadir(carta, { zona: 'equipo' });
    });

    j.hades.forEach((inst) => {
      const carta = window.Game.CHARACTERS_BY_ID[inst.personaje];
      if (toca(carta, 'hades', inst)) anadir(carta, { uid: inst.uid, zona: 'hades' });
    });

    this.retirados.forEach((r) => {
      const carta = window.Game.CHARACTERS_BY_ID[r.cartaId];
      if (carta) anadir(carta, { uid: r.uid, zona: 'reserva', sufijo: r.clave.split(':').pop() });
    });

    return lista;
  },

  /** El jugador dice que ya lo ha aplicado. */
  descartar(clave) {
    this.descartados.add(clave);
    this.retirados = this.retirados.filter((r) => r.clave !== clave);
  },

  marcarVisto(clave) {
    this.vistos.add(clave);
  },

  yaVisto(clave) {
    return this.vistos.has(clave);
  },

  /** Uids con algo pendiente, para marcar las cartas de la mesa. */
  uidsConPendientes(lista) {
    return new Set(lista.filter((r) => r.uid).map((r) => r.uid));
  }
};
