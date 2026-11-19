/**
 * Travesía: el personaje RECORRE el sendero del mapa del calabozo hasta la
 * etapa siguiente, y al llegar le salen al paso los enemigos. Después el duelo
 * empieza directo (eso lo hace quien llama, al resolverse la promesa).
 *
 * Es una capa colgada de `body`, como la cinemática: se dibuja encima de todo
 * y quien la lanza espera su promesa y DESPUÉS navega. Si viviera en `#app`, el
 * Router se la llevaría al cambiar de pantalla.
 *
 * La figura es el retrato flotante del personaje (`imagenFlotante`): se mueve
 * como un recorte de teatro —avanza por la curva del sendero, rebota a cada
 * paso y se balancea—, sin hojas de sprites. Los enemigos usan su retrato
 * flotante si lo tienen (los Eternals) y, si no, su carta.
 *
 * Todo se puede saltar con un clic o una tecla, igual que las cinemáticas.
 */
window.Game = window.Game || {};

window.Game.Travesia = {
  /** Milisegundos por unidad de sendero (píxeles del mapa), con tope. */
  MS_POR_PIXEL: 7,
  MS_MIN: 1300,
  MS_MAX: 3000,
  /** Cuántos pasos (rebotes) da por cada 100 px de camino. */
  PASOS_POR_100: 2.2,
  /** Pausa con los enemigos ya en pie antes de pasar al duelo. */
  MS_ENEMIGOS: 1100,
  MS_SALIDA: 320,

  /**
   * @param {object} o
   * @param {string} o.imagen       arte del mapa ('' si es el sendero genérico)
   * @param {number} o.ancho, o.alto  sistema de coordenadas del mapa
   * @param {string} o.ruta         `d` del tramo de sendero a recorrer
   * @param {string} o.figura       retrato flotante del personaje que camina
   * @param {Array}  o.enemigos     cartas de personaje de la oleada
   * @returns {Promise<void>}       se resuelve al terminar (o al saltarla)
   */
  recorrer({ imagen, ancho, alto, ruta, figura, enemigos = [] }) {
    return new Promise((resolver) => {
      const capa = document.createElement('div');
      capa.className = 'travesia';
      const altoFig = alto * 0.17;
      const anchoFig = altoFig * 0.8;
      capa.innerHTML = `
        <div class="travesia-marco">
          <svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Avanzando por el calabozo">
            ${imagen ? `<image href="${imagen}" x="0" y="0" width="${ancho}" height="${alto}"/>` : ''}
            <path class="travesia-ruta" d="${ruta}"/>
            <g class="travesia-enemigos"></g>
            <g class="travesia-viajero">
              <image href="${figura}" width="${anchoFig}" height="${altoFig}"
                     x="${-anchoFig / 2}" y="${-altoFig}"
                     preserveAspectRatio="xMidYMax meet"/>
            </g>
          </svg>
        </div>
        <p class="travesia-pista">Clic para saltar</p>`;
      document.body.appendChild(capa);

      const camino = capa.querySelector('.travesia-ruta');
      const viajero = capa.querySelector('.travesia-viajero');
      const grupoEnemigos = capa.querySelector('.travesia-enemigos');
      const largo = camino.getTotalLength();
      const quieto = window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let terminado = false;
      let raf = 0;
      const temporizadores = [];
      const terminar = () => {
        if (terminado) return;
        terminado = true;
        cancelAnimationFrame(raf);
        temporizadores.forEach(clearTimeout);
        document.removeEventListener('keydown', saltar, true);
        capa.classList.add('saliendo');
        setTimeout(() => { capa.remove(); resolver(); }, this.MS_SALIDA);
      };
      const saltar = (ev) => {
        if (ev) { ev.preventDefault(); ev.stopPropagation(); }
        terminar();
      };
      capa.addEventListener('click', saltar);
      document.addEventListener('keydown', saltar, true);

      // Coloca la figura con los pies en el punto `t` (0..1) del sendero.
      const colocar = (t, rebote, giro) => {
        const p = camino.getPointAtLength(largo * t);
        // Mira hacia donde camina: un poco por delante en el sendero.
        const q = camino.getPointAtLength(Math.min(largo, largo * t + 2));
        const haciaIzquierda = q.x < p.x - 0.01;
        // La figura cuelga hacia ARRIBA de sus pies: cerca del borde superior
        // (el jefe suele estar arriba del todo) se saldría del marco.
        const y = Math.max(altoFig + 4, p.y);
        viajero.setAttribute('transform',
          `translate(${p.x} ${y - rebote}) rotate(${giro}) scale(${haciaIzquierda ? -1 : 1} 1)`);
        donde = { x: p.x, y };
      };
      let donde = { x: 0, y: 0 };

      const sacarEnemigos = () => {
        const n = enemigos.length;
        // En fila, FRENTE a tu personaje y del lado del mapa donde hay más
        // sitio; con los pies a la altura de los suyos y siempre enteros
        // dentro del marco.
        const tallas = enemigos.map((c) => {
          const conRetrato = !!c.imagenFlotante;
          const h = conRetrato ? alto * 0.2 : alto * 0.11;
          return { c, conRetrato, h, w: conRetrato ? h * 0.8 : h * (1191 / 1646) };
        });
        const masAlto = Math.max(0, ...tallas.map((t) => t.h));
        const suelo = Math.min(alto - 6, Math.max(masAlto + 6, donde.y));
        const aLaDerecha = donde.x < ancho / 2;
        const desde = aLaDerecha ? donde.x + altoFig * 0.45 : 6;
        const hasta = aLaDerecha ? ancho - 6 : donde.x - altoFig * 0.45;
        const hueco = Math.max(1, hasta - desde);
        tallas.forEach((t, i) => {
          const centro = desde + hueco * ((i + 0.5) / n);
          const x = Math.min(ancho - t.w / 2, Math.max(t.w / 2, centro));
          // Un escalón: los del medio un poco más atrás, como un grupo.
          const y = suelo - (n > 1 && i % 2 ? 10 : 0);
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('transform', `translate(${x} ${y})`);
          g.innerHTML = `
            <g class="travesia-enemigo ${t.conRetrato ? 'con-retrato' : 'es-carta'}"
               style="animation-delay:${i * 140}ms">
              <image href="${t.conRetrato ? t.c.imagenFlotante : t.c.imagen}"
                     width="${t.w}" height="${t.h}" x="${-t.w / 2}" y="${-t.h}"
                     preserveAspectRatio="xMidYMax meet"/>
            </g>`;
          grupoEnemigos.appendChild(g);
        });
        if (n && window.Game.Audio) window.Game.Audio.reproducir('posicion');
        temporizadores.push(setTimeout(terminar, this.MS_ENEMIGOS + n * 140));
      };

      if (quieto || !largo) {
        // Sin movimiento: el viajero ya está en su sitio y los enemigos solo aparecen.
        capa.classList.add('quieta');
        colocar(1, 0, 0);
        sacarEnemigos();
        return;
      }

      const ms = Math.min(this.MS_MAX, Math.max(this.MS_MIN, largo * this.MS_POR_PIXEL));
      const pasos = Math.max(2, Math.round((largo / 100) * this.PASOS_POR_100 * 2) / 2);
      const amp = altoFig * 0.06;
      const t0 = performance.now();
      colocar(0, 0, 0);
      const cuadro = (ahora) => {
        if (terminado) return;
        const lineal = Math.min(1, (ahora - t0) / ms);
        // Arranca y frena suave; en medio, paso constante.
        const t = lineal < 0.5 ? 2 * lineal * lineal : 1 - Math.pow(-2 * lineal + 2, 2) / 2;
        const fase = lineal * pasos * Math.PI;
        const rebote = Math.abs(Math.sin(fase)) * amp * (lineal < 1 ? 1 : 0);
        const giro = Math.sin(fase) * 3 * (lineal < 1 ? 1 : 0);
        colocar(t, rebote, giro);
        if (lineal < 1) raf = requestAnimationFrame(cuadro);
        else sacarEnemigos();
      };
      raf = requestAnimationFrame(cuadro);
    });
  }
};
