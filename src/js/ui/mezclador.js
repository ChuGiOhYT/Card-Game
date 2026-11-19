/**
 * Mezclador de sonido.
 *
 * Tres mandos —música, botones y efectos de batalla— sobre la mezcla de
 * diseño que vive en `core/audio.js`. Lo que se guarda en el perfil son estos
 * tres números, no los volúmenes de cada pista.
 *
 * NO es una pantalla del Router, y eso es deliberado: el Router destruye la
 * pantalla anterior, así que abrir el mezclador desde una partida la
 * abandonaría. Es una capa suelta colgada de `body`, como las burbujas.
 */
window.Game = window.Game || {};

window.Game.Mezclador = {
  capa: null,

  abierto() {
    return !!this.capa;
  },

  alternar() {
    if (this.abierto()) this.cerrar();
    else this.abrir();
  },

  abrir() {
    if (this.capa) return;
    const A = window.Game.Audio;

    const filas = Object.entries(A.GRUPOS)
      .map(([grupo, meta]) => {
        const pct = Math.round(A.nivel(grupo) * 100);
        return `
          <div class="mez-fila" data-grupo="${grupo}">
            <div class="mez-etiqueta">
              <strong>${meta.etiqueta}</strong>
              <span class="nota">${meta.descripcion}</span>
            </div>
            <input class="mez-mando" type="range" min="0" max="100" step="1"
                   value="${pct}" aria-label="${meta.etiqueta}">
            <output class="mez-valor">${pct}%</output>
          </div>`;
      })
      .join('');

    const capa = document.createElement('div');
    capa.className = 'mez-capa';
    capa.innerHTML = `
      <div class="mez-panel" role="dialog" aria-label="Ajustes de sonido">
        <h3 class="mez-titulo">Sonido</h3>
        <p class="nota mez-intro">
          Al 100% suena como está mezclado de fábrica. Se guarda solo.
        </p>
        ${filas}
        <div class="mez-fila mez-narrador">
          <div class="mez-etiqueta">
            <strong>Voz del narrador</strong>
            <span class="nota">Lee las escenas de la campaña</span>
          </div>
          <div class="mez-opciones" role="radiogroup" aria-label="Voz del narrador">
            ${Object.entries(window.Game.Narrador ? window.Game.Narrador.MODOS : {}).map(([id, t]) => `
              <button type="button" class="mez-opcion${window.Game.Narrador.modo() === id ? ' activa' : ''}"
                      data-narrador="${id}" role="radio" aria-checked="${window.Game.Narrador.modo() === id}">${t}</button>`).join('')}
          </div>
        </div>
        <div class="mez-pie">
          <button class="mez-restablecer" type="button">Restablecer</button>
          <button class="btn-primario mez-cerrar" type="button">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(capa);
    this.capa = capa;

    capa.querySelectorAll('.mez-fila[data-grupo]').forEach((fila) => {
      const grupo = fila.dataset.grupo;
      const mando = fila.querySelector('.mez-mando');
      const valor = fila.querySelector('.mez-valor');

      // Mientras se arrastra: se aplica pero NO se guarda, que serían decenas
      // de escrituras a disco por gesto.
      mando.addEventListener('input', () => {
        valor.textContent = `${mando.value}%`;
        A.ponerNivel(grupo, mando.value / 100, { guardar: false });
      });

      // Al soltar: se guarda y se oye una muestra del grupo, que es la única
      // forma de saber si el nivel que has puesto es el que querías.
      mando.addEventListener('change', () => {
        A.ponerNivel(grupo, mando.value / 100);
        const muestra = A.GRUPOS[grupo].muestra;
        if (muestra) A.reproducir(muestra);
      });
    });

    capa.querySelector('.mez-restablecer').addEventListener('click', () => {
      Object.keys(A.GRUPOS).forEach((g) => A.ponerNivel(g, 1, { guardar: false }));
      A.ponerNivel('musica', 1); // el último guarda los tres de una vez
      this.refrescar();
    });

    capa.querySelectorAll('[data-narrador]').forEach((b) => {
      b.addEventListener('click', () => {
        window.Game.Narrador.ponerModo(b.dataset.narrador);
        capa.querySelectorAll('[data-narrador]').forEach((x) => {
          const si = x === b;
          x.classList.toggle('activa', si);
          x.setAttribute('aria-checked', String(si));
        });
      });
    });

    capa.querySelector('.mez-cerrar').addEventListener('click', () => this.cerrar());
    // Pinchar fuera del panel cierra; dentro, no.
    capa.addEventListener('click', (ev) => {
      if (ev.target === capa) this.cerrar();
    });

    this._porTecla = (ev) => {
      if (ev.key === 'Escape') this.cerrar();
    };
    document.addEventListener('keydown', this._porTecla);

    capa.querySelector('.mez-mando').focus();
  },

  /** Repinta los mandos desde los niveles vigentes, sin rehacer la capa. */
  refrescar() {
    if (!this.capa) return;
    const A = window.Game.Audio;
    this.capa.querySelectorAll('.mez-fila[data-grupo]').forEach((fila) => {
      const pct = Math.round(A.nivel(fila.dataset.grupo) * 100);
      fila.querySelector('.mez-mando').value = pct;
      fila.querySelector('.mez-valor').textContent = `${pct}%`;
    });
  },

  cerrar() {
    if (!this.capa) return;
    this.capa.remove();
    this.capa = null;
    if (this._porTecla) {
      document.removeEventListener('keydown', this._porTecla);
      this._porTecla = null;
    }
  }
};
