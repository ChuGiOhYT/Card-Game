window.Game = window.Game || {};
window.Game.Screens = window.Game.Screens || {};

/**
 * Duelo remoto · tanda 1: crear sala / unirse por código y comprobar que el
 * canal funciona (estado, ping y un chat de prueba). El duelo en sí llega en
 * las tandas 2-4; la conexión vive en core/red.js.
 *
 * La conexión NO se cierra al salir de esta pantalla si va a empezar el duelo
 * (`this.mantener`): el Router destruye la pantalla anterior al navegar.
 */
window.Game.Screens.remoto = {
  render(contenedor) {
    const R = window.Game.Red;
    const S = window.Game.State;
    this.contenedor = contenedor;
    this.mantener = false;
    this.razaRival = null;
    this.equipoRival = null;
    // Se recuerda lo elegido al volver de una partida (revancha / sala).
    if (!window.Game.RAZAS_EQUIPO.includes(this.raza)) {
      this.raza = window.Game.RACE_ORDER.includes(S.perfil.razaSeleccionada) ? S.perfil.razaSeleccionada : window.Game.RACE_ORDER[0];
    }

    contenedor.innerHTML = `
      <div class="pantalla remoto">
        <header class="pantalla-cabecera">
          <button class="btn-volver" id="btn-volver" aria-label="Volver"><svg class="volver-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><span class="volver-txt">Volver</span></button>
          <h2 class="pantalla-titulo">Duelo remoto</h2>
          <p class="pantalla-sub">Uno contra uno, de PC a PC. Uno crea la sala y el otro entra con su código.</p>
        </header>

        <div class="remoto-cuerpo">
          <label class="remoto-nombre">
            <span>Tu nombre</span>
            <input id="remoto-nombre" maxlength="20" value="${this.escapar(S.perfil.nombreRemoto || '')}" placeholder="Jugador">
          </label>

          <div class="remoto-opciones" id="remoto-opciones">
            <section class="remoto-caja">
              <h3>Crear sala</h3>
              <p>Te damos un código para que se lo pases a tu rival.</p>
              <button class="btn-primario" id="btn-crear">Crear sala</button>
            </section>
            <section class="remoto-caja">
              <h3>Unirse</h3>
              <p>Escribe el código que te pasó quien creó la sala.</p>
              <div class="remoto-unirse">
                <input id="remoto-codigo" maxlength="7" placeholder="K7Q-2MX" autocomplete="off" spellcheck="false">
                <button class="btn-primario" id="btn-unirse">Entrar</button>
              </div>
            </section>
          </div>

          <details class="remoto-avanzado" id="remoto-avanzado">
            <summary>Opciones de conexión</summary>
            <p>Si no conseguís conectaros (pasa con algunas redes, sobre todo internet móvil), podéis usar
              un relé TURN: un servidor que pasa los mensajes cuando la conexión directa no es posible.
              Los dos tenéis que poner el mismo. Alternativa sin relé: una red virtual como Radmin VPN o Tailscale.</p>
            <label><span>Dirección</span><input id="rele-url" placeholder="turn:servidor:3478" autocomplete="off" spellcheck="false"></label>
            <label><span>Usuario</span><input id="rele-usuario" autocomplete="off" spellcheck="false"></label>
            <label><span>Clave</span><input id="rele-clave" type="password" autocomplete="off"></label>
            <div class="remoto-avanzado-pie">
              <span id="rele-estado"></span>
              <button class="btn-secundario" id="btn-rele">Guardar</button>
            </div>
          </details>

          <section class="remoto-sala oculto" id="remoto-sala">
            <div class="remoto-codigo-grande">
              <span class="remoto-codigo-rotulo">Código de la sala</span>
              <strong id="remoto-codigo-texto"></strong>
              <button class="btn-secundario" id="btn-copiar">Copiar</button>
            </div>
            <div class="remoto-estado" id="remoto-estado">
              <span class="remoto-luz"></span>
              <span id="remoto-estado-texto"></span>
              <span class="remoto-ping" id="remoto-ping"></span>
            </div>
            <div class="remoto-rival" id="remoto-rival"></div>

            <div class="remoto-chat oculto" id="remoto-chat">
              <div class="remoto-chat-lineas" id="remoto-chat-lineas"></div>
              <form class="remoto-chat-form" id="remoto-chat-form">
                <input id="remoto-chat-texto" maxlength="160" placeholder="Escribe a tu rival…" autocomplete="off">
                <button class="btn-secundario" type="submit">Enviar</button>
              </form>
            </div>

            <div class="remoto-lobby oculto" id="remoto-lobby">
              <span class="remoto-codigo-rotulo">Tu estirpe</span>
              <div class="remoto-razas" id="remoto-razas"></div>
              <label class="remoto-equipo">
                <span>Equipo</span>
                <select id="remoto-equipo"></select>
              </label>
              <p class="remoto-nota" id="remoto-lobby-nota"></p>
              <button class="btn-primario" id="btn-empezar" disabled>Comenzar duelo</button>
            </div>
            <button class="btn-secundario" id="btn-salir-sala">Salir de la sala</button>
          </section>
        </div>
      </div>`;

    const $ = (s) => contenedor.querySelector(s);
    const nombre = () => {
      const n = $('#remoto-nombre').value.trim().slice(0, 20) || 'Jugador';
      if (S.perfil.nombreRemoto !== n) { S.perfil.nombreRemoto = n; S.guardar(); }
      return n;
    };

    $('#btn-volver').addEventListener('click', () => window.Game.Router.ir('mainMenu'));
    $('#btn-crear').addEventListener('click', () => R.crearSala({ nombre: nombre() }));
    const unirse = () => R.unirse($('#remoto-codigo').value, { nombre: nombre() });
    $('#btn-unirse').addEventListener('click', unirse);
    $('#remoto-codigo').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') unirse(); });
    // Se escribe en mayúsculas y con el guion solo: «k7q2mx» → «K7Q-2MX».
    $('#remoto-codigo').addEventListener('input', (ev) => {
      const c = R.normalizar(ev.target.value).slice(0, 6);
      ev.target.value = c.length > 3 ? `${c.slice(0, 3)}-${c.slice(3)}` : c;
    });
    $('#btn-copiar').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(R.mostrarCodigo());
        $('#btn-copiar').textContent = 'Copiado ✓';
      } catch {
        $('#btn-copiar').textContent = 'Cópialo a mano';
      }
      setTimeout(() => { const b = $('#btn-copiar'); if (b) b.textContent = 'Copiar'; }, 1800);
    });
    $('#btn-salir-sala').addEventListener('click', () => R.cerrar());
    $('#remoto-chat-form').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const campo = $('#remoto-chat-texto');
      const texto = campo.value.trim();
      if (!texto) return;
      if (R.enviar({ tipo: 'chat', texto })) {
        this.lineaChat(R.nombre, texto, true);
        campo.value = '';
      }
    });

    this.soltar = [
      R.on('estado', (estado) => {
        if (estado !== 'conectado') { this.razaRival = null; this.equipoRival = null; }
        this.pintarEstado();
      }),
      R.on('ping', (ms) => { const p = $('#remoto-ping'); if (p) p.textContent = `${ms} ms`; }),
      R.on('rival', () => { this.enviarEleccion(); this.pintarEstado(); }),
      R.on('mensaje', (d) => {
        if (!d) return;
        if (d.tipo === 'chat') this.lineaChat(R.rival ? R.rival.nombre : 'Rival', String(d.texto).slice(0, 160), false);
        if (d.tipo === 'lobby') this.recibirEleccion(d);
        if (d.tipo === 'empezar' && R.rol === 'invitado') this.empezarInvitado(d);
      })
    ];
    $('#btn-empezar').addEventListener('click', () => this.empezarAnfitrion());
    $('#remoto-equipo').addEventListener('change', (ev) => {
      this.equipoElegido = ev.target.value;
      this.enviarEleccion();
    });

    // Relé TURN guardado en el perfil (solo en este PC).
    const rele = S.perfil.releRemoto || null;
    R.ponerRele(rele);
    if (rele) {
      $('#rele-url').value = rele.url || '';
      $('#rele-usuario').value = rele.usuario || '';
      $('#rele-clave').value = rele.clave || '';
    }
    const estadoRele = () => { $('#rele-estado').textContent = R.rele ? `Relé activo: ${R.rele.url}` : 'Sin relé: conexión directa.'; };
    estadoRele();
    $('#btn-rele').addEventListener('click', () => {
      const url = $('#rele-url').value.trim();
      if (url && !/^turns?:/i.test(url)) {
        $('#rele-estado').textContent = 'La dirección empieza por turn: o turns:';
        return;
      }
      S.perfil.releRemoto = url ? { url, usuario: $('#rele-usuario').value.trim(), clave: $('#rele-clave').value } : null;
      S.guardar();
      R.ponerRele(S.perfil.releRemoto);
      estadoRele();
    });

    if (this.equipoElegido === undefined) this.equipoElegido = null;
    this.pintarRazas();
    this.pintarEstado();
    // Volviendo de una partida con la sala abierta: se vuelve a decir qué
    // juega cada uno (y se le pide al otro lo suyo).
    if (R.conectado()) this.enviarEleccion(true);
    window.Game.Audio.ponerMusica('inicio');
  },

  /* ----------------------- Sala de espera (tanda 3) ---------------------- */

  /** Las cuatro estirpes jugables, como botones con su color y su emblema. */
  pintarRazas() {
    const caja = this.contenedor && this.contenedor.querySelector('#remoto-razas');
    if (!caja) return;
    caja.innerHTML = window.Game.RAZAS_EQUIPO.map((id) => {
      const r = window.Game.RACES[id];
      return `<button type="button" class="remoto-raza ${id === this.raza ? 'activa' : ''}" data-raza="${id}"
                style="--raza-primario:${r.colorPrimario}">
          <span class="remoto-raza-sigil">${window.Game.emblema(r)}</span><span>${r.nombre}</span>
        </button>`;
    }).join('');
    caja.querySelectorAll('[data-raza]').forEach((b) => b.addEventListener('click', () => {
      if (this.raza !== b.dataset.raza) this.equipoElegido = null;
      this.raza = b.dataset.raza;
      this.pintarRazas();
      this.enviarEleccion();
    }));
    this.pintarEquipos();
  },

  /** Los equipos guardados de esa estirpe (constructor) y el predeterminado. */
  equiposDeRaza() {
    return window.Game.State.perfil.equiposGuardados
      .map((e, i) => ({ ...e, i }))
      .filter((e) => e.raza === this.raza);
  },

  pintarEquipos() {
    const sel = this.contenedor && this.contenedor.querySelector('#remoto-equipo');
    if (!sel) return;
    const guardados = this.equiposDeRaza();
    // Por defecto, el último guardado de la estirpe (como contra la IA).
    if (this.equipoElegido === null) this.equipoElegido = guardados.length ? String(guardados[guardados.length - 1].i) : 'base';
    sel.innerHTML = [
      ...guardados.map((e) => `<option value="${e.i}">${this.escapar(e.nombre || 'Equipo sin nombre')}</option>`),
      '<option value="base">Equipo predeterminado</option>'
    ].join('');
    sel.value = this.equipoElegido;
  },

  /** Tu estirpe y el equipo elegido (uno guardado de esa estirpe, o el predeterminado). */
  miEquipo() {
    const e = window.Game.State.perfil.equiposGuardados[Number(this.equipoElegido)];
    if (this.equipoElegido !== 'base' && e && e.raza === this.raza) {
      return { personajes: [...e.personajes], acciones: [...e.acciones] };
    }
    return window.Game.Team.equipoPredeterminado(this.raza);
  },

  enviarEleccion(pide = false) {
    const R = window.Game.Red;
    if (!R.conectado()) return;
    R.enviar({ tipo: 'lobby', raza: this.raza, equipo: this.miEquipo(), pide });
  },

  /** Lo que eligió el rival. El anfitrión comprueba que el equipo exista. */
  recibirEleccion(d) {
    if (!window.Game.RACES[d.raza] || !window.Game.RAZAS_EQUIPO.includes(d.raza)) return;
    this.razaRival = d.raza;
    this.equipoRival = this.equipoValido(d.equipo) ? d.equipo : window.Game.Team.equipoPredeterminado(d.raza);
    // Acaba de llegar a la sala y pregunta: se le contesta con lo nuestro.
    if (d.pide) this.enviarEleccion(false);
    this.pintarEstado();
  },

  equipoValido(e) {
    const C = window.Game.CHARACTERS_BY_ID, A = window.Game.ACTIONS_BY_ID;
    return !!e && Array.isArray(e.personajes) && Array.isArray(e.acciones)
      && e.personajes.length >= 1 && e.personajes.length <= 6 && e.acciones.length <= 10
      && e.personajes.every((id) => C[id]) && e.acciones.every((id) => A[id]);
  },

  empezarAnfitrion() {
    const R = window.Game.Red;
    if (R.rol !== 'anfitrion' || !R.conectado() || !this.razaRival) return;
    R.enviar({ tipo: 'empezar' });
    this.mantener = true;
    window.Game.Router.ir('partida', {
      modo: 'remoto', rol: 'anfitrion', abre: 0,
      nombre: R.nombre, raza: this.raza, equipo: this.miEquipo(),
      nombreRival: R.rival ? R.rival.nombre : 'Rival', razaRival: this.razaRival, equipoRival: this.equipoRival
    });
  },

  empezarInvitado() {
    this.mantener = true;
    window.Game.Router.ir('partida', { modo: 'remoto', rol: 'invitado', raza: this.raza });
  },

  TEXTO_ESTADO: {
    senal: 'Conectando con el servidor de salas…',
    esperando: 'Esperando a tu rival…',
    negociando: 'Conectando con tu rival…',
    reconectando: 'Reconectando…',
    conectado: 'Conectado',
    error: 'No se pudo conectar',
    cerrado: 'Desconectado'
  },

  pintarEstado() {
    const c = this.contenedor;
    if (!c || !c.querySelector('#remoto-sala')) return;
    const R = window.Game.Red;
    const enSala = R.estado !== 'apagado';
    c.querySelector('#remoto-opciones').classList.toggle('oculto', enSala && R.estado !== 'error');
    c.querySelector('#remoto-sala').classList.toggle('oculto', !enSala);
    c.querySelector('#remoto-nombre').disabled = enSala && R.estado !== 'error' && R.estado !== 'cerrado';
    c.querySelector('#remoto-avanzado').classList.toggle('oculto', enSala && R.estado !== 'error');
    if (!enSala) return;

    const sala = c.querySelector('#remoto-sala');
    sala.dataset.estado = R.estado;
    c.querySelector('.remoto-codigo-grande').classList.toggle('oculto', R.rol !== 'anfitrion' || !R.codigo || R.estado !== 'esperando');
    c.querySelector('#remoto-codigo-texto').textContent = R.mostrarCodigo();
    const base = this.TEXTO_ESTADO[R.estado] || '';
    const det = R.detalle && R.detalle !== base && R.detalle !== 'Conectado.' ? ` · ${R.detalle}` : '';
    c.querySelector('#remoto-estado-texto').textContent = base + det;
    if (!R.conectado()) c.querySelector('#remoto-ping').textContent = '';
    c.querySelector('#remoto-rival').innerHTML = R.conectado() && R.rival
      ? `Contra <strong>${this.escapar(R.rival.nombre)}</strong>`
      : '';
    c.querySelector('#remoto-chat').classList.toggle('oculto', !R.conectado());
    c.querySelector('#remoto-lobby').classList.toggle('oculto', !R.conectado());
    const btn = c.querySelector('#btn-empezar');
    btn.classList.toggle('oculto', R.rol !== 'anfitrion');
    btn.disabled = !this.razaRival;
    const rr = this.razaRival && window.Game.RACES[this.razaRival];
    const nombreRival = R.rival ? this.escapar(R.rival.nombre) : 'Tu rival';
    c.querySelector('#remoto-lobby-nota').innerHTML = !rr
      ? `${nombreRival} está eligiendo estirpe…`
      : `${nombreRival} juega con <strong>${rr.nombre}</strong>. ${R.rol === 'anfitrion'
        ? 'Cuando quieras, empieza el duelo (abres tú).'
        : 'El duelo empieza cuando lo diga quien creó la sala.'}`;
    c.querySelector('#btn-salir-sala').textContent = R.estado === 'error' || R.estado === 'cerrado' ? 'Volver a empezar' : 'Salir de la sala';
  },

  lineaChat(quien, texto, mio) {
    const caja = this.contenedor && this.contenedor.querySelector('#remoto-chat-lineas');
    if (!caja) return;
    const p = document.createElement('p');
    p.className = mio ? 'mio' : 'suyo';
    p.innerHTML = `<strong>${this.escapar(quien)}:</strong> `;
    p.appendChild(document.createTextNode(texto));
    caja.appendChild(p);
    caja.scrollTop = caja.scrollHeight;
  },

  escapar(t) {
    return String(t).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  },

  destruir() {
    (this.soltar || []).forEach((f) => f());
    this.soltar = [];
    if (!this.mantener) window.Game.Red.cerrar({ silencio: true });
    this.contenedor = null;
  }
};
