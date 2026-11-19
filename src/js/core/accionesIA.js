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
 *   «Cualquier fase»   → al acoplarla (Comodín; Sabotaje no hace nada ahí).
 *
 * Están TODAS desde la tanda 5. Las que eligen algo usan `motor.elegir`: la
 * IA decide al instante y a ti te pregunta la placa de la mesa.
 */
window.Game = window.Game || {};

window.Game.AccionesIA = {
  /** Cartas que la IA sí sabe usar, por id. */
  EFECTOS: {
    /* --------------------------- Ofensivas ----------------------------- */

    /** d6: 1-2 nada, 3-4 +1, 5-6 +2 al ataque. */
    o_finta(motor, jugador, inst) {
      window.Game.Manual.tirar(motor, {
        jugador, motivo: `Finta ${this._q()}`, deAccion: true,
        valor: (n) => (n <= 2 ? 0 : n <= 4 ? 1 : 2)
      }, (resultado) => {
        const bonus = resultado <= 2 ? 0 : resultado <= 4 ? 1 : 2;
        if (!bonus) {
          motor.log('  ↳ Ataque normal: sin bonus.');
          return;
        }
        this._temporal(motor, jugador, inst, { ataque: bonus }, 'Finta');
      });
      return true;
    },

    /**
     * Duplica el ataque, pero si llega a batallar se destruye al final de la
     * fase de combate. La destrucción no se hace aquí: se anota en
     * `motor.aDestruirTrasCombate` y la cobra quien cierra la fase, porque
     * «si batalla» solo se sabe después de resolver.
     */
    o_inmolacion(motor, jugador, inst) {
      window.Game.Manual.duplicar(motor, inst, 'ataque', `Inmolación ${this._q()}`);
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
        motor, rival, objetivo.uid, `Captura ${this._q()}`
      );
    },

    /** Niega los efectos de las cartas de acción durante el turno. */
    o_rompescudos(motor) {
      window.Game.Manual.negarAcciones(motor, `Rompescudos ${this._q()}`);
      return true;
    },

    /** Paga una sangre derramada y gana 2 de ataque. Solo Lunaria. */
    o_luna_sangrienta(motor, jugador, inst) {
      if (!motor.pagar(jugador, 1, `Luna sangrienta ${this._q()}`)) {
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
      window.Game.Manual.tirar(motor, {
        jugador, motivo: `Bloquear ${this._q()}`, deAccion: true,
        // 1 y 6 niegan y devuelven; 4-5 dan +3; 2-3, +2.
        valor: (n) => (n === 1 || n === 6 ? 3 : n >= 4 ? 2 : 1)
      }, (resultado) => this.EFECTOS._bloquear.call(this, motor, jugador, inst, resultado, { atacanteInst, atacante }));
      return true;
    },

    _bloquear(motor, jugador, inst, resultado, { atacanteInst, atacante }) {
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
      window.Game.Manual.tirar(motor, {
        jugador, motivo: `Acrobático ${this._q()}`, deAccion: true
      }, (resultado) => this.EFECTOS._acrobatico.call(this, motor, jugador, inst, resultado, { atacanteInst, atacanteJugador }));
      return true;
    },

    _acrobatico(motor, jugador, inst, resultado, { atacanteInst, atacanteJugador }) {
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
      motor.derramar(jugador, 2, `Ruego al eterno ${this._q()}`);
      return true;
    },

    /**
     * «Cualquier fase»: no hace nada al acoplarla. Mientras está acoplada a tu
     * personaje en posición, cada dado del rival lleva −2: lo aplica
     * `Manual.tirar` (ver `EfectosPersonaje.saboteado`). Está aquí para que
     * cuente como automatizada y no salga en Recordatorios.
     */
    o_sabotaje() {
      return true;
    },

    /**
     * Paga dos sangres y, este turno y el siguiente del rival, nadie declara
     * ataques (Oscar: cuentan los turnos de los dos). Sin dos de energía que
     * pagar, no pasa nada.
     */
    n_diplomatico(motor, jugador) {
      if (!motor.pagar(jugador, 2, `Diplomático ${this._q()}`)) {
        motor.log('  ↳ No hay dos sangres derramadas que pagar: no hace nada.');
        return true;
      }
      motor.ponerEstado({ tipo: 'sinAtaques', jugador, turnos: 2, motivo: 'Diplomático' });
      motor.log('  ↳ Este turno y el siguiente no se pueden declarar ataques.');
      return true;
    },

    /* ------------------------------ Tanda 5 ------------------------------ */

    /**
     * Cuando te atacan: cambias a tu personaje en posición por otro de coste
     * igual o menor, que encaja el golpe; Escape vuelve a la zona (así que el
     * que entra llega sin acción). Es opcional: con nadie que pueda entrar, o
     * si dices que no, nada.
     */
    d_escape(motor, jugador, inst, { atacanteInst } = {}) {
      if (!this._meAtacan(motor, jugador, inst, atacanteInst)) return true;
      const C = window.Game.CHARACTERS_BY_ID;
      const coste = C[inst.personaje].coste;
      const cands = jugador.reserva.filter((i) => C[i.personaje].coste <= coste
        && !motor.tieneEstado('personajeBloqueado', { uid: i.uid }));
      if (!cands.length) {
        motor.log('  ↳ Nadie de coste igual o menor para cambiar.');
        return true;
      }
      const nombre = C[inst.personaje].nombre.split(',')[0];
      motor.elegir({
        jugador,
        titulo: `Escape · ¿quién entra por ${nombre}?`,
        opciones: [{ id: '', texto: 'No escapar' },
          ...cands.map((i) => ({ id: i.uid, texto: `${C[i.personaje].nombre.split(',')[0]} (${C[i.personaje].coste})` }))],
        // Escapa si lo iban a tumbar y aguanta el golpe en la sangre; entra el más barato.
        ia: () => {
          const r = window.Game.Combat.resolver(atacanteInst, inst);
          const golpe = window.Game.Combat.ataqueEfectivo(atacanteInst);
          if (!r.destruido || motor.vidaDe(jugador) <= golpe + 2) return '';
          return [...cands].sort((x, y) => C[x.personaje].coste - C[y.personaje].coste)[0].uid;
        },
        alElegir: (uid) => {
          const nuevo = uid && jugador.reserva.find((i) => i.uid === uid);
          if (!nuevo) return;
          this._cambiar(motor, jugador, inst, nuevo, 'Escape');
          if (motor.ataquePendiente && motor.ataquePendiente.defensorUid === inst.uid) {
            motor.ataquePendiente.defensorUid = nuevo.uid;
          }
        }
      });
      return true;
    },

    /** Cuando te atacan: defender con la defensa, o dejar pasar el golpe a la sangre. */
    d_campo_caotico(motor, jugador, inst, { atacanteInst } = {}) {
      if (!this._meAtacan(motor, jugador, inst, atacanteInst)) return true;
      motor.elegir({
        jugador,
        titulo: 'Campo caótico · ¿cómo encajas el golpe?',
        opciones: [
          { id: 'defensa', texto: 'Con la defensa' },
          { id: 'directo', texto: 'Ataque directo a la sangre' }
        ],
        // Deja pasar el golpe si el personaje iba a caer y la sangre lo aguanta.
        ia: () => {
          const r = window.Game.Combat.resolver(atacanteInst, inst);
          const golpe = window.Game.Combat.ataqueEfectivo(atacanteInst);
          return r.destruido && motor.vidaDe(jugador) > golpe + 2 ? 'directo' : 'defensa';
        },
        alElegir: (id) => {
          if (id !== 'directo' || !motor.ataquePendiente) return;
          motor.ataquePendiente.defensorUid = null;
          motor.log('  ↳ Campo caótico: el golpe va directo a la sangre.');
        }
      });
      return true;
    },

    /**
     * Cuando te atacan: eliges un personaje de tu zona de equipo (queda
     * revelado), que suma su ataque y su defensa al de en posición; al acabar
     * el turno va al Hades y Biomecánica vuelve a la zona de acciones. Sigue
     * acoplada hasta entonces para que el defensor no se quede sin postura en
     * mitad del golpe. Tilos no puede ser el elegido (Oscar: una u otra).
     */
    d_biomecanica(motor, jugador, inst, { atacanteInst } = {}) {
      if (!this._meAtacan(motor, jugador, inst, atacanteInst)) return true;
      const C = window.Game.CHARACTERS_BY_ID;
      const Comb = window.Game.Combat;
      const cands = jugador.reserva.filter((i) => i.personaje !== 'mer_tilos'
        && !motor.tieneEstado('personajeBloqueado', { uid: i.uid }));
      if (!cands.length) return true;
      motor.elegir({
        jugador,
        titulo: 'Biomecánica · ¿a quién sacrificas para reforzarte?',
        opciones: [{ id: '', texto: 'A nadie' },
          ...cands.map((i) => ({ id: i.uid, texto: `${C[i.personaje].nombre.split(',')[0]} (+${C[i.personaje].ataque}/+${C[i.personaje].defensa})` }))],
        // Solo si sin ayuda cae y con ella aguanta; el más barato que baste.
        ia: () => {
          const golpe = Comb.ataqueEfectivo(atacanteInst);
          const def = Comb.defensaEfectiva(inst);
          if (def >= golpe) return '';
          const basta = cands.filter((i) => def + C[i.personaje].defensa >= golpe)
            .sort((x, y) => C[x.personaje].coste - C[y.personaje].coste);
          return basta.length ? basta[0].uid : '';
        },
        alElegir: (uid) => {
          const v = uid && jugador.reserva.find((i) => i.uid === uid);
          if (!v) return;
          const p = C[v.personaje];
          motor.revelar(jugador, v.personaje);
          this._temporal(motor, jugador, inst, { ataque: p.ataque, defensa: p.defensa }, `Biomecánica: ${p.nombre.split(',')[0]}`);
          motor.pendientesFinTurno = motor.pendientesFinTurno || [];
          motor.pendientesFinTurno.push({ tipo: 'biomecanica', jugadorIdx: motor.jugadores.indexOf(jugador), uid: v.uid, anfitrion: inst.uid });
        }
      });
      return true;
    },

    /**
     * Si controlas un Oxitrón, pagas 1 y el RIVAL cambia su personaje en
     * posición por otro suyo ya revelado (elige él); el que sale no puede
     * usarse en su próximo turno.
     */
    d_encadenar(motor, jugador) {
      const C = window.Game.CHARACTERS_BY_ID;
      if (!jugador.activos.some((i) => C[i.personaje].raza === 'oxitron')) {
        motor.log('  ↳ Sin un Oxitrón en posición no hace nada.');
        return true;
      }
      const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
      const sale = rival.activos[0];
      const cands = rival.reserva.filter((i) => rival.revelados.has(i.personaje)
        && !motor.tieneEstado('personajeBloqueado', { uid: i.uid }));
      if (!sale || !cands.length) {
        motor.log('  ↳ El rival no tiene otro personaje revelado: no hace nada.');
        return true;
      }
      if (!motor.pagar(jugador, 1, `Encadenar ${this._q()}`)) {
        motor.log('  ↳ No hay una sangre derramada que pagar.');
        return true;
      }
      motor.elegir({
        jugador: rival,
        titulo: 'Encadenar · elige quién entra en posición',
        opciones: cands.map((i) => ({ id: i.uid, texto: C[i.personaje].nombre.split(',')[0] })),
        ia: () => [...cands].sort((x, y) => window.Game.AI.valor(y) - window.Game.AI.valor(x))[0].uid,
        alElegir: (uid) => {
          const nuevo = rival.reserva.find((i) => i.uid === uid);
          if (!nuevo || !rival.activos.includes(sale)) return;
          this._cambiar(motor, rival, sale, nuevo, 'Encadenar');
          // «Un turno» del rival: el suyo, que es el siguiente (Oscar cuenta los
          // turnos de los dos, así que son 2: este y el suyo).
          motor.ponerEstado({ tipo: 'personajeBloqueado', jugador: rival, uid: sale.uid, turnos: 2, motivo: 'Encadenar' });
        }
      });
      return true;
    },

    /** Envía a tu personaje en posición al Hades y recuperas tanta sangre como su coste. */
    n_devocion(motor, jugador, inst) {
      const p = window.Game.CHARACTERS_BY_ID[inst.personaje];
      motor.enviarAlHades(jugador, inst, `Devoción ${this._q()}`);
      motor.recuperar(jugador, p.coste, 'Devoción');
      return true;
    },

    /** Un Reanimado de tu Hades vuelve a la zona de equipo pagando su coste. */
    n_llamada(motor, jugador) {
      const C = window.Game.CHARACTERS_BY_ID;
      const energia = motor.energiaDe(jugador);
      const cands = jugador.hades.filter((i) => C[i.personaje].raza === 'reanimado' && C[i.personaje].coste <= energia);
      if (!cands.length) {
        motor.log('  ↳ No hay Reanimados en el Hades que puedas pagar.');
        return true;
      }
      motor.elegir({
        jugador,
        titulo: `Llamada · ¿qué Reanimado vuelve? (tienes ${energia})`,
        opciones: cands.map((i) => ({ id: i.uid, texto: `${C[i.personaje].nombre.split(',')[0]} (${C[i.personaje].coste})` })),
        ia: () => [...cands].sort((x, y) => window.Game.AI.valor(y) - window.Game.AI.valor(x))[0].uid,
        alElegir: (uid) => {
          const r = jugador.hades.find((i) => i.uid === uid);
          if (r) motor.recuperarDelHades(jugador, uid, { costeSangre: C[r.personaje].coste, motivo: 'Llamada' });
        }
      });
      return true;
    },

    /** Revela una carta oculta del rival, de acción o de personaje (a ciegas). */
    n_investigar(motor, jugador, inst) {
      const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
      const C = window.Game.CHARACTERS_BY_ID;
      let ka = 0;
      let kp = 0;
      const opciones = [
        ...rival.acciones.filter((id) => !rival.revelados.has(id))
          .map((id) => ({ id, texto: `Acción oculta ${++ka}` })),
        ...rival.reserva.filter((i) => !rival.revelados.has(i.personaje))
          .map((i) => ({ id: i.personaje, texto: `Personaje oculto ${++kp}` }))
      ];
      if (!opciones.length) {
        motor.log('  ↳ El rival no tiene nada oculto.');
        return true;
      }
      motor.elegir({
        jugador,
        titulo: 'Investigar · ¿qué carta del rival revelas?',
        opciones,
        ia: (ops) => ops[Math.floor(Math.random() * ops.length)].id,
        alElegir: (id) => {
          motor.revelar(rival, id);
          const nombre = C[id] ? C[id].nombre.split(',')[0] : window.Game.Manual.nombreCarta(id);
          motor.log(`  ↳ Investigar revela «${nombre}» de ${rival.nombre}.`);
          motor.anunciar(jugador, inst, `Investigar: revela ${nombre}`);
        }
      });
      return true;
    },

    /**
     * Si controlas un Desterrado: hasta dos OTRAS acciones reveladas de las
     * zonas de acciones (de los dos) vuelven boca abajo. Las acopladas no,
     * porque están a la vista en la mesa.
     */
    n_ocultamiento(motor, jugador) {
      const C = window.Game.CHARACTERS_BY_ID;
      if (!jugador.activos.some((i) => C[i.personaje].raza === 'desterrado')) {
        motor.log('  ↳ Sin un Desterrado en posición no hace nada.');
        return true;
      }
      const yo = motor.jugadores.indexOf(jugador);
      const visibles = () => motor.jugadores.flatMap((j, idx) => {
        const acopladas = new Set(j.activos.map((i) => i.accion));
        return j.acciones.filter((id) => id !== 'n_ocultamiento' && j.revelados.has(id) && !acopladas.has(id))
          .map((id) => ({ id: `${idx}:${id}`, texto: `${window.Game.Manual.nombreCarta(id)} (${idx === yo ? 'tuya' : 'rival'})` }));
      });
      const ronda = (n) => {
        const ops = visibles();
        if (n > 2 || !ops.length) return;
        motor.elegir({
          jugador,
          titulo: `Ocultamiento · voltea una acción (${n} de 2)`,
          opciones: [{ id: '', texto: n === 1 ? 'Ninguna' : 'No voltear más' }, ...ops],
          // Esconde lo suyo primero (que Kaw o Lirhym no lo vean), luego lo del rival.
          ia: (o) => (o.find((x) => x.id.startsWith(`${yo}:`)) || o[1] || o[0]).id,
          alElegir: (id) => {
            if (!id) return;
            const [idx, carta] = [Number(id.split(':')[0]), id.slice(id.indexOf(':') + 1)];
            motor.jugadores[idx].revelados.delete(carta);
            motor.log(`  ↳ Ocultamiento voltea «${window.Game.Manual.nombreCarta(carta)}».`);
            ronda(n + 1);
          }
        });
      };
      ronda(1);
      return true;
    },

    /**
     * Puedes devolver Comodín a la zona y acoplar en su lugar otra acción tuya
     * REVELADA, que se activa (si es de «Acción equipada», en el acto). No
     * puede traer otro Comodín (Oscar).
     */
    n_comodin(motor, jugador, inst) {
      const A = window.Game.ACTIONS_BY_ID;
      const quien = this._quien;
      const cands = motor.accionesDisponibles(jugador)
        .filter((id) => id !== 'n_comodin' && jugador.revelados.has(id));
      if (!cands.length) {
        motor.log('  ↳ No tienes otra acción revelada que activar.');
        return true;
      }
      const miTurno = motor.jugadorActivo === jugador;
      motor.elegir({
        jugador,
        titulo: 'Comodín · ¿qué acción revelada activas?',
        opciones: [{ id: '', texto: 'Quedarse con Comodín' },
          ...cands.map((id) => ({ id, texto: window.Game.Manual.nombreCarta(id) }))],
        ia: () => {
          const orden = miTurno ? ['ofensiva', 'defensiva'] : ['defensiva', 'ofensiva'];
          for (const t of orden) {
            const x = cands.find((id) => A[id].tipo === t);
            if (x) return x;
          }
          return '';
        },
        alElegir: (id) => {
          if (!id) return;
          motor.revelar(jugador, 'n_comodin');
          inst.accion = id;
          motor.revelar(jugador, id);
          motor.log(`  ↳ Comodín vuelve a la zona y activa «${window.Game.Manual.nombreCarta(id)}».`);
          window.Game.EfectosPersonaje?.alEquipar(motor, jugador, inst);
          const mo = this.momentoDe(A[id]);
          if (mo !== 'combate' && this.EFECTOS[id]) {
            this.aplicar(motor, jugador, inst, mo, {}, { quien: quien || 'IA' });
          }
        }
      });
      return true;
    }
  },

  /** ¿Es esto una defensa de verdad (te han declarado un ataque a ti)? */
  _meAtacan(motor, jugador, inst, atacanteInst) {
    if (atacanteInst && motor.ataquePendiente && motor.jugadorInactivo === jugador
        && motor.ataquePendiente.defensorUid === inst.uid) return true;
    motor.log('  ↳ Solo sirve cuando te atacan.');
    return false;
  },

  /** Cambia a quien está en posición por otro de la zona de equipo, sin pagar. */
  _cambiar(motor, jugador, sale, entra, motivo) {
    const C = window.Game.CHARACTERS_BY_ID;
    motor.retirar(jugador, sale);
    jugador.reserva = jugador.reserva.filter((i) => i !== entra);
    jugador.activos.push(entra);
    entra.salioAlCampo = true;
    motor.revelar(jugador, entra.personaje);
    motor.log(`  ↳ ${motivo}: ${C[entra.personaje].nombre} entra por ${C[sale.personaje].nombre}.`);
    motor.anunciar(jugador, entra, `${motivo}: entra ${C[entra.personaje].nombre.split(',')[0]}`);
    window.Game.EfectosPersonaje?.alDesplegar(motor, jugador, entra);
  },

  /**
   * Las que la IA todavía NO usa, y por qué. Están aquí escritas a propósito:
   * si alguien ve que su monstruo no aplica una de estas, esto explica que es
   * una decisión y no un olvido.
   */
  SIN_AUTOMATIZAR: {},

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
  aplicar(motor, jugador, inst, momento, contexto = {}, { quien = 'IA' } = {}) {
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

    motor.log(quien === 'IA'
      ? `✦ ${accion.nombre} (efecto automático de la IA).`
      : `✦ ${accion.nombre} (lo aplicas tú).`);
    const desdeRegistro = motor.registro.length;
    let resultado;
    // Los efectos firman sus líneas con `this._q()`; se fija aquí quién aplica
    // para no cambiar la firma de las ocho funciones.
    this._quien = quien;
    try {
      resultado = efecto.call(this, motor, jugador, inst, contexto);
    } catch (err) {
      // Un efecto que revienta no puede colgar el turno del rival: se anota y
      // la partida sigue.
      motor.log(`⚠ El efecto de ${accion.nombre} falló: ${err.message}`);
      return false;
    } finally {
      this._quien = 'IA';
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
      turno: motor.numeroTurno,
      quien
    };
    // Y el emergente amarillo sobre la carta: lo que hizo, en una línea, con
    // los mismos textos del registro (el ✦ de cabecera sobra ahí).
    const resumen = motor.ultimosEfectosIA[momento].lineas
      .filter((t) => !t.startsWith('✦'))
      .map((t) => t.replace(/^\s*↳\s*/, '').replace(/\s*\((IA|tú)\)/g, '')
        .replace(`🎲 ${accion.nombre}:`, '🎲').replace(/\.$/, '')
        // «Annia, aprendiz de los desterrados: ataque +2 (Finta)» → «Annia: ataque +2»
        .replace(/^([^,:]+), [^:]+:/, '$1:').replace(/\s*\([^()]*\)$/, ''))
      .join(' · ');
    if (resumen && motor.anunciar) {
      motor.anunciar(jugador, inst, `${accion.nombre}: ${resumen}`.slice(0, 90));
    }
    return resultado;
  },

  /** Firma de las líneas que escriben los efectos: «(IA)» o «(tú)». */
  _q() {
    return this._quien === 'IA' || !this._quien ? '(IA)' : '(tú)';
  },

  /**
   * El MISMO efecto, aplicado por el jugador desde su recordatorio.
   *
   * Existe porque la IA ya se aplicaba sus cartas sola y el jugador, con la
   * misma Finta, tenía que ir a Herramientas, tirar el dado y sumar a mano. El
   * código es el mismo para los dos lados: lo que no se automatizó para la IA
   * (`SIN_AUTOMATIZAR`) tampoco sale aquí y sigue yendo por Herramientas.
   *
   * El momento lo da el `timing` de la carta y no se comprueba la fase: el
   * botón solo aparece en el recordatorio, que ya sale cuando toca.
   */
  aplicarManual(motor, jugador, inst, contexto = {}) {
    if (!inst || !inst.accion) return false;
    const accion = window.Game.ACTIONS_BY_ID[inst.accion];
    if (!accion || !this.EFECTOS[inst.accion]) return false;
    return this.aplicar(motor, jugador, inst, this.momentoDe(accion), contexto, { quien: 'tú' });
  },

  /** Traduce el `timing` impreso al momento en que se dispara. */
  momentoDe(accion) {
    if (accion.timing === 'Fase de combate') return 'combate';
    if (accion.timing === 'Acción equipada') return 'equipar';
    return 'otro';
  },

  /** Aplica a todos los activos de un bando lo que toque al equipar. */
  alEquipar(motor, jugador, inst) {
    const accion = inst && window.Game.ACTIONS_BY_ID[inst.accion];
    const momento = accion && this.momentoDe(accion) === 'otro' ? 'otro' : 'equipar';
    return this.aplicar(motor, jugador, inst, momento);
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
