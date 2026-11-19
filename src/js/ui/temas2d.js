/**
 * Temas del escenario 2D (ver ui/escenario2d.js). Cada tema dice qué capas
 * tiene, a qué velocidad va cada una, con qué sellos se rellena y en qué orden
 * se pinta todo. Los sellos son funciones que DIBUJAN una pieza (un árbol, un
 * helecho…) en un lienzo pequeño con un `rng` propio: así cada variante es
 * distinta pero siempre la misma.
 *
 * Profundidad: lo lejano es más claro, más azulado y desenfocado (perspectiva
 * aérea); lo cercano, casi negro y nítido; el primer plano vuelve a
 * desenfocarse (fuera de foco, delante de la cámara). Entre capas, bandas de
 * niebla. Con eso, más el parallax, se lee como 3D.
 */
window.Game = window.Game || {};

(function () {
  const E = window.Game.Escenario2D;
  const { ruido, lienzo } = E.util;

  // ------------------------------------------------------------ utilidades
  /** Tronco relleno, más ancho abajo, con una curva suave. */
  const tronco = (ctx, x, yBase, alto, a0, a1, curva) => {
    ctx.beginPath();
    ctx.moveTo(x - a0 / 2, yBase);
    ctx.quadraticCurveTo(x - a1 / 2 + curva, yBase - alto * 0.55, x - a1 / 2 + curva * 0.5, yBase - alto);
    ctx.lineTo(x + a1 / 2 + curva * 0.5, yBase - alto);
    ctx.quadraticCurveTo(x + a1 / 2 + curva, yBase - alto * 0.55, x + a0 / 2, yBase);
    ctx.closePath();
    ctx.fill();
  };

  /** Ramas recursivas; deja en `puntas` dónde acaba cada una (para la copa). */
  const ramas = (ctx, x, y, ang, largo, grosor, prof, rng, puntas) => {
    const x2 = x + Math.cos(ang) * largo, y2 = y + Math.sin(ang) * largo;
    ctx.lineWidth = Math.max(1, grosor);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      (x + x2) / 2 + (rng() - 0.5) * largo * 0.35,
      (y + y2) / 2 + (rng() - 0.5) * largo * 0.25, x2, y2);
    ctx.stroke();
    if (prof <= 1) { puntas.push([x2, y2]); return; }
    const n = 2 + (rng() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      ramas(ctx, x2, y2, ang + (rng() - 0.5) * 1.15, largo * (0.62 + rng() * 0.18),
        grosor * 0.62, prof - 1, rng, puntas);
    }
  };

  /**
   * Follaje: muchas hojas pequeñas alrededor de cada punta, con transparencia
   * variable. Con óvalos grandes la copa parecía de globos; con hojas sueltas
   * se lee como follaje y deja ver el fondo entre medias.
   */
  const copa = (ctx, puntas, r, rng) => {
    const alfa = ctx.globalAlpha;
    for (const [x, y] of puntas) {
      const k = 10 + Math.floor(rng() * 10);
      for (let i = 0; i < k; i++) {
        const a = rng() * Math.PI * 2, d = rng() * r * 1.3;
        ctx.globalAlpha = alfa * (0.55 + rng() * 0.45);
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7,
          r * (0.18 + rng() * 0.16), r * (0.09 + rng() * 0.08), a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = alfa;
  };

  /**
   * Luz lateral sobre una silueta ya pintada (solo donde hay tinta): un
   * degradado desde la izquierda, que es de donde viene la luna. Es lo que
   * convierte una mancha plana en un volumen.
   */
  const iluminar = (ctx, w, h, color, fuerza) => {
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, `rgba(${color},${fuerza})`);
    g.addColorStop(0.45, `rgba(${color},${fuerza * 0.25})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  };

  /** Un brillo redondo (hongos, faroles, luciérnagas). */
  const brillo = (ctx, x, y, r, color, alfa) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${color},${alfa})`);
    g.addColorStop(0.4, `rgba(${color},${alfa * 0.35})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };

  // ------------------------------------------------------------ sellos del bosque
  const S = {
    /** Árbol lejano: alto, fino y con poca copa. */
    arbolLejano(ctx, w, h, rng, capa) {
      ctx.fillStyle = capa.color;
      ctx.strokeStyle = capa.color;
      ctx.lineCap = 'round';
      const x = w / 2;
      tronco(ctx, x, h, h * 0.92, w * 0.16, w * 0.05, (rng() - 0.5) * w * 0.2);
      const puntas = [];
      for (let i = 0; i < 4; i++) {
        const y = h * (0.15 + rng() * 0.45);
        ramas(ctx, x, y, -Math.PI / 2 + (rng() - 0.5) * 1.6, h * 0.12, w * 0.035, 2, rng, puntas);
      }
    },

    /** Árbol retorcido de media distancia, con raíces y copa en racimos. */
    arbolRetorcido(ctx, w, h, rng, capa) {
      ctx.fillStyle = capa.color;
      ctx.strokeStyle = capa.color;
      ctx.lineCap = 'round';
      const x = w / 2 + (rng() - 0.5) * w * 0.1;
      const curva = (rng() - 0.5) * w * 0.35;
      tronco(ctx, x, h, h * 0.62, w * 0.22, w * 0.09, curva);
      // Raíces que se abren en la base.
      for (let i = 0; i < 4; i++) {
        const lado = i % 2 ? 1 : -1;
        ctx.lineWidth = w * (0.03 + rng() * 0.03);
        ctx.beginPath();
        ctx.moveTo(x + lado * w * 0.05, h - h * 0.05);
        ctx.quadraticCurveTo(x + lado * w * (0.15 + rng() * 0.1), h - h * 0.02,
          x + lado * w * (0.25 + rng() * 0.2), h);
        ctx.stroke();
      }
      const puntas = [];
      const arriba = h - h * 0.62;
      for (let i = 0; i < 3; i++) {
        ramas(ctx, x + curva * 0.5, arriba + h * 0.05 * i,
          -Math.PI / 2 + (i - 1) * 0.7 + (rng() - 0.5) * 0.4, h * 0.16, w * 0.05, 3, rng, puntas);
      }
      copa(ctx, puntas, w * 0.13, rng);
      iluminar(ctx, w, h, capa.luz, 0.35);
    },

    /** Tronco cercano, enorme, con raíces gruesas, nudos y musgo. */
    troncoCercano(ctx, w, h, rng, capa) {
      ctx.fillStyle = capa.color;
      ctx.strokeStyle = capa.color;
      ctx.lineCap = 'round';
      const x = w / 2;
      tronco(ctx, x, h, h, w * 0.5, w * 0.3, (rng() - 0.5) * w * 0.15);
      for (let i = 0; i < 6; i++) {
        const lado = i % 2 ? 1 : -1;
        ctx.lineWidth = w * (0.05 + rng() * 0.05);
        ctx.beginPath();
        ctx.moveTo(x + lado * w * 0.1, h - h * 0.12);
        ctx.bezierCurveTo(x + lado * w * 0.3, h - h * 0.1, x + lado * w * 0.35, h - h * 0.02,
          x + lado * w * (0.42 + rng() * 0.08), h);
        ctx.stroke();
      }
      iluminar(ctx, w, h, capa.luz, 0.5);
      // Nudos oscuros.
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        ctx.ellipse(x + (rng() - 0.5) * w * 0.2, h * (0.3 + rng() * 0.4), w * 0.03, h * 0.025, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // Musgo y hiedra: motas verdes sobre el lado de la luz.
      for (let i = 0; i < 70; i++) {
        const yy = h * (0.15 + rng() * 0.8);
        const xx = x - w * 0.2 + rng() * w * 0.18;
        ctx.fillStyle = `rgba(${capa.musgo},${0.25 + rng() * 0.35})`;
        ctx.beginPath();
        ctx.ellipse(xx, yy, 2 + rng() * 5, 2 + rng() * 3, rng() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    /** Haz de luz de luna entre los árboles. */
    haz(ctx, w, h, rng, capa) {
      const tinte = (capa && capa.tinte) || '200,255,220';
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, `rgba(${tinte},0.0)`);
      g.addColorStop(0.25, `rgba(${tinte},0.13)`);
      g.addColorStop(1, `rgba(${tinte},0)`);
      ctx.fillStyle = g;
      const a = w * (0.15 + rng() * 0.1), b = w * (0.5 + rng() * 0.3);
      ctx.beginPath();
      ctx.moveTo(w / 2 - a / 2, 0);
      ctx.lineTo(w / 2 + a / 2, 0);
      ctx.lineTo(w / 2 + b / 2 + w * 0.2, h);
      ctx.lineTo(w / 2 - b / 2 + w * 0.2, h);
      ctx.closePath();
      ctx.fill();
    },

    /** Racimo de hongos que brillan (como en el mapa del calabozo). */
    hongos(ctx, w, h, rng, capa) {
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const x = w * (0.25 + rng() * 0.5), r = w * (0.07 + rng() * 0.08);
        const alto = h * (0.25 + rng() * 0.35);
        brillo(ctx, x, h - alto, r * 3.2, capa.brillo, 0.5);
        ctx.fillStyle = '#16302a';
        ctx.fillRect(x - r * 0.18, h - alto, r * 0.36, alto);
        ctx.fillStyle = `rgb(${capa.brillo})`;
        ctx.beginPath();
        ctx.ellipse(x, h - alto, r, r * 0.55, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(x - r * 0.3, h - alto - r * 0.2, r * 0.25, r * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    },

    /** Helecho: frondas en arco con hojitas. */
    helecho(ctx, w, h, rng, capa) {
      ctx.strokeStyle = capa.color;
      ctx.lineCap = 'round';
      const n = 5 + Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const ang = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.2;
        const largo = h * (0.6 + rng() * 0.4);
        const x0 = w / 2, y0 = h;
        const x1 = x0 + Math.cos(ang) * largo, y1 = y0 + Math.sin(ang) * largo * 0.85;
        const cx = (x0 + x1) / 2 + Math.cos(ang + 1.2) * largo * 0.25, cy = Math.min(y0, y1) - largo * 0.15;
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(cx, cy, x1, y1);
        ctx.stroke();
        ctx.lineWidth = 1.6;
        for (let k = 1; k < 12; k++) {
          const t = k / 12, u = 1 - t;
          const px = u * u * x0 + 2 * u * t * cx + t * t * x1;
          const py = u * u * y0 + 2 * u * t * cy + t * t * y1;
          const l = (1 - t) * 14 + 3;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px - l * 0.6, py - l * 0.7);
          ctx.moveTo(px, py);
          ctx.lineTo(px + l * 0.6, py - l * 0.5);
          ctx.stroke();
        }
      }
    },

    /** Raíz que asoma en arco sobre el suelo. */
    raiz(ctx, w, h, rng, capa) {
      ctx.strokeStyle = capa.color;
      ctx.lineCap = 'round';
      ctx.lineWidth = h * (0.16 + rng() * 0.1);
      ctx.beginPath();
      ctx.moveTo(w * 0.05, h);
      ctx.bezierCurveTo(w * 0.25, h * (0.05 + rng() * 0.2), w * 0.6, h * 0.1, w * 0.95, h);
      ctx.stroke();
      iluminar(ctx, w, h, capa.luz, 0.3);
    },

    /** Lianas que cuelgan desde arriba, con hojas. */
    lianas(ctx, w, h, rng, capa) {
      ctx.strokeStyle = capa.color;
      ctx.fillStyle = capa.color;
      ctx.lineCap = 'round';
      const n = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const x = w * (0.15 + rng() * 0.7), largo = h * (0.45 + rng() * 0.55);
        ctx.lineWidth = 2 + rng() * 3;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        let px = x;
        for (let y = 0; y <= largo; y += 12) {
          px = x + Math.sin(y * 0.03 + i) * 10;
          ctx.lineTo(px, y);
        }
        ctx.stroke();
        for (let y = 20; y < largo; y += 18 + rng() * 14) {
          const xx = x + Math.sin(y * 0.03 + i) * 10;
          ctx.beginPath();
          ctx.ellipse(xx + (rng() < 0.5 ? -4 : 4), y, 5, 2.5, rng() * 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },

    /** Frondas grandes del primer plano, desenfocadas, saliendo de abajo. */
    frondaCercana(ctx, w, h, rng, capa) {
      ctx.fillStyle = capa.color;
      const n = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < n; i++) {
        const x0 = w * (0.2 + rng() * 0.6);
        const ang = -Math.PI / 2 + (rng() - 0.5) * 1.6;
        const largo = h * (0.7 + rng() * 0.3), ancho = w * (0.08 + rng() * 0.07);
        const x1 = x0 + Math.cos(ang) * largo, y1 = h + Math.sin(ang) * largo;
        ctx.beginPath();
        ctx.moveTo(x0 - ancho, h);
        ctx.quadraticCurveTo((x0 + x1) / 2 - ancho * 1.6, (h + y1) / 2, x1, y1);
        ctx.quadraticCurveTo((x0 + x1) / 2 + ancho * 1.6, (h + y1) / 2, x0 + ancho, h);
        ctx.closePath();
        ctx.fill();
      }
    }
  };

  // ------------------------------------------------------------ luciérnagas
  const chispa = (() => {
    const hechas = {};
    return (color) => {
      if (hechas[color]) return hechas[color];
      const c = lienzo(48, 48);
      brillo(c.getContext('2d'), 24, 24, 24, color, 1);
      hechas[color] = c;
      return c;
    };
  })();

  /**
   * Partículas que flotan a varias profundidades (luciérnagas, orbes…).
   * `o`: { colores, n, tam:[min,max], vel (deriva), parpadeo, semilla }.
   */
  const particulas = (ctx, camX, t, E2, o) => {
    const W = E2.ANCHO, H = E2.ALTO;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < o.n; i++) {
      const r = E2.util.mulberry(E2.util.hash(o.semilla, i));
      const prof = 0.5 + r() * 0.8;
      const span = W * 3;
      const xw = r() * span;
      let sx = ((xw - camX * prof) % span + span) % span - W * 0.5;
      sx += Math.sin(t * (0.3 + r() * 0.5) * o.vel + i) * 30;
      const sy = H * (0.18 + r() * 0.72) + Math.cos(t * (0.4 + r()) * o.vel + i * 1.7) * 22;
      const onda = Math.sin(t * (1 + r() * 2) * o.parpadeo + i * 3.1);
      const a = (o.parpadeo > 0 ? Math.max(0, onda) : 0.6 + 0.4 * onda) * (0.45 + prof * 0.4);
      if (a <= 0.02 || sx < -40 || sx > W + 40) continue;
      const s = o.tam[0] + (o.tam[1] - o.tam[0]) * r() * prof;
      ctx.globalAlpha = a;
      ctx.drawImage(chispa(o.colores[i % o.colores.length]), sx - s / 2, sy - s / 2, s, s);
    }
    ctx.restore();
  };

  /**
   * El hito de una etapa: el poste pintado del tema, su luz encendida (un
   * farol rectangular o un orbe) y la tablilla con el número o «JEFE».
   */
  const pintarHito = (tema, ctx, sx, n, esJefe, t, E2, s) => {
    const H = E2.ALTO, G = H * 0.8;
    const poste = s && s.tiras && s.tiras._poste;
    const p = tema.poste;
    const luz = esJefe ? '255,96,72' : p.luz;
    const parpadeo = 0.86 + Math.sin(t * 7 + n) * 0.08 + Math.sin(t * 13 + n * 2) * 0.05;
    const ox = sx - p.ejeX, oy = G + 34 - 320;
    ctx.save();
    if (p.orbe) {
      const [cx, cy, r] = p.orbe;
      const fx = ox + cx, fy = oy + cy;
      ctx.globalCompositeOperation = 'lighter';
      brillo(ctx, fx, fy, 130 * parpadeo, luz, 0.45 * parpadeo);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createRadialGradient(fx - r * 0.3, fy - r * 0.3, 1, fx, fy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.5, `rgba(${luz},0.9)`);
      g.addColorStop(1, `rgba(${luz},0.35)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(fx, fy, r, 0, Math.PI * 2); ctx.fill();
    } else {
      const [c0, c1, c2, c3] = p.cristal;
      const fx = ox + (c0 + c2) / 2, fy = oy + (c1 + c3) / 2;
      ctx.globalCompositeOperation = 'lighter';
      brillo(ctx, fx, fy, 150 * parpadeo, luz, 0.42 * parpadeo);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(${luz},${0.95 * parpadeo})`;
      ctx.fillRect(ox + c0, oy + c1, c2 - c0, c3 - c1);
    }
    if (poste) ctx.drawImage(poste, ox, oy);
    const ty = oy + (p.tablilla || 168);
    ctx.fillStyle = p.fondoTablilla || '#1a130c';
    ctx.fillRect(sx - 27, ty, 54, 30);
    ctx.strokeStyle = esJefe ? 'rgba(255,110,90,0.9)' : p.bordeTablilla || 'rgba(201,169,89,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 27, ty, 54, 30);
    ctx.fillStyle = esJefe ? '#ff8a7a' : p.texto || '#e8c878';
    ctx.font = `700 ${esJefe ? 13 : 18}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(esJefe ? 'JEFE' : String(n), sx, ty + 16);
    ctx.restore();
  };

  // ------------------------------------------------------------ el tema
  E.temas.bosque = {
    id: 'bosque',
    semilla: 4242,
    cielo: '#06120c',
    // El retrato de Annia ya mira a la derecha, hacia donde avanza: sin voltear.
    voltearFigura: false,

    // Las capas de árboles, suelo, lianas y primer plano están PINTADAS con
    // tools/fondos2d/bosque.py (paleta medida del fondo de la estirpe) y se
    // repiten sin costura. Aquí solo quedan las que se animan en vivo.
    tiras: {
      lejanos: 'assets/escenario2d/bosque/lejanos.webp',
      medios: 'assets/escenario2d/bosque/medios.webp',
      cercanos: 'assets/escenario2d/bosque/cercanos.webp',
      suelo: 'assets/escenario2d/bosque/suelo.webp',
      lianas: 'assets/escenario2d/bosque/lianas.webp',
      frente: 'assets/escenario2d/bosque/frente.webp'
    },
    // Poste del farol (pintado); el cristal está vacío: ahí va la luz.
    poste: { src: 'assets/escenario2d/bosque/poste.webp', ejeX: 27, cristal: [120, 78, 140, 108],
      luz: '255,205,120' },

    capas: [
      /* 0 */ { nombre: 'haces', vel: 0.12, celda: 520, densidad: 0.55, n: 4, tam: [420, 760],
        base: [0.0, 0.0], colgar: true, sello: S.haz, desenfoque: 6, mezcla: 'lighter', sinVoltear: true }
    ],

    orden: [
      { tipo: 'fondo', vel: 0.05, desenfoque: 1.5, oscurecer: 0.3, tinte: '4,18,10' },
      { tipo: 'capa', capa: 0 },
      { tipo: 'tira', tira: 'lejanos', vel: 0.22 },
      { tipo: 'niebla', y0: 0.42, y1: 0.8, color: '72,119,80', alfa: 0.2 },
      { tipo: 'tira', tira: 'medios', vel: 0.45 },
      { tipo: 'niebla', y0: 0.6, y1: 0.86, color: '72,119,80', alfa: 0.14 },
      { tipo: 'tira', tira: 'cercanos', vel: 0.75 },
      { tipo: 'tira', tira: 'suelo', vel: 1 },
      { tipo: 'hitos' },
      { tipo: 'actores' },
      // Niebla baja DELANTE de los actores: los retratos son bustos, y así
      // parece que avanzan entre la bruma en vez de flotar cortados.
      { tipo: 'niebla', y0: 0.8, y1: 1.02, color: '96,150,110', alfa: 0.32 },
      { tipo: 'particulas' },
      { tipo: 'tira', tira: 'lianas', vel: 1.25 },
      { tipo: 'tira', tira: 'frente', vel: 1.4 },
      { tipo: 'velo', alfa: 0.72 }
    ],

    /** El suelo: borde irregular, tierra oscura y un sendero más claro. */
    suelo(ctx, camX, E2) {
      const W = E2.ANCHO, H = E2.ALTO, G = H * 0.8;
      const borde = (sx) => G + (ruido(91, (camX + sx) / 160) - 0.5) * 26;
      ctx.beginPath();
      ctx.moveTo(0, H);
      for (let sx = 0; sx <= W + 8; sx += 8) ctx.lineTo(sx, borde(sx));
      ctx.lineTo(W, H);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, G - 20, 0, H);
      g.addColorStop(0, '#1c3424');
      g.addColorStop(0.3, '#12241a');
      g.addColorStop(1, '#070e0a');
      ctx.fillStyle = g;
      ctx.fill();
      // El sendero: una franja de tierra clara que serpentea.
      const centro = (sx) => G + 52 + (ruido(17, (camX + sx) / 420) - 0.5) * 18;
      ctx.beginPath();
      for (let sx = 0; sx <= W + 8; sx += 8) ctx.lineTo(sx, centro(sx) - 20);
      for (let sx = W + 8; sx >= 0; sx -= 8) ctx.lineTo(sx, centro(sx) + 24);
      ctx.closePath();
      const p = ctx.createLinearGradient(0, G + 20, 0, G + 90);
      p.addColorStop(0, 'rgba(120,110,80,0.0)');
      p.addColorStop(0.45, 'rgba(120,110,80,0.28)');
      p.addColorStop(1, 'rgba(120,110,80,0.0)');
      ctx.fillStyle = p;
      ctx.fill();
    },

    hito(ctx, sx, n, esJefe, t, E2, s) {
      pintarHito(this, ctx, sx, n, esJefe, t, E2, s);
    },

    /** Luciérnagas a varias profundidades, con su parpadeo. */
    particulas(ctx, camX, t, E2) {
      particulas(ctx, camX, t, E2, {
        colores: ['215,255,120'], n: 90, tam: [10, 26], vel: 1, parpadeo: 1.8, semilla: 55
      });
    }
  };

  // ------------------------------------------------------------ el oasis
  E.temas.oasis = {
    id: 'oasis',
    semilla: 7171,
    cielo: '#0b1226',
    voltearFigura: false,

    // Pintado con tools/fondos2d/oasis.py (paleta medida de lunaria.jpg).
    tiras: {
      lejanos: 'assets/escenario2d/oasis/lejanos.webp',
      medios: 'assets/escenario2d/oasis/medios.webp',
      cercanos: 'assets/escenario2d/oasis/cercanos.webp',
      suelo: 'assets/escenario2d/oasis/suelo.webp',
      lianas: 'assets/escenario2d/oasis/lianas.webp',
      frente: 'assets/escenario2d/oasis/frente.webp'
    },
    // Estela de piedra lunar con un orbe encima (la luz va en vivo).
    poste: {
      src: 'assets/escenario2d/oasis/poste.webp', ejeX: 27, orbe: [27, 50, 15], luz: '190,160,255',
      tablilla: 196, fondoTablilla: '#0e1530', bordeTablilla: 'rgba(170,190,255,0.85)', texto: '#cfd9ff'
    },

    capas: [
      /* 0 */ { nombre: 'haces', vel: 0.1, celda: 600, densidad: 0.5, n: 4, tam: [440, 760],
        base: [0.0, 0.0], colgar: true, sello: S.haz, desenfoque: 7, mezcla: 'lighter', sinVoltear: true,
        tinte: '190,225,255' }
    ],

    orden: [
      { tipo: 'fondo', vel: 0.03, desenfoque: 1, oscurecer: 0.18, tinte: '6,10,28' },
      { tipo: 'capa', capa: 0 },
      { tipo: 'tira', tira: 'lejanos', vel: 0.2 },
      { tipo: 'niebla', y0: 0.45, y1: 0.8, color: '91,157,196', alfa: 0.18 },
      { tipo: 'tira', tira: 'medios', vel: 0.45 },
      { tipo: 'niebla', y0: 0.62, y1: 0.86, color: '91,157,196', alfa: 0.12 },
      { tipo: 'tira', tira: 'cercanos', vel: 0.75 },
      { tipo: 'tira', tira: 'suelo', vel: 1 },
      { tipo: 'hitos' },
      { tipo: 'actores' },
      { tipo: 'niebla', y0: 0.8, y1: 1.02, color: '114,191,215', alfa: 0.26 },
      { tipo: 'particulas' },
      { tipo: 'tira', tira: 'lianas', vel: 1.25 },
      { tipo: 'tira', tira: 'frente', vel: 1.4 },
      { tipo: 'velo', alfa: 0.68 }
    ],

    hito(ctx, sx, n, esJefe, t, E2, s) {
      pintarHito(this, ctx, sx, n, esJefe, t, E2, s);
    },

    /** Orbes violetas y turquesa, lentos, como los del fondo. */
    particulas(ctx, camX, t, E2) {
      particulas(ctx, camX, t, E2, {
        colores: ['190,150,255', '190,150,255', '130,235,255'], n: 46, tam: [12, 40],
        vel: 0.55, parpadeo: 0, semilla: 77
      });
    }
  };
})();
