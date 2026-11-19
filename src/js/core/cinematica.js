/**
 * Cinemáticas narrativas: la pantalla se funde a negro, aparece un texto en
 * letras doradas, se sostiene unos segundos y se va.
 *
 * Vive en `core/` aunque toque el DOM porque no es una pantalla: no se registra
 * en el Router, se superpone a lo que haya y devuelve el control cuando acaba.
 * Es la única excepción a la regla de «core no toca el DOM», y lo hace sobre
 * `document.body`, nunca sobre el contenedor de la pantalla activa —si pintara
 * dentro de `#app`, el `innerHTML = ''` del Router se la llevaría a media
 * transición.
 *
 * Siempre saltable: un clic o una tecla corta a la salida. `mostrar()` devuelve
 * una promesa, así que el sitio que la lanza puede esperar y luego navegar:
 *
 *   await Game.Cinematica.mostrar(texto, 5);
 *   Game.Router.ir('partida', {...});
 */
window.Game = window.Game || {};

window.Game.Cinematica = {
  /** Fundido a negro de la pantalla que había debajo, en ms. */
  FUNDIDO_ENTRADA: 900,
  /** Aparición del texto una vez la pantalla ya está negra, en ms. */
  APARICION: 900,
  /** Fundido de salida (texto y negro a la vez), en ms. */
  FUNDIDO_SALIDA: 700,
  /** Al saltar no se corta en seco: se acelera la salida. */
  SALIDA_RAPIDA: 260,

  /**
   * Ritmo de lectura, en caracteres por segundo. TODAS las cinemáticas del
   * juego se miden con esta cifra: la duración se deduce del texto en vez de
   * escribirse a mano en cada una.
   *
   * Se hace así porque a mano se desincroniza sola: basta editar una frase
   * para que su tiempo deje de corresponder. Antes convivían textos a 20 y a
   * 39 car/s, y los de 39 no se podían leer.
   *
   * Ojo: el «clic para continuar» ACORTA, no alarga —llama a `salir` con
   * `SALIDA_RAPIDA`—, así que este número es todo el tiempo de lectura que
   * tiene quien no toca nada. No se puede compensar con él.
   */
  CARACTERES_POR_SEGUNDO: 20,

  /** Suelo, para que un texto de tres palabras no parpadee. */
  SEGUNDOS_MINIMO: 2.5,

  /** Cuánto se sostiene un texto, según su longitud. */
  duracionPara(texto) {
    const calculada = (texto || '').length / this.CARACTERES_POR_SEGUNDO;
    return Math.max(this.SEGUNDOS_MINIMO, calculada);
  },

  /**
   * Claves de las cinemáticas ya vistas en esta ejecución. Solo la usan las
   * que no deben repetirse cada vez que se pasa por la misma pantalla (la
   * entrada al calabozo se ve al llegar, no al volver de cada duelo).
   */
  vistas: new Set(),

  capa: null,
  /** Corte de la cinemática viva, si hay alguna. */
  _cortar: null,

  /** ¿Hay una cinemática en pantalla ahora mismo? */
  enCurso() {
    return !!this.capa;
  },

  /**
   * Corta la cinemática viva sin esperar. La promesa de `mostrar()` se
   * resuelve igualmente, para no dejar colgado a quien la estuviera esperando.
   */
  cortar() {
    if (this._cortar) this._cortar();
  },

  /**
   * Muestra una vez por ejecución. Devuelve la promesa de `mostrar()` la
   * primera vez y una ya resuelta las siguientes.
   */
  mostrarUnaVez(clave, texto, segundos) {
    if (this.vistas.has(clave)) return Promise.resolve();
    this.vistas.add(clave);
    return this.mostrar(texto, segundos);
  },

  /**
   * Igual que `mostrarUnaVez` pero con un vídeo. Se usa para la entrada a un
   * calabozo, antes de su texto dorado.
   */
  videoUnaVez(clave, escena) {
    if (this.vistas.has(clave)) return Promise.resolve();
    this.vistas.add(clave);
    // Acepta la ruta suelta o `{ src, conSonido }`.
    const e = typeof escena === 'string' ? { src: escena } : escena || {};
    return this.video(e.src, { conSonido: !!e.conSonido });
  },

  /**
   * Un vídeo a pantalla completa sobre el negro, saltable igual que el texto.
   *
   * `conSonido` se decide por escena, según lo que traiga el archivo: el intro
   * del Bosque tiene su pista en silencio digital (-91 dB medido) y va muda; la
   * del Oasis tiene audio de verdad (-20 dB de media) y suena. **La música del
   * calabozo NO se aparta**: las dos cosas suenan a la vez, a propósito.
   *
   * El volumen sigue al mando de música del mezclador. Si no, alguien que lo
   * hubiera bajado a cero se llevaría un susto en cada escena.
   *
   * @returns {Promise<void>} Se resuelve al acabar, al saltarlo, o enseguida
   *   si el archivo no carga: una cinemática decorativa nunca debe dejar al
   *   jugador encerrado en un negro del que no sale.
   */
  video(src, { conSonido = false } = {}) {
    if (!src) return Promise.resolve();
    this.cortar();

    return new Promise((resolve) => {
      const capa = document.createElement('div');
      capa.className = 'cinematica es-video';
      capa.setAttribute('role', 'dialog');
      capa.setAttribute('aria-label', 'Escena');
      capa.tabIndex = -1;
      capa.style.setProperty('--cine-entrada', `${this.FUNDIDO_ENTRADA}ms`);
      capa.style.setProperty('--cine-aparicion', `${this.APARICION}ms`);

      const video = document.createElement('video');
      video.className = 'cinematica-video';
      video.muted = !conSonido;
      if (conSonido) {
        const A = window.Game.Audio;
        video.volume = A ? Math.max(0, Math.min(1, A.nivel('musica'))) : 1;
      }
      video.autoplay = true;
      video.playsInline = true;
      video.preload = 'auto';
      const fuente = document.createElement('source');
      fuente.src = src;
      fuente.type = 'video/mp4';
      video.appendChild(fuente);

      const pie = document.createElement('span');
      pie.className = 'cinematica-saltar';
      pie.textContent = 'Clic o cualquier tecla para continuar';

      capa.appendChild(video);
      capa.appendChild(pie);
      document.body.appendChild(capa);
      this.capa = capa;

      void capa.offsetWidth;
      capa.classList.add('visible');
      capa.focus();

      let cerrado = false;
      const salir = (duracion) => {
        if (cerrado) return;
        cerrado = true;
        clearTimeout(seguro);
        document.removeEventListener('keydown', alPulsarTecla, true);
        capa.removeEventListener('click', alHacerClic);
        video.removeEventListener('ended', alAcabar);

        capa.style.setProperty('--cine-salida', `${duracion}ms`);
        capa.classList.remove('visible');
        capa.classList.add('saliendo');

        this.capa = null;
        this._cortar = null;
        setTimeout(() => {
          // Parar el vídeo antes de soltarlo: si no, sigue decodificando un
          // rato dentro de un nodo que ya nadie ve.
          video.pause();
          capa.remove();
          resolve();
        }, duracion);
      };

      const alAcabar = () => salir(this.FUNDIDO_SALIDA);
      const alHacerClic = () => salir(this.SALIDA_RAPIDA);
      const alPulsarTecla = (ev) => {
        if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
        ev.preventDefault();
        ev.stopPropagation();
        salir(this.SALIDA_RAPIDA);
      };

      video.addEventListener('ended', alAcabar);
      capa.addEventListener('click', alHacerClic);
      document.addEventListener('keydown', alPulsarTecla, true);
      this._cortar = () => salir(0);

      // Si el vídeo no arranca —archivo movido, códec ausente— la promesa
      // tiene que resolverse igual: `ended` no llegaría nunca y la pantalla se
      // quedaría negra para siempre. Hacen falta las tres redes:
      //
      // 1. El `error` del `<source>`. El del `<video>` NO salta cuando falla
      //    una fuente hija: medido, con el archivo ausente tardaba 20 s en
      //    rendirse por el temporizador en vez de reaccionar al instante.
      // 2. Un plazo corto para que aparezcan los metadatos. Si en cuatro
      //    segundos no se sabe ni cuánto dura, no va a reproducirse.
      // 3. Un tope total, pero calculado sobre la duración REAL una vez se
      //    conoce, no un número fijo: un fijo cortaría una escena más larga.
      let seguro = setTimeout(() => salir(0), 4000);
      fuente.addEventListener('error', () => salir(0));
      video.addEventListener('error', () => salir(0));
      video.addEventListener('loadedmetadata', () => {
        clearTimeout(seguro);
        const total = Number.isFinite(video.duration) ? video.duration * 1000 : 20000;
        seguro = setTimeout(() => salir(0), total + 5000);
      });

      // Con sonido, Chromium puede negarse a arrancar sin un gesto previo del
      // usuario. Antes de rendirse se reintenta en silencio: es mejor ver la
      // escena muda que quedarse mirando un negro.
      const arrancar = () => {
        const intento = video.play();
        if (!intento) return;
        intento.catch(() => {
          if (!conSonido || video.muted) return salir(0);
          video.muted = true;
          const segundo = video.play();
          if (segundo) segundo.catch(() => salir(0));
        });
      };
      arrancar();
    });
  },

  /**
   * @param {string} texto Lo que se lee en dorado.
   * @param {number} [segundos] Cuánto se sostiene el texto ya legible, sin
   *   contar los fundidos. Si no se pasa —lo normal—, se deduce del largo del
   *   texto con `CARACTERES_POR_SEGUNDO`. Pasarlo es una excepción a mano.
   * @returns {Promise<void>} Se resuelve cuando la capa ya no está.
   */
  mostrar(texto, segundos) {
    if (!texto) return Promise.resolve();
    if (!Number.isFinite(segundos)) segundos = this.duracionPara(texto);

    // Dos a la vez no tiene sentido y dejaría una capa huérfana encima.
    this.cortar();

    // El narrador (ui/narrador.js), si está encendido y hay voz para este
    // texto: arranca cuando el texto ya se ve y la escena dura lo que la voz.
    const voz = window.Game.Narrador?.leer(texto, { retraso: this.FUNDIDO_ENTRADA });
    if (voz && voz.dur) segundos = Math.max(segundos, voz.dur - this.APARICION / 1000 + 0.8);

    return new Promise((resolve) => {
      const capa = document.createElement('div');
      capa.className = 'cinematica';
      capa.setAttribute('role', 'dialog');
      capa.setAttribute('aria-label', 'Narración');
      capa.tabIndex = -1;
      capa.innerHTML = `
        <p class="cinematica-texto">${texto}</p>
        <span class="cinematica-saltar">Clic o cualquier tecla para continuar</span>
      `;
      // Las duraciones las manda el JS, no la hoja de estilos: los tiempos de
      // los `setTimeout` de abajo tienen que ser los mismos que los de las
      // transiciones, y con dos fuentes se desincronizan a la primera.
      capa.style.setProperty('--cine-entrada', `${this.FUNDIDO_ENTRADA}ms`);
      capa.style.setProperty('--cine-aparicion', `${this.APARICION}ms`);

      document.body.appendChild(capa);
      this.capa = capa;

      // Sin reflow, el navegador agrupa el estado inicial con el final y no
      // hay transición: la capa aparecería negra de golpe.
      void capa.offsetWidth;
      capa.classList.add('visible');
      capa.focus();

      let espera = setTimeout(
        () => salir(this.FUNDIDO_SALIDA),
        this.FUNDIDO_ENTRADA + this.APARICION + segundos * 1000
      );

      const salir = (duracion) => {
        if (!this.capa) return;
        clearTimeout(espera);
        window.Game.Narrador?.parar(duracion);
        document.removeEventListener('keydown', alPulsarTecla, true);
        capa.removeEventListener('click', alHacerClic);

        capa.style.setProperty('--cine-salida', `${duracion}ms`);
        capa.classList.remove('visible');
        capa.classList.add('saliendo');

        this.capa = null;
        this._cortar = null;
        setTimeout(() => {
          capa.remove();
          resolve();
        }, duracion);
      };

      const alHacerClic = () => salir(this.SALIDA_RAPIDA);
      const alPulsarTecla = (ev) => {
        // Cualquier tecla salta, pero no las que el sistema usa para otra cosa.
        if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
        ev.preventDefault();
        ev.stopPropagation();
        salir(this.SALIDA_RAPIDA);
      };

      capa.addEventListener('click', alHacerClic);
      // En captura: la capa está por delante de todo, pero el foco puede estar
      // en un botón de la pantalla de debajo y ahí la tecla no llegaría.
      document.addEventListener('keydown', alPulsarTecla, true);

      // Un corte externo (el Router cambiando de pantalla) se lleva la capa sin
      // fundido: ya no hay nada debajo que combine con ella.
      this._cortar = () => salir(0);
    });
  }
};
