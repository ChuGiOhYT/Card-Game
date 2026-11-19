/**
 * Escenario 2D: el calabozo como una franja horizontal por la que el personaje
 * AVANZA de una etapa a la siguiente, con capas a distintas velocidades
 * (parallax) para simular profundidad. Al llegar le salen al paso los enemigos
 * y quien llama lanza el duelo cuando se resuelve la promesa.
 *
 * El arte se DIBUJA con código (ver ui/temas2d.js): cada capa es una lista de
 * «sellos» (árboles, raíces, hongos…) que se pintan una vez en lienzos pequeños
 * y luego se reparten por el mundo con una semilla fija. Por eso:
 *   - el mundo es infinito y siempre igual: cada celda de cada capa decide su
 *     sello con `hash(semilla, capa, celda)`, sin guardar nada;
 *   - cada fotograma solo dibuja lo visible, y no hacen falta imágenes enormes
 *     en el instalador.
 *
 * Coordenadas: el mundo se mide en píxeles de una pantalla lógica de
 * ANCHO×ALTO. La etapa k está en x = k·PASO; la salida (antes de la 1) en 0.
 *
 * Capa colgada de `body`, como la cinemática: se espera su promesa y después
 * se navega. Un clic o una tecla la saltan.
 */
window.Game = window.Game || {};

(function () {
  // ------------------------------------------------------------ azar fijo
  const mulberry = (a) => () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash = (...n) => {
    let h = 2166136261;
    for (const v of n) { h ^= (v | 0) + 0x9e3779b9; h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  /** Ruido suave 1D en [0,1]: valor por entero, interpolado. */
  const ruido = (semilla, x) => {
    const i = Math.floor(x), f = x - i;
    const a = mulberry(hash(semilla, i))(), b = mulberry(hash(semilla, i + 1))();
    const s = f * f * (3 - 2 * f);
    return a + (b - a) * s;
  };
  const lienzo = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };
  const cargar = (src) => new Promise((ok) => {
    if (!src) return ok(null);
    const img = new Image();
    let hecho = false;
    const fin = (v) => { if (!hecho) { hecho = true; ok(v); } };
    img.onload = () => fin(img);
    img.onerror = () => fin(null);
    img.src = src;
    setTimeout(() => fin(img.complete && img.naturalWidth ? img : null), 4000);
  });
  const lerp = (a, b, t) => a + (b - a) * t;
  const suave = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  /**
   * Copia de un retrato con la parte de abajo fundida a transparente: los
   * retratos flotantes son bustos, y su corte recto se vería contra el suelo.
   */
  const fundirBase = (img, fraccion) => {
    const c = lienzo(img.naturalWidth, img.naturalHeight);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const g = x.createLinearGradient(0, c.height * (1 - fraccion), 0, c.height);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out';
    x.fillStyle = g;
    x.fillRect(0, 0, c.width, c.height);
    return c;
  };

  const E = {
    ANCHO: 1280,
    ALTO: 720,
    /** Distancia entre etapas en el mundo. */
    PASO: 1500,
    /** Velocidad de marcha, en píxeles del mundo por ms (pausada, a pie). */
    VELOCIDAD: 0.3,
    MS_MIN: 3500,
    MS_MAX: 6500,
    /** Ritmo de lectura de los bocadillos y velocidad del texto al escribirse. */
    CARACTERES_POR_SEGUNDO: 20,
    MS_FRASE_MIN: 2600,
    LETRAS_POR_SEGUNDO: 45,
    /** El acompañante camina detrás del líder, a esta distancia y escala. */
    SEPARACION: 190,
    ESCALA_COMPANIA: 0.88,
    /** Enemigos saliendo y pausa con ellos en pie antes del duelo. */
    MS_SALIDA_ENEMIGOS: 650,
    MS_ENCUENTRO: 1500,
    MS_FUNDIDO: 320,
    /** Dónde queda el personaje en pantalla mientras camina (fracción). */
    CAMARA: 0.3,

    temas: {},
    util: { mulberry, hash, ruido, lienzo, lerp },

    /**
     * Retratos flotantes que miran hacia la IZQUIERDA. En la escena todos
     * avanzan a la derecha, así que estos se voltean. Se revisan a ojo al
     * sumar personajes que caminen (hoja de contacto con PIL).
     */
    MIRAN_A_LA_IZQUIERDA: new Set(['lun_acompanantes', 'lun_seluah', 'des_erem', 'des_lydia', 'des_auram']),
    _cache: {},

    tiene(id) {
      return !!(id && this.temas[id]);
    },

    /** Pinta una vez las variantes de cada sello de un tema (y las guarda). */
    preparar(tema) {
      if (this._cache[tema.id]) return this._cache[tema.id];
      const capas = tema.capas.map((capa, ci) => {
        const variantes = [];
        const [w, h] = capa.tam;
        const pad = Math.ceil((capa.desenfoque || 0) * 3) + (capa.margen || 0);
        for (let v = 0; v < (capa.n || 5); v++) {
          const rng = mulberry(hash(tema.semilla, ci, v, 77));
          const c = lienzo(w + pad * 2, h + pad * 2);
          const x = c.getContext('2d');
          x.translate(pad, pad);
          capa.sello(x, w, h, rng, capa);
          let final = c;
          if (capa.desenfoque) {
            final = lienzo(c.width, c.height);
            const y = final.getContext('2d');
            y.filter = `blur(${capa.desenfoque}px)`;
            y.drawImage(c, 0, 0);
          }
          variantes.push({ c: final, pad });
        }
        return { ...capa, variantes };
      });
      const p = { capas };
      this._cache[tema.id] = p;
      return p;
    },

    /** Dibuja una capa de sellos para la cámara dada. */
    dibujarCapa(ctx, tema, prep, ci, camX) {
      const capa = prep.capas[ci];
      const offset = camX * capa.vel;
      const maxW = capa.tam[0] * (capa.escala ? capa.escala[1] : 1) + 60;
      const i0 = Math.floor((offset - maxW) / capa.celda);
      const i1 = Math.ceil((offset + this.ANCHO + maxW) / capa.celda);
      ctx.save();
      if (capa.alfa != null) ctx.globalAlpha = capa.alfa;
      if (capa.mezcla) ctx.globalCompositeOperation = capa.mezcla;
      for (let i = i0; i <= i1; i++) {
        const rng = mulberry(hash(tema.semilla, ci, i, 1000));
        if (rng() > capa.densidad) continue;
        const v = capa.variantes[Math.floor(rng() * capa.variantes.length)];
        const xw = i * capa.celda + rng() * capa.celda;
        const esc = capa.escala ? lerp(capa.escala[0], capa.escala[1], rng()) : 1;
        const base = lerp(capa.base[0], capa.base[1], rng()) * this.ALTO;
        const voltear = !capa.sinVoltear && rng() < 0.5;
        const w = v.c.width * esc, h = v.c.height * esc;
        const sx = xw - offset;
        ctx.save();
        ctx.translate(sx, base);
        if (voltear) ctx.scale(-1, 1);
        // Los sellos se anclan por la base (abajo-centro); los que cuelgan, por arriba.
        const y = capa.colgar ? -v.pad * esc : -h + v.pad * esc;
        ctx.drawImage(v.c, -w / 2, y, w, h);
        ctx.restore();
      }
      ctx.restore();
    },

    /** Banda de niebla horizontal (más densa en el centro de la banda). */
    niebla(ctx, y0, y1, color, alfa) {
      const g = ctx.createLinearGradient(0, y0 * this.ALTO, 0, y1 * this.ALTO);
      g.addColorStop(0, `rgba(${color},0)`);
      g.addColorStop(0.5, `rgba(${color},${alfa})`);
      g.addColorStop(1, `rgba(${color},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, y0 * this.ALTO, this.ANCHO, (y1 - y0) * this.ALTO);
    },

    /** Carga (una vez) las tiras pintadas de un tema y su poste. */
    async cargarTiras(tema) {
      const clave = 'tiras:' + tema.id;
      if (this._cache[clave]) return this._cache[clave];
      const nombres = Object.keys(tema.tiras || {});
      const imgs = await Promise.all(nombres.map((n) => cargar(tema.tiras[n])));
      const tiras = {};
      nombres.forEach((n, i) => { tiras[n] = imgs[i]; });
      tiras._poste = tema.poste ? await cargar(tema.poste.src) : null;
      this._cache[clave] = tiras;
      return tiras;
    },

    /** Una tira pintada que se repite en horizontal a su propia velocidad. */
    pintarTira(ctx, img, vel, camX, alfa) {
      if (!img) return;
      const w = img.naturalWidth;
      const off = ((camX * vel) % w + w) % w;
      ctx.save();
      if (alfa != null) ctx.globalAlpha = alfa;
      for (let x = -off; x < this.ANCHO; x += w) ctx.drawImage(img, x, 0, w, this.ALTO);
      ctx.restore();
    },

    /**
     * Reparte las frases del diálogo en el tiempo: cada una dura lo que tarda
     * en leerse (mismo criterio que las cinemáticas), con un mínimo.
     */
    horarioDialogo(dialogo) {
      let t = 700;
      return (dialogo || []).map((d) => {
        const dur = Math.max(this.MS_FRASE_MIN,
          (d.texto.length / this.CARACTERES_POR_SEGUNDO) * 1000 + 900);
        const f = { ...d, desde: t, hasta: t + dur };
        t += dur;
        return f;
      });
    },

    /**
     * @param {object} o
     * @param {string} o.tema            id del tema (ver ui/temas2d.js)
     * @param {string} o.fondo           imagen lejana (el fondo de la estirpe)
     * @param {number} o.desde, o.hasta  índices de etapa (0 = salida)
     * @param {number} o.etapas          cuántas etapas tiene el calabozo
     * @param {number} o.jefe            índice de la etapa del jefe
     * @param {object} o.lider           { id, imagen, voltear } quien encabeza
     * @param {object} o.compania        { id, imagen, voltear } quien lo acompaña (opcional)
     * @param {Array}  o.dialogo         [{ quien, nombre, texto }] lo que se dicen al andar
     * @param {Array}  o.enemigos        cartas de personaje de la oleada
     * @param {string} o.titulo          rótulo del encuentro
     * @param {object} o.minimapa        { imagen, ancho, alto, ruta, nodos }
     */
    async recorrer(o) {
      const tema = this.temas[o.tema];
      if (!tema) return;
      const prep = this.preparar(tema);
      const tiras = await this.cargarTiras(tema);
      const lider = o.lider || { imagen: o.figura, voltear: !!tema.voltearFigura };
      const [fondo, liderImg, compImg, ...enemImgs] = await Promise.all([
        cargar(o.fondo),
        cargar(lider.imagen),
        cargar(o.compania && o.compania.imagen),
        ...o.enemigos.map((c) => cargar(c.imagenFlotante || c.imagen))
      ]);
      const aliados = [];
      if (compImg) aliados.push({ ...o.compania, img: fundirBase(compImg, 0.38), detras: true });
      if (liderImg) aliados.push({ ...lider, img: fundirBase(liderImg, 0.38), detras: false });
      const enemigos = o.enemigos.map((c, i) => {
        const img = enemImgs[i];
        const retrato = !!c.imagenFlotante && img;
        return { c, img: retrato ? fundirBase(img, 0.22) : img, retrato };
      });
      const frases = this.horarioDialogo(o.dialogo);

      return new Promise((resolver) => {
        const W = this.ANCHO, H = this.ALTO;
        const capa = document.createElement('div');
        capa.className = 'escenario2d';
        capa.innerHTML = `
          <div class="esc2d-marco">
            <canvas></canvas>
            ${o.minimapa ? this.htmlMinimapa(o.minimapa) : ''}
            <div class="esc2d-globo" hidden><strong></strong><span></span></div>
            <div class="esc2d-rotulo">${o.titulo || ''}</div>
          </div>
          <p class="esc2d-pista">${frases.length
            ? 'Clic: siguiente &nbsp;·&nbsp; Esc: saltar'
            : 'Clic para saltar'}</p>`;
        document.body.appendChild(capa);
        const canvas = capa.querySelector('canvas');
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = W * dpr;
        canvas.height = H * dpr;
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const rutaMini = capa.querySelector('.esc2d-mini-ruta');
        const puntoMini = capa.querySelector('.esc2d-mini-punto');
        const largoMini = rutaMini ? rutaMini.getTotalLength() : 0;
        const rotulo = capa.querySelector('.esc2d-rotulo');
        const globo = capa.querySelector('.esc2d-globo');
        const globoNombre = globo.querySelector('strong');
        const globoTexto = globo.querySelector('span');

        const xA = o.desde * this.PASO;
        const xFin = o.hasta * this.PASO - 150;
        const distancia = Math.max(1, xFin - xA);
        const finDialogo = frases.length ? frases[frases.length - 1].hasta + 500 : 0;
        // Si conversan, la marcha dura lo que la conversación: llegan al
        // terminar de hablar, y entonces salen los enemigos.
        const msMarcha = Math.max(
          Math.min(this.MS_MAX, Math.max(this.MS_MIN, distancia / this.VELOCIDAD)),
          finDialogo);
        const quieto = window.matchMedia
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        // Dónde se ponen los enemigos: en fila al otro lado del hito.
        const xEnem = enemigos.map((e, i) => o.hasta * this.PASO + 150 + i * (e.retrato ? 230 : 190));

        // Reloj «virtual» de la marcha: avanza con el tiempo real, y un clic lo
        // adelanta al principio de la frase siguiente. La posición en pantalla
        // lo persigue suavemente, así saltar una frase no teletransporta a nadie.
        const estado = { fase: quieto ? 'encuentro' : 'marcha', tEnc: 0, tv: 0, prog: 0 };
        let previo = performance.now();
        const t0 = previo;
        if (quieto) estado.tEnc = t0;

        let terminado = false;
        let raf = 0;
        const timers = [];
        const terminar = () => {
          if (terminado) return;
          terminado = true;
          cancelAnimationFrame(raf);
          timers.forEach(clearTimeout);
          document.removeEventListener('keydown', tecla, true);
          capa.classList.add('saliendo');
          setTimeout(() => { capa.remove(); resolver(); }, this.MS_FUNDIDO);
        };
        const siguiente = () => {
          if (estado.fase !== 'marcha') { terminar(); return; }
          const k = frases.findIndex((f) => estado.tv < f.hasta);
          estado.tv = k >= 0 && k + 1 < frases.length ? frases[k + 1].desde : msMarcha;
        };
        const tecla = (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.key === 'Escape') terminar();
          else siguiente();
        };
        capa.addEventListener('click', (ev) => { ev.stopPropagation(); siguiente(); });
        document.addEventListener('keydown', tecla, true);

        // El «pipipi» de quien habla (ui/voces.js): una vez por letra nueva.
        const voz = { frase: null, n: 0 };
        const ponerGlobo = (f, pos) => {
          if (!f || !pos) { globo.hidden = true; return; }
          globo.hidden = false;
          globoNombre.textContent = f.nombre;
          const letras = Math.floor(((estado.tv - f.desde) / 1000) * this.LETRAS_POR_SEGUNDO);
          globoTexto.textContent = f.texto.slice(0, Math.max(0, letras));
          if (voz.frase !== f) {
            voz.frase = f;
            voz.n = 0;
            window.Game.Voces?.nuevaFrase();
          }
          const hasta = Math.min(f.texto.length, Math.max(0, letras));
          // Un clic que salta la frase no suelta una ráfaga: solo la última letra.
          if (hasta - voz.n > 6) voz.n = hasta - 1;
          while (voz.n < hasta) window.Game.Voces?.letra(f.quien || f.nombre, f.texto[voz.n++]);
          // Dentro del marco siempre: se mide el bocadillo ya escrito y se
          // recoloca; el piquito se desplaza para seguir apuntando a quien habla.
          const marcoW = globo.parentElement.clientWidth || W;
          const bw = globo.offsetWidth;
          const deseado = (pos.x / W) * marcoW;
          const centro = Math.min(marcoW - bw / 2 - 10, Math.max(bw / 2 + 10, deseado));
          globo.style.left = `${centro}px`;
          globo.style.top = `${(pos.y / H) * 100}%`;
          globo.style.setProperty('--cola', `${Math.max(-bw / 2 + 18, Math.min(bw / 2 - 18, deseado - centro))}px`);
        };

        const cuadro = (ahora) => {
          if (terminado) return;
          const dt = Math.min(100, ahora - previo);
          previo = ahora;
          if (estado.fase === 'marcha') {
            estado.tv = Math.min(msMarcha, estado.tv + dt);
            const objetivo = estado.tv / msMarcha;
            estado.prog += (objetivo - estado.prog) * Math.min(1, dt / 220);
            if (estado.tv >= msMarcha && estado.prog > 0.998) {
              estado.prog = 1;
              estado.fase = 'encuentro';
              estado.tEnc = ahora;
              globo.hidden = true;
              if (window.Game.Audio) window.Game.Audio.reproducir('posicion');
              rotulo.classList.add('visible');
              timers.push(setTimeout(terminar,
                this.MS_SALIDA_ENEMIGOS + enemigos.length * 140 + this.MS_ENCUENTRO));
            }
          }
          const prog = estado.fase === 'marcha' ? estado.prog : 1;
          const t = (ahora - t0) / 1000;
          const pjX = lerp(xA, xFin, suave(prog));
          // Con acompañante la pareja ocupa más: se centra un poco más.
          const camX = pjX - W * (aliados.length > 1 ? this.CAMARA + 0.08 : this.CAMARA);
          const andando = estado.fase === 'marcha' && prog < 0.999;

          const posiciones = this.pintar(ctx, tema, prep, {
            camX, t, fondo, aliados, pjX, andando, prog,
            enemigos, xEnem, estado, ahora, tiras,
            etapas: o.etapas, jefe: o.jefe
          });

          if (estado.fase === 'marcha') {
            const f = frases.find((x) => estado.tv >= x.desde && estado.tv < x.hasta);
            ponerGlobo(f, f && (posiciones[f.quien] || posiciones._lider));
          }

          if (puntoMini && largoMini) {
            const p = rutaMini.getPointAtLength(largoMini * suave(prog));
            puntoMini.setAttribute('cx', p.x);
            puntoMini.setAttribute('cy', p.y);
          }
          raf = requestAnimationFrame(cuadro);
        };

        if (quieto) {
          rotulo.classList.add('visible');
          timers.push(setTimeout(terminar, this.MS_ENCUENTRO + 600));
        }
        raf = requestAnimationFrame(cuadro);
      });
    },

    htmlMinimapa(m) {
      const nodos = (m.nodos || [])
        .map((n) => `<circle cx="${n.x}" cy="${n.y}" r="${m.ancho * 0.03}" class="esc2d-mini-nodo"/>`)
        .join('');
      return `
        <svg class="esc2d-mini" viewBox="0 0 ${m.ancho} ${m.alto}" aria-hidden="true">
          ${m.imagen ? `<image href="${m.imagen}" width="${m.ancho}" height="${m.alto}"/>` : ''}
          ${nodos}
          <path class="esc2d-mini-ruta" d="${m.ruta}"/>
          <circle class="esc2d-mini-punto" r="${m.ancho * 0.035}" cx="-99" cy="-99"/>
        </svg>`;
    },

    /** Un fotograma completo, en el orden que dicta el tema. */
    pintar(ctx, tema, prep, s) {
      const W = this.ANCHO, H = this.ALTO;
      s.posiciones = {};
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = tema.cielo || '#000';
      ctx.fillRect(0, 0, W, H);
      for (const paso of tema.orden) {
        if (paso.tipo === 'fondo') this.pintarFondo(ctx, s.fondo, s.camX, paso);
        else if (paso.tipo === 'capa') this.dibujarCapa(ctx, tema, prep, paso.capa, s.camX);
        else if (paso.tipo === 'tira') this.pintarTira(ctx, s.tiras && s.tiras[paso.tira], paso.vel, s.camX, paso.alfa);
        else if (paso.tipo === 'niebla') this.niebla(ctx, paso.y0, paso.y1, paso.color, paso.alfa);
        else if (paso.tipo === 'suelo') tema.suelo(ctx, s.camX, this);
        else if (paso.tipo === 'hitos') this.pintarHitos(ctx, tema, s);
        else if (paso.tipo === 'actores') this.pintarActores(ctx, tema, s);
        else if (paso.tipo === 'particulas') tema.particulas(ctx, s.camX, s.t, this);
        else if (paso.tipo === 'velo') this.velo(ctx, paso);
      }
      return s.posiciones;
    },

    pintarFondo(ctx, img, camX, paso) {
      const W = this.ANCHO, H = this.ALTO;
      if (!img) return;
      const esc = H / img.naturalHeight * (paso.zoom || 1.08);
      const w = img.naturalWidth * esc, h = img.naturalHeight * esc;
      const libre = Math.max(0, w - W);
      // Ida y vuelta: el fondo no se acaba nunca ni pega saltos.
      const ciclo = libre * 2 || 1;
      const m = ((camX * (paso.vel || 0.05)) % ciclo + ciclo) % ciclo;
      const off = m < libre ? m : ciclo - m;
      ctx.save();
      ctx.filter = paso.desenfoque ? `blur(${paso.desenfoque}px)` : 'none';
      ctx.drawImage(img, -off, (H - h) * 0.5, w, h);
      ctx.restore();
      if (paso.oscurecer) {
        ctx.fillStyle = `rgba(${paso.tinte || '0,0,0'},${paso.oscurecer})`;
        ctx.fillRect(0, 0, W, H);
      }
    },

    pintarHitos(ctx, tema, s) {
      for (let k = 1; k <= s.etapas; k++) {
        const sx = k * this.PASO - 10 - s.camX;
        if (sx < -200 || sx > this.ANCHO + 200) continue;
        tema.hito(ctx, sx, k, k === s.jefe, s.t, this, s);
      }
    },

    pintarActores(ctx, tema, s) {
      const H = this.ALTO;
      // --- Enemigos (detrás del personaje si se cruzan)
      if (s.estado.fase === 'encuentro' || s.prog >= 1) {
        const desde = s.estado.tEnc || s.ahora;
        s.enemigos.forEach((e, i) => {
          if (!e.img) return;
          const k = Math.max(0, Math.min(1, (s.ahora - desde - i * 140) / this.MS_SALIDA_ENEMIGOS));
          if (k <= 0) return;
          const ease = 1 - Math.pow(1 - k, 3);
          const sx = s.xEnem[i] - s.camX;
          const alto = e.retrato ? H * 0.54 : H * 0.3;
          const iw = e.img.width || e.img.naturalWidth, ih = e.img.height || e.img.naturalHeight;
          const ancho = alto * iw / ih;
          const pie = e.retrato ? H * 0.95 : H * 0.88;
          const flotar = Math.sin(s.t * 1.6 + i) * 4;
          ctx.save();
          ctx.globalAlpha = ease;
          ctx.translate(sx, pie + (1 - ease) * alto * 0.35 + flotar);
          ctx.rotate(e.retrato ? 0 : (i % 2 ? 0.05 : -0.05) * ease);
          ctx.scale(0.8 + 0.2 * ease, 0.8 + 0.2 * ease);
          ctx.shadowColor = 'rgba(255,70,70,0.85)';
          ctx.shadowBlur = 30 * (1 - ease * 0.4);
          ctx.drawImage(e.img, -ancho / 2, -alto, ancho, alto);
          if (!e.retrato) {
            ctx.shadowBlur = 0;
            ctx.strokeStyle = 'rgba(240,200,120,0.7)';
            ctx.lineWidth = 2;
            ctx.strokeRect(-ancho / 2, -alto, ancho, alto);
          }
          ctx.restore();
        });
      }
      // --- Los aliados: bustos que avanzan flotando entre la niebla baja. El
      // acompañante va detrás, algo más pequeño y oscuro (más lejos).
      (s.aliados || []).forEach((a, k) => {
        if (!a.img) return;
        const esc = a.detras ? this.ESCALA_COMPANIA : 1;
        const sx = s.pjX - s.camX - (a.detras ? this.SEPARACION : 0);
        const alto = H * 0.5 * esc;
        const ancho = alto * a.img.width / a.img.height;
        const pie = H * (a.detras ? 0.95 : 0.97);
        const fase = a.detras ? 1.7 : 0;
        const paso = s.andando ? Math.abs(Math.sin(s.t * 5.2 + fase)) * 8 * esc : 0;
        const flotar = Math.sin(s.t * 1.8 + fase) * 5;
        const giro = s.andando ? Math.sin(s.t * 5.2 + fase) * 0.022 : 0;
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.36)';
        ctx.beginPath();
        ctx.ellipse(sx, H * (a.detras ? 0.85 : 0.86), ancho * 0.3, 11 * esc, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.translate(sx, pie - paso + flotar);
        ctx.rotate(giro);
        if (a.voltear) ctx.scale(-1, 1);
        if (a.detras) ctx.filter = 'brightness(0.82)';
        ctx.drawImage(a.img, -ancho / 2, -alto, ancho, alto);
        ctx.restore();
        // Dónde va su bocadillo: sobre la cabeza.
        const pos = { x: sx, y: pie - alto * 0.93 - paso + flotar };
        if (a.id) s.posiciones[a.id] = pos;
        if (!a.detras) s.posiciones._lider = pos;
      });
    },

    velo(ctx, paso) {
      const W = this.ANCHO, H = this.ALTO;
      const g = ctx.createRadialGradient(W / 2, H * 0.52, H * 0.35, W / 2, H * 0.52, H * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, `rgba(0,0,0,${paso.alfa ?? 0.65})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  };

  window.Game.Escenario2D = E;
})();
