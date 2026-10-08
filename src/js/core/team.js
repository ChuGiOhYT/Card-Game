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

  /** Equipo jugable por defecto: los 5 más baratos de la raza + 8 acciones. */
  equipoPredeterminado(razaId) {
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
