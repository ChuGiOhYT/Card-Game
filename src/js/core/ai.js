/**
 * IA rival. Heurística simple y legible: despliega lo mejor que pueda pagar,
 * decide postura comparando su golpe con lo que tiene enfrente y ataca
 * siempre que le salga rentable.
 *
 * Soporta varios personajes en posición: rellena los puestos libres, equipa a
 * cada uno y ataca con todos los que puedan.
 *
 * Es deliberadamente básica; sirve para que el duelo sea jugable de principio
 * a fin, no para dar pelea seria.
 */
window.Game = window.Game || {};

window.Game.AI = {
  /**
   * Palancas de decisión, separadas de la lógica para poder medirlas.
   * `tools/simular.js` juega miles de duelos variando estos valores y
   * enfrentando las variantes entre sí; los que están aquí son los que
   * ganaron la comparación, no los que sonaban bien.
   */
  AJUSTES: {
    /**
     * Con la sangre en la pila por debajo de esto, se cubre: prefiere acción
     * defensiva aunque pudiera matar. 0 = no mirar nunca la vida.
     */
    sangreParaCubrirse: 0,

    /**
     * Relevar al de posición en cuanto otro resuelva mejor el cruce, en vez
     * de solo cuando el actual no puede con el rival.
     */
    relevoOportunista: false,

    /**
     * Si no puede romper al defensor, atacar igualmente cuando el golpe pase
     * daño a la sangre. Con `false` se limita a cubrirse.
     */
    insistirSinMatar: false,

    /**
     * Elegir la acción simulando el intercambio con las reglas de combate
     * reales, en vez de por la regla fija de «ofensiva si puedo matar».
     *
     * Activado tras medirlo: gana 54-55% contra la regla fija y cierra las
     * partidas dos turnos antes. Es el único de estos ajustes que se sale del
     * ruido; los otros tres se quedaron en 49-52% y siguen apagados.
     * Reproducible con `npm run simular -- --torneo`.
     */
    accionPorSimulacion: true,

    /**
     * Pesos de esa simulación: cuánto vale tumbar a alguien y cuánto duele
     * que te tumben. Si `pesoMorir` sube demasiado los dos bandos se atrincheran
     * y el duelo se decide por desgaste de sangre en vez de por combate.
     */
    pesoMatar: 8,
    pesoMorir: 7,
    pesoSangreRecibida: 0.5,

    /**
     * Cuánto vale el daño que devuelve el escudo al atacante. Va a peso 1
     * porque es sangre rival igual que la que saco pegando.
     *
     * No es un ajuste especulativo como los de arriba: sin él la IA no veía
     * el único beneficio de cubrirse y NO equipaba una defensiva jamás. Está
     * como peso y no como número fijo para poder apagarlo y medirlo
     * (`npm run simular -- --torneo`, variante `sinReflejo`).
     */
    pesoReflejo: 1
  },

  /**
   * Juega el turno del jugador activo y lo cierra.
   *
   * Con `pausarEnAtaques` declara un ataque y devuelve el control sin
   * resolverlo, para que el humano pueda aplicar sus efectos de «Fase de
   * combate» defendiendo. Volver a llamar reanuda donde lo dejó: la función
   * es reentrante porque cada bloque mira la fase actual.
   */
  jugarTurno(motor, opciones = {}) {
    let guarda = 0;
    while (guarda++ < 10) {
      if (!this.jugarFase(motor, opciones)) break;
    }
  },

  /**
   * Resuelve SOLO la fase en curso y avanza a la siguiente.
   *
   * Está separado para que la pantalla pueda ir llamándolo con una pausa
   * entre fases y se vea el indicador P → A → C → F moverse, en vez de que
   * el turno del rival ocurra entero en un parpadeo. El banco de simulación
   * no quiere esa pausa y usa `jugarTurno`, que lo llama en bucle: la lógica
   * es la misma en los dos casos.
   *
   * @returns {boolean} si queda turno por jugar. `false` cuando el turno
   *   terminó, la partida acabó, o quedó un ataque esperando al humano.
   */
  jugarFase(motor, { pausarEnAtaques = false } = {}) {
    if (motor.terminada) return false;
    // Una carta suya pide que ELIJA el humano (Zhin, Campo caótico…): se para
    // hasta que conteste.
    if (motor.eleccionPendiente) return false;
    // Hay un ataque suyo esperando resolución: no toca moverse todavía.
    if (motor.ataquePendiente) return false;

    const yo = motor.jugadorActivo;
    const rival = motor.jugadorInactivo;

    // --- Fase de personaje: llena los puestos libres ------------------------
    if (motor.fase === 'personaje') {
      let guarda = 0;
      while (yo.activos.length < yo.maxActivos && !motor.desplegoEsteTurno && guarda++ < 10) {
        const candidatos = this.candidatos(motor, yo);
        if (!candidatos.length) break;
        if (!motor.desplegar(candidatos[0].uid)) break;
      }
      // Con un solo puesto, cambiar es la única forma de mejorar la posición.
      this.relevarSiConviene(motor, yo, rival);
      motor.siguienteFase();
      return true;
    }

    // --- Fase de acción: equipa a cada personaje ----------------------------
    if (motor.fase === 'accion') {
      for (const inst of yo.activos) {
        if (inst.tilos) continue;
        const elegida = this.elegirAccion(motor, yo, rival, inst);
        if (elegida && motor.equipar(elegida, inst.uid)) {
          // Las de timing «Acción equipada» ocurren aquí mismo, al acoplarlas.
          if (window.Game.AccionesIA) {
            window.Game.AccionesIA.alEquipar(motor, yo, inst);
          }
        }
        if (motor.eleccionPendiente) return false;
      }
      motor.siguienteFase();
      return true;
    }

    // --- Fase de ataque: golpea con todos los que puedan --------------------
    if (motor.fase === 'ataque') {
      let guarda = 0;
      while (motor.puedeAtacar() && guarda++ < 10) {
        const atacante = motor.atacantesDisponibles()[0];
        const objetivo = this.elegirObjetivo(motor, atacante, rival);

        // Su carta ofensiva, ANTES de declarar: así el bonus ya cuenta en la
        // previsión que verá el jugador y en la resolución.
        if (window.Game.AccionesIA) {
          window.Game.AccionesIA.alAtacar(motor, yo, atacante, {
            defensorInst: objetivo,
            defensor: rival
          });
          // Un efecto puede haber terminado la partida (Ruego, Luna sangrienta
          // mueven sangre) o haber dejado al atacante sin poder atacar.
          if (motor.terminada) return false;
          if (motor.atacaronEsteTurno.has(atacante.uid)) continue;
        }

        if (pausarEnAtaques) {
          // Declara y se detiene: el humano decide si se defiende con algo
          // antes de que esto se resuelva.
          motor.declararAtaque(atacante.uid, objetivo && objetivo.uid);
          // Si la defensa del humano canceló el ataque al declararlo, no hay
          // nada pendiente y la cadena debe seguir en vez de quedarse colgada.
          if (motor.ataquePendiente) return false;
          continue;
        }
        if (!motor.atacar(atacante.uid, objetivo && objetivo.uid)) break;
      }
      // Inmolación y compañía: se cobran cuando ya se sabe quién batalló.
      if (window.Game.AccionesIA) {
        window.Game.AccionesIA.cobrarAutodestrucciones(motor);
        if (motor.terminada) return false;
      }
      motor.siguienteFase();
      return true;
    }

    if (motor.fase === 'fin') {
      motor.finalizarTurno();
      return false;
    }
    return false;
  },

  valor(inst) {
    const p = window.Game.CHARACTERS_BY_ID[inst.personaje];
    return p.ataque + p.defensa;
  },

  /**
   * Lo que valdría `inst` EN POSICIÓN ahora mismo: lo impreso más los pasivos
   * que le tocarían (los suyos —Gurh, Zabar, Auram— y los de sus aliados
   * desde la mano o el Hades —Lydia, Acompañantes, Ejército—), más lo que le
   * quita al rival (Thila). Sin esto la IA solo veía números impresos, y los
   * Reanimados, flojos sobre el papel y fuertes con el Hades lleno, salían
   * tarde o nunca.
   *
   * Se prueba poniéndolo un momento en posición, sin tocar nada más: las
   * funciones de `PASIVOS` solo leen.
   */
  valorEnCampo(motor, yo, inst) {
    const EP = window.Game.EfectosPersonaje;
    const C = window.Game.CHARACTERS_BY_ID;
    let v = this.valor(inst);
    if (!EP || !motor) return v;
    const rival = motor.jugadores[1 - motor.jugadores.indexOf(yo)];
    const antes = yo.activos;
    yo.activos = [inst];
    try {
      const fuentes = [
        { inst, donde: 'posicion' },
        ...yo.reserva.filter((i) => i !== inst && yo.revelados.has(i.personaje)).map((i) => ({ inst: i, donde: 'mano' })),
        ...yo.hades.map((i) => ({ inst: i, donde: 'hades' }))
      ];
      for (const { inst: f, donde } of fuentes) {
        const fn = EP.PASIVOS[f.personaje];
        if (!fn || EP.DONDE_PASIVO[f.personaje] !== donde || EP.negado(motor, f)) continue;
        for (const p of fn(motor, yo, f) || []) {
          const n = (p.ataque || 0) + (p.defensa || 0);
          if (p.inst === inst) v += n;
          else if (p.j === rival) v -= n; // Thila: lo que pierde el rival
        }
      }
    } catch (err) {
      // Si algo no cuadra, se queda con lo impreso.
    } finally {
      yo.activos = antes;
    }
    // Vyla al entrar llena el Hades con otro Reanimado: vale lo que alimenta.
    if (inst.personaje === 'rea_vyla'
        && yo.reserva.some((i) => i !== inst && C[i.personaje].raza === 'reanimado')) v += 3;
    return v;
  },

  /** Ataque que tendría en posición (impreso + pasivos), para los cruces. */
  ataqueEnCampo(motor, yo, inst) {
    const base = window.Game.CHARACTERS_BY_ID[inst.personaje].ataque;
    if (!motor || !yo) return base;
    const EP = window.Game.EfectosPersonaje;
    const antes = yo.activos;
    let extra = 0;
    yo.activos = [inst];
    try {
      const fuentes = [
        { inst, donde: 'posicion' },
        ...yo.reserva.filter((i) => i !== inst && yo.revelados.has(i.personaje)).map((i) => ({ inst: i, donde: 'mano' })),
        ...yo.hades.map((i) => ({ inst: i, donde: 'hades' }))
      ];
      for (const { inst: f, donde } of fuentes) {
        const fn = EP && EP.PASIVOS[f.personaje];
        if (!fn || EP.DONDE_PASIVO[f.personaje] !== donde || EP.negado(motor, f)) continue;
        for (const p of fn(motor, yo, f) || []) if (p.inst === inst) extra += p.ataque || 0;
      }
    } catch (err) {
      extra = 0;
    } finally {
      yo.activos = antes;
    }
    return base + extra;
  },

  /**
   * Quién puede salir ahora, en orden de preferencia.
   *
   * Con `ordenFijo` respeta el orden en que viene el equipo, que es como se
   * escribió la oleada del calabozo: primero la chusma, al final lo gordo.
   * Sin él manda la potencia bruta.
   */
  candidatos(motor, yo) {
    const libres = yo.reserva.filter((i) => motor.puedeDesplegar(yo, i));
    if (yo.ordenFijo) {
      return libres.sort(
        (a, b) => yo.equipo.indexOf(a.personaje) - yo.equipo.indexOf(b.personaje)
      );
    }
    const v = new Map(libres.map((i) => [i, this.valorEnCampo(motor, yo, i)]));
    return libres.sort((a, b) => v.get(b) - v.get(a));
  },

  /**
   * Releva al personaje en posición si el que espera resuelve mejor la
   * situación actual. Conservador a propósito: solo cambia cuando el actual
   * no puede con el rival y el suplente sí, para no estar rotando en vano.
   */
  relevarSiConviene(motor, yo, rival) {
    if (yo.activos.length < yo.maxActivos) return false;
    if (!yo.reserva.length) return false;

    const objetivo = rival.activos[0];
    if (!objetivo) return false;

    const actual = yo.activos[0];
    const sirve = this.superaA(actual, objetivo, motor, yo);

    // En modo oportunista se cambia también con el actual sirviendo, si hay
    // alguien que pega más fuerte para este mismo cruce.
    if (sirve && !this.AJUSTES.relevoOportunista) return false;

    // El Eternal no sale a relevar mientras le queden esbirros: se esconde
    // tras ellos. Pasaba en cuanto tus personajes aplicaban sus bonus solos
    // (Annia +1): el esbirro ya no podía con ella, salía Iskar y la etapa 6 del
    // Bosque caía del 67% al 12%.
    const relevo = this.candidatos(motor, yo).find(
      (i) =>
        !motor.eternalProtegido(yo, i) &&
        this.superaA(i, objetivo, motor, yo) &&
        (!sirve || this.valorEnCampo(motor, yo, i) > this.valorEnCampo(motor, yo, actual))
    );
    if (!relevo) return false;

    return motor.desplegar(relevo.uid);
  },

  /**
   * ¿Bastaría el ataque impreso de `inst` para tumbar a `objetivo`? Se mira
   * en crudo porque en fase de personaje aún no hay acciones acopladas.
   */
  superaA(inst, objetivo, motor = null, yo = null) {
    const atk = this.ataqueEnCampo(motor, yo, inst);
    const postura = window.Game.Combat.postura(objetivo);
    if (postura === 'neutral') return true;
    const umbral =
      postura === 'ofensiva'
        ? window.Game.Combat.ataqueEfectivo(objetivo)
        : window.Game.Combat.defensaEfectiva(objetivo);
    return atk > umbral;
  },

  /** Prefiere el objetivo que pueda destruir; si no, el más peligroso. */
  elegirObjetivo(motor, atacante, rival) {
    if (!rival.activos.length) return null;
    // Los intocables (Pip) no son objetivo.
    const atacables = rival.activos.filter((d) => motor.puedeSerAtacado(d));
    if (!atacables.length) return null;
    rival = { ...rival, activos: atacables };
    const atk = window.Game.Combat.ataqueEfectivo(atacante);

    const matables = rival.activos.filter((d) => {
      const postura = window.Game.Combat.postura(d);
      if (postura === 'neutral') return false;
      const umbral =
        postura === 'ofensiva'
          ? window.Game.Combat.ataqueEfectivo(d)
          : window.Game.Combat.defensaEfectiva(d);
      return atk > umbral;
    });

    if (matables.length) {
      return matables.sort((a, b) => this.valor(b) - this.valor(a))[0];
    }
    // Si no puede matar a nadie, pega al neutral (el daño pasa a la sangre).
    const neutral = rival.activos.find(
      (d) => window.Game.Combat.postura(d) === 'neutral'
    );
    return neutral || rival.activos[0];
  },

  /**
   * Ataca si con ello destruye o hace sangrar al rival; si no, se cubre.
   *
   * Las acciones no llevan bonus numérico, así que dentro de un mismo tipo
   * son intercambiables para el cálculo: se prefiere la que no esté
   * restringida a otra raza.
   */
  /**
   * Puntúa una acción jugando mentalmente el intercambio: lo que le hago con
   * ella y lo que me hace él después. Usa `Combat` —las reglas reales— en vez
   * de comparar números a ojo, así que respeta posturas y destrucciones.
   *
   * Los pesos dicen qué le importa a la IA: tumbar a alguien vale más que
   * arañar sangre, y que la tumben a ella cuesta casi lo mismo.
   */
  puntuarAccion(motor, yo, rival, inst, accion) {
    const C = window.Game.Combat;
    const simulado = { ...inst, accion: accion.id };
    let puntos = 0;

    const miGolpe = C.ataqueEfectivo(simulado);
    if (miGolpe > 0) {
      if (!rival.activos.length) {
        puntos += miGolpe; // campo vacío: todo a la sangre
      } else {
        const mejor = rival.activos
          .map((d) => C.resolverValor(miGolpe, d))
          .sort(
            (x, y) => y.destruido - x.destruido || y.danoSangre - x.danoSangre
          )[0];
        if (mejor.destruido) puntos += this.AJUSTES.pesoMatar;
        puntos += mejor.danoSangre;
      }
    }

    // Su respuesta. Se estima con el ataque impreso del rival: todavía no ha
    // equipado, pero es lo que puede llegar a pegar.
    // Con sus pasivos (Lydia, Gurh…) y sus modificadores: lo impreso se
    // quedaba corto contra los que crecen solos.
    const suGolpe = rival.activos.reduce(
      (mx, d) => Math.max(mx, window.Game.CHARACTERS_BY_ID[d.personaje].ataque
        + (d.pasivo?.ataque || 0) + (d.modificadores?.ataque || 0)),
      0
    );
    if (suGolpe > 0) {
      const contra = C.resolverValor(suGolpe, simulado);
      if (contra.destruido) puntos -= this.AJUSTES.pesoMorir;
      puntos -= contra.danoSangre * this.AJUSTES.pesoSangreRecibida;

      // Un escudo mayor que el golpe REFLEJA la diferencia a la sangre del
      // atacante. Es daño que le hago yo, así que vale lo mismo que el que
      // saco pegando (`mejor.danoSangre`, peso 1) y no lleva ajuste propio.
      //
      // Sin esta línea la IA no veía el único beneficio de cubrirse y jamás
      // equipaba una defensiva: sumaba lo que evitaba encajar, nunca lo que
      // devolvía. Cuando se añadió el reflejo, esta función se quedó atrás.
      puntos += contra.danoReflejado * this.AJUSTES.pesoReflejo;
    }

    return puntos;
  },

  elegirAccion(motor, yo, rival, inst) {
    const coste = window.Game.CHARACTERS_BY_ID[inst.personaje].coste;
    const devocionRinde = motor.vidaDe(yo) <= 4 && yo.sangre.gasto >= coste
      && coste >= 2 && yo.reserva.length > 0;
    const disponibles = motor
      .accionesDisponibles(yo)
      .filter((id) => id !== 'n_devocion' || devocionRinde)
      .map((id) => window.Game.ACTIONS_BY_ID[id]);
    if (!disponibles.length) return null;

    if (this.AJUSTES.accionPorSimulacion) {
      const usable = (a) => !a.razaRequerida || a.razaRequerida === yo.raza;
      // Se prueba una por tipo: sin bonus numéricos, dentro de un mismo tipo
      // son intercambiables para el cálculo.
      const candidatas = ['ofensiva', 'defensiva', 'neutral']
        .map((t) => {
          const delTipo = disponibles.filter((a) => a.tipo === t);
          return delTipo.find(usable) || delTipo[0] || null;
        })
        .filter(Boolean);
      if (!candidatas.length) return null;

      return candidatas
        .map((a) => ({ a, p: this.puntuarAccion(motor, yo, rival, inst, a) }))
        .sort((x, y) => y.p - x.p)[0].a.id;
    }

    const utilizable = (a) => !a.razaRequerida || a.razaRequerida === yo.raza;
    const porTipo = (tipo) => {
      const delTipo = disponibles.filter((a) => a.tipo === tipo);
      return delTipo.find(utilizable) || delTipo[0] || null;
    };

    const atkAccion = porTipo('ofensiva');
    const defAccion = porTipo('defensiva');
    const base = window.Game.CHARACTERS_BY_ID[inst.personaje];

    // Con poca sangre en la pila, cubrirse antes que buscar el intercambio.
    const enApuros =
      this.AJUSTES.sangreParaCubrirse > 0 &&
      motor.vidaDe(yo) <= this.AJUSTES.sangreParaCubrirse;
    if (enApuros && defAccion) return defAccion.id;

    // Aunque no rompa a nadie, pegar mueve sangre si el defensor va en
    // neutral o si el campo está vacío; cubrirse no hace nada de eso.
    if (this.AJUSTES.insistirSinMatar && atkAccion && !defAccion) {
      return atkAccion.id;
    }

    if (atkAccion) {
      const golpe = base.ataque + (inst.modificadores?.ataque || 0);
      // Basta con que pueda superar a UNO de los defensores.
      const rentable =
        !rival.activos.length ||
        rival.activos.some((d) => {
          const postura = window.Game.Combat.postura(d);
          if (postura === 'neutral') return true;
          const umbral =
            postura === 'ofensiva'
              ? window.Game.Combat.ataqueEfectivo(d)
              : window.Game.Combat.defensaEfectiva(d);
          return golpe > umbral;
        });
      if (rentable) return atkAccion.id;
    }

    return defAccion?.id || atkAccion?.id || disponibles[0]?.id || null;
  }
};
