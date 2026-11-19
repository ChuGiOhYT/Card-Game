/**
 * Bocadillos: los personajes hablan durante los duelos de CAMPAÑA.
 *
 * Las frases viven en `data/frases.js`; aquí solo se decide CUÁNDO habla
 * quién y se pinta. La pantalla de la partida llama a tres cosas:
 *
 *   iniciar(pantalla, { raza, etapa })   al montar la partida (null fuera de
 *                                        la campaña: entonces nadie habla)
 *   revisar(pantalla, sucesos)           en cada repintado, con el diff de
 *                                        `detectarSucesos` (null el primero)
 *   parar()                              al salir de la pantalla
 *
 * Reglas para que hablen sin agobiar:
 *  - Un bocadillo a la vez, en cola. Lo que espera demasiado (3,5 s) se tira:
 *    una frase sobre un golpe que ya pasó no dice nada.
 *  - La primera vez que alguien entra en posición habla siempre; después,
 *    a veces. Destruir habla casi siempre; caer, siempre.
 *  - Con el tutorial abierto, nadie habla.
 *  - En Catacumbas y Forjas (sin escenario 2D, donde no hay paseo con
 *    conversación) la conversación de la etapa se dice aquí, al empezar el
 *    duelo. Esa no caduca.
 *
 * Los bocadillos van en `position: fixed` sobre la pantalla y no reciben
 * clics: nunca tapan un botón que haga falta pulsar.
 */
window.Game = window.Game || {};

window.Game.Bocadillos = {
  CADUCA_MS: 3500,
  HUECO_MS: 280,
  CARACTERES_POR_SEGUNDO: 20,

  pantalla: null,
  ctx: null,
  cola: [],
  visible: null,
  temporizador: null,
  ultimaDe: new Map(),
  entradas: new Set(),
  marcas: new Set(),

  iniciar(pantalla, ctx) {
    this.parar();
    this.pantalla = pantalla;
    this.ctx = ctx || null;
    this.ultimaDe = new Map();
    this.entradas = new Set();
    this.marcas = new Set();
  },

  parar() {
    clearTimeout(this.temporizador);
    clearInterval(this.escritura);
    this.temporizador = null;
    if (this.visible && this.visible.el) this.visible.el.remove();
    this.visible = null;
    this.cola = [];
    this.pantalla = null;
    this.ctx = null;
  },

  activo() {
    return !!(this.ctx && this.pantalla && this.pantalla.motor && !window.Game.Tutorial?.activo);
  },

  /* ------------------------------ Cuándo ------------------------------- */

  revisar(pantalla, s) {
    if (pantalla !== this.pantalla || !this.ctx) return;
    const m = pantalla.motor;
    if (!m) return;

    if (!s) {
      // Primer pintado: la conversación de la etapa, si no hubo paseo.
      this.conversacionInicial(m);
      return;
    }
    if (!this.activo()) return;

    // Quien entra en posición.
    for (const k of s.nuevosActivos || []) {
      const [idx, uid] = k.split(':');
      const j = m.jugadores[Number(idx)];
      const inst = j && j.activos.find((i) => i.uid === uid);
      if (!inst) continue;
      const id = inst.personaje;
      const primera = !this.entradas.has(id);
      this.entradas.add(id);
      if (this.frases(id, 'aparece').length) {
        if (primera) this.decir(Number(idx), inst, 'aparece');
      } else if (primera || Math.random() < 0.35) {
        this.decir(Number(idx), inst, 'entra');
      }
    }

    // El golpe: quien tumba habla; quien cae, también.
    if (s.golpe) this.trasGolpe(m, s.golpe);

    // Al empezar un turno del jefe, a veces provoca.
    if (s.turnoNuevo) {
      const jefe = this.jefeEnPosicion(m, m.jugadorActivo);
      if (jefe && Math.random() < 0.4) this.decir(m.jugadores.indexOf(m.jugadorActivo), jefe, 'provoca');
    }

    this.revisarSangre(m);
  },

  trasGolpe(m, g) {
    const instDe = (idx, uid) => {
      const j = m.jugadores[idx];
      if (!j || !uid) return null;
      return [...j.activos, ...j.hades, ...j.reserva, ...(j.vacio || [])].find((i) => i.uid === uid) || null;
    };
    const atk = g.atacanteIdx >= 0 ? instDe(g.atacanteIdx, g.atacanteUid) : null;
    const def = g.defensorIdx >= 0 ? instDe(g.defensorIdx, g.defensorUid) : null;
    if (g.destruido && def) {
      // Las últimas palabras primero: es lo que pide la escena.
      this.decir(g.defensorIdx, def, 'cae', { prioridad: true });
      if (atk && Math.random() < 0.75) this.decir(g.atacanteIdx, atk, 'destruye');
    }
  },

  /** Poca sangre (un cuarto o menos): el de posición lo dice, una vez por bando. */
  revisarSangre(m) {
    m.jugadores.forEach((j, idx) => {
      const total = j.sangreTotal || 30;
      const vida = m.vidaDe(j);
      const inst = j.activos[0];
      if (!inst) return;
      if (this.esJefe(inst.personaje)) {
        if (vida <= total / 2 && !this.marcas.has(`herido:${idx}`)) {
          this.marcas.add(`herido:${idx}`);
          this.decir(idx, inst, 'herido', { prioridad: true });
        }
        return;
      }
      if (vida > 0 && vida <= Math.max(2, total / 4) && !this.marcas.has(`apuros:${idx}`)) {
        this.marcas.add(`apuros:${idx}`);
        this.decir(idx, inst, 'apuros');
      }
    });
  },

  conversacionInicial(m) {
    const { raza, etapa } = this.ctx;
    const cal = window.Game.DUNGEONS[raza];
    if (!cal || cal.escenario2d || !etapa || !etapa.dialogo) return;
    if (this.marcas.has('conversacion')) return;
    this.marcas.add('conversacion');
    const yo = m.jugadores[0];
    for (const d of etapa.dialogo) {
      const inst = [...yo.activos, ...yo.reserva].find((i) => i.personaje === d.quien);
      if (!inst) continue;
      // Directo a la cola, sin arrancarla: empieza cuando se haya ido «Tu turno».
      this.cola.push({ lado: 0, inst, id: d.quien, texto: d.texto, caduca: Infinity });
    }
    if (!this.visible && !this.temporizador) {
      this.temporizador = setTimeout(() => this.siguiente(), 1500);
    }
  },

  /* ------------------------------- Quién ------------------------------- */

  frases(id, momento) {
    const f = window.Game.FRASES && window.Game.FRASES[id];
    return (f && f[momento]) || [];
  },

  esJefe(id) {
    return this.frases(id, 'aparece').length > 0;
  },

  jefeEnPosicion(m, j) {
    return j.activos.find((i) => this.esJefe(i.personaje)) || null;
  },

  nombre(id) {
    const c = window.Game.CHARACTERS_BY_ID[id]
      || (window.Game.CREATURES || []).find((x) => x.id === id);
    return c ? c.nombre.split(',')[0] : '';
  },

  /** Una frase al azar de ese momento, sin repetir la última que dijo. */
  elegir(id, momento) {
    const lista = this.frases(id, momento);
    if (!lista.length) return null;
    const clave = `${id}:${momento}`;
    const antes = this.ultimaDe.get(clave);
    const opciones = lista.length > 1 ? lista.filter((t) => t !== antes) : lista;
    const t = opciones[Math.floor(Math.random() * opciones.length)];
    this.ultimaDe.set(clave, t);
    return t;
  },

  decir(lado, inst, momento, { prioridad = false } = {}) {
    if (!inst) return;
    const texto = this.elegir(inst.personaje, momento);
    if (!texto) return;
    this.encolar({ lado, inst, id: inst.personaje, texto, caduca: Date.now() + this.CADUCA_MS }, prioridad);
  },

  /* ------------------------------- Cómo -------------------------------- */

  encolar(item, prioridad = false) {
    if (prioridad) this.cola.unshift(item);
    else this.cola.push(item);
    if (!this.visible && !this.temporizador) this.siguiente();
  },

  siguiente() {
    this.temporizador = null;
    if (!this.pantalla || !this.pantalla.contenedor) return;
    const ahora = Date.now();
    this.cola = this.cola.filter((x) => x.caduca > ahora);
    const item = this.cola.shift();
    if (!item) return;
    const el = this.pintar(item);
    if (!el) {
      this.siguiente();
      return;
    }
    const ms = Math.max(2200, (item.texto.length / this.CARACTERES_POR_SEGUNDO) * 1000 + 900);
    this.visible = { el, item };
    this.temporizador = setTimeout(() => {
      el.classList.add('se-va');
      this.temporizador = setTimeout(() => {
        el.remove();
        this.visible = null;
        this.temporizador = setTimeout(() => this.siguiente(), this.HUECO_MS);
      }, 260);
    }, ms);
  },

  /** Dónde está ahora la carta de quien habla: en la mesa, en tu mano o en su placa. */
  ancla(item) {
    const c = this.pantalla.contenedor;
    const panel = c.querySelector(item.lado === 0 ? '#panel-jugador' : '#panel-rival');
    return (panel && panel.querySelector(`[data-uid-personaje="${item.inst.uid}"]`))
      || (item.lado === 0 && c.querySelector(`#mesa-controles [data-uid="${item.inst.uid}"]`))
      || c.querySelector(item.lado === 0 ? '#placa-jugador' : '#placa-rival');
  },

  pintar(item) {
    const c = this.pantalla.contenedor;
    const ancla = this.ancla(item);
    if (!ancla) return null;
    const acotacion = /^\(.*\)$/.test(item.texto.trim());
    const el = document.createElement('div');
    el.className = `bocadillo ${item.lado === 0 ? 'de-jugador' : 'de-rival'}${acotacion ? ' acotacion' : ''}`;
    el.setAttribute('role', 'status');
    const nombre = acotacion ? '' : `<span class="bocadillo-nombre">${this.nombre(item.id)}</span>`;
    el.innerHTML = `${nombre}<span class="bocadillo-texto">${item.texto}</span>`;
    c.appendChild(el);

    // Encima de la carta; si no cabe arriba, debajo. Siempre dentro de la ventana.
    const ra = ancla.getBoundingClientRect();
    const rb = el.getBoundingClientRect();
    const margen = 8;
    let x = ra.left + ra.width / 2 - rb.width / 2;
    x = Math.max(margen, Math.min(window.innerWidth - rb.width - margen, x));
    let y = ra.top - rb.height - 12;
    let abajo = false;
    if (y < margen) {
      y = ra.bottom + 12;
      abajo = true;
    }
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    // El piquito sigue apuntando a la carta aunque el bocadillo se haya movido.
    const cola = Math.max(14, Math.min(rb.width - 14, ra.left + ra.width / 2 - x));
    el.style.setProperty('--cola', `${Math.round(cola)}px`);
    if (abajo) el.classList.add('abajo');
    this.escribir(el, item, acotacion, rb);
    return el;
  },

  /** Letras por segundo al escribirse un bocadillo (y su «pipipi»). */
  LETRAS_POR_SEGUNDO: 38,

  /**
   * Escribe el texto letra a letra. El bocadillo ya se midió y colocó con el
   * texto entero: se le fija ese tamaño para que no crezca mientras se escribe.
   * Las acotaciones («(gruñe)») no son habla: aparecen enteras y sin sonido.
   */
  escribir(el, item, acotacion, medida) {
    clearInterval(this.escritura);
    if (acotacion) return;
    const caja = el.querySelector('.bocadillo-texto');
    if (!caja) return;
    el.style.width = `${Math.ceil(medida.width)}px`;
    el.style.minHeight = `${Math.ceil(medida.height)}px`;
    const texto = item.texto;
    let n = 0;
    caja.textContent = '';
    window.Game.Voces?.nuevaFrase();
    this.escritura = setInterval(() => {
      if (!el.isConnected || n >= texto.length) {
        clearInterval(this.escritura);
        caja.textContent = texto;
        return;
      }
      window.Game.Voces?.letra(item.id, texto[n]);
      caja.textContent = texto.slice(0, ++n);
    }, 1000 / this.LETRAS_POR_SEGUNDO);
  }
};
