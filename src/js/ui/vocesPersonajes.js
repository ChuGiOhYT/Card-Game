/**
 * Voces de personajes: frases cortas dichas con la voz de cada personaje
 * (Gemini TTS, una voz por personaje; ver tools/narrador/generar-voces.mjs).
 *
 * Igual que el narrador, se busca por el hash del TEXTO en el índice
 * generado `assets/voces/voces.js` (Game.VOCES): si el texto cambió y no se
 * regeneró, simplemente calla. Volumen: el mando «Voces de personajes» del
 * mezclador. Una sola voz a la vez: la nueva corta a la anterior.
 *
 * Hoy: la frase de cada estirpe al elegirla (Game.FRASE_ESTIRPE).
 */
window.Game = window.Game || {};

window.Game.VocesPersonajes = {
  _audio: null,

  /** { src, dur, personaje } de este texto, o null. */
  pista(texto) {
    if (!texto || !window.Game.VOCES || !window.Game.Narrador) return null;
    return window.Game.VOCES[window.Game.Narrador.clave(texto)] || null;
  },

  decir(texto, { sinParar = false } = {}) {
    const p = this.pista(texto);
    if (!p) return null;
    if (sinParar) { if (this._audio) this._audio.pause(); } else this.parar();
    const A = window.Game.Audio;
    const audio = new Audio(p.src);
    audio.volume = Math.max(0, Math.min(1, A ? A.nivel('voces') : 1));
    this._audio = audio;
    audio.play().catch(() => {});
    return p;
  },

  /** La frase de una estirpe, con la voz de su protagonista (o sus pitidos). */
  estirpe(razaId) {
    const f = window.Game.FRASE_ESTIRPE && window.Game.FRASE_ESTIRPE[razaId];
    if (!f) return null;
    return f.robot ? this.robot(f.texto) : this.decir(f.texto);
  },

  /**
   * Un robot (Pip) «dice» su frase en pitidos digitales, sin archivos:
   * WebAudio, un trino por palabra (más largo cuanto más larga la palabra,
   * con un tono sacado de la propia palabra para que suene siempre igual),
   * pausas en las comas y los puntos, y la última palabra sube si la frase es
   * una pregunta y baja si no.
   */
  robot(texto) {
    this.parar();
    const A = window.Game.Audio;
    const nivel = A ? A.nivel('voces') : 1;
    if (nivel <= 0) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this._ctx) { try { this._ctx = new AC(); } catch { return null; } }
    const ctx = this._ctx;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const salida = ctx.createGain();
    salida.gain.value = 0.07 * nivel;
    salida.connect(ctx.destination);
    this._robot = salida;

    const pregunta = /\?\s*$/.test(texto);
    const palabras = texto.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p));
    let t = ctx.currentTime + 0.05;
    palabras.forEach((p, i) => {
      const letras = p.replace(/[^\p{L}\p{N}]/gu, '').length;
      let h = 0;
      for (const ch of p.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
      const base = 520 + (h % 9) * 70;
      const dur = Math.min(0.24, 0.05 + letras * 0.028);
      const ultima = i === palabras.length - 1;
      // Dos o tres «sílabas» por palabra: saltos rápidos de tono, como un R/C.
      const pasos = Math.max(1, Math.min(3, Math.round(letras / 3)));
      for (let k = 0; k < pasos; k++) {
        const ini = t + (dur / pasos) * k;
        const fin = ini + dur / pasos * 0.85;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        osc.type = k % 2 ? 'square' : 'triangle';
        const f0 = base * (1 + ((h >> (k * 3)) % 5) * 0.12);
        osc.frequency.setValueAtTime(f0, ini);
        const f1 = ultima && k === pasos - 1 ? f0 * (pregunta ? 1.9 : 0.55) : f0 * (1 + (k % 2 ? -0.08 : 0.1));
        osc.frequency.exponentialRampToValueAtTime(f1, fin);
        env.gain.setValueAtTime(0.0001, ini);
        env.gain.exponentialRampToValueAtTime(1, ini + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, fin);
        osc.connect(env).connect(salida);
        osc.start(ini);
        osc.stop(fin + 0.02);
      }
      t += dur + (/[,.;:…]$/.test(p) ? 0.16 : 0.045);
    });
    return { robot: true, dur: t - ctx.currentTime };
  },

  /* --------------------- Al entrar al campo (una vez) --------------------- */

  /** Al empezar cada duelo: cada personaje vuelve a poder decir su frase. */
  nuevoDuelo() {
    this._yaHablaron = new Set();
    this._cola = [];
    this.parar();
  },

  /**
   * Un personaje entra en posición: dice su frase de ENTRADA (Game.FRASE_ENTRADA)
   * con su voz, UNA vez por duelo, sin bocadillo. Si otro está hablando, espera
   * su turno en una cola corta (no se pisan).
   */
  entrada(personajeId) {
    const f = window.Game.FRASE_ENTRADA && window.Game.FRASE_ENTRADA[personajeId];
    if (!f) return;
    this._yaHablaron = this._yaHablaron || new Set();
    if (this._yaHablaron.has(personajeId)) return;
    this._yaHablaron.add(personajeId);
    this._cola = this._cola || [];
    this._cola.push(f);
    if (!this._hablando) this._siguiente();
  },

  _siguiente() {
    const f = (this._cola || []).shift();
    if (!f) { this._hablando = false; return; }
    this._hablando = true;
    let seg = 0;
    if (typeof f === 'object' && f.sonido) seg = this.sonido(f.sonido);
    else {
      const p = this.decir(f, { sinParar: true });
      seg = p ? p.dur : 0;
    }
    clearTimeout(this._tCola);
    this._tCola = setTimeout(() => this._siguiente(), Math.max(0.2, seg) * 1000 + 250);
  },

  /** Sonidos que no son voz, generados aquí (WebAudio). Devuelve su duración. */
  sonido(nombre) {
    const ctx = this._contexto();
    if (!ctx) return 0;
    const A = window.Game.Audio;
    const nivel = A ? A.nivel('voces') : 1;
    if (nivel <= 0) return 0;
    const salida = ctx.createGain();
    // ×4: medidos solos daban picos del 10 % frente al ~90 % de las voces.
    salida.gain.value = nivel * 4;
    salida.connect(ctx.destination);
    const t0 = ctx.currentTime + 0.05;
    const ruido = (seg) => {
      const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seg), ctx.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const s = ctx.createBufferSource();
      s.buffer = b;
      return s;
    };
    if (nombre === 'cuervo') {
      // Una grabación de cuervo con eco (Oscar la eligió: la sintetizada
      // sonaba rara). Recortada a 2,6 s con fundido. Mismo mando de volumen.
      if (salida) salida.disconnect();
      const a = new Audio('assets/audio/cuervo.ogg');
      a.volume = Math.max(0, Math.min(1, nivel));
      a.play().catch(() => {});
      this._audio = a;
      return 2.6;
    }
    if (nombre === 'horda') {
      // Un ejército de muertos: mezcla que armó Oscar con tres grabaciones
      // (quejidos de batalla, gruñidos de monstruo y uno de bestia de fondo),
      // 3,6 s. Lo sintetizado no sonaba a zombis.
      if (salida) salida.disconnect();
      const a = new Audio('assets/audio/ejercito.ogg');
      a.volume = Math.max(0, Math.min(1, nivel));
      a.play().catch(() => {});
      this._audio = a;
      return 3.6;
    }
    return 0;
  },

  _contexto() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!this._ctx) { try { this._ctx = new AC(); } catch { return null; } }
    if (this._ctx.state === 'suspended') this._ctx.resume().catch(() => {});
    return this._ctx;
  },

  parar() {
    clearTimeout(this._tCola);
    this._hablando = false;
    if (this._audio) this._audio.pause();
    this._audio = null;
    if (this._robot) { try { this._robot.disconnect(); } catch { /* ya estaba */ } }
    this._robot = null;
  }
};
