/**
 * Narrador: lee en voz alta las cinemáticas de la campaña con la voz «mayor».
 *
 * Los audios los genera `tools/narrador/generar-narracion.mjs` (o
 * GENERAR_NARRACION.bat) y quedan indexados en
 * `assets/narracion/narracion.js` por el hash del TEXTO. Así no hace falta
 * ninguna clave a mano: `Cinematica.mostrar(texto)` pregunta aquí si hay voz
 * para ese texto exacto. Si cambias un texto y no regeneras, simplemente no
 * suena (nunca suena una voz que no corresponde).
 *
 * El jugador elige en Sonido → Narrador: apagado (por defecto), normal,
 * suave o anciano. Su volumen es el mando «Narrador» del mezclador.
 */
window.Game = window.Game || {};

window.Game.Narrador = {
  // normal y suave: tu voz «mayor» (local). anciano: Gemini, voz Algenib.
  // Una escena sin audio en el modo elegido simplemente no suena (mientras se
  // completa el anciano, que se genera por partes por el cupo diario).
  MODOS: { apagado: 'Apagado', normal: 'Normal', suave: 'Suave', anciano: 'Anciano' },
  _audio: null,

  modo() {
    const m = window.Game.State && window.Game.State.perfil && window.Game.State.perfil.narrador;
    return this.MODOS[m] ? m : 'apagado';
  },

  ponerModo(modo) {
    if (!this.MODOS[modo] || !window.Game.State) return;
    window.Game.State.perfil.narrador = modo;
    window.Game.State.guardar();
  },

  /** Igual que tools/narrador/generar-narracion.mjs: FNV-1a de 32 bits. */
  clave(texto) {
    let h = 0x811c9dc5;
    const t = String(texto).trim();
    for (let i = 0; i < t.length; i++) {
      h ^= t.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  },

  /** { src, dur } de la voz de este texto en el modo elegido, o null. */
  pista(texto) {
    const modo = this.modo();
    if (modo === 'apagado' || !texto) return null;
    const e = window.Game.NARRACION && window.Game.NARRACION[this.clave(texto)];
    return (e && e[modo]) || null;
  },

  /** Empieza a leer. Devuelve la pista, o null si no hay nada que leer. */
  leer(texto, { retraso = 0 } = {}) {
    this.parar();
    const p = this.pista(texto);
    if (!p) return null;
    const audio = new Audio(p.src);
    const A = window.Game.Audio;
    audio.volume = Math.max(0, Math.min(1, A ? A.nivel('narrador') : 1));
    this._audio = audio;
    this._retraso = setTimeout(() => {
      if (this._audio === audio) audio.play().catch(() => {});
    }, retraso);
    return p;
  },

  /** Calla, con un desvanecido corto si se le da tiempo. */
  parar(ms = 0) {
    clearTimeout(this._retraso);
    const audio = this._audio;
    this._audio = null;
    if (!audio) return;
    if (!ms) {
      audio.pause();
      return;
    }
    const v0 = audio.volume;
    const t0 = performance.now();
    const paso = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      audio.volume = v0 * (1 - k);
      if (k < 1) requestAnimationFrame(paso);
      else audio.pause();
    };
    requestAnimationFrame(paso);
  }
};
