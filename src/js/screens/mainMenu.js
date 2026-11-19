window.Game = window.Game || {};

window.Game.Screens = window.Game.Screens || {};

window.Game.Screens.mainMenu = {
  /** El emblema hexagonal del logo registrado (INAPI), sutil tras el título. */
  EMBLEMA: `<svg class="menu-emblema" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <linearGradient id="em-oro" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e3b0"/><stop offset="1" stop-color="#8a6a2a"/></linearGradient>
              <radialGradient id="em-violeta" cx="35%" cy="30%"><stop offset="0" stop-color="#f2a6e6"/><stop offset=".45" stop-color="#c04aae"/><stop offset="1" stop-color="#3a1250"/></radialGradient>
              <radialGradient id="em-cian" cx="35%" cy="30%"><stop offset="0" stop-color="#c9f6ff"/><stop offset=".45" stop-color="#3cc3d4"/><stop offset="1" stop-color="#16305a"/></radialGradient>
              <radialGradient id="em-nebula"><stop offset="0" stop-color="#7b2d96" stop-opacity=".55"/><stop offset=".6" stop-color="#3cc3d4" stop-opacity=".12"/><stop offset="1" stop-color="#0a0a1d" stop-opacity="0"/></radialGradient>
            </defs>
            <circle class="halo" cx="100" cy="100" r="78" fill="url(#em-nebula)"/>
            <polygon points="100.0,12.0 176.2,56.0 176.2,144.0 100.0,188.0 23.8,144.0 23.8,56.0" fill="none" stroke="url(#em-oro)" stroke-width="1.4"/>
            <polygon points="100.0,20.0 169.3,60.0 169.3,140.0 100.0,180.0 30.7,140.0 30.7,60.0" fill="none" stroke="#d8b968" stroke-opacity=".35" stroke-width=".8"/>
            <path d="M100 58 L132 100 L100 142 L68 100 Z" fill="none" stroke="#3cc3d4" stroke-opacity=".55" stroke-width="1"/>
            <circle cx="100" cy="100" r="5" fill="#fff6dc"/>
            <circle cx="100" cy="40" r="9" fill="url(#em-violeta)"/><circle cx="55" cy="72" r="6" fill="url(#em-cian)"/><circle cx="145" cy="72" r="6" fill="url(#em-violeta)"/><circle cx="50" cy="128" r="6" fill="url(#em-violeta)"/><circle cx="150" cy="128" r="6" fill="url(#em-cian)"/><circle cx="100" cy="160" r="8" fill="url(#em-cian)"/><circle cx="100.0" cy="12.0" r="7" fill="#0a0a1d" stroke="url(#em-oro)" stroke-width="1.6"/><circle cx="100.0" cy="12.0" r="2.4" fill="#d8b968"/><circle cx="176.2" cy="56.0" r="7" fill="#0a0a1d" stroke="url(#em-oro)" stroke-width="1.6"/><circle cx="176.2" cy="56.0" r="2.4" fill="#d8b968"/><circle cx="176.2" cy="144.0" r="7" fill="#0a0a1d" stroke="url(#em-oro)" stroke-width="1.6"/><circle cx="176.2" cy="144.0" r="2.4" fill="#d8b968"/><circle cx="100.0" cy="188.0" r="7" fill="#0a0a1d" stroke="url(#em-oro)" stroke-width="1.6"/><circle cx="100.0" cy="188.0" r="2.4" fill="#d8b968"/><circle cx="23.8" cy="144.0" r="7" fill="#0a0a1d" stroke="url(#em-oro)" stroke-width="1.6"/><circle cx="23.8" cy="144.0" r="2.4" fill="#d8b968"/><circle cx="23.8" cy="56.0" r="7" fill="#0a0a1d" stroke="url(#em-oro)" stroke-width="1.6"/><circle cx="23.8" cy="56.0" r="2.4" fill="#d8b968"/>
          </svg>`,

  render(contenedor) {
    const partidas = window.Game.State.perfil.partidasJugadas;
    const equipos = window.Game.State.perfil.equiposGuardados.length;

    // El modo historia hace de tutorial: hasta reunir los cuatro cristales y
    // leer la historia oculta, el resto del juego permanece cerrado.
    const S = window.Game.State;
    const abierto = S.desbloqueado();
    const gemas = S.gemas().length;
    const totalGemas = window.Game.gemasTotales().length;

    // Decir cuánto falta motiva más que un «bloqueado» sin más. Con los cuatro
    // cristales ya en la mano, lo que falta es leer la historia, y conviene
    // decirlo así: si no, parece que el juego se ha atascado.
    const queFalta = S.historiaFinalDesbloqueada()
      ? 'Lee la historia oculta en el modo historia'
      : `Reúne los cuatro cristales de los Eternals` +
        ` <span class="candado-avance">${gemas}/${totalGemas}</span>`;
    const candado = abierto
      ? ''
      : `<span class="menu-btn-candado">🔒 ${queFalta}</span>`;

    // Cada modo es una CARTA con su arte, en abanico. Las cerradas llevan
    // cadenas y el candado con lo que falta; el arte va en estilo en línea
    // (un url en una variable CSS se resolvería contra la hoja y no cargaría).
    const carta = ({ destino, titulo, sub, fondo, figura, extra = '', cerrada = false, clase = '' }) => `
      <button class="menu-carta ${clase} ${cerrada ? 'bloqueado' : ''}" data-destino="${destino}"
              ${cerrada ? 'aria-disabled="true"' : ''}>
        <span class="mc-arte" ${fondo ? `style="background-image:url('${fondo}')"` : ''}></span>
        ${figura ? `<img class="mc-figura" src="${figura}" alt="" draggable="false">` : ''}
        ${extra}
        <span class="mc-texto">
          <span class="menu-btn-titulo">${titulo}</span>
          <span class="menu-btn-sub">${sub}</span>
          ${cerrada ? candado : ''}
        </span>
        ${cerrada ? '<span class="mc-cadenas" aria-hidden="true"></span><span class="mc-cadenas mc-cadenas-x" aria-hidden="true"></span><span class="mc-candado" aria-hidden="true">🔒</span>' : ''}
      </button>`;

    const cartas = [
      carta({
        destino: 'historia', titulo: 'Modo Historia', sub: 'Elige tu estirpe y recorre su caída',
        fondo: 'assets/fondos/desterrado.jpg', figura: 'assets/personajes-flotantes/des_annia-flotante.png'
      }),
      carta({
        destino: 'solo', titulo: 'Modo Solo', sub: 'Partida rápida contra la máquina',
        fondo: 'assets/fondos/reanimado.jpg', figura: 'assets/personajes-flotantes/cri_uldar-flotante.png',
        cerrada: !abierto
      }),
      carta({
        destino: 'constructor', titulo: 'Crea tu Equipo', sub: '5 personajes y 8 acciones',
        fondo: 'assets/fondos/lunaria.jpg', cerrada: !abierto,
        extra: `<span class="mc-abanico" aria-hidden="true">
          <img src="assets/cartas/desterrado-axel.jpg" alt="">
          <img src="assets/cartas/lunaria-sadash.jpg" alt="">
          <img src="assets/cartas/oxitron-krag.jpg" alt="">
        </span>`
      }),
      // Duelo remoto 1 contra 1, de PC a PC (core/red.js). Abierto siempre:
      // no depende de la campaña.
      carta({
        destino: 'remoto', titulo: 'Duelo remoto', sub: 'Uno contra uno con un amigo',
        fondo: 'assets/fondos/oxitron.jpg', clase: 'menu-carta-remoto',
        extra: `<span class="mc-abanico mc-duelo" aria-hidden="true">
          <img src="assets/cartas/reverso.webp" alt="">
          <img src="assets/cartas/reverso.webp" alt="">
        </span>`
      }),
      // Fuera del juego: abre la web en el navegador del sistema. Nunca se
      // bloquea, porque no depende del progreso de la campaña. Lleva el
      // reverso oficial: es el de las partidas contra jugadores.
      carta({
        destino: 'online', titulo: 'Juega online', sub: 'TCG Arena · aeternumtcgchile.fun ↗',
        fondo: 'assets/cartas/reverso.webp', clase: 'menu-carta-externa'
      })
    ];

    contenedor.innerHTML = `
      <div class="menu-principal">
        <div class="menu-fondo" aria-hidden="true">
          <video id="menu-video" autoplay muted loop playsinline
                 preload="auto" disablepictureinpicture tabindex="-1">
            <source src="assets/video/menu-background.mp4" type="video/mp4">
          </video>
          <div class="menu-fondo-velo"></div>
        </div>
        <canvas class="menu-particulas" id="menu-particulas" aria-hidden="true"></canvas>

        <div class="menu-marca">
          ${this.EMBLEMA}
          <h1 class="menu-titulo" aria-label="AETERNUM">AeternuM</h1>
          <div class="menu-filete"></div>
          <p class="menu-lema">Juego de mesa y aventura de rol</p>
        </div>

        <nav class="menu-cartas">${cartas.join('')}</nav>

        <footer class="menu-pie">
          <span>${partidas} partida${partidas === 1 ? '' : 's'}</span>
          <span class="menu-pie-sep">·</span>
          <span>${equipos} equipo${equipos === 1 ? '' : 's'} guardado${equipos === 1 ? '' : 's'}</span>
          <span class="menu-pie-iconos">
            <button class="menu-icono" id="btn-sonido" title="Sonido" aria-label="Sonido">🔊</button>
            ${
              S.hayAventuraQueReiniciar()
                ? `<button class="menu-icono" id="btn-reiniciar-aventura" title="Reiniciar aventura"
                           aria-label="Reiniciar aventura">↺</button>`
                : ''
            }
            <button class="menu-icono menu-icono-salir" id="btn-salir" title="Salir" aria-label="Salir">⏻</button>
          </span>
        </footer>
      </div>
    `;

    // Las cartas, en abanico: cada una girada desde abajo según su sitio.
    const lista = [...contenedor.querySelectorAll('.menu-carta')];
    const medio = (lista.length - 1) / 2;
    lista.forEach((el, i) => {
      const d = i - medio;
      el.style.setProperty('--giro', `${(d * 5).toFixed(1)}deg`);
      el.style.setProperty('--alto', `${(Math.abs(d) * Math.abs(d) * 7).toFixed(1)}px`);
    });

    this.arrancarAmbiente(contenedor);

    contenedor.querySelectorAll('.menu-carta').forEach((btn) => {
      btn.addEventListener('click', () => {
        const destino = btn.dataset.destino;

        if (btn.classList.contains('bloqueado')) {
          // En vez de no hacer nada, se explica y se ofrece el camino.
          btn.classList.remove('sacudir');
          void btn.offsetWidth; // reinicia la animación
          btn.classList.add('sacudir');
          return;
        }

        // Este no navega a ninguna pantalla: sale de la app. Se atiende antes
        // de tocar `sesion.modo`, y con retorno propio, porque el `else` final
        // de esta cadena lleva al constructor y se lo comería.
        if (destino === 'online') {
          if (window.gameAPI && window.gameAPI.abrirArena) {
            window.gameAPI.abrirArena().then((res) => {
              if (res && res.ok === false) this.avisarEnlaceFallido(btn);
            });
          } else {
            // Fuera de Electron no hay puente: mejor decirlo que no hacer nada.
            this.avisarEnlaceFallido(btn);
          }
          return;
        }

        window.Game.State.sesion.modo = destino;

        if (destino === 'historia') {
          window.Game.Router.ir('seleccionRaza', { modo: 'historia' });
        } else if (destino === 'remoto') {
          window.Game.Router.ir('remoto');
        } else if (destino === 'solo') {
          window.Game.Router.ir('modoSolo');
        } else {
          window.Game.Router.ir('constructor');
        }
      });
    });

    contenedor.querySelector('#btn-sonido').addEventListener('click', () => {
      window.Game.Mezclador.abrir();
    });

    contenedor.querySelector('#btn-salir').addEventListener('click', () => {
      if (window.gameAPI) window.gameAPI.quit();
    });

    // Irreversible, así que pasa por la confirmación genérica antes de tocar
    // nada. Solo existe el botón cuando hay algo que perder (ver el `if` de
    // arriba), pero el manejador puede faltar si `hayAventuraQueReiniciar()`
    // lo ocultó, de ahí el `?.`.
    contenedor.querySelector('#btn-reiniciar-aventura')?.addEventListener('click', async () => {
      const ok = await window.Game.Confirmar.preguntar({
        titulo: 'Reiniciar la aventura',
        texto:
          'Se borra el progreso del modo historia: las etapas superadas, ' +
          'los cristales de los Eternals y la historia oculta. Los mercenarios ' +
          'y los modos que hayas desbloqueado volverán a pedir la campaña ' +
          'entera. Tus equipos guardados y los ajustes de sonido NO se tocan. ' +
          'Esto no se puede deshacer.',
        textoOk: 'Reiniciar'
      });
      if (!ok) return;
      window.Game.State.reiniciarAventura();
      // Repinta para que el candado y este mismo botón reflejen el reinicio;
      // si no, el menú seguiría enseñando el estado de antes de borrar.
      this.render(contenedor);
    });

    // El vídeo es decorativo. Lo arranca el atributo `autoplay`; aquí solo se
    // insiste si sigue parado cuando ya hay datos.
    //
    // Ojo: llamar a play() nada más pintar lo ROMPE. La promesa se aborta
    // porque el <source> aún no está resuelto y, de paso, apaga la bandera de
    // autoplay del elemento, así que el vídeo se queda pausado para siempre.
    // Por eso se espera a `canplay` y solo se actúa si hace falta.
    const video = contenedor.querySelector('#menu-video');
    if (video) {
      const asegurarReproduccion = () => {
        if (!video.paused) return;
        const intento = video.play();
        if (intento) intento.catch(() => {});
      };
      video.addEventListener('canplay', asegurarReproduccion, { once: true });
      if (video.readyState >= 3) asegurarReproduccion();
    }

    window.Game.Audio.ponerMusica('inicio');
  },

  /**
   * Si el navegador no se abre, el botón lo dice en su propio subtítulo con la
   * dirección a mano. Un clic que no hace nada visible parece la app rota.
   */
  avisarEnlaceFallido(btn) {
    const sub = btn.querySelector('.menu-btn-sub');
    if (!sub) return;
    if (!sub.dataset.original) sub.dataset.original = sub.innerHTML;
    sub.textContent = 'No se pudo abrir el navegador · entra a aeternumtcgchile.fun';
    btn.classList.add('menu-btn-error');
    setTimeout(() => {
      sub.innerHTML = sub.dataset.original;
      btn.classList.remove('menu-btn-error');
    }, 6000);
  },

  /**
   * Luciérnagas en un lienzo y un leve movimiento de profundidad que sigue al
   * ratón: el fondo se desplaza hacia un lado y las luciérnagas y el título
   * hacia el otro. Todo se suelta en destruir(). Quien pidió menos movimiento
   * no recibe ninguna de las dos cosas.
   */
  arrancarAmbiente(contenedor) {
    this.pararAmbiente();
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const raiz = contenedor.querySelector('.menu-principal');
    const lienzo = contenedor.querySelector('#menu-particulas');
    const ctx = lienzo.getContext('2d');
    const ajustar = () => {
      lienzo.width = lienzo.clientWidth;
      lienzo.height = lienzo.clientHeight;
    };
    ajustar();
    const N = 46;
    const luces = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      r: 0.8 + Math.random() * 1.8,
      vx: (Math.random() - 0.5) * 0.00018, vy: -0.00008 - Math.random() * 0.00018,
      fase: Math.random() * Math.PI * 2, ritmo: 0.6 + Math.random() * 1.2
    }));
    const dibujar = (t) => {
      const w = lienzo.width, h = lienzo.height;
      ctx.clearRect(0, 0, w, h);
      for (const l of luces) {
        l.x += l.vx * 16; l.y += l.vy * 16;
        if (l.y < -0.02) { l.y = 1.02; l.x = Math.random(); }
        if (l.x < -0.02) l.x = 1.02; else if (l.x > 1.02) l.x = -0.02;
        const brillo = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t / 1000 * l.ritmo + l.fase));
        const x = l.x * w, y = l.y * h;
        const g = ctx.createRadialGradient(x, y, 0, x, y, l.r * 6);
        g.addColorStop(0, `rgba(255, 226, 150, ${0.85 * brillo})`);
        g.addColorStop(0.3, `rgba(220, 190, 110, ${0.35 * brillo})`);
        g.addColorStop(1, 'rgba(220, 190, 110, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, l.r * 6, 0, Math.PI * 2);
        ctx.fill();
      }
      this.marco = requestAnimationFrame(dibujar);
    };
    this.marco = requestAnimationFrame(dibujar);

    const mover = (ev) => {
      raiz.style.setProperty('--px', ((ev.clientX / innerWidth) - 0.5).toFixed(3));
      raiz.style.setProperty('--py', ((ev.clientY / innerHeight) - 0.5).toFixed(3));
    };
    window.addEventListener('pointermove', mover);
    window.addEventListener('resize', ajustar);
    this.soltarAmbiente = () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('resize', ajustar);
    };
  },

  pararAmbiente() {
    if (this.marco) cancelAnimationFrame(this.marco);
    this.marco = null;
    if (this.soltarAmbiente) this.soltarAmbiente();
    this.soltarAmbiente = null;
  },

  /** El Router llama a esto al salir: la música es del menú, no del juego. */
  destruir() {
    this.pararAmbiente();
    window.Game.Audio.quitarMusica();
  }
};
