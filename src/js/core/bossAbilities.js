/**
 * Habilidades de los Eternals.
 *
 * Es la única excepción a la regla de que los efectos impresos no se ejecutan
 * solos: al jefe no hay nadie que le aplique sus cartas a mano. Cada turno
 * suyo lanza UNA de sus cuatro al azar.
 *
 * Las cuatro cartas comparten estructura, así que aquí solo hay 12 efectos
 * distintos, indexados por nombre:
 *
 *   Convocar   los cuatro          Aplacar     Brahma y A'tar
 *   Revelar / Ocultar   Iskar      Burlar / Adaptación   Tarh Akh
 *   Cegar      Brahma              Intimidar   A'tar
 *   Tenebres / Purgatorio / Luminaria / Devastar  — el golpe al grupo
 *
 * Lecturas que hubo que fijar porque la carta no las cierra, todas anotadas
 * en el registro de la partida para que se puedan auditar jugando:
 *
 *   - «Una serie» = un turno.
 *   - El golpe al grupo se resuelve con las reglas de combate normales
 *     (`Combat.resolverValor`), así que cuenta la postura del defensor. Sin
 *     personaje en posición va entero a la sangre, como dice la carta.
 *   - Los contadores («por cada carta revelada», «por cada personaje en el
 *     hades»…) miran el campo entero, los dos lados, salvo donde la carta
 *     diga explícitamente «oponente».
 */
window.Game = window.Game || {};

window.Game.Jefes = {
  /** Qué esbirro convoca cada Eternal. */
  ESBIRRO_DE: {
    cri_uldar: 'cri_esbirro_bosque',
    cri_tarh_akh: 'cri_esbirro_catacumbas',
    cri_brahma: 'cri_esbirro_oasis',
    cri_atar: 'cri_esbirro_forjas'
  },

  /** Una «serie» de las cartas, en turnos. */
  DURACION_SERIE: 1,

  _contadorUid: 0,

  /**
   * Lanza al azar una de las habilidades del jefe.
   * @returns {{n:number, nombre:string, texto:string, detalle:string}|null}
   */
  lanzar(motor, jefeInst) {
    const jefe = window.Game.CHARACTERS_BY_ID[jefeInst.personaje];
    if (!jefe || !Array.isArray(jefe.habilidades) || !jefe.habilidades.length) {
      return null;
    }

    const hab = jefe.habilidades[Math.floor(Math.random() * jefe.habilidades.length)];
    const efecto = this.EFECTOS[hab.nombre];

    motor.log(`✦ ${jefe.nombre} usa «${hab.nombre}».`);
    if (!efecto) {
      // Habilidad sin implementar: se avisa en vez de fingir que pasó algo.
      motor.log(`  ↳ Sin efecto automático. Aplícala a mano: ${hab.texto}`);
      motor.notificar();
      return { n: hab.n, nombre: hab.nombre, texto: hab.texto, detalle: 'Aplícala a mano desde Herramientas.' };
    }

    const detalle = efecto.call(this, motor, jefeInst, jefe) || 'Sin efecto esta vez.';
    motor.log(`  ↳ ${detalle}`);
    motor.notificar();
    return { n: hab.n, nombre: hab.nombre, texto: hab.texto, detalle };
  },

  /* ------------------------------ Utilidades ----------------------------- */

  /** El humano siempre es el jugador 0; el jefe, el 1. */
  _rival(motor) {
    return motor.jugadores[0];
  },

  _duenoDe(motor, inst) {
    return motor.jugadores.find(
      (j) => j.activos.includes(inst) || j.reserva.includes(inst)
    );
  },

  /** Cartas de personaje que el rival tiene sobre la mesa o en reserva. */
  _personajesRival(motor) {
    const r = this._rival(motor);
    return [...r.activos, ...r.reserva];
  },

  /**
   * Modificador que se revierte solo al cabo de `turnos`. Se apoya en
   * `motor.efectosTemporales`, que el motor descuenta al cerrar cada turno.
   */
  _modificarTemporal(motor, jugador, inst, { ataque = 0, defensa = 0 }, motivo) {
    inst.modificadores = inst.modificadores || { ataque: 0, defensa: 0 };
    inst.modificadores.ataque += ataque;
    inst.modificadores.defensa += defensa;
    motor.efectosTemporales.push({
      jugadorIdx: motor.jugadores.indexOf(jugador),
      uid: inst.uid,
      ataque,
      defensa,
      turnos: this.DURACION_SERIE,
      motivo
    });
  },

  /**
   * El golpe «al grupo» que comparten las cuatro cartas de daño. Se resuelve
   * con las reglas de combate de siempre para que la postura del defensor
   * siga contando; sin personaje en posición, entero a la sangre.
   */
  _golpeAlGrupo(motor, jefe, valor, comoSeCuenta, jefeInst = null) {
    const rival = this._rival(motor);
    const activo = rival.activos[0] || null;

    // El bando del jefe, para saber a quién sangra un reflejo y a quién
    // atribuir el golpe. Sin `jefeInst` no se puede deducir de la carta sola.
    const ladoJefe = jefeInst ? this._duenoDe(motor, jefeInst) : null;

    if (!activo) {
      motor.derramar(rival, valor, `${jefe.nombre} · golpe sin oposición`);
      // Sin nadie en posición no hay carta que sacudir: el parte va igual,
      // pero sin defensor, y la pantalla se queda solo con el destello.
      motor.anotarGolpe({
        atacante: ladoJefe,
        defensor: rival,
        atacanteInst: jefeInst,
        danoSangre: valor
      });
      return `${valor} de daño directo a la sangre (${comoSeCuenta}); no había nadie en posición.`;
    }

    const res = window.Game.Combat.resolverValor(valor, activo, jefe.nombre);
    motor.log(`  ↳ ${res.mensaje}`);

    if (res.destruido) motor.enviarAlHades(rival, activo, 'habilidad de jefe');
    if (res.danoSangre > 0) motor.derramar(rival, res.danoSangre, 'habilidad de jefe');

    // Si el defensor tenía más escudo que el golpe, el reflejo sangra al JEFE.
    // Su bando se localiza por la instancia; con la carta sola no se puede
    // saber de quién es, así que sin ella el reflejo se anota pero no se cobra.
    if (res.danoReflejado > 0) {
      if (ladoJefe) {
        motor.derramar(ladoJefe, res.danoReflejado, 'reflejo del escudo');
      } else {
        motor.log(
          `  ↳ ⚠ ${res.danoReflejado} de reflejo sin cobrar: no se sabe de qué ` +
            `bando es ${jefe.nombre}.`
        );
      }
    }

    // El parte, ya cobrado todo, para que la mesa lo enseñe igual que un
    // ataque normal: el mazazo al grupo es el golpe más gordo del juego y
    // hasta ahora pasaba en silencio. El reflejo solo se anota si se supo
    // cobrar; si no, animaría una sangría que no ocurrió.
    motor.anotarGolpe({
      atacante: ladoJefe,
      defensor: rival,
      atacanteInst: jefeInst,
      defensorInst: activo,
      destruido: res.destruido,
      danoSangre: res.danoSangre,
      danoReflejado: ladoJefe ? res.danoReflejado : 0
    });

    return `Ataque de ${valor} al grupo (${comoSeCuenta}). ${res.mensaje}`;
  },

  /* ------------------------------- Efectos ------------------------------- */

  EFECTOS: {
    /* --- Común a los cuatro Eternals --- */

    Convocar(motor, jefeInst, jefe) {
      const rival = this._rival(motor);
      const lado = this._duenoDe(motor, jefeInst);
      const esbirroId = this.ESBIRRO_DE[jefe.id];
      if (!esbirroId) return 'No tiene esbirro asignado.';

      // «Un esbirro por cada personaje activo». El jugador solo puede tener
      // uno en posición, así que en la práctica es uno por invocación.
      const cuantos = Math.max(1, rival.activos.length);
      const nuevos = [];
      for (let k = 0; k < cuantos; k++) {
        nuevos.push({
          uid: `esb${++this._contadorUid}`,
          personaje: esbirroId,
          accion: null,
          modificadores: { ataque: 0, defensa: 0 }
        });
      }

      // El esbirro se planta DELANTE: el Eternal cede el puesto y se va a
      // esperar. Es la manera de cumplir «si hay un esbirro en campo no
      // puedes atacar al eternal» sin tocar la regla de un solo personaje en
      // posición por bando —el jefe deja de ser un objetivo alcanzable hasta
      // que su guardaespaldas caiga.
      const seEscuda = lado.activos.includes(jefeInst);
      if (seEscuda) motor.retirar(lado, jefeInst);

      const sitio = Math.max(0, lado.maxActivos - lado.activos.length);
      lado.activos.push(...nuevos.slice(0, sitio));
      // Los que no caben se ponen por delante del resto de la oleada: son
      // guardaespaldas, entran antes que las criaturas que ya esperaban.
      lado.reserva.unshift(...nuevos.slice(sitio));

      const nombre = window.Game.CHARACTERS_BY_ID[esbirroId].nombre;
      return (
        `Convoca ${cuantos} × ${nombre}` +
        (seEscuda
          ? `. Se planta delante y el Eternal se repliega: habrá que ` +
            `derribar al esbirro para volver a tenerlo a tiro.`
          : ` como refuerzo de la oleada.`)
      );
    },

    /* --- Iskar --- */

    Revelar(motor) {
      const rival = this._rival(motor);
      let n = 0;
      for (const inst of this._personajesRival(motor)) {
        if (window.Game.Manual.revelar(motor, rival, inst.personaje, 'Revelar')) n++;
      }
      return n
        ? `Deja al descubierto ${n} ${n === 1 ? 'personaje' : 'personajes'} del rival.`
        : 'No quedaba ningún personaje por revelar.';
    },

    Ocultar(motor) {
      const rival = this._rival(motor);
      // Solo las acciones: los personajes se quedan como estén.
      let n = 0;
      for (const accionId of rival.acciones) {
        if (window.Game.Manual.ocultar(motor, rival, accionId, 'Ocultar')) n++;
      }
      return n
        ? `Vuelve a tapar ${n} ${n === 1 ? 'acción' : 'acciones'} del rival.`
        : 'El rival no tenía acciones reveladas.';
    },

    Tenebres(motor, jefeInst, jefe) {
      // «+1 por cada dos cartas reveladas»: se cuenta el campo entero.
      const reveladas = motor.jugadores.reduce((s, j) => s + j.revelados.size, 0);
      const extra = Math.floor(reveladas / 2);
      return this._golpeAlGrupo(
        motor, jefe, 10 + extra,
        `10 + ${extra} por ${reveladas} cartas reveladas`,
        jefeInst
      );
    },

    /* --- Tarh Akh --- */

    Burlar(motor) {
      const rival = this._rival(motor);
      let n = 0;
      for (const inst of [...rival.activos, ...rival.reserva]) {
        const p = window.Game.CHARACTERS_BY_ID[inst.personaje];
        if (!p) continue;
        // Intercambio permanente: la carta no le pone caducidad.
        window.Game.Manual.modificar(
          motor, inst,
          { ataque: p.defensa - p.ataque, defensa: p.ataque - p.defensa },
          'Burlar'
        );
        n++;
      }
      return n
        ? `Intercambia ataque y defensa de ${n} ${n === 1 ? 'personaje' : 'personajes'}.`
        : 'El rival no tenía personajes.';
    },

    Purgatorio(motor, jefeInst, jefe) {
      const enHades = motor.jugadores.reduce((s, j) => s + j.hades.length, 0);
      return this._golpeAlGrupo(
        motor, jefe, 10 + enHades,
        `10 + ${enHades} por los caídos en el Hades`,
        jefeInst
      );
    },

    Adaptación(motor) {
      const rival = this._rival(motor);
      const quitadas = [];
      for (const inst of rival.activos) {
        if (!inst.accion) continue;
        quitadas.push(inst.accion);
        motor.revelar(rival, inst.accion);
        window.Game.Manual.bloquear(
          motor, rival, inst.accion, this.DURACION_SERIE, 'Adaptación'
        );
        inst.accion = null;
      }
      return quitadas.length
        ? `Le arranca ${quitadas.length} ${quitadas.length === 1 ? 'acción' : 'acciones'}, ` +
          `inutilizables durante ${this.DURACION_SERIE} turno.`
        : 'No había ninguna acción acoplada que quitar.';
    },

    /* --- Brahma y A'tar --- */

    Aplacar(motor) {
      // «De todos los jugadores», el jefe incluido.
      const partes = motor.jugadores.map(
        (j) => `${j.nombre} ${motor.derramar(j, 2, 'Aplacar')}`
      );
      return `Derrama sangre de los dos bandos — ${partes.join(', ')}.`;
    },

    /* --- Brahma --- */

    Luminaria(motor, jefeInst, jefe) {
      const activos = motor.jugadores.reduce((s, j) => s + j.activos.length, 0);
      return this._golpeAlGrupo(
        motor, jefe, 10 + activos,
        `10 + ${activos} por los personajes en posición`,
        jefeInst
      );
    },

    Cegar(motor) {
      const rival = this._rival(motor);
      motor.aturdidos.push({
        jugadorIdx: motor.jugadores.indexOf(rival),
        // +1 porque el turno en curso es el del jefe: si no, se pasaría el
        // efecto antes de que al rival le toque jugar y no se notaría.
        turnos: this.DURACION_SERIE + 1
      });
      motor.log(`😵 ${rival.nombre} queda aturdido.`);
      return 'Aturde al grupo: en su próximo turno no podrá cambiar de personaje ni de acción.';
    },

    /* --- A'tar --- */

    Devastar(motor, jefeInst, jefe) {
      const derramadas = this._rival(motor).sangre.gasto;
      const extra = Math.floor(derramadas / 2);
      return this._golpeAlGrupo(
        motor, jefe, 10 + extra,
        `10 + ${extra} por ${derramadas} sangres derramadas del rival`,
        jefeInst
      );
    },

    Intimidar(motor) {
      const rival = this._rival(motor);
      let n = 0;
      for (const inst of rival.activos) {
        // «Ataque o defensa»: se recorta la que el personaje tenga activada,
        // que es la única que cuenta en combate. Sin acción, el ataque.
        const postura = window.Game.Combat.postura(inst);
        const campo = postura === 'defensiva' ? 'defensa' : 'ataque';
        this._modificarTemporal(motor, rival, inst, { [campo]: -2 }, 'Intimidar');
        motor.log(
          `⚙ ${window.Game.CHARACTERS_BY_ID[inst.personaje].nombre}: ${campo} -2 (Intimidar).`
        );
        n++;
      }
      return n
        ? `Recorta 2 puntos a ${n} ${n === 1 ? 'personaje' : 'personajes'} ` +
          `durante ${this.DURACION_SERIE} turno.`
        : 'No había personajes en posición a los que intimidar.';
    }
  }
};
