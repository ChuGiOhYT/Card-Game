/**
 * Router de pantallas. Cada pantalla es un objeto con render(contenedor, params)
 * y, opcionalmente, destruir(). Solo hay una pantalla viva a la vez.
 */
window.Game = window.Game || {};

window.Game.Router = {
  pantallas: {},
  actual: null,
  contenedor: null,
  historial: [],

  registrar(nombre, pantalla) {
    this.pantallas[nombre] = pantalla;
  },

  iniciar(contenedor, pantallaInicial) {
    this.contenedor = contenedor;
    this.ir(pantallaInicial);
  },

  /** Pantallas que exigen haber pasado por el modo historia. */
  CERRADAS: ['modoSolo', 'constructor'],

  ir(nombre, params = {}) {
    // Cerrojo central: aunque se llegue por otra vía, no se entra sin
    // haber terminado un calabozo entero.
    if (this.CERRADAS.includes(nombre) && !window.Game.State.desbloqueado()) {
      console.warn(`«${nombre}» está bloqueada hasta completar el modo historia.`);
      nombre = 'mainMenu';
      params = {};
    }

    // La campaña es lineal: no se entra en un calabozo cuya raza anterior
    // siga sin terminar, ni por la pantalla de historia ni por un duelo.
    if (
      (nombre === 'historia' || (nombre === 'partida' && params.modo === 'historia')) &&
      params.raza &&
      !window.Game.State.calabozoDisponible(params.raza)
    ) {
      console.warn(`El calabozo de «${params.raza}» aún no está disponible.`);
      nombre = 'seleccionRaza';
      params = { modo: 'historia' };
    }

    // Ir a un duelo pasa por la pantalla de carga (ui/pantallaCarga.js): la
    // ilustración de tu estirpe mientras se precargan las cartas y el tapete.
    // Al terminar se vuelve a llamar con `_trasCarga` para entrar de verdad.
    if (nombre === 'partida' && window.Game.Carga && !this._trasCarga) {
      if (this._cargando) return;
      this._cargando = true;
      const C = window.Game.Carga;
      C.mostrar({ raza: params.raza, recursos: C.recursosDeDuelo(params), minMs: 1400 }).then(() => {
        this._cargando = false;
        this._trasCarga = true;
        try { this.ir(nombre, params); } finally { this._trasCarga = false; }
      });
      return;
    }

    const pantalla = this.pantallas[nombre];
    if (!pantalla) {
      console.error(`Pantalla no registrada: ${nombre}`);
      return;
    }

    if (this.actual && this.pantallas[this.actual]?.destruir) {
      this.pantallas[this.actual].destruir();
    }

    // Una cinemática viva pertenece a la pantalla que se va. Quien la lanza
    // espera su promesa antes de navegar, así que en el caso normal esto no
    // hace nada; está para que un cambio de pantalla inesperado no deje una
    // capa negra encima del juego, sin nada debajo que la explique.
    window.Game.Cinematica.cortar();

    if (this.actual && this.actual !== nombre) {
      this.historial.push({ nombre: this.actual, params: this.paramsActuales });
    }

    this.actual = nombre;
    this.paramsActuales = params;
    this.contenedor.innerHTML = '';
    this.contenedor.classList.remove('fade-in');
    // Fuerza reflow para reiniciar la animación de entrada.
    void this.contenedor.offsetWidth;
    this.contenedor.classList.add('fade-in');

    this.renderSeguro(pantalla, params, nombre);
  },

  /**
   * Si una pantalla revienta al construirse, el contenedor se queda vacío y el
   * jugador pierde hasta el botón de volver. Aquí se atrapa el fallo y se
   * pinta una salida, en vez de dejar la aplicación muerta.
   */
  renderSeguro(pantalla, params, nombre) {
    try {
      pantalla.render(this.contenedor, params);
    } catch (err) {
      console.error(`Fallo al renderizar «${nombre}»:`, err);
      this.contenedor.innerHTML = `
        <div class="pantalla pantalla-fallo">
          <h2>Esta pantalla no se pudo abrir</h2>
          <p class="nota">${nombre}: ${err.message}</p>
          <button class="btn-primario" id="btn-fallo-menu">Volver al menú</button>
        </div>
      `;
      const btn = this.contenedor.querySelector('#btn-fallo-menu');
      // Si la que falla es el propio menú, recargar es la única salida.
      btn.addEventListener('click', () => {
        if (nombre === 'mainMenu') location.reload();
        else this.ir('mainMenu');
      });
    }
  },

  volver() {
    const anterior = this.historial.pop();
    if (!anterior) return;
    // ir() empujaría de nuevo al historial, así que lo saltamos.
    const destino = anterior.nombre;
    const params = anterior.params || {};
    if (this.actual && this.pantallas[this.actual]?.destruir) {
      this.pantallas[this.actual].destruir();
    }
    window.Game.Cinematica.cortar();
    this.actual = destino;
    this.paramsActuales = params;
    this.contenedor.innerHTML = '';
    void this.contenedor.offsetWidth;
    this.contenedor.classList.add('fade-in');
    this.renderSeguro(this.pantallas[destino], params, destino);
  }
};
