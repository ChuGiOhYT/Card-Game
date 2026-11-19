/**
 * Plataforma: lo que cambia entre el .exe (Electron) y la APK (Capacitor).
 *
 * El juego solo habla con `window.gameAPI` (guardar, cargar, salir y abrir la
 * web de TCG Arena). En Electron lo pone preload.js. En el teléfono no hay
 * preload, así que aquí se pone uno equivalente:
 *   - la partida se guarda en el almacenamiento de la app (localStorage del
 *     WebView, que es privado de la app y sobrevive a cerrarla);
 *   - salir usa el plugin App de Capacitor;
 *   - la web se abre en el navegador del teléfono.
 *
 * Además, en el teléfono:
 *   - PANTALLA: la mesa se diseñó para 1024×700 como mínimo. El WebView se
 *     configura con «viewport ancho» (MainActivity.java) y aquí se le dice qué
 *     ancho usar: el que deja al menos ALTO_MINIMO px de alto con la forma de
 *     esta pantalla. El sistema escala todo para que quepa: se ve la mesa
 *     entera, más pequeña, en vez de cortada.
 *   - El botón ATRÁS de Android hace lo mismo que el «←» de cada pantalla;
 *     en el menú, sale del juego.
 *
 * EN EL NAVEGADOR (la web, p. ej. dentro de aeternumtcgchile.fun):
 *   - el mismo gameAPI, con la partida en el localStorage del sitio;
 *   - sin botón «Salir» (html.web lo esconde: una página no se cierra sola);
 *   - TCG Arena se abre en otra pestaña;
 *   - en un TELÉFONO (táctil y pantalla pequeña) la misma escala que la APK,
 *     y en vertical un aviso de girarlo (html.movil + CSS).
 *
 * Se carga ANTES que todo lo demás (index.html). No toca nada en Electron.
 */
window.Game = window.Game || {};

window.Game.Plataforma = {
  ARENA_URL: 'https://aeternumtcgchile.fun',
  CLAVE_GUARDADO: 'aeternum-guardado',
  ALTO_MINIMO: 540,
  ANCHO_MINIMO: 1024,

  esMovil() {
    return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  },

  /** Navegador en un teléfono: táctil y con la pantalla pequeña. */
  esTelefonoWeb() {
    const tactil = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    return !!tactil && Math.min(screen.width, screen.height) < 700;
  },

  plugin(nombre) {
    return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[nombre];
  },

  /** Ancho de diseño para esta pantalla (siempre en horizontal). */
  anchoDeDiseno() {
    const largo = Math.max(screen.width, screen.height);
    const corto = Math.min(screen.width, screen.height) || 1;
    return Math.max(this.ANCHO_MINIMO, Math.ceil(this.ALTO_MINIMO * (largo / corto)));
  },

  ajustarPantalla() {
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = `width=${this.anchoDeDiseno()}, user-scalable=no`;
    document.documentElement.classList.add('movil');
  },

  /** El `gameAPI` de Electron, hecho con lo que hay en el teléfono. */
  apiMovil() {
    return {
      ...this.guardadoLocal(),
      quit: async () => {
        const app = this.plugin('App');
        if (app) app.exitApp();
      },
      // Capacitor manda al navegador del sistema cualquier dirección que no
      // sea de la propia app.
      abrirArena: async () => {
        window.location.href = this.ARENA_URL;
        return { ok: true };
      }
    };
  },

  /** El `gameAPI` en una página web. */
  apiWeb() {
    return {
      ...this.guardadoLocal(),
      quit: async () => {},
      abrirArena: async () => {
        const v = window.open(this.ARENA_URL, '_blank', 'noopener');
        return { ok: v !== null };
      }
    };
  },

  /** Guardar y cargar la partida en localStorage (APK y web). */
  guardadoLocal() {
    const clave = this.CLAVE_GUARDADO;
    return {
      async saveGame(datos) {
        try {
          localStorage.setItem(clave, JSON.stringify(datos));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      },
      async loadGame() {
        try {
          const t = localStorage.getItem(clave);
          return { ok: true, data: t ? JSON.parse(t) : null };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
    };
  },

  /**
   * Atrás de Android: cierra lo que esté encima (lupa grande, mezclador,
   * confirmación) o pulsa el «←» de la pantalla. En el menú, sale.
   */
  conectarAtras() {
    const app = this.plugin('App');
    if (!app || !app.addListener) return;
    app.addListener('backButton', () => {
      const pulsar = (sel) => {
        const el = document.querySelector(sel);
        if (el && el.offsetParent !== null) { el.click(); return true; }
        return false;
      };
      // Capas encima de todo: se cierran primero.
      if (document.querySelector('.lupa-grande:not(.oculto)')) {
        window.Game.Lupa?.cerrar();
        return;
      }
      if (pulsar('#confirmar-no')) return;
      if (pulsar('.mez-cerrar')) return;
      // El «←» de la pantalla (mesa, constructor, sala, calabozo…).
      if (pulsar('#btn-salir-partida, #btn-volver, .btn-volver')) return;
      if (window.Game.Router && window.Game.Router.actual !== 'mainMenu') {
        window.Game.Router.ir('mainMenu');
        return;
      }
      app.exitApp();
    });
  },

  iniciar() {
    // Electron: preload.js ya puso el suyo.
    if (window.gameAPI) return;
    if (this.esMovil()) {
      this.ajustarPantalla();
      window.gameAPI = this.apiMovil();
      this.conectarAtras();
      return;
    }
    // Navegador.
    document.documentElement.classList.add('web');
    window.gameAPI = this.apiWeb();
    if (this.esTelefonoWeb()) this.ajustarPantalla();
  }
};

window.Game.Plataforma.iniciar();
