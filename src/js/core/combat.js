/**
 * Resolución de combate.
 *
 * Una acción no suma números: solo ACTIVA una estadística del personaje.
 *   ofensiva  -> activa el ataque
 *   defensiva -> activa la defensa
 *   neutral   -> no activa nada; el daño atraviesa al personaje
 *
 * Todo ajuste numérico viene de los efectos de carta, que se acumulan en
 * `inst.modificadores` (ataque/defensa). Los efectos aún no se ejecutan
 * automáticamente, pero el cálculo ya los tiene en cuenta.
 *
 * Reglas de resolución (atacante contra el activo defensor):
 *
 *   defensor OFENSIVA  -> se comparan ataques.
 *       atacante > defensor : destruido y la DIFERENCIA pasa como daño.
 *       atacante <= defensor: ataque fallido, nadie muere.
 *   defensor DEFENSIVA -> ataque contra defensa.
 *       atacante > defensa  : destruido, SIN daño a la sangre.
 *       defensa > atacante  : el escudo REFLEJA la diferencia a la sangre
 *                             del atacante. Nadie muere.
 *       defensa === atacante: empate, ataque fallido sin más. El reflejo
 *                             exige defensa estrictamente mayor.
 *   defensor NEUTRAL    -> sobrevive intacto y todo el ataque va a la sangre.
 *   sin defensor        -> todo el ataque va a la sangre.
 *
 * El reflejo (`danoReflejado`) es la contrapartida de la diferencia que ya se
 * usaba en el choque ofensivo: ahí el ganador se lleva la diferencia como
 * daño; aquí el escudo se la devuelve a quien atacó. Nunca se destruye al
 * atacante por esto —el escudo hiere, no mata— y no es una carta: es la regla
 * general de la defensa fuerte contra el ataque débil.
 */
window.Game = window.Game || {};

window.Game.Combat = {
  /**
   * La acción que cuenta: la carta acoplada o, si no hay, Tilos equipado como
   * acción (ofensiva o defensiva), que además suma su ataque o su defensa.
   */
  _accion(inst) {
    const real = window.Game.ACTIONS_BY_ID[inst.accion];
    if (real) return { tipo: real.tipo, extra: 0 };
    if (!inst.tilos) return null;
    const T = window.Game.CHARACTERS_BY_ID.mer_tilos;
    return { tipo: inst.tilos.tipo, extra: inst.tilos.tipo === 'ofensiva' ? T.ataque : T.defensa };
  },

  /**
   * Todo lo que tiene equipado: la acción y, además, Tilos. Solo Chispa puede
   * llevar las dos a la vez (las demás: una u otra, y vale `_accion`).
   */
  _equipo(inst) {
    const out = [];
    const real = window.Game.ACTIONS_BY_ID[inst.accion];
    if (real) out.push({ tipo: real.tipo, extra: 0 });
    if (inst.tilos && (!real || inst.personaje === 'mas_chispa')) {
      const T = window.Game.CHARACTERS_BY_ID.mer_tilos;
      out.push({ tipo: inst.tilos.tipo, extra: inst.tilos.tipo === 'ofensiva' ? T.ataque : T.defensa });
    }
    return out;
  },

  /** Ataque efectivo: 0 salvo que tenga una acción ofensiva equipada. */
  ataqueEfectivo(inst) {
    if (!inst) return 0;
    const of = this._equipo(inst).filter((a) => a.tipo === 'ofensiva');
    if (!of.length) return 0;
    const base = window.Game.CHARACTERS_BY_ID[inst.personaje].ataque + of.reduce((s, a) => s + a.extra, 0);
    // `pasivo`: los efectos que se recalculan solos (efectosPersonaje).
    return Math.max(0, base + (inst.modificadores?.ataque || 0) + (inst.pasivo?.ataque || 0));
  },

  /** Defensa efectiva: 0 salvo que tenga una acción defensiva equipada. */
  defensaEfectiva(inst) {
    if (!inst) return 0;
    const de = this._equipo(inst).filter((a) => a.tipo === 'defensiva');
    if (!de.length) return 0;
    const base = window.Game.CHARACTERS_BY_ID[inst.personaje].defensa + de.reduce((s, a) => s + a.extra, 0);
    return Math.max(0, base + (inst.modificadores?.defensa || 0) + (inst.pasivo?.defensa || 0));
  },

  /** Postura del personaje: 'ofensiva' | 'defensiva' | 'neutral'. */
  postura(inst) {
    if (!inst) return 'neutral';
    const accion = this._accion(inst);
    return accion ? accion.tipo : 'neutral';
  },

  puedeAtacar(inst) {
    return this.ataqueEfectivo(inst) > 0;
  },

  /**
   * @returns {{resultado:string, danoSangre:number, destruido:boolean,
   *            atacanteValor:number, defensorValor:number, mensaje:string}}
   */
  resolver(atacanteInst, defensorInst) {
    return this.resolverValor(
      this.ataqueEfectivo(atacanteInst),
      defensorInst,
      window.Game.CHARACTERS_BY_ID[atacanteInst.personaje].nombre
    );
  },

  /**
   * Mismas reglas, pero con un ataque de valor suelto en vez de sacado de una
   * instancia. Lo usan las habilidades de jefe que golpean «al grupo»: así el
   * daño de un Eternal se resuelve con las reglas de siempre —cuenta la
   * postura del defensor— y no hay dos versiones del combate que mantener.
   */
  resolverValor(atk, defensorInst, nombreAtk = 'El ataque') {
    if (atk <= 0) {
      return {
        resultado: 'sin_ataque',
        danoSangre: 0,
        danoReflejado: 0,
        destruido: false,
        atacanteValor: 0,
        defensorValor: 0,
        mensaje: `${nombreAtk} no tiene el ataque activado.`
      };
    }

    if (!defensorInst) {
      return {
        resultado: 'directo',
        danoSangre: atk,
        danoReflejado: 0,
        destruido: false,
        atacanteValor: atk,
        defensorValor: 0,
        mensaje: `Campo rival vacío: ${atk} de daño directo a la sangre.`
      };
    }

    const nombreDef = window.Game.CHARACTERS_BY_ID[defensorInst.personaje].nombre;
    const postura = this.postura(defensorInst);

    if (postura === 'ofensiva') {
      const def = this.ataqueEfectivo(defensorInst);
      if (atk > def) {
        const dano = atk - def;
        return {
          resultado: 'choque_ganado',
          danoSangre: dano,
          danoReflejado: 0,
          destruido: true,
          atacanteValor: atk,
          defensorValor: def,
          mensaje:
            `${nombreAtk} (${atk}) supera el ataque de ${nombreDef} (${def}): ` +
            `destruido y ${dano} de daño a la sangre.`
        };
      }
      return {
        resultado: 'fallido',
        danoSangre: 0,
        danoReflejado: 0,
        destruido: false,
        atacanteValor: atk,
        defensorValor: def,
        mensaje:
          `${nombreAtk} (${atk}) no supera el ataque de ${nombreDef} (${def}): ` +
          `ataque fallido.`
      };
    }

    if (postura === 'defensiva') {
      const def = this.defensaEfectiva(defensorInst);
      if (atk > def) {
        return {
          resultado: 'defensa_rota',
          danoSangre: 0,
          danoReflejado: 0,
          destruido: true,
          atacanteValor: atk,
          defensorValor: def,
          mensaje:
            `${nombreAtk} (${atk}) rompe la defensa de ${nombreDef} (${def}): ` +
            `destruido, sin daño a la sangre.`
        };
      }
      // Defensa estrictamente mayor que el ataque: el escudo devuelve la
      // diferencia a quien atacó. Un empate (atk === def) no refleja nada —
      // «más grande», no «igual o más grande»— y se queda en fallido a secas.
      if (def > atk) {
        const reflejo = def - atk;
        return {
          resultado: 'escudo_refleja',
          danoSangre: 0,
          danoReflejado: reflejo,
          destruido: false,
          atacanteValor: atk,
          defensorValor: def,
          mensaje:
            `${nombreAtk} (${atk}) no supera la defensa de ${nombreDef} (${def}): ` +
            `el escudo refleja ${reflejo} de daño a la sangre de ${nombreAtk}.`
        };
      }
      return {
        resultado: 'fallido',
        danoSangre: 0,
        danoReflejado: 0,
        destruido: false,
        atacanteValor: atk,
        defensorValor: def,
        mensaje:
          `${nombreAtk} (${atk}) empata la defensa de ${nombreDef} (${def}): ` +
          `ataque fallido, sin reflejo.`
      };
    }

    return {
      resultado: 'atraviesa',
      danoSangre: atk,
      danoReflejado: 0,
      destruido: false,
      atacanteValor: atk,
      defensorValor: 0,
      mensaje:
        `${nombreDef} está en neutral: el golpe lo atraviesa, ` +
        `${atk} de daño a la sangre.`
    };
  }
};
