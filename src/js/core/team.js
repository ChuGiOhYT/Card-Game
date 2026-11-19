/**
 * Construcción y validación de equipos: 5 personajes + 8 acciones.
 * No hay mazo ni robo; todo lo que tendrás durante el duelo se elige aquí.
 *
 * Los mercenarios (raza "mercenario") pueden acompañar a cualquier raza.
 */
window.Game = window.Game || {};

window.Game.Team = {
  PERSONAJES: 5,
  ACCIONES: 8,

  /** @returns {{valido: boolean, errores: string[], avisos: string[]}} */
  validar(personajesIds, accionesIds, razaId) {
    const errores = [];
    const avisos = [];

    if (personajesIds.length !== this.PERSONAJES) {
      errores.push(
        `Tu equipo necesita exactamente ${this.PERSONAJES} personajes ` +
          `(llevas ${personajesIds.length}).`
      );
    }
    if (accionesIds.length !== this.ACCIONES) {
      errores.push(
        `Necesitas exactamente ${this.ACCIONES} acciones ` +
          `(llevas ${accionesIds.length}).`
      );
    }

    if (new Set(personajesIds).size !== personajesIds.length) {
      errores.push('No puedes repetir personajes en el equipo.');
    }
    // Las acciones son reutilizables durante el duelo, así que una copia basta.
    if (new Set(accionesIds).size !== accionesIds.length) {
      errores.push('No puedes repetir acciones: son reutilizables.');
    }

    for (const id of personajesIds) {
      const p = window.Game.CHARACTERS_BY_ID[id];
      if (!p) {
        errores.push(`Personaje desconocido: ${id}`);
      } else if (p.raza !== razaId && p.raza !== 'mercenario') {
        errores.push(`«${p.nombre}» no es de tu raza ni mercenario.`);
      }
    }

    for (const id of accionesIds) {
      if (!window.Game.ACTIONS_BY_ID[id]) errores.push(`Acción desconocida: ${id}`);
    }

    // Sin un personaje de coste 0 no puedes desplegar en el turno 1, porque
    // aún no se ha derramado ninguna sangre.
    const tieneCosteCero = personajesIds.some(
      (id) => window.Game.CHARACTERS_BY_ID[id]?.coste === 0
    );
    if (personajesIds.length === this.PERSONAJES && !tieneCosteCero) {
      errores.push(
        'Sin un personaje de coste 0 no podrás desplegar en el primer turno.'
      );
    }

    // Sin acciones ofensivas no hay forma de hacer daño.
    const ofensivas = accionesIds.filter(
      (id) => window.Game.ACTIONS_BY_ID[id]?.tipo === 'ofensiva'
    ).length;
    if (accionesIds.length === this.ACCIONES && ofensivas === 0) {
      errores.push('Necesitas al menos una acción ofensiva para poder ganar.');
    }

    // Acciones bloqueadas por una raza que no es la tuya: legales, pero inertes.
    for (const id of accionesIds) {
      const a = window.Game.ACTIONS_BY_ID[id];
      if (a?.razaRequerida && a.razaRequerida !== razaId) {
        const nombreRaza = window.Game.RACES[a.razaRequerida]?.nombre || a.razaRequerida;
        avisos.push(
          `«${a.nombre}» exige un personaje ${nombreRaza}: no te servirá con esta raza.`
        );
      }
    }

    return { valido: errores.length === 0, errores, avisos };
  },

  /**
   * Mazos por defecto de cada estirpe, con la identidad que pidió Oscar. Son
   * los que juegan la IA del modo solo, el «Autocompletar» del constructor y
   * el duelo remoto cuando no eliges un equipo guardado. La campaña NO los
   * usa (va con equipoDeHistoria).
   */
  MAZOS_BASE: {
    // Revelar lo del rival, resistir y pegar fuerte: Annia, Axel, Thiana,
    // Investigar y Captura revelan; Lydia y Auram lo cobran en daño.
    desterrado: {
      personajes: ['des_annia', 'des_axel', 'des_thiana', 'des_lydia', 'des_auram'],
      acciones: ['o_finta', 'o_captura', 'o_rompescudos', 'd_bloquear', 'd_acrobatico', 'd_escape', 'n_investigar', 'n_ruego']
    },
    // Jugar con la sangre propia y la del rival para sostener la vida, y
    // resistir: Sadash desangra al rival; Ruego y Luna sangrienta mueven la
    // propia; Devoción la recupera; Acompañantes y Seluah (5/5) aguantan, y
    // Lirhym es su carta grande. (Con Errante y más neutrales ganaba el 15 %.)
    lunaria: {
      personajes: ['lun_sadash', 'lun_acompanantes', 'lun_delem', 'lun_seluah', 'lun_lirhym'],
      acciones: ['o_luna_sangrienta', 'o_finta', 'o_captura', 'd_bloquear', 'd_acrobatico', 'd_escape', 'n_devocion', 'n_ruego']
    },
    // Defenderse y llegar rápido al jefe (Kratox, coste 10): Pip, Krag y las
    // defensivas aguantan; Ruego acelera la energía; Diplomático compra turnos.
    oxitron: {
      personajes: ['oxi_pip', 'oxi_kaw', 'oxi_krag', 'oxi_brawl', 'oxi_kratox'],
      acciones: ['n_ruego', 'n_diplomatico', 'd_bloquear', 'd_acrobatico', 'd_encadenar', 'd_escape', 'o_finta', 'o_sabotaje']
    },
    // Llenar su propio Hades cuanto antes: Luh, Vyla y Biomecánica mandan
    // reanimados allí (Llamada los rescata); Ejército, Gurh y Thila crecen con
    // él. Sabotaje y Rompescudos les apagan los dados y las defensas al rival:
    // con Devoción e Inmolación ganaban el 5-8 % contra Oxitrones.
    reanimado: {
      personajes: ['rea_luh', 'rea_ejercito', 'rea_vyla', 'rea_gurh', 'rea_thila'],
      acciones: ['o_sabotaje', 'd_biomecanica', 'o_rompescudos', 'o_finta', 'n_llamada', 'd_bloquear', 'n_ruego', 'd_acrobatico']
    }
  },

  /** Equipo por defecto: el mazo de la estirpe; si no tiene, los 5 más baratos + 8 acciones. */
  equipoPredeterminado(razaId) {
    const base = this.MAZOS_BASE[razaId];
    if (base) return { personajes: [...base.personajes], acciones: [...base.acciones] };
    const personajes = window.Game.CHARACTERS.filter((c) => c.raza === razaId)
      .slice()
      .sort((a, b) => a.coste - b.coste)
      .slice(0, this.PERSONAJES)
      .map((p) => p.id);

    // Prioriza las acciones sin restricción de raza, y luego las de la propia.
    const utiles = window.Game.ACTIONS.filter(
      (a) => !a.razaRequerida || a.razaRequerida === razaId
    );
    const porTipo = (tipo, n) =>
      utiles.filter((a) => a.tipo === tipo).slice(0, n).map((a) => a.id);

    const acciones = [
      ...porTipo('ofensiva', 3),
      ...porTipo('defensiva', 3),
      ...porTipo('neutral', 2)
    ];

    // Si alguna categoría se quedó corta, rellena con lo que haya.
    for (const a of utiles) {
      if (acciones.length >= this.ACCIONES) break;
      if (!acciones.includes(a.id)) acciones.push(a.id);
    }

    return { personajes, acciones: acciones.slice(0, this.ACCIONES) };
  }
};
