/**
 * El fondo de ambiente de cada estirpe.
 *
 * Tres pantallas lo pintan —selección de estirpe, calabozo y las partidas de
 * historia— y antes cada una repetía el mismo `<div>` con su `background-image`.
 * Ahora una estirpe puede traer además un `fondoVideo` en bucle, y con eso el
 * bloque deja de ser una línea: hay que crear el `<video>`, insistir en que
 * arranque y no romper el caso de las que solo tienen imagen. Repetir eso tres
 * veces es pedir que se desincronicen.
 *
 * Vive en `ui/` y no en `core/` porque pinta: es una capa suelta, como el
 * mezclador.
 *
 * El vídeo se guarda como MP4, no como GIF. El GIF original del bosque pesaba
 * 74 MB para 5,76 s; el mismo metraje en H.264 son 304 KB —245 veces menos— y
 * además lo decodifica el hardware en vez de la CPU. Un GIF de ese tamaño se
 * habría llevado por delante la memoria y el instalador.
 */
window.Game = window.Game || {};

window.Game.Ambiente = {
  /**
   * El marcado del fondo para una raza, o cadena vacía si no tiene ambiente.
   *
   * La imagen fija sigue haciendo falta aunque haya vídeo: es el `poster`, lo
   * que se ve mientras el primer fotograma llega, y el respaldo de las estirpes
   * que aún no tienen animación.
   */
  html(raza) {
    if (!raza) return '';
    const video = raza.fondoVideo;
    const imagen = raza.fondo;
    if (!video && !imagen) return '';

    if (!video) {
      return `<div class="fondo-estirpe con-imagen" aria-hidden="true"
                   style="background-image:url('${imagen}')"></div>`;
    }

    // `muted` no es decorativo: sin él la política de autoarranque de Chromium
    // bloquea la reproducción. Y la imagen queda debajo como `poster`.
    return `
      <div class="fondo-estirpe con-imagen es-video" aria-hidden="true"
           ${imagen ? `style="background-image:url('${imagen}')"` : ''}>
        <video class="fondo-video" autoplay muted loop playsinline
               ${imagen ? `poster="${imagen}"` : ''}>
          <source src="${video}" type="video/mp4">
        </video>
      </div>`;
  },

  /**
   * Cambia el ambiente de un `.fondo-estirpe` ya pintado. Lo usa la pantalla de
   * selección, que salta de estirpe en estirpe según cuál estés mirando.
   */
  aplicar(elemento, raza) {
    if (!elemento) return;
    const video = raza && raza.fondoVideo;
    const imagen = raza && raza.fondo;

    elemento.classList.toggle('con-imagen', !!(video || imagen));
    elemento.classList.toggle('es-video', !!video);
    elemento.style.backgroundImage = imagen ? `url('${imagen}')` : '';

    const previo = elemento.querySelector('.fondo-video');
    if (!video) {
      if (previo) previo.remove();
      return;
    }
    // Ya está puesto el mismo: no se reinicia, que cortaría el bucle a mitad
    // por volver a pasar el ratón por encima de la misma tarjeta.
    if (previo && previo.querySelector('source')?.getAttribute('src') === video) return;
    if (previo) previo.remove();

    const el = document.createElement('video');
    el.className = 'fondo-video';
    el.autoplay = true;
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    if (imagen) el.poster = imagen;
    const fuente = document.createElement('source');
    fuente.src = video;
    fuente.type = 'video/mp4';
    el.appendChild(fuente);
    elemento.appendChild(el);
    this.asegurar(el);
  },

  /**
   * Insiste en que el vídeo arranque, pero SOLO cuando ya hay datos.
   *
   * Llamar a `play()` justo después de pintar lo rompe: la promesa se aborta
   * porque el `<source>` aún no está resuelto y, de paso, apaga la bandera de
   * autoarranque, así que el vídeo se queda pausado para siempre. Es la misma
   * trampa que documenta el vídeo del menú principal.
   */
  asegurar(video) {
    if (!video) return;
    const intentar = () => {
      if (!video.paused) return;
      const intento = video.play();
      if (intento) intento.catch(() => {});
    };
    video.addEventListener('canplay', intentar, { once: true });
    if (video.readyState >= 3) intentar();
  },

  /** Arranca todos los fondos de vídeo que haya en un contenedor recién pintado. */
  conectar(contenedor) {
    if (!contenedor) return;
    contenedor.querySelectorAll('.fondo-video').forEach((v) => this.asegurar(v));
  }
};
