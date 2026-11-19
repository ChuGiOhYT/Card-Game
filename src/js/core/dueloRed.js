/**
 * Duelo remoto · tanda 2: el motor en red.
 *
 * EL ANFITRIÓN MANDA. Su PC corre el TurnEngine de verdad, con los dos
 * jugadores humanos (jugadores[0] = anfitrión, jugadores[1] = invitado). El
 * invitado nunca cambia el estado: envía INTENCIONES («despliego u7», «elijo
 * la opción ?2») y el anfitrión las valida, las aplica y le devuelve la FOTO
 * de la mesa (core/sincro.js). Así no hay desincronización posible, y todo
 * el azar (dados, «al azar») sale de un único sitio: el motor del anfitrión.
 *
 * EL INVITADO tiene un MOTOR ESPEJO: un objeto con el prototipo del
 * TurnEngine, así que las CONSULTAS funcionan igual (accionesDisponibles,
 * atacantesDisponibles, energiaDe, previsionAtaque…), pero cada método que
 * cambiaría algo (desplegar, equipar, siguienteFase, resolverEleccion,
 * derramar…) se convierte en una intención y devuelve una promesa con
 * { ok, motivo }. La pantalla podrá llamar a `m.desplegar(uid)` igual en los
 * dos lados; la mesa nueva llega cuando el anfitrión contesta.
 *
 * Lo que el invitado puede pedir está en INTENCIONES, con su validación: solo
 * en su turno (o, para responder, en SU pregunta), solo sobre SUS cartas.
 * Cualquier otra cosa se rechaza con un motivo, sin tocar la partida.
 *
 * No toca el DOM.
 */
window.Game = window.Game || {};

window.Game.DueloRed = {
  /** Métodos del motor que solo LEEN: el espejo los usa tal cual. */
  LECTURA: new Set([
    'vidaDe', 'energiaDe', 'activoDe', 'instancia', 'tieneEstado', 'estadosDe',
    'puedeSerAtacado', 'estaAturdido', 'eternalProtegido', 'esbirrosVivos',
    'defensorEfectivo', 'puedeDesplegar', 'accionesDisponibles',
    'atacantesDisponibles', 'puedeAtacar', 'implicadosAtaque', 'sinPersonajes'
  ]),

  /* ============================== Anfitrión ============================== */

  /**
   * Pone el motor en red. `red` es Game.Red (o algo con on/enviar).
   * Devuelve la sesión: { enviarFoto(), soltar() }.
   */
  anfitrion({ motor, red, invitadoIdx = 1 }) {
    const S = window.Game.Sincro;
    const sesion = { motor, red, idx: invitadoIdx, v: 0, marcas: {}, aplicadas: new Set() };
    let pendiente = false;
    sesion.enviarFoto = () => {
      const f = S.foto(motor, invitadoIdx);
      sesion.marcas = f.marcas;
      red.enviar({
        tipo: 'estado', v: ++sesion.v, yo: invitadoIdx,
        foto: { grafo: f.grafo, registro: f.registro, nRegistro: f.nRegistro, anuncios: f.anuncios }
      });
    };
    // Varias notificaciones seguidas (un efecto que repinta a mitad) salen en
    // UNA foto: se espera al final de la tarea en curso.
    const programar = () => {
      if (pendiente) return;
      pendiente = true;
      Promise.resolve().then(() => { pendiente = false; sesion.enviarFoto(); });
    };
    const original = motor.alCambiar;
    motor.alCambiar = (m) => { original(m); programar(); };

    const soltarMensajes = red.on('mensaje', (d) => {
      // La mesa del invitado ya escucha: se le manda la foto (la primera pudo
      // salir antes de que su pantalla existiera).
      if (d && d.tipo === 'listo') { sesion.enviarFoto(); return; }
      if (!d || d.tipo !== 'intento') return;
      const r = this.ejecutar(sesion, d.op, d.args || []);
      red.enviar({ tipo: 'resultado', n: d.n, ok: r === true, motivo: r === true ? '' : r });
      programar();
    });
    sesion.soltar = () => {
      soltarMensajes();
      motor.alCambiar = original;
    };
    sesion.enviarFoto();
    return sesion;
  },

  /** Convierte los argumentos que llegan ({$j}, {$u}) en objetos del motor. */
  _argumento(motor, a) {
    if (a && typeof a === 'object') {
      if (a.$j !== undefined) return motor.jugadores[a.$j];
      if (a.$u !== undefined) {
        for (const j of motor.jugadores) {
          const inst = motor.instancia(j, a.$u);
          if (inst) return inst;
        }
        return null;
      }
    }
    return a;
  },

  /** Aplica una intención del invitado. Devuelve true o el motivo del rechazo. */
  ejecutar(sesion, op, args) {
    const m = sesion.motor;
    if (m.terminada) return 'El duelo ya terminó.';
    const fn = typeof op === 'string' && !op.startsWith('_') && Object.hasOwn(this.INTENCIONES, op) && this.INTENCIONES[op];
    if (!fn) return `«${op}» no está disponible en el duelo remoto.`;
    const q = m.jugadores[sesion.idx];
    const ctx = {
      m, q, qi: sesion.idx, sesion,
      rival: m.jugadores[1 - sesion.idx],
      suTurno: m.jugadorActivo === q,
      args: args.map((a) => this._argumento(m, a))
    };
    try {
      const r = fn.call(this, ctx);
      return r === undefined ? true : r;
    } catch (e) {
      console.error('DueloRed:', e);
      return `Error al aplicar «${op}»: ${e.message}`;
    }
  },

  /**
   * Lo que el invitado puede pedir. Cada una devuelve undefined/true si se
   * aplicó, o un texto con el motivo si no. `ctx.args` ya viene traducido.
   */
  INTENCIONES: {
    desplegar({ m, q, suTurno, args: [uid] }) {
      if (!suTurno) return 'No es tu turno.';
      if (m.eleccionPendiente) return 'Hay una pregunta sin responder.';
      if (!q.reserva.some((i) => i.uid === uid)) return 'Ese personaje no está en tu reserva.';
      return m.desplegar(uid) === false ? 'No se puede desplegar ahora.' : true;
    },
    equipar({ m, q, suTurno, args: [accionId, uid] }) {
      if (!suTurno) return 'No es tu turno.';
      if (m.eleccionPendiente) return 'Hay una pregunta sin responder.';
      if (!q.acciones.includes(accionId)) return 'Esa acción no es tuya.';
      if (uid && !q.activos.some((i) => i.uid === uid)) return 'Ese personaje no está en tu posición.';
      return m.equipar(accionId, uid || null) === false ? 'No se puede acoplar ahora.' : true;
    },
    declararAtaque({ m, q, suTurno, args: [atacanteUid, defensorUid] }) {
      if (!suTurno) return 'No es tu turno.';
      if (atacanteUid && !q.activos.some((i) => i.uid === atacanteUid)) return 'Ese atacante no es tuyo.';
      m.declararAtaque(atacanteUid || null, defensorUid || null);
      return m.ataquePendiente || m.terminada ? true : 'No se pudo declarar el ataque.';
    },
    resolverAtaque({ m, q, suTurno }) {
      if (!m.ataquePendiente) return 'No hay ningún ataque declarado.';
      // Lo resuelve quien ataca o quien encaja («Encajar»).
      if (!suTurno && m.jugadorInactivo !== q) return 'No es tu ataque.';
      m.resolverAtaque();
      return true;
    },
    cancelarAtaque({ m, suTurno }) {
      if (!suTurno) return 'No es tu turno.';
      m.cancelarAtaque();
      return true;
    },
    siguienteFase({ m, suTurno }) {
      if (!suTurno) return 'No es tu turno.';
      if (m.eleccionPendiente) return 'Hay una pregunta sin responder.';
      if (m.ataquePendiente) return 'Resuelve o retira el ataque primero.';
      m.siguienteFase();
      return true;
    },
    resolverEleccion({ m, qi, sesion, args: [id] }) {
      const e = m.eleccionPendiente;
      if (!e || e.jugadorIdx !== qi) return 'No tienes ninguna pregunta pendiente.';
      // Las cartas ocultas del anfitrión viajan como «?N»: se traducen aquí.
      const real = sesion.marcas[id] || id;
      return m.resolverEleccion(real) ? true : 'Esa opción no existe.';
    },
    derramar(ctx) { return this.INTENCIONES._sangre(ctx, 'derramar'); },
    pagar(ctx) { return this.INTENCIONES._sangre(ctx, 'pagar'); },
    recuperar(ctx) { return this.INTENCIONES._sangre(ctx, 'recuperar'); },
    _sangre({ m, q, args: [jug, n] }, op) {
      if (jug !== q) return 'Solo puedes mover tu propia sangre.';
      const k = Math.max(1, Math.min(5, Math.floor(Number(n) || 1)));
      m[op](q, k, 'efecto manual');
      m.notificar();
      return true;
    },
    /** Atajos ± de la carta (los de Herramientas, sobre tus personajes). */
    modificar({ m, q, args: [inst, cambio] }) {
      if (!inst || !q.activos.includes(inst)) return 'Solo puedes ajustar a tus personajes en posición.';
      const lim = (x) => Math.max(-5, Math.min(5, Math.trunc(Number(x) || 0)));
      window.Game.Manual.modificar(m, inst, { ataque: lim(cambio && cambio.ataque), defensa: lim(cambio && cambio.defensa) }, 'manual');
      m.notificar();
      return true;
    },
    limpiarModificadores({ m, q, args: [inst] }) {
      if (!inst || !q.activos.includes(inst)) return 'Solo puedes limpiar a tus personajes en posición.';
      window.Game.Manual.limpiarModificadores(m, inst, 'manual');
      m.notificar();
      return true;
    },
    /** El dado de la mesa (herramienta, no carta). */
    dado({ m, q }) {
      window.Game.Manual.dado(m, 0, `tirada de ${q.nombre}`);
      m.notificar();
      return true;
    },
    /**
     * Una carta de acción tuya automatizada, en su momento (lo que en tu PC
     * hace `autoAplicar`): el anfitrión la aplica con el mismo código que la
     * IA. Una vez por carta y momento, para que dos fotos seguidas no la
     * apliquen dos veces.
     */
    aplicar({ m, q, rival, sesion, args: [inst, cartaId] }) {
      const AI = window.Game.AccionesIA;
      if (!inst || !q.activos.includes(inst) || inst.accion !== cartaId) return 'Esa acción no está acoplada a tu personaje.';
      if (!AI.sabeUsar(cartaId) || m.accionesNegadas) return 'Esa carta no se aplica sola.';
      const clave = `${m.numeroTurno}:${inst.uid}:${cartaId}:${m.ataquePendiente ? m.ataquePendiente.atacanteUid : '-'}`;
      if (sesion.aplicadas.has(clave)) return 'Ya se aplicó.';
      sesion.aplicadas.add(clave);
      const contexto = { defensor: rival };
      if (m.ataquePendiente && m.jugadorActivo !== q) {
        const imp = m.implicadosAtaque();
        Object.assign(contexto, { atacanteInst: imp && imp.atacante, atacanteJugador: m.jugadorActivo, atacante: m.jugadorActivo });
      }
      AI.aplicarManual(m, q, inst, contexto);
      m.notificar();
      return true;
    }
  },

  /* =============================== Invitado ============================== */

  /**
   * El motor espejo del invitado. `alCambiar(espejo)` se llama con cada foto
   * nueva (es el mismo objeto siempre). Devuelve el espejo; `espejo.soltar()`
   * deja de escuchar.
   */
  invitado({ red, alCambiar = () => {} }) {
    const espejo = Object.create(this._prototipoEspejo());
    espejo._red = { red, n: 0, v: 0, esperando: new Map() };
    espejo.esEspejo = true;
    espejo.yo = 1;
    const soltar = red.on('mensaje', (d) => {
      if (!d) return;
      if (d.tipo === 'estado') {
        if (d.v <= espejo._red.v) return;
        espejo._red.v = d.v;
        window.Game.Sincro.aplicar(espejo, d.foto);
        espejo.yo = d.yo;
        espejo.listo = true;
        alCambiar(espejo);
      } else if (d.tipo === 'resultado') {
        const r = espejo._red.esperando.get(d.n);
        if (r) { espejo._red.esperando.delete(d.n); r({ ok: d.ok, motivo: d.motivo }); }
      }
    });
    // Tras una reconexión se pide la foto otra vez; lo que quedó en el aire
    // durante el corte se da por no hecho (el anfitrión nunca lo recibió).
    const soltarEstado = red.on('estado', (estado) => {
      if (estado === 'conectado') {
        red.enviar({ tipo: 'listo' });
        return;
      }
      for (const [n, r] of espejo._red.esperando) {
        espejo._red.esperando.delete(n);
        r({ ok: false, motivo: 'Se cortó la conexión.' });
      }
    });
    espejo.soltar = () => { soltar(); soltarEstado(); };
    red.enviar({ tipo: 'listo' });
    return espejo;
  },

  _prototipoEspejo() {
    if (this._proto) return this._proto;
    const TE = window.Game.TurnEngine.prototype;
    const proto = Object.create(TE);
    for (const nombre of Object.getOwnPropertyNames(TE)) {
      if (nombre === 'constructor' || this.LECTURA.has(nombre)) continue;
      const d = Object.getOwnPropertyDescriptor(TE, nombre);
      if (d.get || typeof d.value !== 'function') continue;
      proto[nombre] = function (...args) { return this.intento(nombre, ...args); };
    }
    // Repintar lo hace la foto que llega, no quien pide.
    proto.notificar = function () {};
    proto.log = function () {};
    // La previsión, sin recalcular pasivos: ya vienen calculados en la foto
    // (y las cartas ocultas del rival no se pueden mirar).
    proto.previsionAtaque = function () {
      const imp = this.implicadosAtaque();
      if (!imp || !imp.atacante) return null;
      return window.Game.Combat.resolver(imp.atacante, imp.defensor);
    };
    /**
     * Envía una intención al anfitrión. Los jugadores viajan como {$j} y las
     * instancias como {$u}. Devuelve una promesa con { ok, motivo }.
     */
    proto.intento = function (op, ...args) {
      const red = this._red;
      const n = ++red.n;
      const fuera = args.map((a) => {
        if (a && typeof a === 'object') {
          const j = this.jugadores ? this.jugadores.indexOf(a) : -1;
          if (j >= 0) return { $j: j };
          if (a.uid) return { $u: a.uid };
        }
        return a;
      });
      return new Promise((resolver) => {
        red.esperando.set(n, resolver);
        if (!red.red.enviar({ tipo: 'intento', n, op, args: fuera })) {
          red.esperando.delete(n);
          resolver({ ok: false, motivo: 'Sin conexión con el anfitrión.' });
        }
      });
    };
    this._proto = proto;
    return proto;
  }
};
