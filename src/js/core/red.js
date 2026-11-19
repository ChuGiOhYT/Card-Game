/**
 * Red: la conexión de un duelo remoto 1 contra 1, de PC a PC.
 *
 * - Las jugadas viajan DIRECTAS entre los dos equipos por un canal de datos
 *   WebRTC (viene con Electron; no hay que instalar nada ni pagar servidor).
 * - Para encontrarse, los dos se presentan en el servidor público de PeerJS
 *   (0.peerjs.com), que solo reenvía los mensajes de saludo (OFFER / ANSWER /
 *   CANDIDATE). Le hablamos con su protocolo a mano, sin la librería: son
 *   cuatro tipos de mensaje. En cuanto el canal está abierto se cierra la
 *   conexión con él: la partida ya no pasa por ningún servidor.
 * - El anfitrión crea la sala y recibe un código corto (K7Q-2MX). El invitado
 *   lo escribe y se conecta. Su id en el servidor es PREFIJO + código.
 *
 * No toca el DOM: la pantalla (screens/remoto.js) escucha con on().
 *
 * Eventos: 'estado' (estado, detalle), 'mensaje' (datos de la app),
 * 'ping' (ms), 'rival' ({ nombre }).
 * Estados: apagado · senal (hablando con el servidor) · esperando (sala
 * creada, sin rival) · negociando · conectado · reconectando · error · cerrado.
 *
 * RECONEXIÓN (tanda 4): si el canal se cae sin un «adiós» (o el ping deja de
 * contestar MS_SIN_RESPUESTA), los dos pasan a «reconectando»: el anfitrión
 * vuelve a abrir la MISMA sala en el servidor y el invitado vuelve a llamar
 * con su MISMO id, reintentando hasta MS_RECONEXION. Solo se acepta de vuelta
 * al mismo rival. Al reabrir el canal: «conectado» otra vez (y la partida se
 * resincroniza sola: el invitado pide la foto con `listo`).
 *
 * RELÉ (TURN) opcional: `ponerRele({ url, usuario, clave })` (lo guarda la
 * sala en el perfil).
 *
 * RESPALDO POR SUPABASE (19-nov): entre un teléfono y un PC lo directo falla
 * a menudo (wifi que aísla a los dispositivos, datos móviles con NAT
 * compartido). Si en MS_DIRECTO no hay canal directo, los dos pasan a un canal
 * de Supabase Realtime (`CanalRele`, abajo) con el tema `aeternum-<código>`.
 * Ese canal imita a un RTCDataChannel (readyState, send, onopen, onmessage,
 * onclose, close), así que `_enganchar` y todo lo de encima no cambian.
 */
window.Game = window.Game || {};

window.Game.Red = {
  SENAL: 'wss://0.peerjs.com:443/peerjs',
  CLAVE_SENAL: 'peerjs',
  ICE: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ],
  PREFIJO: 'aeternum-duelo-',
  /** Sube si cambia el formato de los mensajes de la partida. */
  PROTOCOLO: 1,
  /** Sin letras que se confunden (0/O, 1/I/L). */
  ALFABETO: 'ABCDEFGHJKMNPQRSTUVWXYZ23456789',
  MS_LATIDO_SENAL: 5000,
  MS_PING: 2000,
  MS_ESPERA_UNIRSE: 25000,
  MS_SIN_RESPUESTA: 8000,
  MS_RECONEXION: 60000,
  MS_REINTENTO: 2500,
  /** Tiempo para lograr el canal directo antes de pasar al respaldo. */
  MS_DIRECTO: 9000,
  /** Proyecto de Supabase para el respaldo (la clave «anon» es pública por diseño). */
  SUPABASE: { url: 'https://ywgxhqwrhexocpygjtlh.supabase.co', clave: 'sb_publishable_0qJZhYasUvQCIEWgEAq61Q_-rZ0FN5k' },
  /** Relé TURN opcional (ver ponerRele). */
  rele: null,

  estado: 'apagado',
  detalle: '',
  rol: null, // 'anfitrion' | 'invitado'
  codigo: null,
  nombre: 'Jugador',
  rival: null,
  ping: null,
  _oyentes: {},

  on(ev, fn) {
    (this._oyentes[ev] = this._oyentes[ev] || []).push(fn);
    return () => { this._oyentes[ev] = (this._oyentes[ev] || []).filter((f) => f !== fn); };
  },

  _emitir(ev, ...args) {
    for (const fn of this._oyentes[ev] || []) {
      try { fn(...args); } catch (e) { console.error('Red:', e); }
    }
  },

  _poner(estado, detalle = '') {
    this.estado = estado;
    this.detalle = detalle;
    this._emitir('estado', estado, detalle);
  },

  conectado() { return this.estado === 'conectado'; },

  /** Configura (o quita, con null) un relé TURN para las redes difíciles. */
  ponerRele(r) {
    this.rele = r && r.url ? { url: String(r.url).trim(), usuario: r.usuario || '', clave: r.clave || '' } : null;
  },

  _iceServers() {
    const lista = [...this.ICE];
    if (this.rele) {
      lista.push({ urls: this.rele.url, username: this.rele.usuario, credential: this.rele.clave });
    }
    return lista;
  },

  /** El mensaje de «no se pudo conectar directo», con qué hacer. */
  textoSinDirecto() {
    return this.rele
      ? 'No se pudo conectar ni directo ni por el relé configurado. Revisa los datos del relé.'
      : 'No se pudo conectar directo entre los dos PC (vuestras redes no lo permiten). ' +
        'Probad con un relé TURN (Opciones de conexión) o con una red virtual como Radmin VPN o Tailscale.';
  },

  /* ------------------------------ Salas ------------------------------- */

  nuevoCodigo() {
    let s = '';
    const a = this.ALFABETO;
    const azar = crypto.getRandomValues(new Uint32Array(6));
    for (let i = 0; i < 6; i++) s += a[azar[i] % a.length];
    return s;
  },

  /** «k7q 2mx» → «K7Q2MX». */
  normalizar(codigo) {
    return String(codigo || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  },

  /** Para enseñarlo: «K7Q-2MX». */
  mostrarCodigo(codigo = this.codigo) {
    return codigo ? `${codigo.slice(0, 3)}-${codigo.slice(3)}` : '';
  },

  crearSala({ nombre } = {}) {
    this.cerrar({ silencio: true });
    this.rol = 'anfitrion';
    this.nombre = nombre || this.nombre;
    this.codigo = this.nuevoCodigo();
    this._intentosId = 0;
    this._abrirSenal(this.PREFIJO + this.codigo);
  },

  unirse(codigo, { nombre } = {}) {
    const c = this.normalizar(codigo);
    if (c.length !== 6) {
      this._poner('error', 'El código tiene 6 letras o números (por ejemplo K7Q-2MX).');
      return;
    }
    this.cerrar({ silencio: true });
    this.rol = 'invitado';
    this.nombre = nombre || this.nombre;
    this.codigo = c;
    this._abrirSenal(`${this.PREFIJO}g-${this.nuevoCodigo().toLowerCase()}`);
    this._tEspera = setTimeout(() => {
      if (this.estado !== 'conectado') {
        this._fallar(`No hubo respuesta de esa sala. Revisa el código. ${this.textoSinDirecto()}`);
      }
    }, this.MS_ESPERA_UNIRSE);
  },

  /* ---------------------- El servidor de presentación ------------------- */

  _abrirSenal(id, { silencio = false } = {}) {
    this._miId = id;
    if (!silencio) this._poner('senal', 'Conectando con el servidor de salas…');
    const token = Math.random().toString(36).slice(2, 12);
    let ws;
    try {
      ws = new WebSocket(`${this.SENAL}?key=${this.CLAVE_SENAL}&id=${encodeURIComponent(id)}&token=${token}&version=1.5.4`);
    } catch (e) {
      this._fallar('No se pudo abrir la conexión con el servidor de salas.');
      return;
    }
    this._ws = ws;
    ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      this._deSenal(m);
    };
    ws.onerror = () => {
      if (this.estado === 'senal') this._fallar('Sin conexión con el servidor de salas. ¿Hay internet?');
      else if (this.estado === 'reconectando') this._reintentar();
    };
    ws.onclose = () => {
      clearInterval(this._latido);
      if (this._ws === ws) this._ws = null;
      if (this.estado === 'senal' || this.estado === 'esperando') {
        this._fallar('Se cortó la conexión con el servidor de salas.');
      } else if (this.estado === 'reconectando' && this._ws === null) {
        this._reintentar();
      }
    };
  },

  /**
   * El servidor de PeerJS CORTA al que manda un OFFER o un ANSWER sin la forma
   * que usa su librería (connectionId, label, reliable, serialization…): sin
   * ella la oferta no llegaba nunca. Se manda siempre completa.
   */
  _carga(extra) {
    const id = `dc_${this.codigo || 'x'}`;
    return { type: 'data', connectionId: id, label: id, reliable: true, serialization: 'json',
      browser: 'chrome', protocolo: this.PROTOCOLO, ...extra };
  },

  _aSenal(tipo, dst, payload) {
    if (this._ws && this._ws.readyState === 1) this._ws.send(JSON.stringify({ type: tipo, dst, payload }));
  },

  _cerrarSenal() {
    clearInterval(this._latido);
    const ws = this._ws;
    this._ws = null;
    if (ws) { ws.onclose = null; try { ws.close(); } catch { /* ya estaba */ } }
  },

  _deSenal(m) {
    switch (m.type) {
      case 'OPEN':
        this._latido = setInterval(() => {
          if (this._ws && this._ws.readyState === 1) this._ws.send(JSON.stringify({ type: 'HEARTBEAT' }));
        }, this.MS_LATIDO_SENAL);
        if (this.rol === 'anfitrion') {
          if (this.estado !== 'reconectando') this._poner('esperando', 'Sala abierta. Pásale el código a tu rival.');
        } else {
          this._ofrecer();
        }
        break;
      case 'ID-TAKEN':
        this._cerrarSenal();
        // Reconectando: el servidor aún no soltó nuestro id viejo. Otra vez en un rato.
        if (this.estado === 'reconectando') {
          this._reintentar();
          break;
        }
        // Rarísimo con 31^6 códigos, pero se resuelve solo con otro.
        if (this.rol === 'anfitrion' && ++this._intentosId < 4) {
          this.codigo = this.nuevoCodigo();
          this._abrirSenal(this.PREFIJO + this.codigo);
        } else {
          this._fallar('El servidor de salas no aceptó el código. Prueba otra vez.');
        }
        break;
      case 'OFFER':
        this._recibirOferta(m.src, m.payload || {});
        break;
      case 'ANSWER':
        this._recibirRespuesta(m.src, m.payload || {});
        break;
      case 'CANDIDATE':
        if (m.payload && m.payload.ocupada && this.rol === 'invitado' && this.estado !== 'conectado') {
          this._fallar('Esa sala ya tiene dos jugadores.');
          break;
        }
        if (this._pc && m.src === this._otro && m.payload && m.payload.candidate) {
          // Pueden llegar antes que la descripción remota: se guardan hasta entonces.
          if (this._pc.remoteDescription) this._pc.addIceCandidate(m.payload.candidate).catch(() => {});
          else this._colaIce.push(m.payload.candidate);
        }
        break;
      case 'EXPIRE':
        // Reconectando: el anfitrión aún no volvió a abrir la sala. Otra vez en un rato.
        if (this.estado === 'reconectando') {
          this._reintentar();
          break;
        }
        // El servidor no encontró al destinatario: la sala no existe (o ya cerró).
        if (this.rol === 'invitado' && this.estado !== 'conectado') {
          this._fallar(`No hay ninguna sala ${this.mostrarCodigo()} esperando rival (no existe, o ya empezó su duelo).`);
        }
        break;
      case 'ERROR':
      case 'INVALID-KEY':
        this._fallar(`El servidor de salas dio un error${m.payload && m.payload.msg ? `: ${m.payload.msg}` : ''}.`);
        break;
      default:
        break;
    }
  },

  /* ------------------------------ WebRTC ------------------------------- */

  _nuevaPc(otro) {
    this._otro = otro;
    this._colaIce = [];
    const pc = new RTCPeerConnection({ iceServers: this._iceServers() });
    this._pc = pc;
    pc.onicecandidate = (ev) => {
      if (ev.candidate) this._aSenal('CANDIDATE', otro, this._carga({ candidate: ev.candidate.toJSON() }));
    };
    // Si lo directo no llega a tiempo, al respaldo (los dos lados lo deciden
    // solos con el mismo plazo).
    clearTimeout(this._tDirecto);
    if (this._hayRespaldo()) {
      this._tDirecto = setTimeout(() => { if (this._pc === pc && !this._dc?.esRele && this._dc?.readyState !== 'open') this._aRespaldo(); }, this.MS_DIRECTO);
    }
    pc.onconnectionstatechange = () => {
      if (this._pc !== pc) return;
      if (pc.connectionState === 'failed') {
        if (this._hayRespaldo()) this._aRespaldo();
        else if (this._huboConexion) this._perdida();
        else this._fallar(this.textoSinDirecto());
      } else if (pc.connectionState === 'disconnected' && this.estado === 'conectado') {
        this._poner('conectado', 'La conexión va inestable…');
      }
    };
    return pc;
  },

  async _ofrecer() {
    if (this.estado !== 'reconectando') this._poner('negociando', 'Buscando la sala…');
    const pc = this._nuevaPc(this.PREFIJO + this.codigo);
    this._enganchar(pc.createDataChannel('aeternum', { ordered: true }));
    try {
      await pc.setLocalDescription(await pc.createOffer());
      this._aSenal('OFFER', this._otro, this._carga({ sdp: pc.localDescription.toJSON() }));
    } catch (e) {
      this._fallar('No se pudo preparar la conexión.');
    }
  },

  _vaciarColaIce() {
    for (const c of this._colaIce.splice(0)) this._pc.addIceCandidate(c).catch(() => {});
  },

  async _recibirOferta(src, payload) {
    if (this.rol !== 'anfitrion') return;
    // Una sala es para dos: si ya hay rival (o se espera que VUELVA el mismo),
    // se le dice al que llega.
    if ((this._pc && this._otro !== src) || (this._rivalSenal && this._rivalSenal !== src)) {
      this._aSenal('CANDIDATE', src, this._carga({ candidate: { candidate: '' }, ocupada: true }));
      return;
    }
    if (this.estado !== 'reconectando') this._poner('negociando', 'Alguien entra en la sala…');
    const pc = this._nuevaPc(src);
    pc.ondatachannel = (ev) => this._enganchar(ev.channel);
    try {
      await pc.setRemoteDescription(payload.sdp);
      this._vaciarColaIce();
      await pc.setLocalDescription(await pc.createAnswer());
      this._aSenal('ANSWER', src, this._carga({ sdp: pc.localDescription.toJSON() }));
    } catch (e) {
      this._fallar('No se pudo aceptar al rival.');
    }
  },

  async _recibirRespuesta(src, payload) {
    if (this.rol !== 'invitado' || src !== this._otro || !this._pc) return;
    try {
      await this._pc.setRemoteDescription(payload.sdp);
      this._vaciarColaIce();
    } catch (e) {
      this._fallar('La respuesta de la sala no valía.');
    }
  },

  _hayRespaldo() {
    return !!(this.SUPABASE.url && this.SUPABASE.clave && typeof WebSocket !== 'undefined');
  },

  /** Lo directo no llegó: el duelo sigue por el canal de Supabase. */
  _aRespaldo() {
    if (this._dc?.esRele) return;
    clearTimeout(this._tDirecto);
    const pc = this._pc;
    this._pc = null;
    if (pc) { pc.onconnectionstatechange = null; pc.onicecandidate = null; try { pc.close(); } catch { /* */ } }
    if (this.estado !== 'reconectando') this._poner('negociando', 'Sin camino directo: conectando por el servidor de respaldo…');
    // El invitado tenía 25 s para entrar; por el respaldo se le dan otros tantos.
    if (this.rol === 'invitado') {
      clearTimeout(this._tEspera);
      this._tEspera = setTimeout(() => {
        if (this.estado !== 'conectado' && this.estado !== 'reconectando') this._fallar('No se pudo conectar ni directo ni por el servidor de respaldo.');
      }, this.MS_ESPERA_UNIRSE);
    }
    this._enganchar(new CanalRele(this.SUPABASE, `aeternum-${this.codigo}`, this._miId));
  },

  /* --------------------------- El canal de datos ------------------------ */

  _enganchar(dc) {
    this._dc = dc;
    dc.onopen = () => {
      clearTimeout(this._tEspera);
      clearTimeout(this._tReconexion);
      clearTimeout(this._tReintento);
      // Ya no hace falta el servidor: todo va directo.
      this._cerrarSenal();
      const volvio = this.estado === 'reconectando';
      this._huboConexion = true;
      if (this.rol === 'anfitrion') this._rivalSenal = this._otro;
      this._ultimaSenalDeVida = performance.now();
      this._poner('conectado', `${volvio ? 'Reconectado' : 'Conectado'}${dc.esRele ? ' (por el servidor de respaldo)' : ''}.`);
      this._enviarInterno({ t: 'hola', nombre: this.nombre, protocolo: this.PROTOCOLO });
      clearInterval(this._tPing);
      this._tPing = setInterval(() => {
        // Sin noticias del otro en un rato: el canal está muerto aunque no lo diga.
        if (performance.now() - this._ultimaSenalDeVida > this.MS_SIN_RESPUESTA) {
          this._perdida();
          return;
        }
        this._enviarInterno({ t: 'ping', ts: performance.now() });
      }, this.MS_PING);
    };
    dc.onmessage = (ev) => {
      this._ultimaSenalDeVida = performance.now();
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      this._deCanal(m);
    };
    dc.onclose = () => {
      if (this._dc !== dc) return;
      clearInterval(this._tPing);
      if (this.estado !== 'conectado') return;
      if (this._seFue) this._poner('cerrado', 'Tu rival salió de la sala.');
      else this._perdida();
    };
  },

  _deCanal(m) {
    switch (m.t) {
      case 'hola':
        this.rival = { nombre: String(m.nombre || 'Rival').slice(0, 24), protocolo: m.protocolo };
        this._emitir('rival', this.rival);
        if (m.protocolo !== this.PROTOCOLO) {
          this._poner('conectado', 'Ojo: tu rival tiene otra versión del juego. Actualizad los dos.');
        }
        break;
      case 'ping':
        this._enviarInterno({ t: 'pong', ts: m.ts });
        break;
      case 'pong':
        this.ping = Math.round(performance.now() - m.ts);
        this._emitir('ping', this.ping);
        break;
      case 'adios':
        this._seFue = true;
        break;
      case 'app':
        this._emitir('mensaje', m.d);
        break;
      default:
        break;
    }
  },

  _enviarInterno(obj) {
    if (this._dc && this._dc.readyState === 'open') {
      this._dc.send(JSON.stringify(obj));
      return true;
    }
    return false;
  },

  /** Manda datos de la partida al rival. Devuelve si salieron. */
  enviar(datos) {
    return this._enviarInterno({ t: 'app', d: datos });
  },

  /* ----------------------------- Reconexión ----------------------------- */

  /** Se cayó el canal sin «adiós»: se intenta volver a enlazar con el mismo rival. */
  _perdida() {
    if (this.estado === 'reconectando' || !this.rol) return;
    if (this._seFue) {
      this._soltarCanal();
      this._poner('cerrado', 'Tu rival salió de la sala.');
      return;
    }
    this._soltarCanal();
    this._poner('reconectando', 'Se cortó la conexión. Reconectando…');
    clearTimeout(this._tReconexion);
    this._tReconexion = setTimeout(() => {
      if (this.estado === 'reconectando') {
        this._fallar('No se pudo recuperar la conexión con tu rival.');
      }
    }, this.MS_RECONEXION);
    this._volverASenal();
  },

  _volverASenal() {
    if (this.estado !== 'reconectando') return;
    // El anfitrión reabre su sala; el invitado vuelve con su mismo id.
    this._abrirSenal(this.rol === 'anfitrion' ? this.PREFIJO + this.codigo : this._miId, { silencio: true });
  },

  _reintentar() {
    this._cerrarSenal();
    this._soltarCanal();
    clearTimeout(this._tReintento);
    this._tReintento = setTimeout(() => this._volverASenal(), this.MS_REINTENTO);
  },

  /** Cierra el canal y la conexión WebRTC, sin tocar la sala ni el servidor. */
  _soltarCanal() {
    clearInterval(this._tPing);
    const dc = this._dc, pc = this._pc;
    this._dc = null;
    this._pc = null;
    if (dc) { dc.onclose = null; dc.onmessage = null; try { dc.close(); } catch { /* ya estaba */ } }
    if (pc) { pc.onconnectionstatechange = null; try { pc.close(); } catch { /* ya estaba */ } }
  },

  /* ------------------------------- Cierre ------------------------------- */

  _fallar(texto) {
    this._soltar();
    this._poner('error', texto);
  },

  _soltar() {
    clearTimeout(this._tEspera);
    clearTimeout(this._tDirecto);
    clearTimeout(this._tReconexion);
    clearTimeout(this._tReintento);
    clearInterval(this._tPing);
    this._cerrarSenal();
    this._soltarCanal();
    this._otro = null;
  },

  /** Sale de la sala avisando al rival. */
  cerrar({ silencio = false } = {}) {
    // El «adiós» tiene que salir ANTES de cerrar: si no, el otro lo tomaría
    // por un corte y se pondría a reconectar. Se cierra un instante después.
    const dc = this._dc, pc = this._pc;
    if (dc && dc.readyState === 'open') {
      try { dc.send(JSON.stringify({ t: 'adios' })); } catch { /* ya estaba */ }
      this._dc = null;
      this._pc = null;
      dc.onclose = null;
      dc.onmessage = null;
      if (pc) pc.onconnectionstatechange = null;
      setTimeout(() => { try { dc.close(); } catch { /* */ } try { pc && pc.close(); } catch { /* */ } }, 250);
    }
    this._soltar();
    this._huboConexion = false;
    this._rivalSenal = null;
    this.rol = null;
    this.codigo = null;
    this.rival = null;
    this.ping = null;
    this._seFue = false;
    if (!silencio) this._poner('apagado');
    else this.estado = 'apagado';
  }
};


/**
 * Un «canal de datos» por Supabase Realtime (broadcast), hablado a mano con
 * su protocolo Phoenix (sin librería): unirse al tema, latido cada 25 s y
 * mensajes `broadcast`. Imita lo que `_enganchar` usa de un RTCDataChannel.
 *
 * CIFRADO DE EXTREMO A EXTREMO: cada lado genera un par ECDH (P-256) y manda
 * su clave pública en el saludo; con la del otro se deriva una clave AES-GCM
 * que solo conocen los dos. Así ni Supabase ni quien sepa el código de la sala
 * pueden leer la partida ni el chat (como en el canal directo, que ya va
 * cifrado por WebRTC). El canal se abre cuando hay clave compartida, y a
 * partir de ahí solo escucha a ese otro. Cifrar y descifrar son asíncronos:
 * van en colas para no desordenar los mensajes.
 */
function CanalRele({ url, clave }, tema, miId) {
  this.esRele = true;
  this.readyState = 'connecting';
  this.onopen = this.onmessage = this.onclose = null;
  this._yo = miId;
  this._otro = null;
  this._ref = 0;
  this._tema = `realtime:${tema}`;
  this._colaSalida = Promise.resolve();
  this._colaEntrada = Promise.resolve();
  // Lo que llega mientras aún se calcula la clave espera a que el canal abra.
  this._abierto = new Promise((r) => { this._alAbrir = r; });
  const sutil = crypto.subtle;
  this._par = sutil.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveKey'])
    .then(async (par) => ({ par, publica: await sutil.exportKey('jwk', par.publicKey) }));
  const ws = new WebSocket(`${url.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(clave)}&vsn=1.0.0`);
  this._ws = ws;
  const mandar = (topic, event, payload) => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ topic, event, payload, ref: String(++this._ref), join_ref: '1' }));
  };
  this._mandar = mandar;
  const saludar = async () => {
    const { publica } = await this._par;
    this._emitir({ k: 'hola-rele', pub: { x: publica.x, y: publica.y } });
  };
  ws.onopen = () => {
    // Las claves nuevas («sb_publishable_…») no son un JWT: van solo en la URL.
    const union = { config: { broadcast: { ack: false, self: false }, presence: { key: '' }, postgres_changes: [], private: false } };
    if (/^eyJ/.test(clave)) union.access_token = clave;
    mandar(this._tema, 'phx_join', union);
    this._latido = setInterval(() => mandar('phoenix', 'heartbeat', {}), 25000);
    this._saludo = setInterval(saludar, 1000);
    saludar();
  };
  ws.onmessage = (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.event !== 'broadcast' || !m.payload || m.payload.event !== 'm') return;
    const p = m.payload.payload || {};
    if (!p.de || p.de === this._yo) return;
    if (this._otro && p.de !== this._otro) return; // un tercero con el mismo código
    if (p.k === 'hola-rele' && !this._otro && p.pub) {
      this._otro = p.de;
      this._clave = this._par.then(({ par }) => sutil.importKey('jwk',
        { kty: 'EC', crv: 'P-256', x: p.pub.x, y: p.pub.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
        .then((suya) => sutil.deriveKey({ name: 'ECDH', public: suya }, par.privateKey,
          { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])));
      this._clave.then(() => {
        if (this.readyState !== 'connecting') return;
        this.readyState = 'open';
        // Un último saludo, por si el otro aún no nos oyó.
        saludar();
        clearInterval(this._saludo);
        if (this.onopen) this.onopen();
        this._alAbrir();
      }).catch(() => this._cerrado());
      return;
    }
    if (p.k === 'adios-rele') { this._cerrado(); return; }
    if (p.k === 'd' && this._clave) {
      this._colaEntrada = this._colaEntrada.then(async () => {
        const k = await this._clave;
        await this._abierto;
        const claro = await sutil.decrypt({ name: 'AES-GCM', iv: _deB64(p.iv) }, k, _deB64(p.c));
        if (this.readyState === 'open' && this.onmessage) this.onmessage({ data: new TextDecoder().decode(claro) });
      }).catch(() => { /* un mensaje que no se descifra (de otro, o roto): se ignora */ });
    }
  };
  ws.onclose = () => this._cerrado();
  ws.onerror = () => {};
}

function _aB64(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}
function _deB64(t) {
  return Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
}

CanalRele.prototype._emitir = function (extra) {
  this._mandar(this._tema, 'broadcast', { type: 'broadcast', event: 'm', payload: { de: this._yo, ...extra } });
};

CanalRele.prototype.send = function (texto) {
  if (this.readyState !== 'open') throw new Error('canal cerrado');
  this._colaSalida = this._colaSalida.then(async () => {
    const k = await this._clave;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(texto));
    this._emitir({ k: 'd', iv: _aB64(iv), c: _aB64(c) });
  }).catch(() => {});
};

CanalRele.prototype._cerrado = function () {
  if (this.readyState === 'closed') return;
  this.readyState = 'closed';
  clearInterval(this._latido);
  clearInterval(this._saludo);
  if (this.onclose) this.onclose();
};

CanalRele.prototype.close = function () {
  if (this.readyState === 'closed') return;
  // El adiós sale DETRÁS de lo que quede por cifrar (p. ej. el «adios» del juego).
  const ws = this._ws;
  this._colaSalida.then(() => {
    this._emitir({ k: 'adios-rele' });
    try { this._mandar(this._tema, 'phx_leave', {}); } catch { /* */ }
    setTimeout(() => { try { ws.close(); } catch { /* */ } }, 100);
  });
  this._cerrado();
};

window.Game.CanalRele = CanalRele;
