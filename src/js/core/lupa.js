/**
 * Lupa de cartas, compartida por todas las pantallas.
 *
 * Dos niveles, porque el lateral nunca da para leer el texto impreso:
 *   - Pasar el ratón por cualquier `[data-lupa]` la muestra en el panel.
 *   - Pulsar el panel (o la tecla) la abre a tamaño completo sobre la
 *     ventana, que es donde de verdad se lee la carta.
 */
window.Game = window.Game || {};

window.Game.Lupa = {
  ID_OVERLAY: 'lupa-grande',

  /**
   * Conecta la lupa dentro de un contenedor. Idempotente: puede llamarse en
   * cada repintado sin acumular escuchadores, porque marca los elementos.
   */
  conectar(contenedor) {
    const panel = contenedor.querySelector('#lupa');
    if (!panel) return;

    contenedor.querySelectorAll('[data-lupa]').forEach((el) => {
      if (el.dataset.lupaConectada) return;
      el.dataset.lupaConectada = '1';
      el.addEventListener('mouseenter', () => {
        this.mostrar(panel, el.dataset.lupa, el.dataset.lupaNombre);
      });
      // Doble utilidad: si la carta no es pulsable para otra cosa, el clic
      // derecho siempre la abre grande.
      el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.ampliar(el.dataset.lupa, el.dataset.lupaNombre);
      });
    });

    if (!panel.dataset.lupaConectada) {
      panel.dataset.lupaConectada = '1';
      panel.addEventListener('click', () => {
        const img = panel.querySelector('img');
        if (img) this.ampliar(img.getAttribute('src'), img.getAttribute('alt'));
      });
    }
  },

  mostrar(panel, src, nombre) {
    panel.innerHTML = `
      <img src="${src}" alt="${nombre || ''}">
      <span class="lupa-pista">Pulsa para ampliar</span>
    `;
  },

  /** Abre la carta a tamaño completo sobre toda la ventana. */
  ampliar(src, nombre) {
    if (!src) return;
    let ov = document.getElementById(this.ID_OVERLAY);
    if (!ov) {
      ov = document.createElement('div');
      ov.id = this.ID_OVERLAY;
      ov.className = 'lupa-grande oculto';
      document.body.appendChild(ov);
      ov.addEventListener('click', () => this.cerrar());
      // Escape también cierra: es un visor, no un diálogo.
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.cerrar();
      });
    }
    ov.innerHTML = `
      <figure class="lupa-grande-caja">
        <img src="${src}" alt="${nombre || ''}">
        <figcaption>${nombre || ''} <span>· pulsa o Esc para cerrar</span></figcaption>
      </figure>
    `;
    ov.classList.remove('oculto');
  },

  cerrar() {
    const ov = document.getElementById(this.ID_OVERLAY);
    if (ov) ov.classList.add('oculto');
  }
};
