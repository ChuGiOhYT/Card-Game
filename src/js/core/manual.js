/**
 * Herramientas manuales.
 *
 * Los efectos impresos no se programan uno a uno: el juego ofrece las
 * primitivas y el jugador las aplica, como en una mesa real. Cada operación
 * queda anotada en el registro para que la partida sea auditable.
 *
 * Las primitivas salen del catálogo de mecánicas de las 45 cartas:
 *
 *   modificar()     bonus_ataque, bonus_dano, bonus_defensa, reducir_ataque,
 *                   reducir_defensa, sumar_stats, escala_con_revelados,
 *                   escala_con_hades, condicional_tipo_accion
 *   duplicar()      duplicar_ataque, duplicar_defensa
 *   dado()          dado_d6, modificar_dado
 *   revelar/ocultar revelar_rival, ocultar_cartas
 *   bloquear()      bloquear_accion_rival, bloquear_personaje_rival,
 *                   bloqueo_temporal, inmunidad_temporal, prohibir_ataques
 *   negar()         negar_acciones, negar_ataque, negar_efectos, evadir
 *
 * Sangre y Hades ya tienen sus métodos en el motor (derramar, pagar,
 * recuperar, enviarAlHades, recuperarDelHades) y se reutilizan tal cual.
 */
window.Game = window.Game || {};

window.Game.Manual = {
  /* --------------------------- Estadísticas ----------------------------- */

  /**
   * Suma (o resta) ataque y defensa a un personaje en posición.
   * Los modificadores viven en la instancia y el combate ya los lee.
   */
  modificar(motor, inst, { ataque = 0, defensa = 0 }, motivo = 'efecto de carta') {
    if (!inst) return false;
    inst.modificadores = inst.modificadores || { ataque: 0, defensa: 0 };
    inst.modificadores.ataque += ataque;
    inst.modificadores.defensa += defensa;

    const p = window.Game.CHARACTERS_BY_ID[inst.personaje];
    const partes = [];
    if (ataque) partes.push(`ataque ${ataque > 0 ? '+' : ''}${ataque}`);
    if (defensa) partes.push(`defensa ${defensa > 0 ? '+' : ''}${defensa}`);
    motor.log(`⚙ ${p.nombre}: ${partes.join(', ')} (${motivo}).`);
    motor.notificar();
    return true;
  },

  /** Duplica el ataque o la defensa impresos (Inmolación, Zabar). */
  duplicar(motor, inst, campo, motivo = 'efecto de carta') {
    if (!inst || (campo !== 'ataque' && campo !== 'defensa')) return false;
    const base = window.Game.CHARACTERS_BY_ID[inst.personaje][campo];
    return this.modificar(motor, inst, { [campo]: base }, `duplicar ${campo} · ${motivo}`);
  },

  /** Devuelve un personaje a sus valores impresos. */
  limpiarModificadores(motor, inst, motivo = 'fin del efecto') {
    if (!inst) return false;
    inst.modificadores = { ataque: 0, defensa: 0 };
    motor.log(
      `⚙ ${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre} vuelve a sus ` +
        `valores impresos (${motivo}).`
    );
    motor.notificar();
    return true;
  },

  /* ------------------------------- Dado --------------------------------- */

  /**
   * Tira un d6. `modificador` cubre a Yun, que aplica +1 o -1 al resultado.
   * @returns {{bruto:number, resultado:number}}
   */
  dado(motor, modificador = 0, motivo = 'tirada') {
    const bruto = 1 + Math.floor(Math.random() * 6);
    const resultado = Math.max(1, Math.min(6, bruto + modificador));
    const extra =
      modificador !== 0
        ? ` (${bruto} ${modificador > 0 ? '+' : ''}${modificador})`
        : '';
    motor.log(`🎲 ${motivo}: ${resultado}${extra}.`);
    motor.notificar();
    return { bruto, resultado };
  },

  /* --------------------------- Información ------------------------------ */

  /** Revela una carta concreta del rival, para siempre. */
  revelar(motor, jugador, cartaId, motivo = 'efecto de carta') {
    if (!cartaId) return false;
    if (jugador.revelados.has(cartaId)) return false;
    jugador.revelados.add(cartaId);
    motor.log(`👁 Revelada «${this.nombreCarta(cartaId)}» de ${jugador.nombre} (${motivo}).`);
    motor.notificar();
    return true;
  },

  /** Vuelve a ocultar una carta revelada (Ocultamiento, Üldar). */
  ocultar(motor, jugador, cartaId, motivo = 'efecto de carta') {
    if (!jugador.revelados.has(cartaId)) return false;
    // Lo que está en el Hades es zona abierta: no se puede volver a tapar.
    if (jugador.hades.some((i) => i.personaje === cartaId)) return false;
    jugador.revelados.delete(cartaId);
    motor.log(`🌑 Ocultada «${this.nombreCarta(cartaId)}» de ${jugador.nombre} (${motivo}).`);
    motor.notificar();
    return true;
  },

  nombreCarta(id) {
    return (
      window.Game.CHARACTERS_BY_ID[id]?.nombre ||
      window.Game.ACTIONS_BY_ID[id]?.nombre ||
      id
    );
  },

  /* ---------------------------- Bloqueos -------------------------------- */

  /**
   * Marca una carta como inutilizable durante N turnos. Lo consultan las
   * pantallas para atenuarla; el motor descuenta los turnos al cerrar cada uno.
   */
  bloquear(motor, jugador, cartaId, turnos, motivo = 'efecto de carta') {
    if (!cartaId || turnos <= 0) return false;
    motor.bloqueos.push({
      jugador: motor.jugadores.indexOf(jugador),
      cartaId,
      turnos
    });
    motor.log(
      `⛓ «${this.nombreCarta(cartaId)}» bloqueada ${turnos} ` +
        `${turnos === 1 ? 'turno' : 'turnos'} (${motivo}).`
    );
    motor.notificar();
    return true;
  },

  estaBloqueada(motor, jugador, cartaId) {
    const idx = motor.jugadores.indexOf(jugador);
    return motor.bloqueos.some((b) => b.jugador === idx && b.cartaId === cartaId);
  },

  liberar(motor, jugador, cartaId) {
    const idx = motor.jugadores.indexOf(jugador);
    const antes = motor.bloqueos.length;
    motor.bloqueos = motor.bloqueos.filter(
      (b) => !(b.jugador === idx && b.cartaId === cartaId)
    );
    if (motor.bloqueos.length === antes) return false;
    motor.log(`⛓ «${this.nombreCarta(cartaId)}» queda libre.`);
    motor.notificar();
    return true;
  },

  /* ----------------------------- Negaciones ------------------------------ */

  /** Anula los efectos de acción durante el turno (Rompescudos). */
  negarAcciones(motor, motivo = 'Rompescudos') {
    motor.accionesNegadas = true;
    motor.log(`🚫 Efectos de las cartas de acción negados este turno (${motivo}).`);
    motor.notificar();
    return true;
  },

  /** Cancela un ataque ya declarado o por declarar (Bloquear 1/6, evadir). */
  anularAtaque(motor, inst, motivo = 'ataque negado') {
    if (!inst) return false;
    motor.atacaronEsteTurno.add(inst.uid);
    motor.log(
      `🚫 ${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre} no puede ` +
        `atacar este turno (${motivo}).`
    );
    motor.notificar();
    return true;
  },

  /* ------------------------------ Posición ------------------------------- */

  /** Fuerza a un personaje a salir de posición (Encadenar, Escape, Captura). */
  retirarDePosicion(motor, jugador, inst, motivo = 'efecto de carta') {
    if (!jugador.activos.includes(inst)) return false;
    motor.retirar(jugador, inst);
    motor.log(`↩ Retirado por ${motivo}.`);
    motor.notificar();
    return true;
  },

  /** Mete en posición a un personaje de la reserva, saltándose coste y fase. */
  forzarPosicion(motor, jugador, uid, motivo = 'efecto de carta') {
    const inst = jugador.reserva.find((i) => i.uid === uid);
    if (!inst) return false;
    if (jugador.activos.length >= jugador.maxActivos) {
      motor.retirar(jugador, jugador.activos[0]);
    }
    jugador.reserva = jugador.reserva.filter((i) => i !== inst);
    jugador.activos.push(inst);
    motor.log(
      `↪ ${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre} entra en ` +
        `posición (${motivo}).`
    );
    motor.notificar();
    return true;
  }
};
