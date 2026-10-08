/**
 * El Hades: zona pública donde acaban los personajes destruidos o enviados
 * allí por un efecto. No es un descarte muerto — ocho cartas lo consultan o
 * lo manipulan, así que aquí viven las consultas que ellas necesitan.
 *
 * Es una zona ABIERTA: todo lo que entra queda revelado para ambos jugadores.
 *
 * Consultas que exigen las cartas actuales:
 *   contar()      — Gurh: +1 ataque por Reanimado en el Hades.
 *   ataqueTotal() — Ejército: gana el ataque total de tus reanimados allí.
 *   contiene()    — Zabar: si Gurh está en el Hades, duplica.
 *   recuperables()— Llamada (Reanimado) y Lyla (coste <= 5).
 */
window.Game = window.Game || {};

window.Game.Hades = {
  /** Instancias en el Hades, opcionalmente filtradas por raza. */
  cartas(jugador, { raza = null } = {}) {
    const lista = jugador.hades || [];
    if (!raza) return lista;
    return lista.filter(
      (i) => window.Game.CHARACTERS_BY_ID[i.personaje].raza === raza
    );
  },

  /** Cuántos personajes hay, opcionalmente de una raza concreta. */
  contar(jugador, opciones) {
    return this.cartas(jugador, opciones).length;
  },

  /** Suma del ataque impreso de los personajes que haya allí. */
  ataqueTotal(jugador, opciones) {
    return this.cartas(jugador, opciones).reduce(
      (s, i) => s + window.Game.CHARACTERS_BY_ID[i.personaje].ataque,
      0
    );
  },

  /** Suma de la defensa impresa. */
  defensaTotal(jugador, opciones) {
    return this.cartas(jugador, opciones).reduce(
      (s, i) => s + window.Game.CHARACTERS_BY_ID[i.personaje].defensa,
      0
    );
  },

  /** ¿Está ahí una carta concreta? (Zabar pregunta por Gurh.) */
  contiene(jugador, personajeId) {
    return this.cartas(jugador).some((i) => i.personaje === personajeId);
  },

  /**
   * Candidatos a volver a la zona de equipo.
   * @param {{raza?: string, costeMaximo?: number}} filtros
   */
  recuperables(jugador, { raza = null, costeMaximo = null } = {}) {
    return this.cartas(jugador, { raza }).filter((i) => {
      if (costeMaximo === null) return true;
      return window.Game.CHARACTERS_BY_ID[i.personaje].coste <= costeMaximo;
    });
  },

  /** Recuento por raza, para pintarlo en la interfaz. */
  resumen(jugador) {
    const porRaza = {};
    for (const i of this.cartas(jugador)) {
      const r = window.Game.CHARACTERS_BY_ID[i.personaje].raza;
      porRaza[r] = (porRaza[r] || 0) + 1;
    }
    return { total: this.contar(jugador), porRaza };
  }
};
