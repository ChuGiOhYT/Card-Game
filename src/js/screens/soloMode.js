window.Game = window.Game || {};
window.Game.Screens = window.Game.Screens || {};

window.Game.Screens.modoSolo = {
  razaJugador: null,
  razaRival: null,

  render(contenedor) {
    this.razaJugador = window.Game.State.perfil.razaSeleccionada || 'lunaria';
    this.razaRival = this.razaAleatoriaDistinta(this.razaJugador);

    contenedor.innerHTML = `
      <div class="pantalla">
        <header class="pantalla-cabecera">
          <button class="btn-volver" id="btn-volver" aria-label="Volver"><svg class="volver-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><span class="volver-txt">Volver</span></button>
          <h2 class="pantalla-titulo">Partida rápida</h2>
          <p class="pantalla-sub">
            Elige con quién juegas y contra quién. Sin progreso, sin castigo.
          </p>
        </header>

        <div class="solo-enfrentamiento">
          <div class="solo-lado" id="lado-jugador"></div>
          <div class="solo-versus">VS</div>
          <div class="solo-lado" id="lado-rival"></div>
        </div>

        <footer class="pantalla-pie">
          <button class="btn-secundario" id="btn-aleatorio">Rival aleatorio</button>
          <button class="btn-primario" id="btn-jugar">Comenzar duelo</button>
        </footer>
      </div>
    `;

    this.pintarLados(contenedor);

    contenedor.querySelector('#btn-volver').addEventListener('click', () => {
      window.Game.Router.ir('mainMenu');
    });

    contenedor.querySelector('#btn-aleatorio').addEventListener('click', () => {
      this.razaRival = this.razaAleatoriaDistinta(this.razaJugador);
      this.pintarLados(contenedor);
    });

    contenedor.querySelector('#btn-jugar').addEventListener('click', () => {
      window.Game.Router.ir('partida', {
        raza: this.razaJugador,
        razaRival: this.razaRival,
        modo: 'solo'
      });
    });
  },

  razaAleatoriaDistinta(excluir) {
    const opciones = window.Game.RACE_ORDER.filter((r) => r !== excluir);
    return opciones[Math.floor(Math.random() * opciones.length)];
  },

  pintarLados(contenedor) {
    contenedor.querySelector('#lado-jugador').innerHTML = this.tarjetaLado(
      this.razaJugador,
      'Tú',
      true
    );
    contenedor.querySelector('#lado-rival').innerHTML = this.tarjetaLado(
      this.razaRival,
      'Rival (IA)',
      false
    );

    contenedor
      .querySelectorAll('#lado-jugador .solo-selector button')
      .forEach((btn) => {
        btn.addEventListener('click', () => {
          this.razaJugador = btn.dataset.raza;
          if (this.razaRival === this.razaJugador) {
            this.razaRival = this.razaAleatoriaDistinta(this.razaJugador);
          }
          this.pintarLados(contenedor);
        });
      });
  },

  /** Equipos guardados de una raza, del más reciente al más antiguo. */
  equiposDe(razaId) {
    return window.Game.State.perfil.equiposGuardados
      .map((e, i) => ({ ...e, indice: i }))
      .filter((e) => e.raza === razaId)
      .reverse();
  },

  tarjetaLado(razaId, etiqueta, conSelector) {
    const r = window.Game.RACES[razaId];
    const selector = conSelector
      ? `<div class="solo-selector">
           ${window.Game.RAZAS_EQUIPO.map(
             (id) => `
             <button data-raza="${id}" class="${id === razaId ? 'activa' : ''}"
                     style="--raza-primario:${window.Game.RACES[id].colorPrimario}"
                     title="${window.Game.RACES[id].nombre}">
               ${window.Game.emblema(id)}
             </button>`
           ).join('')}
         </div>`
      : '';

    // Deja claro con qué equipo se va a jugar: el guardado más reciente de
    // esa raza, o el predeterminado si nunca has construido ninguno.
    const guardados = this.equiposDe(razaId);
    const equipo = conSelector
      ? guardados.length
        ? `<span class="solo-equipo">Equipo: ${guardados[0].nombre}</span>`
        : `<span class="solo-equipo sin-equipo">Equipo predeterminado</span>`
      : '<span class="solo-equipo">Equipo predeterminado</span>';

    return `
      <div class="solo-tarjeta"
           style="--raza-primario:${r.colorPrimario};--raza-secundario:${r.colorSecundario}">
        <span class="solo-etiqueta">${etiqueta}</span>
        <span class="solo-sigil">${window.Game.emblema(r)}</span>
        <strong class="solo-nombre">${r.nombre}</strong>
        <span class="solo-sangre">${window.Game.SANGRE_TOTAL} sangres</span>
        ${equipo}
      </div>
      ${selector}
    `;
  }
};
