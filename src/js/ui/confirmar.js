/**
 * Diálogo de confirmación genérico, para acciones que no tienen vuelta atrás.
 *
 * No es una pantalla del Router: es una capa suelta colgada de `body`, como
 * el mezclador. Así se puede pedir confirmación desde cualquier pantalla sin
 * abandonarla ni depender de `window.confirm()`, que rompe con el resto de la
 * interfaz (fuente del sistema, sin la mezcla de colores del juego).
 *
 * Uso:
 *   const ok = await Game.Confirmar.preguntar({
 *     titulo: 'Reiniciar la aventura',
 *     texto: 'Perderás todo el progreso del modo historia. No se puede deshacer.',
 *     textoOk: 'Reiniciar'
 *   });
 *   if (ok) { ... }
 */
window.Game = window.Game || {};

window.Game.Confirmar = {
  capa: null,

  /**
   * @param {{titulo:string, texto:string, textoOk?:string, textoCancelar?:string}} opciones
   * @returns {Promise<boolean>} true si confirma, false si cancela o cierra.
   */
  preguntar({ titulo, texto, textoOk = 'Confirmar', textoCancelar = 'Cancelar' }) {
    // Dos preguntas a la vez no tiene sentido: se corta la anterior con «no».
    this.cerrar(false);

    return new Promise((resolve) => {
      const capa = document.createElement('div');
      capa.className = 'confirmar-capa';
      capa.innerHTML = `
        <div class="confirmar-caja" role="alertdialog" aria-modal="true"
             aria-labelledby="confirmar-titulo">
          <h3 id="confirmar-titulo">${titulo}</h3>
          <p>${texto}</p>
          <div class="confirmar-botones">
            <button class="btn-secundario" id="confirmar-no" type="button">
              ${textoCancelar}
            </button>
            <button class="btn-primario confirmar-peligro" id="confirmar-si" type="button">
              ${textoOk}
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(capa);
      this.capa = capa;
      this._resolver = resolve;

      // El foco por defecto va en CANCELAR, no en confirmar: para una acción
      // destructiva, que una tecla Intro perdida cierre sin más es lo seguro.
      capa.querySelector('#confirmar-no').focus();

      const terminar = (valor) => {
        if (!this.capa) return;
        this.capa.remove();
        this.capa = null;
        document.removeEventListener('keydown', alTeclado, true);
        const r = this._resolver;
        this._resolver = null;
        if (r) r(valor);
      };

      const alTeclado = (ev) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          terminar(false);
        }
      };

      capa.querySelector('#confirmar-si').addEventListener('click', () => terminar(true));
      capa.querySelector('#confirmar-no').addEventListener('click', () => terminar(false));
      // Clic fuera de la caja también cancela, nunca confirma.
      capa.addEventListener('click', (ev) => {
        if (ev.target === capa) terminar(false);
      });
      document.addEventListener('keydown', alTeclado, true);
    });
  },

  /** Cierra sin resolver con un valor concreto (se usa al abrir otra encima). */
  cerrar(valor = false) {
    if (!this.capa) return;
    const r = this._resolver;
    this.capa.remove();
    this.capa = null;
    this._resolver = null;
    if (r) r(valor);
  }
};
