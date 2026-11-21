/**
 * Pantallas de carga (Oscar): la ilustración de una estirpe a pantalla
 * completa, una frase de su campaña y una barra verde que avanza.
 *
 * La barra es REAL: precarga lo que la pantalla siguiente va a necesitar
 * (imágenes, audio, vídeo) y avanza con lo que ya está listo. En la versión
 * web es lo que da tiempo a bajar el escenario; en el PC carga al instante,
 * así que se queda un mínimo (`minMs`) para que se pueda leer la frase. Un tope
 * (`maxMs`) evita que un archivo lento deje a nadie atascado.
 *
 * Tres sitios:
 *   - al abrir el juego (app.js, estirpe al azar),
 *   - al entrar a un calabozo (raceSelect «Comenzar historia»),
 *   - al ir a un duelo (Router.ir('partida'), cualquier modo).
 *
 * Es una capa de `body`, como la cinemática: quien la lanza ESPERA su promesa
 * y después navega.
 */
window.Game = window.Game || {};

window.Game.Carga = {
  MS_FUNDIDO: 380,

  /** Raza con ilustración (las cuatro jugables); otra cosa → al azar. */
  razaValida(raza) {
    const ok = window.Game.RACE_ORDER || [];
    return ok.includes(raza) ? raza : ok[Math.floor(Math.random() * ok.length)];
  },

  /**
   * Enseña la pantalla, precarga `recursos` (rutas) y se va. Devuelve una
   * promesa que se cumple cuando ya se ha ido.
   */
  mostrar({ raza = null, recursos = [], minMs = 1800, maxMs = 8000 } = {}) {
    const r = this.razaValida(raza);
    const frases = (window.Game.FRASES_CARGA && window.Game.FRASES_CARGA[r]) || [];
    const frase = frases[Math.floor(Math.random() * frases.length)] || '';
    const color = (window.Game.RACES[r] || {}).colorPrimario || '#c9a959';
    const lista = [...new Set(recursos.filter(Boolean))];

    const capa = document.createElement('div');
    capa.className = 'carga';
    capa.style.setProperty('--fundido', `${this.MS_FUNDIDO}ms`);
    capa.innerHTML = `
      <div class="carga-fondo" style="background-image:url('assets/carga/${r}.webp')"></div>
      <div class="carga-velo"></div>
      <div class="carga-pie" style="--raza-primario:${color}">
        <span class="carga-emblema">${window.Game.emblema ? window.Game.emblema(r, 44) : ''}</span>
        <p class="carga-frase">${frase}</p>
        <div class="carga-barra"><div class="carga-relleno"></div></div>
      </div>`;
    document.body.appendChild(capa);
    void capa.offsetWidth;
    capa.classList.add('visible');

    const relleno = capa.querySelector('.carga-relleno');
    const t0 = performance.now();
    let listos = 0;
    const total = lista.length;

    return new Promise((resolver) => {
      let terminado = false;
      const pintar = () => {
        if (terminado) return;
        const tiempo = Math.min(1, (performance.now() - t0) / minMs);
        const carga = total ? listos / total : 1;
        // La barra no se adelanta al tiempo mínimo ni a lo cargado de verdad.
        relleno.style.width = `${Math.round(Math.min(tiempo, carga) * 100)}%`;
        if (tiempo >= 1 && carga >= 1) return acabar();
        requestAnimationFrame(pintar);
      };
      const acabar = () => {
        if (terminado) return;
        terminado = true;
        relleno.style.width = '100%';
        clearTimeout(tope);
        setTimeout(() => {
          capa.classList.remove('visible');
          setTimeout(() => { capa.remove(); resolver(); }, this.MS_FUNDIDO);
        }, 150);
      };
      const tope = setTimeout(acabar, maxMs);
      lista.forEach((ruta) => this.precargar(ruta).then(() => { listos++; }));
      requestAnimationFrame(pintar);
    });
  },

  /** Una ruta lista (o fallida: no se espera por lo que no existe). */
  precargar(ruta) {
    return new Promise((ok) => {
      const fin = () => ok();
      const ext = (ruta.split('?')[0].split('.').pop() || '').toLowerCase();
      if (['mp4', 'webm'].includes(ext)) {
        const v = document.createElement('video');
        v.preload = 'auto';
        v.muted = true;
        v.oncanplaythrough = fin;
        v.onerror = fin;
        v.src = ruta;
        setTimeout(fin, 6000);
        return;
      }
      if (['mp3', 'ogg', 'wav'].includes(ext)) {
        const a = new Audio();
        a.preload = 'auto';
        a.oncanplaythrough = fin;
        a.onerror = fin;
        a.src = ruta;
        setTimeout(fin, 5000);
        return;
      }
      const img = new Image();
      img.onload = fin;
      img.onerror = fin;
      img.src = ruta;
    });
  },

  /* ------------------------- Qué precargar en cada sitio ------------------------- */

  /** Al abrir el juego: el menú, las cartas y la música. */
  recursosDeArranque() {
    const G = window.Game;
    return [
      'assets/video/menu-background.mp4',
      ...((G.Audio && G.Audio.MUSICA && G.Audio.MUSICA.inicio) ? [G.Audio.MUSICA.inicio.src] : []),
      ...(G.CHARACTERS || []).map((c) => c.imagen),
      ...(G.ACTIONS || []).map((a) => a.imagen),
      ...(G.RACE_ORDER || []).map((r) => G.RACES[r] && G.RACES[r].emblema),
      'assets/cartas/reverso.webp'
    ];
  },

  /** Al entrar a un calabozo: mapa, vídeo, ambiente, retratos y la oleada. */
  recursosDeCalabozo(raza) {
    const G = window.Game;
    const cal = G.calabozoDe && G.calabozoDe(raza);
    const r = G.RACES[raza] || {};
    if (!cal) return [];
    const C = G.CHARACTERS_BY_ID;
    const ids = [...(cal.personajesIniciales || [])];
    for (const e of cal.etapas) {
      if (e.recompensa && e.recompensa.personaje) ids.push(e.recompensa.personaje);
      ids.push(...e.criaturas);
    }
    return [
      cal.mapa && cal.mapa.imagen,
      cal.videoIntro && cal.videoIntro.src,
      r.fondo,
      r.fondoVideo,
      ...ids.map((id) => C[id] && C[id].imagen),
      ...ids.map((id) => C[id] && C[id].imagenFlotante),
      G.Audio && G.Audio.MUSICA && G.Audio.MUSICA[raza] && G.Audio.MUSICA[raza].src
    ];
  },

  /** Al ir a un duelo: tapete, cartas de los dos bandos, retratos y la música. */
  recursosDeDuelo(params = {}) {
    const G = window.Game;
    const C = G.CHARACTERS_BY_ID;
    const razas = [params.raza, params.razaRival].filter(Boolean);
    const ids = (G.CHARACTERS || []).filter((c) => razas.includes(c.raza) || c.raza === 'mercenario').map((c) => c.id);
    if (params.modo === 'historia' && params.etapa && G.calabozoDe) {
      const e = G.calabozoDe(params.raza).etapas.find((x) => x.n === params.etapa);
      if (e) ids.push(...e.criaturas);
    }
    return [
      `assets/tapetes/${params.raza}.webp`,
      'assets/cartas/reverso.webp',
      ...ids.map((id) => C[id] && C[id].imagen),
      ...ids.map((id) => C[id] && C[id].imagenFlotante),
      ...(G.ACTIONS || []).map((a) => a.imagen),
      G.Audio && G.Audio.MUSICA && G.Audio.MUSICA.batalla && G.Audio.MUSICA.batalla.src
    ];
  }
};
