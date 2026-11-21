/**
 * Lupa de cartas, compartida por todas las pantallas.
 *
 * MANTENER PULSADA cualquier carta (`[data-lupa]`) la enseña gigante en el
 * centro, con el fondo oscurecido, mientras sigas apretando; al SOLTAR se
 * cierra (Oscar). Con ratón y con el dedo. Ya no hay panel lateral: era
 * espacio que le quitaba protagonismo al campo.
 *
 * - Un anillo dorado se llena alrededor del puntero mientras carga
 *   (MS_PULSAR), para que se note que algo va a pasar.
 * - Moverse más de MOVER_PX lo cancela (arrastrar o desplazar no la abre).
 * - Si llegó a abrirse, el clic de soltar NO llega a la carta: una pulsación
 *   larga no debe desplegar ni acoplar sin querer. Un toque corto sigue
 *   jugando la carta como siempre.
 * - El clic derecho la abre fija (se cierra tocando o con Esc), para quien
 *   prefiera leerla con calma en el PC.
 * - `Lupa.extra(el)`: una pantalla puede añadir texto bajo la carta (la mesa
 *   enseña ahí lo que la carta tiene pendiente, el ⚡).
 *
 * Se engancha UNA vez al documento (`iniciar`, desde app.js): las pantallas
 * solo tienen que poner `data-lupa` / `data-lupa-nombre` en sus cartas.
 */
window.Game = window.Game || {};

window.Game.Lupa = {
  ID_OVERLAY: 'lupa-grande',
  MS_PULSAR: 380,
  MOVER_PX: 10,
  /** (el) => html extra bajo la carta, o ''. Lo pone la pantalla que quiera. */
  extra: null,

  iniciar() {
    if (this._iniciada) return;
    this._iniciada = true;
    const doc = document;
    doc.addEventListener('pointerdown', (e) => this._abajo(e), true);
    doc.addEventListener('pointermove', (e) => this._mover(e), true);
    doc.addEventListener('pointerup', (e) => this._arriba(e), true);
    doc.addEventListener('pointercancel', () => this._cancelar(), true);
    window.addEventListener('blur', () => this._arriba());
    // Clic derecho: la carta fija. En el móvil la pulsación larga también
    // dispara `contextmenu`: ahí ya la está enseñando el vistazo.
    doc.addEventListener('contextmenu', (e) => {
      const el = e.target.closest && e.target.closest('[data-lupa]');
      if (!el) return;
      e.preventDefault();
      if (this._pulsando || this._vistazo) return;
      this.ampliar(el.dataset.lupa, el.dataset.lupaNombre, { el });
    });
    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.cerrar();
    });
  },

  /** Compatibilidad: las pantallas lo llamaban para enganchar su panel. */
  conectar() {
    this.iniciar();
  },

  _abajo(e) {
    if (e.button !== undefined && e.button !== 0) return;
    const el = e.target.closest && e.target.closest('[data-lupa]');
    if (!el || !el.dataset.lupa) return;
    this._cancelar();
    this._pulsando = { el, x: e.clientX, y: e.clientY, id: e.pointerId };
    this._anillo(e.clientX, e.clientY);
    this._timer = setTimeout(() => {
      const p = this._pulsando;
      if (!p) return;
      this._quitarAnillo();
      this._vistazo = true;
      this.ampliar(p.el.dataset.lupa, p.el.dataset.lupaNombre, { el: p.el, vistazo: true });
    }, this.MS_PULSAR);
  },

  _mover(e) {
    const p = this._pulsando;
    if (!p || this._vistazo || e.pointerId !== p.id) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > this.MOVER_PX) this._cancelar();
  },

  _arriba() {
    const abierta = this._vistazo;
    this._cancelar();
    if (!abierta) return;
    this._vistazo = false;
    this.cerrar();
    // El clic que viene detrás de soltar no debe jugar la carta.
    const tragar = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', tragar, { capture: true, once: true });
    setTimeout(() => document.removeEventListener('click', tragar, { capture: true }), 400);
  },

  _cancelar() {
    clearTimeout(this._timer);
    this._pulsando = null;
    this._quitarAnillo();
  },

  _anillo(x, y) {
    this._quitarAnillo();
    const a = document.createElement('div');
    a.className = 'lupa-anillo';
    a.style.left = `${x}px`;
    a.style.top = `${y}px`;
    a.style.setProperty('--ms', `${this.MS_PULSAR}ms`);
    document.body.appendChild(a);
    this._anilloEl = a;
  },

  _quitarAnillo() {
    if (this._anilloEl) this._anilloEl.remove();
    this._anilloEl = null;
  },

  /**
   * La carta a tamaño completo sobre toda la ventana. `vistazo`: mientras se
   * mantiene pulsada (se cierra al soltar, no recibe clics); si no, fija.
   */
  ampliar(src, nombre, { el = null, vistazo = false } = {}) {
    if (!src) return;
    let ov = document.getElementById(this.ID_OVERLAY);
    if (!ov) {
      ov = document.createElement('div');
      ov.id = this.ID_OVERLAY;
      ov.className = 'lupa-grande oculto';
      document.body.appendChild(ov);
      ov.addEventListener('click', () => { if (!ov.classList.contains('vistazo')) this.cerrar(); });
    }
    let extra = '';
    try { extra = (el && typeof this.extra === 'function' && this.extra(el)) || ''; } catch { extra = ''; }
    ov.innerHTML = `
      <figure class="lupa-grande-caja">
        <img src="${src}" alt="${nombre || ''}" draggable="false">
        <figcaption>${nombre || ''} <span>· ${vistazo ? 'suelta para cerrar' : 'pulsa o Esc para cerrar'}</span></figcaption>
        ${extra ? `<div class="lupa-extra">${extra}</div>` : ''}
      </figure>
    `;
    ov.classList.toggle('vistazo', vistazo);
    ov.classList.remove('oculto');
    void ov.offsetWidth;
    ov.classList.add('abierta');
  },

  cerrar() {
    const ov = document.getElementById(this.ID_OVERLAY);
    if (!ov) return;
    ov.classList.remove('abierta');
    ov.classList.add('oculto');
  }
};
