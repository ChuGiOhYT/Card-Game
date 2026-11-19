/**
 * Efectos de PERSONAJE que el juego aplica solo: los que suben o bajan ataque
 * o defensa con un número fijo (o un dado). Hermano de `accionesIA.js`, y con
 * la misma forma: tabla de id → efecto, y ganchos que llama el motor.
 *
 * Valen para los DOS bandos: la IA y tú. Cada efecto aplicado deja un anuncio
 * en `motor.anuncios` ({ n, jugadorIdx, uid, texto }) que la pantalla enseña
 * como un rótulo amarillo que se desvanece sobre la carta. `core/` no pinta.
 *
 * Los modales («revela … o aumenta …») se quedan con el aumento: es la mitad
 * que el juego sabe hacer sola. Si prefieres revelar, ↺ quita el bonus y la
 * revelación se hace desde Herramientas, como siempre.
 *
 * Los que escalan con lo revelado o con el Hades (Auram, Lydia, Fälum, Gurh,
 * Thila…) son PASIVOS: no se aplican una vez, se recalculan en cada cambio de
 * la mesa (`recalcularPasivos`, desde `notificar`) y van en `inst.pasivo`,
 * que el combate suma aparte de `inst.modificadores`. Así nunca se acumulan
 * ni hay que deshacerlos: si el Hades cambia, el número cambia.
 *
 * «Daño» en las cartas es el ataque del motor: el daño sale del ataque.
 */
window.Game = window.Game || {};

window.Game.EfectosPersonaje = {
  EFECTOS: {
    // En posición: al pisar el campo. Dura mientras siga en posición: retirarse
    // pone los modificadores a cero (`TurnEngine.retirar`).
    // Los cuatro desterrados son MODALES: «revela … o aumenta …». Se pregunta
    // (Oscar); si el rival no tiene nada oculto de ese tipo, no hay elección.
    des_annia: { momento: 'posicion', ataque: 1, texto: '+1 de daño',
      revelar: { tipo: 'accion', n: 1, texto: 'Revelar 1 acción del rival' } },
    des_axel: { momento: 'posicion', ataque: 2, texto: '+2 de ataque',
      revelar: { tipo: 'personaje', n: 2, texto: 'Revelar 2 personajes del rival' } },
    des_thiana: { momento: 'posicion', ataque: 2, texto: '+2 de ataque',
      revelar: { tipo: 'accion', n: 2, texto: 'Revelar 2 acciones del rival' } },
    // Acción: en cada fase de acción de su dueño, hasta el final del turno.
    des_erem: { momento: 'accion', ataque: 3, texto: '+3 de ataque',
      revelar: { tipo: 'cualquiera', n: 3, texto: 'Revelar 3 cartas ocultas del rival' } },
    // Según el tipo de la acción acoplada; se recalcula al cambiar de acción.
    lun_delem: {
      momento: 'equipar',
      porTipo: {
        ofensiva: { ataque: 2, texto: '+2 de daño (acción de ataque)' },
        defensiva: { defensa: 2, texto: '+2 de defensa (acción de defensa)' }
      }
    },
    // Batalla: al entrar en un combate, atacando o defendiendo. Hasta fin de turno.
    oxi_krag: { momento: 'batalla', dado: 'defensa' },
    oxi_krox: { momento: 'batalla', dado: 'ataque' },
    // En posición, con dado y a veces eligiendo objetivo (ver más abajo).
    oxi_pip: { momento: 'posicion', fn: 'pip' },
    oxi_brawl: { momento: 'posicion', fn: 'brawl' },
    oxi_kaw: { momento: 'posicion', fn: 'kaw' },
    oxi_kratox: { momento: 'posicion', fn: 'kratox' },
    // Yun no se dispara: lo consulta Manual.tirar en cada dado de acción.
    mer_yun: { momento: 'dado' },
    // Tanda 4: eligen objetivo o mueven cartas entre zonas.
    lun_lirhym: { momento: 'posicion', fn: 'lirhym' },
    rea_vyla: { momento: 'posicion', fn: 'vyla' },
    rea_luh: { momento: 'posicion', fn: 'luh' },
    mer_lyla: { momento: 'posicion', fn: 'lyla' },
    mer_yrving: { momento: 'posicion', fn: 'yrving' },
    mer_errante: { momento: 'equipar', fn: 'errante' },
    // Estos tres los llaman ganchos del motor, no el despliegue:
    lun_sadash: { momento: 'retirada' },    // alRetirarse
    lun_seluah: { momento: 'batalla-mano' }, // enBatalla, revelada en la mano
    mer_zhin: { momento: 'destruccion' },    // zhinDe / antesDeDestruir
    mer_tilos: { momento: 'accion-mano' },   // alEntrarEnAccion, revelado en la mano
    // Pasivos: ver PASIVOS más abajo.
    des_lydia: { momento: 'pasivo' },
    des_auram: { momento: 'pasivo' },
    lun_acompanantes: { momento: 'pasivo' },
    lun_falum: { momento: 'pasivo' },
    rea_gurh: { momento: 'pasivo' },
    rea_ejercito: { momento: 'pasivo' },
    rea_thila: { momento: 'pasivo' },
    rea_zabar: { momento: 'pasivo' }
  },

  /* ------------------------------ Pasivos ------------------------------ */

  /**
   * Cada pasivo mira la mesa y devuelve a quién da qué:
   * [{ j, inst, ataque, defensa, texto }]. Lecturas fijadas por Oscar:
   * - «Revelada» = usada (en posición, acoplada, o usada antes y de vuelta en
   *   la mano); deja de estarlo al ir al Hades o al vacío.
   * - Cuando la carta no restringe, cuentan los DOS bandos, campo y manos (un
   *   espejo escala para los dos). Si dice «tu oponente» o «aliado», no.
   * - Los contadores del Hades miran los dos lados salvo que diga «tus»,
   *   como ya hacen las habilidades de jefe.
   * - Los modales «ataque o defensa» (Fälum, Zabar) van, mientras no exista el
   *   sistema de elecciones, a la estadística que su postura usa.
   * - «Revelado:» (Lydia, Acompañantes) funciona solo revelada EN LA MANO.
   */
  PASIVOS: {
    // Tu Desterrado en posición: +1 daño por cada acción revelada del oponente.
    des_lydia(m, j, fuente) {
      const rival = m.jugadores[1 - m.jugadores.indexOf(j)];
      const n = window.Game.EfectosPersonaje.reveladas(m)
        .filter((r) => r.j === rival && r.tipo === 'accion').length;
      return window.Game.EfectosPersonaje._aActivo(j, 'desterrado', { ataque: n }, `+${n} de daño (Lydia)`);
    },
    // Ella misma, en posición: +1 por cada dos cartas reveladas en el campo.
    des_auram(m, j, fuente) {
      const n = Math.floor(window.Game.EfectosPersonaje.reveladas(m).length / 2);
      return [{ j, inst: fuente, ataque: n, defensa: 0, texto: `+${n} de daño (revelados)` }];
    },
    // Tu Lunaria en posición: +1 daño por cada lunaria revelado (los dos bandos).
    lun_acompanantes(m, j) {
      const n = window.Game.EfectosPersonaje.reveladas(m)
        .filter((r) => r.tipo === 'personaje' && r.raza === 'lunaria').length;
      return window.Game.EfectosPersonaje._aActivo(j, 'lunaria', { ataque: n }, `+${n} de daño (Acompañantes)`);
    },
    // Ella, en posición: +1 de ataque o escudo por cada aliado lunaria revelado
    // en TU zona de equipo.
    lun_falum(m, j, fuente) {
      const n = window.Game.EfectosPersonaje.reveladas(m)
        .filter((r) => r.j === j && r.tipo === 'personaje' && r.raza === 'lunaria' && r.zona === 'mano').length;
      const def = window.Game.Combat.postura(fuente) === 'defensiva';
      return [{ j, inst: fuente, ataque: def ? 0 : n, defensa: def ? n : 0,
        texto: `+${n} de ${def ? 'escudo' : 'ataque'} (aliados)` }];
    },
    // Él, en posición: +1 de ataque por cada Reanimado en el Hades.
    rea_gurh(m, j, fuente) {
      const n = window.Game.EfectosPersonaje.reanimadosEnHades(m).length;
      return [{ j, inst: fuente, ataque: n, defensa: 0, texto: `+${n} de ataque (Hades)` }];
    },
    // Desde el Hades: tu Reanimado en posición gana el ataque de TUS reanimados
    // en el Hades (ella incluida).
    rea_ejercito(m, j) {
      const n = window.Game.EfectosPersonaje.reanimadosEnHades(m, j)
        .reduce((s, i) => s + window.Game.CHARACTERS_BY_ID[i.personaje].ataque, 0);
      return window.Game.EfectosPersonaje._aActivo(j, 'reanimado', { ataque: n }, `+${n} de ataque (Ejército)`);
    },
    // Ella, en posición: el activo del rival pierde 1 de ataque y defensa por
    // cada Reanimado en el Hades.
    rea_thila(m, j) {
      const n = window.Game.EfectosPersonaje.reanimadosEnHades(m).length;
      const rival = m.jugadores[1 - m.jugadores.indexOf(j)];
      return rival.activos.map((inst) => ({ j: rival, inst, ataque: -n, defensa: -n, texto: `−${n} (Thila)` }));
    },
    // Él, en posición: si Gurh está en el Hades, duplica su ataque o defensa.
    rea_zabar(m, j, fuente) {
      const gurh = m.jugadores.some((x) => x.hades.some((i) => i.personaje === 'rea_gurh'));
      if (!gurh) return [];
      const p = window.Game.CHARACTERS_BY_ID[fuente.personaje];
      const def = window.Game.Combat.postura(fuente) === 'defensiva';
      return [{ j, inst: fuente, ataque: def ? 0 : p.ataque, defensa: def ? p.defensa : 0,
        texto: `${def ? 'defensa' : 'ataque'} ×2 (Gurh en el Hades)` }];
    }
  },

  /** Dónde tiene que estar la carta del pasivo para funcionar. */
  DONDE_PASIVO: {
    des_lydia: 'mano', lun_acompanantes: 'mano',
    rea_ejercito: 'hades',
    des_auram: 'posicion', lun_falum: 'posicion', rea_gurh: 'posicion',
    rea_thila: 'posicion', rea_zabar: 'posicion'
  },

  /**
   * Todas las cartas reveladas de la mesa, de los dos bandos, sin las del
   * Hades ni el vacío: [{ j, id, tipo: 'personaje'|'accion', raza, zona }].
   * `zona`: 'posicion' (en posición o acoplada) o 'mano' (usada y de vuelta).
   */
  reveladas(m) {
    const C = window.Game.CHARACTERS_BY_ID;
    const out = [];
    for (const j of m.jugadores) {
      const fuera = new Set([...j.hades, ...(j.vacio || [])].map((i) => i.personaje));
      const enJuego = new Set();
      for (const i of j.activos) {
        enJuego.add(i.personaje);
        if (i.accion) enJuego.add(i.accion);
      }
      const ids = new Set([...j.revelados, ...enJuego]);
      for (const id of ids) {
        if (fuera.has(id)) continue;
        const c = C[id];
        out.push({ j, id, tipo: c ? 'personaje' : 'accion', raza: c ? c.raza : null,
          zona: enJuego.has(id) ? 'posicion' : 'mano' });
      }
    }
    return out;
  },

  /** Reanimados en el Hades: de los dos bandos, o solo de `j` si se da. */
  reanimadosEnHades(m, j = null) {
    const C = window.Game.CHARACTERS_BY_ID;
    return (j ? [j] : m.jugadores)
      .flatMap((x) => x.hades)
      .filter((i) => C[i.personaje] && C[i.personaje].raza === 'reanimado');
  },

  /** Bono para tu personaje en posición, si es de la raza pedida. */
  _aActivo(j, raza, { ataque = 0, defensa = 0 }, texto) {
    const C = window.Game.CHARACTERS_BY_ID;
    return j.activos
      .filter((i) => C[i.personaje] && C[i.personaje].raza === raza)
      .map((inst) => ({ j, inst, ataque, defensa, texto }));
  },

  /**
   * Recalcula `inst.pasivo` de todos los personajes en posición y anuncia en
   * amarillo los que CAMBIAN (no en cada repintado: solo cuando el número se
   * mueve). Lo llama `notificar`, así que la pantalla y la IA lo ven ya.
   */
  recalcularPasivos(m) {
    const nuevos = new Map();
    for (const j of m.jugadores) {
      const fuentes = [
        ...j.activos.map((inst) => ({ inst, donde: 'posicion' })),
        ...j.reserva.filter((i) => j.revelados.has(i.personaje)).map((inst) => ({ inst, donde: 'mano' })),
        ...j.hades.map((inst) => ({ inst, donde: 'hades' }))
      ];
      for (const { inst, donde } of fuentes) {
        const f = this.PASIVOS[inst.personaje];
        if (!f || this.DONDE_PASIVO[inst.personaje] !== donde) continue;
        // Kratox niega sus efectos mientras dure.
        if (this.negado(m, inst)) continue;
        let partes = [];
        try {
          partes = f(m, j, inst) || [];
        } catch (err) {
          continue;
        }
        for (const p of partes) {
          if (!p.ataque && !p.defensa) continue;
          const acc = nuevos.get(p.inst) || { j: p.j, ataque: 0, defensa: 0, textos: [] };
          acc.ataque += p.ataque || 0;
          acc.defensa += p.defensa || 0;
          acc.textos.push(p.texto);
          nuevos.set(p.inst, acc);
        }
      }
    }
    for (const j of m.jugadores) {
      // Fuera de posición no hay bono: que no se quede pegado a la instancia
      // para cuando vuelva (ni engañe a la IA al valorar su reserva).
      for (const inst of [...j.reserva, ...j.hades, ...(j.vacio || [])]) inst.pasivo = null;
      for (const inst of j.activos) {
        const n = nuevos.get(inst) || { ataque: 0, defensa: 0, textos: [] };
        const antes = inst.pasivo || { ataque: 0, defensa: 0 };
        inst.pasivo = { ataque: n.ataque, defensa: n.defensa };
        if (antes.ataque === n.ataque && antes.defensa === n.defensa) continue;
        const nombre = window.Game.CHARACTERS_BY_ID[inst.personaje].nombre.split(',')[0];
        const texto = n.textos.length ? n.textos.join(' · ') : 'pierde su bono';
        m.log(`✦ ${nombre}: ${texto} (automático).`);
        if (m.anunciar) m.anunciar(j, inst, `${nombre}: ${texto}`);
      }
    }
  },

  sabeUsar(id) {
    return !!this.EFECTOS[id];
  },

  /* ------------------------------ Ganchos ------------------------------ */

  alDesplegar(motor, jugador, inst) {
    const ef = this.EFECTOS[inst.personaje];
    if (!ef || ef.momento !== 'posicion') return;
    if (this.negado(motor, inst)) return;
    if (ef.fn) {
      this.CON_DADO[ef.fn].call(this, motor, jugador, inst);
      return;
    }
    this._modal(motor, jugador, inst, ef, 'En posición');
  },

  _seluah(motor, j, inst, ataca, otro) {
    const C = window.Game.CHARACTERS_BY_ID;
    const seluah = j.reserva.find((i) => i.personaje === 'lun_seluah' && j.revelados.has('lun_seluah'));
    if (!seluah || this.negado(motor, seluah)) return;
    if (!C[inst.personaje] || C[inst.personaje].raza !== 'lunaria') return;
    const libres = motor.accionesDisponibles(j);
    if (!libres.length) return;
    const nombre = C[inst.personaje].nombre.split(',')[0];
    motor.elegir({
      jugador: j,
      titulo: `Seluah · ¿cambiar la acción de ${nombre}?`,
      opciones: [
        { id: '', texto: `Mantener ${inst.accion ? window.Game.Manual.nombreCarta(inst.accion) : 'sin acción'}` },
        ...libres.map((id) => ({ id, texto: window.Game.Manual.nombreCarta(id) }))
      ],
      // La IA prueba cada una contra el otro y se queda con la que mejor sale.
      ia: (ops) => {
        const Comb = window.Game.Combat;
        const puntua = (accionId) => {
          const antes = inst.accion;
          if (accionId) inst.accion = accionId;
          const r = ataca ? Comb.resolver(inst, otro) : (otro ? Comb.resolver(otro, inst) : null);
          inst.accion = antes;
          if (!r) return 0;
          return ataca
            ? (r.destruido ? 10 : 0) + r.danoSangre - r.danoReflejado
            : -(r.destruido ? 10 : 0) - r.danoSangre + r.danoReflejado;
        };
        return ops.map((o) => o.id).sort((a, b) => puntua(b) - puntua(a))[0];
      },
      alElegir: (id) => {
        if (!id) return;
        if (inst.accion) motor.revelar(j, inst.accion);
        inst.accion = id;
        motor.revelar(j, id);
        motor.log(`✦ Seluah: ${nombre} cambia a «${window.Game.Manual.nombreCarta(id)}».`);
        motor.anunciar(j, inst, `Seluah: cambia a ${window.Game.Manual.nombreCarta(id)}`);
      }
    });
  },

  /* ------------------------ Oxitrón: dados y estados ----------------------- */

  CON_DADO: {
    /** Eliges una acción del rival: no se puede usar mientras Lirhym siga en posición. */
    lirhym(motor, jugador, inst) {
      const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
      const libres = motor.accionesDisponibles(rival);
      if (!libres.length) return;
      motor.elegir({
        jugador,
        titulo: 'Lirhym · elige una acción del rival',
        opciones: this._opcionesOcultas(rival, libres, 'Acción oculta'),
        ia: (ops) => this._iaObjetivo(rival, ops, 'accion'),
        alElegir: (cartaId) => {
          window.Game.Manual.bloquearMientras(motor, rival, cartaId, inst.uid, 'Lirhym');
          motor.anunciar(jugador, inst, 'Lirhym: bloquea una acción mientras siga aquí');
        }
      });
    },

    /** Envía un Reanimado de TU zona de equipo al Hades (eliges cuál). */
    vyla(motor, jugador, inst) {
      const C = window.Game.CHARACTERS_BY_ID;
      const candidatos = jugador.reserva.filter((i) => C[i.personaje]?.raza === 'reanimado');
      if (!candidatos.length) return;
      motor.elegir({
        jugador,
        titulo: 'Vyla · envía un Reanimado de tu equipo al Hades',
        opciones: candidatos.map((i) => ({ id: i.uid, texto: C[i.personaje].nombre.split(',')[0] })),
        // Al Hades lo que más rinde allí: Ejército, luego Gurh (Zabar), luego el más barato.
        ia: (ops) => {
          const pref = ['rea_ejercito', 'rea_gurh'];
          const p = candidatos.find((i) => pref.includes(i.personaje));
          return (p || [...candidatos].sort((a, b) => C[a.personaje].coste - C[b.personaje].coste)[0]).uid;
        },
        alElegir: (uid) => {
          const v = jugador.reserva.find((i) => i.uid === uid);
          if (v) motor.enviarAlHades(jugador, v, 'Vyla');
        }
      });
    },

    /** Puedes enviar a Luh al Hades y poner en posición otro Reanimado REVELADO. */
    luh(motor, jugador, inst) {
      const C = window.Game.CHARACTERS_BY_ID;
      const candidatos = jugador.reserva.filter(
        (i) => C[i.personaje]?.raza === 'reanimado' && jugador.revelados.has(i.personaje)
      );
      if (!candidatos.length) return;
      motor.elegir({
        jugador,
        titulo: 'Luh · ¿cambiarte por otro Reanimado revelado?',
        opciones: [
          { id: '', texto: 'Quedarse' },
          ...candidatos.map((i) => ({ id: i.uid, texto: C[i.personaje].nombre.split(',')[0] }))
        ],
        ia: () => [...candidatos].sort((a, b) => window.Game.AI.valor(b) - window.Game.AI.valor(a))[0].uid,
        alElegir: (uid) => {
          if (!uid) return;
          const otro = jugador.reserva.find((i) => i.uid === uid);
          if (!otro) return;
          motor.enviarAlHades(jugador, inst, 'Luh se sacrifica');
          // Entra sin pagar coste ni mirar la fase: lo pone la carta.
          jugador.reserva = jugador.reserva.filter((i) => i !== otro);
          jugador.activos.push(otro);
          otro.salioAlCampo = true;
          motor.revelar(jugador, otro.personaje);
          motor.log(`✦ Luh: ${C[otro.personaje].nombre} entra en posición.`);
          this.alDesplegar(motor, jugador, otro);
        }
      });
    },

    /** Recupera del Hades a la zona de equipo un personaje de coste ≤5, pagando su coste. */
    lyla(motor, jugador, inst) {
      const C = window.Game.CHARACTERS_BY_ID;
      const energia = motor.energiaDe(jugador);
      const candidatos = jugador.hades.filter(
        (i) => C[i.personaje] && C[i.personaje].coste <= 5 && C[i.personaje].coste <= energia
      );
      if (!candidatos.length) return;
      motor.elegir({
        jugador,
        titulo: `Lyla · recupera del Hades (pagas su coste; tienes ${energia})`,
        opciones: [
          { id: '', texto: 'No recuperar' },
          ...candidatos.map((i) => ({ id: i.uid, texto: `${C[i.personaje].nombre.split(',')[0]} (${C[i.personaje].coste})` }))
        ],
        ia: () => [...candidatos].sort((a, b) => window.Game.AI.valor(b) - window.Game.AI.valor(a))[0].uid,
        alElegir: (uid) => {
          if (!uid) return;
          const r = jugador.hades.find((i) => i.uid === uid);
          if (r) motor.recuperarDelHades(jugador, uid, { costeSangre: C[r.personaje].coste, motivo: 'Lyla' });
        }
      });
    },

    /**
     * Declaras un tipo; el rival debe acoplar a su activo una acción de ese
     * tipo en su próxima fase de acción. Si no tiene de ese tipo, no aplica
     * (Oscar), así que solo se ofrecen los tipos que tiene.
     */
    yrving(motor, jugador, inst) {
      const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
      const A = window.Game.ACTIONS_BY_ID;
      const tipos = ['neutral', 'defensiva', 'ofensiva']
        .filter((t) => motor.accionesDisponibles(rival).some((id) => A[id]?.tipo === t));
      if (!tipos.length) return;
      const NOMBRE = { ofensiva: 'Ofensiva', defensiva: 'Defensiva', neutral: 'Neutra' };
      motor.elegir({
        jugador,
        titulo: 'Yrving · declara un tipo de acción',
        opciones: tipos.map((t) => ({ id: t, texto: NOMBRE[t] })),
        // La neutra deja al rival sin ataque ni defensa: es la que más duele.
        ia: (ops) => ops[0].id,
        alElegir: (tipo) => {
          motor.ponerEstado({ tipo: 'tipoForzado', jugador: rival, turnos: 2, valor: tipo,
            motivo: `Yrving: ${rival.nombre} debe acoplar una acción ${NOMBRE[tipo].toLowerCase()}` });
          motor.log(`✦ Yrving declara «${NOMBRE[tipo]}»: ${rival.nombre} debe acoplar una de ese tipo.`);
          motor.anunciar(jugador, inst, `Yrving: el rival debe acoplar ${NOMBRE[tipo].toLowerCase()}`);
        }
      });
    },

    /**
     * Según el tipo de la acción acoplada: ofensiva, un personaje del Hades al
     * vacío; defensiva, uno del vacío al Hades; neutra, recuperar 1 sangre.
     */
    errante(motor, jugador, inst) {
      const A = window.Game.ACTIONS_BY_ID;
      const C = window.Game.CHARACTERS_BY_ID;
      const tipo = A[inst.accion]?.tipo;
      const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
      if (tipo === 'neutral') {
        motor.recuperar(jugador, 1, 'Errante');
        motor.anunciar(jugador, inst, 'Errante: recupera 1 sangre');
        return;
      }
      const deHades = tipo === 'ofensiva';
      const zona = (j) => (deHades ? j.hades : (j.vacio || []));
      const opciones = motor.jugadores.flatMap((j) => zona(j).map((i) => ({
        id: i.uid,
        texto: `${C[i.personaje].nombre.split(',')[0]} (${j === jugador ? 'tuyo' : 'rival'})`
      })));
      if (!opciones.length) return;
      motor.elegir({
        jugador,
        titulo: deHades ? 'Errante · un personaje del Hades al vacío' : 'Errante · uno del vacío al Hades',
        opciones,
        // Al vacío, lo del rival (le quita recursos); del vacío, lo tuyo.
        ia: (ops) => {
          const mio = (uid) => zona(jugador).some((i) => i.uid === uid);
          const o = ops.find((x) => (deHades ? !mio(x.id) : mio(x.id)));
          return (o || ops[0]).id;
        },
        alElegir: (uid) => {
          const dueno = motor.jugadores.find((j) => zona(j).some((i) => i.uid === uid));
          if (!dueno) return;
          if (deHades) motor.enviarAlVacio(dueno, uid, 'Errante');
          else motor.recuperarDelVacio(dueno, uid, 'Errante');
        }
      });
    },

    /** 1-3: el rival no puede atacarle durante tantos turnos como salga. */
    pip(motor, jugador, inst) {
      window.Game.Manual.tirar(motor, { jugador, motivo: 'Pip (En posición)' }, (r) => {
        if (r > 3) {
          motor.log('  ↳ Pip: no pasa nada.');
          return;
        }
        motor.ponerEstado({ tipo: 'inmune', jugador, uid: inst.uid, turnos: r, motivo: 'Pip: intocable' });
        motor.log(`  ↳ Pip: no se le puede atacar durante ${r} ${r === 1 ? 'turno' : 'turnos'}.`);
        motor.anunciar(jugador, inst, `Pip: intocable ${r} ${r === 1 ? 'turno' : 'turnos'}`);
      });
    },

    /** Con 3 o más, la acción acoplada del rival vuelve a su zona. */
    brawl(motor, jugador, inst) {
      const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
      const objetivo = rival.activos.find((i) => i.accion);
      if (!objetivo) {
        motor.log('  ↳ Brawl: el rival no tiene acción acoplada.');
        return;
      }
      window.Game.Manual.tirar(motor, { jugador, motivo: 'Brawl (En posición)' }, (r) => {
        if (r < 3 || !objetivo.accion) {
          motor.log('  ↳ Brawl: no la arranca.');
          return;
        }
        const nombre = window.Game.Manual.nombreCarta(objetivo.accion);
        motor.revelar(rival, objetivo.accion);
        objetivo.accion = null;
        motor.log(`  ↳ Brawl devuelve «${nombre}» a la zona de acciones de ${rival.nombre}.`);
        motor.anunciar(jugador, inst, `Brawl: quita «${nombre}»`);
      });
    },

    /** Eliges una acción del rival; queda bloqueada tantos turnos como salga. */
    kaw(motor, jugador, inst) {
      const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
      const libres = motor.accionesDisponibles(rival);
      if (!libres.length) return;
      motor.elegir({
        jugador,
        titulo: 'Kaw · elige una acción del rival',
        opciones: this._opcionesOcultas(rival, libres, 'Acción oculta'),
        ia: (ops) => this._iaObjetivo(rival, ops, 'accion'),
        alElegir: (cartaId) => {
          window.Game.Manual.tirar(motor, { jugador, motivo: 'Kaw (En posición)' }, (r) => {
            window.Game.Manual.bloquear(motor, rival, cartaId, r, 'Kaw');
            motor.anunciar(jugador, inst, `Kaw: acción bloqueada ${r} ${r === 1 ? 'turno' : 'turnos'}`);
          });
        }
      });
    },

    /** Eliges un personaje de su reserva: bloqueado y negado tantos turnos como salga. */
    kratox(motor, jugador, inst) {
      const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
      if (!rival.reserva.length) return;
      const ids = rival.reserva.map((i) => i.uid);
      motor.elegir({
        jugador,
        titulo: 'Kratox · elige un personaje del rival',
        opciones: rival.reserva.map((i, k) => ({
          id: i.uid,
          texto: rival.revelados.has(i.personaje)
            ? window.Game.CHARACTERS_BY_ID[i.personaje].nombre.split(',')[0]
            : `Personaje oculto ${k + 1}`
        })),
        ia: (ops) => {
          // El revelado de más coste; si no hay revelados, uno al azar.
          const C = window.Game.CHARACTERS_BY_ID;
          const vistos = rival.reserva.filter((i) => rival.revelados.has(i.personaje))
            .sort((a, b) => C[b.personaje].coste - C[a.personaje].coste);
          return vistos.length ? vistos[0].uid : ids[Math.floor(Math.random() * ids.length)];
        },
        alElegir: (uid) => {
          const victima = rival.reserva.find((i) => i.uid === uid);
          if (!victima) return;
          window.Game.Manual.tirar(motor, { jugador, motivo: 'Kratox (En posición)' }, (r) => {
            motor.ponerEstado({ tipo: 'personajeBloqueado', jugador: rival, uid, turnos: r, motivo: 'Kratox: bloqueado' });
            const nombre = window.Game.CHARACTERS_BY_ID[victima.personaje].nombre.split(',')[0];
            motor.log(`  ↳ Kratox: ${nombre} no se puede usar y sus efectos se niegan ${r} ${r === 1 ? 'turno' : 'turnos'}.`);
            motor.anunciar(jugador, inst, `Kratox: bloquea a ${rival.revelados.has(victima.personaje) ? nombre : 'un personaje'} ${r} t.`);
          });
        }
      });
    }
  },

  /**
   * Opciones para elegir entre cartas del rival: las reveladas por su nombre,
   * las ocultas como «… oculta N» (no se sabe cuál es cuál).
   */
  _opcionesOcultas(rival, ids, rotulo) {
    let k = 0;
    return ids.map((id) => ({
      id,
      texto: rival.revelados.has(id) ? window.Game.Manual.nombreCarta(id) : `${rotulo} ${++k}`
    }));
  },

  /** La IA, al elegir una acción del rival: la ofensiva revelada, o una al azar. */
  _iaObjetivo(rival, ops, tipo) {
    const A = window.Game.ACTIONS_BY_ID;
    const vista = ops.find((o) => rival.revelados.has(o.id) && A[o.id] && A[o.id].tipo === 'ofensiva')
      || ops.find((o) => rival.revelados.has(o.id));
    return (vista || ops[Math.floor(Math.random() * ops.length)]).id;
  },

  /** Sabotaje del RIVAL acoplado a su personaje en posición (y sin negar). */
  saboteado(motor, jugador) {
    if (motor.accionesNegadas) return false;
    const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
    return !!rival && rival.activos.some((i) => i.accion === 'o_sabotaje');
  },

  /** Yun de `jugador`, en posición o revelado en su mano, sin negar. */
  tieneYun(motor, jugador) {
    return jugador.activos.some((i) => i.personaje === 'mer_yun' && !this.negado(motor, i))
      || jugador.reserva.some((i) => i.personaje === 'mer_yun' && jugador.revelados.has('mer_yun') && !this.negado(motor, i));
  },

  /**
   * «Retirada:» Sadash. Al volver a la reserva (no al morir), el oponente
   * derrama 1 por cada lunaria revelado (Oscar: sangrado x1 = derramar 1; los
   * revelados cuentan en los dos bandos).
   */
  alRetirarse(motor, jugador, inst) {
    if (inst.personaje !== 'lun_sadash' || this.negado(motor, inst)) return;
    const n = this.reveladas(motor).filter((r) => r.tipo === 'personaje' && r.raza === 'lunaria').length;
    if (!n) return;
    const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
    motor.derramar(rival, n, 'Sadash: sangrado');
    motor.anunciar(rival, rival.activos[0] || null, `Sadash: ${rival.nombre} sangra ${n}`);
  },

  /**
   * Zhin revelado en la mano de `jugador`, listo para destruirse en lugar de
   * su personaje en posición `inst`. Lo usa el combate (que pregunta) y
   * antesDeDestruir (que no puede esperar).
   */
  zhinDe(motor, jugador, inst) {
    if (!inst || inst.personaje === 'mer_zhin' || !jugador.activos.includes(inst)) return null;
    return jugador.reserva.find((i) => i.personaje === 'mer_zhin'
      && jugador.revelados.has('mer_zhin') && !this.negado(motor, i)) || null;
  },

  /**
   * Destrucciones que no son el golpe normal (golpe al grupo del jefe,
   * Inmolación…): no pueden esperar una respuesta, así que Zhin se sacrifica
   * solo si está. El golpe normal SÍ pregunta (ver resolverAtaque).
   */
  antesDeDestruir(motor, jugador, inst, motivo) {
    const zhin = this.zhinDe(motor, jugador, inst);
    if (!zhin) return false;
    motor.enviarAlHades(jugador, zhin, 'Zhin se destruye en su lugar');
    motor.anunciar(jugador, inst, 'Zhin se sacrifica en su lugar');
    return true;
  },

  /** Al cerrar el turno de `jugador` (Tilos). Gancho del motor. */
  /**
   * Fin de turno de `jugador`:
   *  - Biomecánica: el personaje sacrificado va al Hades y la carta vuelve a
   *    la zona de acciones.
   *  - Tilos: se destruye al final del turno del OPONENTE de su dueño, o en
   *    cuanto su anfitrión deja la posición.
   */
  alFinDeTurno(motor, jugador) {
    const C = window.Game.CHARACTERS_BY_ID;
    for (const p of motor.pendientesFinTurno || []) {
      const j = motor.jugadores[p.jugadorIdx];
      const v = j.reserva.find((i) => i.uid === p.uid);
      if (v) motor.enviarAlHades(j, v, 'Biomecánica');
      const host = j.activos.find((i) => i.uid === p.anfitrion);
      if (host && host.accion === 'd_biomecanica') {
        motor.revelar(j, host.accion);
        host.accion = null;
        motor.log('Biomecánica vuelve a la zona de acciones.');
      }
    }
    motor.pendientesFinTurno = [];

    motor.jugadores.forEach((j) => {
      for (const inst of [...j.activos, ...j.reserva, ...j.hades, ...(j.vacio || [])]) {
        if (!inst.tilos) continue;
        const sigue = j.activos.includes(inst);
        if (sigue && jugador === j) continue; // aún es el turno de su dueño
        j.hades.push(inst.tilos.carta);
        j.revelados.delete('mer_tilos');
        inst.tilos = null;
        motor.log(`${C.mer_tilos.nombre} se destruye${sigue ? ' al final del turno rival' : ''}.`);
      }
    });
  },

  /**
   * Tilos revelado en la mano, en tu fase de acción: puedes equiparlo a tu
   * personaje en posición como acción ofensiva o defensiva (suma su ataque o
   * su defensa). Ocupa el puesto de la acción: si había una, vuelve a la zona.
   */
  _tilos(motor, j) {
    const tilos = j.reserva.find((i) => i.personaje === 'mer_tilos');
    const host = j.activos[0];
    if (!tilos || !host || host.tilos || !j.revelados.has('mer_tilos') || this.negado(motor, tilos)) return;
    const T = window.Game.CHARACTERS_BY_ID.mer_tilos;
    const A = window.Game.ACTIONS_BY_ID;
    motor.elegir({
      jugador: j,
      titulo: 'Tilos · ¿lo equipas como acción?',
      opciones: [
        { id: '', texto: 'No' },
        { id: 'ofensiva', texto: `Ofensiva (+${T.ataque} ataque)` },
        { id: 'defensiva', texto: `Defensiva (+${T.defensa} defensa)` }
      ],
      // La IA lo gasta solo cuando no le queda ninguna ofensiva que acoplar.
      ia: () => (motor.accionesDisponibles(j).some((id) => A[id]?.tipo === 'ofensiva') ? '' : 'ofensiva'),
      alElegir: (tipo) => {
        if (!tipo) return;
        if (host.accion) {
          motor.revelar(j, host.accion);
          host.accion = null;
        }
        j.reserva = j.reserva.filter((i) => i !== tilos);
        host.tilos = { tipo, carta: tilos };
        motor.log(`✦ Tilos se equipa como acción ${tipo} (+${tipo === 'ofensiva' ? T.ataque : T.defensa}).`);
        motor.anunciar(j, host, `Tilos: acción ${tipo} +${tipo === 'ofensiva' ? T.ataque : T.defensa}`);
      }
    });
  },

  /** ¿Tiene sus efectos negados? (Kratox). */
  negado(motor, inst) {
    return motor.tieneEstado && motor.tieneEstado('personajeBloqueado', { uid: inst.uid });
  },

  /* --------------------------- Modales y revelar -------------------------- */

  /**
   * «Revela … o aumenta …»: con algo oculto que revelar, se pregunta (al
   * humano en pantalla; la IA con `iaModal`). Sin nada oculto, el aumento.
   */
  _modal(motor, jugador, inst, ef, momento, opts = {}) {
    const bono = () => this._sumar(motor, jugador, inst, ef, ef.texto, momento, opts);
    const rival = motor.jugadores[1 - motor.jugadores.indexOf(jugador)];
    const ocultas = ef.revelar ? this.ocultasDe(motor, rival, ef.revelar.tipo) : [];
    if (!ocultas.length) return bono();
    const nombre = window.Game.CHARACTERS_BY_ID[inst.personaje].nombre.split(',')[0];
    motor.elegir({
      jugador,
      titulo: `${nombre} · ${momento}`,
      opciones: [
        { id: 'bono', texto: ef.texto },
        { id: 'revelar', texto: ef.revelar.texto }
      ],
      ia: () => this.iaModal(motor, jugador),
      alElegir: (id) => (id === 'revelar'
        ? this._revelarOcultas(motor, jugador, inst, rival, ef.revelar.n, ocultas, nombre)
        : bono())
    });
  },

  /**
   * La regla de la IA para «revelar o aumentar»: revela si tiene cartas que
   * escalan con lo revelado (Lydia, Auram); si no, el aumento, que pega ya.
   */
  iaModal(motor, jugador) {
    const ids = [...jugador.reserva, ...jugador.activos].map((i) => i.personaje);
    return ids.some((id) => id === 'des_lydia' || id === 'des_auram') ? 'revelar' : 'bono';
  },

  /** Las cartas del rival que siguen ocultas, de un tipo o de cualquiera. */
  ocultasDe(motor, rival, tipo) {
    const out = [];
    if (tipo === 'personaje' || tipo === 'cualquiera') {
      for (const i of rival.reserva) if (!rival.revelados.has(i.personaje)) out.push(i.personaje);
    }
    if (tipo === 'accion' || tipo === 'cualquiera') {
      const enUso = new Set(rival.activos.map((i) => i.accion).filter(Boolean));
      for (const id of rival.acciones) if (!enUso.has(id) && !rival.revelados.has(id)) out.push(id);
    }
    return [...new Set(out)];
  },

  /**
   * Revela hasta N de las ocultas, ELIGIENDO una a una (Oscar): se pregunta
   * por posición («Acción oculta 2»), porque boca abajo no se sabe cuál es
   * cuál; en pantalla también se pincha el reverso en la mano del rival.
   * Tras la primera se puede terminar («hasta N»). La IA elige al azar.
   */
  _revelarOcultas(motor, jugador, inst, rival, n, ocultas, nombre, elegidas = []) {
    const quedan = ocultas.filter((id) => !rival.revelados.has(id));
    const cerrar = () => {
      if (!elegidas.length) return;
      const nombres = elegidas.map((id) => window.Game.Manual.nombreCarta(id)).join(', ');
      motor.log(`👁 ${nombre} revela de ${rival.nombre}: ${nombres}.`);
      motor.anunciar(jugador, inst, `${nombre} revela: ${nombres}`);
      motor.notificar();
    };
    if (!quedan.length || elegidas.length >= n) return cerrar();
    const A = window.Game.ACTIONS_BY_ID;
    let ka = 0, kp = 0;
    const opciones = quedan.map((id) => ({
      id, revelar: true, texto: A[id] ? `Acción oculta ${++ka}` : `Personaje oculto ${++kp}`
    }));
    if (elegidas.length) opciones.push({ id: '__fin', texto: 'Terminar' });
    motor.elegir({
      jugador,
      titulo: `${nombre} · revela ${elegidas.length + 1} de ${n}${elegidas.length ? '' : ' (pincha sus cartas boca abajo)'}`,
      opciones,
      ia: (ops) => {
        const validas = ops.filter((o) => o.id !== '__fin');
        return validas[Math.floor(Math.random() * validas.length)].id;
      },
      alElegir: (id) => {
        if (id === '__fin') return cerrar();
        rival.revelados.add(id);
        elegidas.push(id);
        this._revelarOcultas(motor, jugador, inst, rival, n, ocultas, nombre, elegidas);
      }
    });
  },

  alEquipar(motor, jugador, inst) {
    const ef = this.EFECTOS[inst.personaje];
    if (!ef || ef.momento !== 'equipar') return;
    if (this.negado(motor, inst)) return;
    if (ef.fn) {
      this.CON_DADO[ef.fn].call(this, motor, jugador, inst);
      return;
    }
    // Lo que diera la acción anterior se quita antes de dar lo nuevo.
    const previo = inst.bonoPersonaje;
    if (previo) {
      inst.modificadores.ataque -= previo.ataque || 0;
      inst.modificadores.defensa -= previo.defensa || 0;
      inst.bonoPersonaje = null;
    }
    const accion = window.Game.ACTIONS_BY_ID[inst.accion];
    const rama = accion && ef.porTipo[accion.tipo];
    if (!rama) return;
    this._sumar(motor, jugador, inst, rama, rama.texto, accion.tipo === 'ofensiva' ? 'Acción Ataque' : 'Acción Defensa');
    inst.bonoPersonaje = { ataque: rama.ataque || 0, defensa: rama.defensa || 0 };
  },

  /** Al entrar en la fase de acción del jugador activo. */
  alEntrarEnAccion(motor) {
    const j = motor.jugadorActivo;
    this._tilos(motor, j);
    for (const inst of j.activos) {
      const ef = this.EFECTOS[inst.personaje];
      if (!ef || ef.momento !== 'accion' || this.negado(motor, inst)) continue;
      this._modal(motor, j, inst, ef, 'Acción', { temporal: true });
    }
  },

  /** Al declararse un ataque: atacante y defensor, si tienen efecto de batalla. */
  enBatalla(motor, atacanteJ, atkInst, defensorJ, defInst) {
    // Seluah revelada en la mano: puedes cambiar la acción de tu Lunaria.
    for (const [j, inst, rival] of [[atacanteJ, atkInst, defInst], [defensorJ, defInst, atkInst]]) {
      if (inst) this._seluah(motor, j, inst, inst === atkInst, rival);
    }
    for (const [j, inst] of [[atacanteJ, atkInst], [defensorJ, defInst]]) {
      if (!inst) continue;
      const ef = this.EFECTOS[inst.personaje];
      if (!ef || ef.momento !== 'batalla') continue;
      if (this.negado(motor, inst)) continue;
      const nombre = window.Game.CHARACTERS_BY_ID[inst.personaje].nombre;
      window.Game.Manual.tirar(motor, { jugador: j, motivo: `${nombre} (Batalla)` }, (resultado) => {
        const cambio = { [ef.dado]: resultado };
        const texto = `+${resultado} de ${ef.dado === 'ataque' ? 'daño' : 'defensa'} (dado)`;
        this._sumar(motor, j, inst, cambio, texto, 'Batalla', { temporal: true });
      });
    }
  },

  /* ------------------------------ Interno ------------------------------ */

  _sumar(motor, jugador, inst, { ataque = 0, defensa = 0 }, texto, momento, { temporal = false } = {}) {
    inst.modificadores = inst.modificadores || { ataque: 0, defensa: 0 };
    inst.modificadores.ataque += ataque;
    inst.modificadores.defensa += defensa;
    const nombre = window.Game.CHARACTERS_BY_ID[inst.personaje].nombre;
    if (temporal) {
      // Se revierte solo al cerrar el turno, como Finta (ver finalizarTurno).
      motor.efectosTemporales.push({
        jugadorIdx: motor.jugadores.indexOf(jugador),
        uid: inst.uid,
        ataque,
        defensa,
        turnos: 1,
        motivo: `${nombre}: ${momento}`
      });
    }
    motor.log(`✦ ${nombre} — ${momento}: ${texto} (automático).`);
    motor.anunciar(jugador, inst, `${nombre.split(',')[0]}: ${texto}`);
  }
};
