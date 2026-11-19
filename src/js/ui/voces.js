/**
 * Voces: el «pipipipi» de los RPG cuando un personaje habla.
 *
 * No hay archivos: cada pitido se genera con WebAudio (onda cuadrada muy
 * corta). Cada personaje tiene SU tono, sacado de su id (así Annia suena
 * siempre igual y distinta de Axel); los Eternals y criaturas, más graves.
 * Suena con el mando de «Efectos de batalla» del mezclador.
 *
 * Uso: Voces.letra(quien, caracter) en cada letra que se escribe; decide sola
 * cuándo pitar (una de cada dos letras, nunca en espacios ni signos) y no
 * deja que se amontonen.
 */
window.Game = window.Game || {};

window.Game.Voces = {
  VOLUMEN: 0.05,
  MS: 42,
  /** Separación mínima entre pitidos: más seguidos suenan a zumbido. */
  MS_ENTRE: 55,
  _ctx: null,
  _ultimo: 0,
  _cuenta: 0,

  contexto() {
    if (this._ctx) return this._ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { this._ctx = new AC(); } catch { return null; }
    return this._ctx;
  },

  /** Tono base (Hz) de quien habla. */
  tono(quien) {
    const id = String(quien || '');
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const grave = /^cri_|eternal|jefe/i.test(id);
    return grave ? 190 + (h % 120) : 430 + (h % 380);
  },

  pitar(quien) {
    const ahora = performance.now();
    if (ahora - this._ultimo < this.MS_ENTRE) return;
    const A = window.Game.Audio;
    const nivel = A ? A.nivel('efectos') : 1;
    if (nivel <= 0) return;
    const ctx = this.contexto();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    this._ultimo = ahora;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.type = 'square';
    // Un pelín de variación para que no suene a máquina de escribir.
    osc.frequency.value = this.tono(quien) * (0.94 + Math.random() * 0.12);
    const vol = this.VOLUMEN * nivel;
    gan.gain.setValueAtTime(0.0001, t);
    gan.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    gan.gain.exponentialRampToValueAtTime(0.0001, t + this.MS / 1000);
    osc.connect(gan).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + this.MS / 1000 + 0.01);
  },

  /** Se acaba de escribir `caracter` del texto de `quien`. */
  letra(quien, caracter) {
    if (!caracter || !/[\p{L}\p{N}]/u.test(caracter)) return;
    if (this._cuenta++ % 2) return;
    this.pitar(quien);
  },

  /** Empieza una frase nueva: el primer carácter siempre pita. */
  nuevaFrase() {
    this._cuenta = 0;
  }
};
