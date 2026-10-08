window.Game = window.Game || {};

window.Game.Screens = window.Game.Screens || {};

window.Game.Screens.mainMenu = {
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

    contenedor.innerHTML = `
      <div class="menu-principal">
        <div class="menu-marca">
          <h1 class="menu-titulo">AETERNUM</h1>
          <div class="menu-filete"></div>
          <p class="menu-lema">Juego de mesa y aventura de rol</p>
        </div>

        <nav class="menu-opciones">
          <div class="menu-fondo" aria-hidden="true">
            <video id="menu-video" autoplay muted loop playsinline
                   preload="auto" disablepictureinpicture tabindex="-1">
              <source src="assets/video/menu-background.mp4" type="video/mp4">
            </video>
            <div class="menu-fondo-velo"></div>
          </div>

          <button class="menu-btn" data-destino="historia">
            <span class="menu-btn-sigil">✦</span>
            <span class="menu-btn-cuerpo">
              <span class="menu-btn-titulo">Modo Historia</span>
              <span class="menu-btn-sub">Elige tu estirpe y recorre su caída</span>
            </span>
          </button>

          <button class="menu-btn ${abierto ? '' : 'bloqueado'}" data-destino="solo"
                  ${abierto ? '' : 'aria-disabled="true"'}>
            <span class="menu-btn-sigil">${abierto ? '⚔' : '🔒'}</span>
            <span class="menu-btn-cuerpo">
              <span class="menu-btn-titulo">Modo Solo</span>
              <span class="menu-btn-sub">Partida rápida contra la máquina</span>
              ${candado}
            </span>
          </button>

          <button class="menu-btn ${abierto ? '' : 'bloqueado'}" data-destino="constructor"
                  ${abierto ? '' : 'aria-disabled="true"'}>
            <span class="menu-btn-sigil">${abierto ? '⬡' : '🔒'}</span>
            <span class="menu-btn-cuerpo">
              <span class="menu-btn-titulo">Crea tu Equipo</span>
              <span class="menu-btn-sub">5 personajes y 8 acciones</span>
              ${candado}
            </span>
          </button>

          <!-- Fuera del juego: abre la web en el navegador del sistema. Nunca
               se bloquea, porque no depende del progreso de la campaña. -->
          <button class="menu-btn menu-btn-externo" data-destino="online">
            <span class="menu-btn-sigil">🌐</span>
            <span class="menu-btn-cuerpo">
              <span class="menu-btn-titulo">Juega online (TCG Arena)</span>
              <span class="menu-btn-sub">
                Duelos contra otros jugadores · aeternumtcgchile.fun
              </span>
            </span>
            <span class="menu-btn-fuera" aria-hidden="true">↗</span>
          </button>
        </nav>

        <footer class="menu-pie">
          <span>${partidas} partida${partidas === 1 ? '' : 's'}</span>
          <span class="menu-pie-sep">·</span>
          <span>${equipos} equipo${equipos === 1 ? '' : 's'} guardado${equipos === 1 ? '' : 's'}</span>
          <span class="menu-pie-sep">·</span>
          <button class="menu-salir" id="btn-sonido">Sonido</button>
          ${
            S.hayAventuraQueReiniciar()
              ? `<span class="menu-pie-sep">·</span>
                 <button class="menu-salir" id="btn-reiniciar-aventura">Reiniciar aventura</button>`
              : ''
          }
          <span class="menu-pie-sep">·</span>
          <button class="menu-salir" id="btn-salir">Salir</button>
        </footer>
      </div>
    `;

    contenedor.querySelectorAll('.menu-btn').forEach((btn) => {
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

  /** El Router llama a esto al salir: la música es del menú, no del juego. */
  destruir() {
    window.Game.Audio.quitarMusica();
  }
};
