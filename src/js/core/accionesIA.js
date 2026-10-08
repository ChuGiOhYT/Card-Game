/**
 * Efectos de las cartas de ACCIÓN del lado de la IA.
 *
 * El jugador aplica sus efectos a mano desde Herramientas (`core/manual.js`);
 * la IA no tiene manos. Antes de esto solo llamaba a `equipar()` y `atacar()`,
 * así que sus cartas activaban la estadística pero su TEXTO no ocurría nunca:
 * una Finta que no tiraba el dado, un Bloquear que no subía la defensa ni
 * reflejaba. Es la misma razón por la que existe `core/bossAbilities.js`, y
 * sigue su forma: una tabla de id → función.
 *
 * Vive en `core/` y no toca el DOM, así que funciona igual en la app y en
 * `tools/simular.js` (que carga el motor sin pantallas).
 *
 * CUÁNDO se aplica cada carta lo decide su `timing` impreso:
 *   «Fase de combate»  → ofensivas al declarar SU ataque, defensivas cuando le
 *                        declaran uno a ella. En los dos casos ANTES de
 *                        resolver, para que la previsión que ve el jugador ya
 *                        incluya el efecto.
 *   «Acción equipada»  → en el momento de equiparla.
 *
 * NO están las 12 cartas que la IA puede equipar. Las que faltan piden elegir
 * un objetivo o hacen daño al propio bando, y automatizarlas a medias sería
 * peor que dejarlas fuera; ver `SIN_AUTOMATIZAR` al final.
 */
window.Game = window.Game || {};

window.Game.AccionesIA = {
  /** Cartas que la IA sí sabe usar, por id. */
  EFECTOS: {
    /* --------------------------- Ofensivas ----------------------------- */

    /** d6: 1-2 nada, 3-4 +1, 5-6 +2 al ataque. */
    o_finta(motor, jugador, inst) {
      const { resultado } = window.Game.Manual.dado(motor, 0, 'Finta (IA)');
      const bonus = resultado <= 2 ? 0 : resultado <= 4 ? 1 : 2;
      if (!bonus) {
        motor.log('  ↳ Ataque normal: sin bonus.');
        return true;
      }
      this._temporal(motor, jugador, inst, { ataque: bonus }, 'Finta');
      return true;
    },

    /**
     * Duplica el ataque, pero si llega a batallar se destruye al final de la
     * fase de combate. La destrucción no se hace aquí: se anota en
     * `motor.aDestruirTrasCombate` y la cobra quien cierra la fase, porque
     * «si batalla» solo se sabe después de resolver.
     */
    o_inmolacion(motor, jugador, inst) {
      window.Game.Manual.duplicar(motor, inst, 'ataque', 'Inmolación (IA)');
      motor.aDestruirTrasCombate = motor.aDestruirTrasCombate || [];
      motor.aDestruirTrasCombate.push({
        jugadorIdx: motor.jugadores.indexOf(jugador),
        uid: inst.uid,
        motivo: 'Inmolación'
      });
      return true;
    },

    /**
     * Declara un coste y obliga al rival a poner en posición un personaje de
     * ese coste, si lo tiene. La IA declara el coste del personaje MÁS DÉBIL
     * que le ve en la reserva: la carta sirve para sacarle a campo lo peor que
     * tenga, no para elegir al azar.
     */
    o_captura(motor, jugador, inst, { defensor } = {}) {
      const rival = defensor || motor.jugadores.find((j) => j !== jugador);
      if (!rival || !rival.reserva.length) {
        motor.log('  ↳ El rival no tiene reservas: no pasa nada.');
        return false;
      }

      const valor = (i) => {
        const p = window.Game.CHARACTERS_BY_ID[i.personaje];
        return p.ataque + p.defensa;
      };
      const objetivo = rival.reserva.slice().sort((a, b) => valor(a) - valor(b))[0];
      const coste = window.Game.CHARACTERS_BY_ID[objetivo.personaje].coste;
      motor.log(`  ↳ Declara coste ${coste}.`);

      // «Reemplazando a cualquiera allí»: forzarPosicion ya retira al que esté.
      return window.Game.Manual.forzarPosicion(
        motor, rival, objetivo.uid, 'Captura (IA)'
      );
    },

    /** Niega los efectos de las cartas de acción durante el turno. */
    o_rompescudos(motor) {
      window.Game.Manual.negarAcciones(motor, 'Rompescudos (IA)');
      return true;
    },

    /** Paga una sangre derramada y gana 2 de ataque. Solo Lunaria. */
    o_luna_sangrienta(motor, jugador, inst) {
      if (!motor.pagar(jugador, 1, 'Luna sangrienta (IA)')) {
        motor.log('  ↳ Sin sangre derramada que pagar: no se activa.');
        return false;
      }
      this._temporal(motor, jugador, inst, { ataque: 2 }, 'Luna sangrienta');
      return true;
    },

    /* --------------------------- Defensivas ---------------------------- */

    /**
     * d6: 1 o 6 niega el ataque y devuelve daño igual a la defensa del
     * defensor; 2-3 da +2 de defensa; 4-5 da +3.
     */
    d_bloquear(motor, jugador, inst, { atacanteInst, atacante } = {}) {
      const { resultado } = window.Game.Manual.dado(motor, 0, 'Bloquear (IA)');

      if (resultado === 1 || resultado === 6) {
        const defensa = window.Game.Combat.defensaEfectiva(inst);
        if (atacanteInst) {
          window.Game.Manual.anularAtaque(motor, atacanteInst, 'Bloquear 1/6');
          motor.cancelarAtaque();
        }
        if (defensa > 0 && atacante) {
          motor.derramar(atacante, defensa, 'Bloquear: daño devuelto');
        }
        return true;
      }

      const bonus = resultado <= 3 ? 2 : 3;
      this._temporal(motor, jugador, inst, { defensa: bonus }, 'Bloquear');
      return true;
    },

    /** d6: 1-2 quita 1 al ataque rival, 3-4 quita 2, 5-6 evade el ataque. */
    d_acrobatico(motor, jugador, inst, { atacanteInst, atacanteJugador } = {}) {
      const { resultado } = window.Game.Manual.dado(motor, 0, 'Acrobático (IA)');

      if (resultado >= 5) {
        if (atacanteInst) {
          window.Game.Manual.anularAtaque(motor, atacanteInst, 'Acrobático: evadido');
          motor.cancelarAtaque();
        }
        return true;
      }

      const menos = resultado <= 2 ? -1 : -2;
      // El recorte va al ATACANTE, no al defensor: es «ataque total oponente».
      if (atacanteInst && atacanteJugador) {
        this._temporal(
          motor, atacanteJugador, atacanteInst, { ataque: menos }, 'Acrobático'
        );
      }
      return true;
    },

    /* ---------------------------- Neutrales ---------------------------- */

    /** Derrama dos sangres: cuesta vida, pero da energía. */
    n_ruego(motor, jugador) {
      motor.derramar(jugador, 2, 'Ruego al eterno (IA)');
      return true;
    }
  },

  /**
   * Las que la IA todavía NO usa, y por qué. Están aquí escritas a propósito:
   * si alguien ve que su monstruo no aplica una de estas, esto explica que es
   * una decisión y no un olvido.
   */
  SIN_AUTOMATIZAR: {
    d_biomecanica: 'Hay que elegir qué personaje sacrificar del equipo y devolverlo al Hades al cerrar turno.',
    d_escape: 'Hay que elegir por quién cambiar entre los de coste igual o menor.',
    n_comodin: 'Activa OTRA carta revelada: encadena efectos y necesita elegir cuál.',
    n_devocion: 'Manda al Hades a tu propio activo. Aplicarlo sin criterio sería un suicidio automático.'
  },

  /* ------------------------------ Motor -------------------------------- */

  /** ¿Hay efecto automatizado para esta carta? */
  sabeUsar(accionId) {
    return !!(accionId && this.EFECTOS[accionId]);
  },

  /**
   * Aplica el efecto de la acción equipada a `inst`, si la IA sabe usarla.
   *
   * @param {string} momento 'combate' | 'equipar', para respetar el `timing`
   *   impreso y no disparar una carta de combate al equiparla.
   * @param {object} contexto Quién ataca y a quién, que las defensivas
   *   necesitan para recortar al atacante o devolverle daño.
   */
  aplicar(motor, jugador, inst, momento, contexto = {}) {
    if (!inst || !inst.accion) return false;
    if (motor.terminada) return false;

    // Rompescudos: si los efectos están negados, nadie aplica nada. Antes esta
    // bandera no la leía nadie, así que la carta no hacía nada ni para el
    // jugador; ahora la respetan los dos lados.
    if (motor.accionesNegadas) return false;

    const accion = window.Game.ACTIONS_BY_ID[inst.accion];
    if (!accion) return false;
    if (this.momentoDe(accion) !== momento) return false;

    const efecto = this.EFECTOS[inst.accion];
    if (!efecto) return false;

    motor.log(`✦ ${accion.nombre} (efecto automático de la IA).`);
    const desdeRegistro = motor.registro.length;
    let resultado;
    try {
      resultado = efecto.call(this, motor, jugador, inst, contexto);
    } catch (err) {
      // Un efecto que revienta no puede colgar el turno del rival: se anota y
      // la partida sigue.
      motor.log(`⚠ El efecto de ${accion.nombre} falló: ${err.message}`);
      return false;
    }

    // Resumen para la interfaz: reutiliza los mismos textos que el efecto ya
    // escribió en el registro, para no llevar dos copias del mismo mensaje.
    //
    // Existe porque el registro puede estar detrás de otra pestaña justo
    // cuando más importa verlo: al declararse un ataque,
    // `abrirRecordatoriosSiTeAtacan` cambia de pestaña sola. Sin esto, un dado
    // que cae en «sin bonus» se ve exactamente igual que si la carta no
    // hubiera hecho nada, y una Captura que te arrastra un personaje a
    // posición no se anuncia en ninguna parte.
    //
    // Se guardan SEPARADOS por momento porque los pinta gente distinta —la
    // ventana del ataque pendiente y la banda central— y en un mismo turno
    // pueden darse los dos: si compartieran hueco, el de combate borraría el
    // aviso de lo que acabó de acoplar.
    motor.ultimosEfectosIA = motor.ultimosEfectosIA || {};
    motor.ultimosEfectosIA[momento] = {
      uid: inst.uid,
      nombre: accion.nombre,
      lineas: motor.registro.slice(desdeRegistro).map((r) => r.texto),
      turno: motor.numeroTurno
    };
    return resultado;
  },

  /** Traduce el `timing` impreso al momento en que se dispara. */
  momentoDe(accion) {
    if (accion.timing === 'Fase de combate') return 'combate';
    if (accion.timing === 'Acción equipada') return 'equipar';
    return 'otro';
  },

  /** Aplica a todos los activos de un bando lo que toque al equipar. */
  alEquipar(motor, jugador, inst) {
    return this.aplicar(motor, jugador, inst, 'equipar');
  },

  /**
   * La IA va a atacar: aplica su carta ofensiva antes de resolver.
   * Devuelve false si el efecto canceló el propio ataque.
   */
  alAtacar(motor, jugador, inst, contexto) {
    this.aplicar(motor, jugador, inst, 'combate', contexto);
    return !motor.terminada;
  },

  /**
   * Le han declarado un ataque a la IA: aplica su carta defensiva antes de
   * que se resuelva, para que la previsión del jugador ya lo refleje.
   */
  alSerAtacada(motor, jugador, inst, contexto) {
    return this.aplicar(motor, jugador, inst, 'combate', contexto);
  },

  /**
   * Cobra las autodestrucciones pendientes (Inmolación). Se llama al cerrar la
   * fase de combate, cuando ya se sabe quién llegó a batallar.
   */
  cobrarAutodestrucciones(motor) {
    const cola = motor.aDestruirTrasCombate || [];
    if (!cola.length) return 0;
    let hechas = 0;
    for (const { jugadorIdx, uid, motivo } of cola) {
      const jugador = motor.jugadores[jugadorIdx];
      if (!jugador) continue;
      const inst = jugador.activos.find((i) => i.uid === uid);
      // Solo se destruye si BATALLÓ: si nunca llegó a atacar, la carta no se
      // cumple y el personaje se queda.
      if (!inst || !motor.atacaronEsteTurno.has(uid)) continue;
      motor.enviarAlHades(jugador, inst, motivo);
      hechas++;
    }
    motor.aDestruirTrasCombate = [];
    return hechas;
  },

  /** Modificador que el motor revierte solo al cerrar el turno. */
  _temporal(motor, jugador, inst, { ataque = 0, defensa = 0 }, motivo) {
    inst.modificadores = inst.modificadores || { ataque: 0, defensa: 0 };
    inst.modificadores.ataque += ataque;
    inst.modificadores.defensa += defensa;
    motor.efectosTemporales.push({
      jugadorIdx: motor.jugadores.indexOf(jugador),
      uid: inst.uid,
      ataque,
      defensa,
      turnos: 1,
      motivo
    });
    const p = window.Game.CHARACTERS_BY_ID[inst.personaje];
    const partes = [];
    if (ataque) partes.push(`ataque ${ataque > 0 ? '+' : ''}${ataque}`);
    if (defensa) partes.push(`defensa ${defensa > 0 ? '+' : ''}${defensa}`);
    motor.log(`  ↳ ${p.nombre}: ${partes.join(', ')} (${motivo}).`);
    motor.notificar();
  }
};
