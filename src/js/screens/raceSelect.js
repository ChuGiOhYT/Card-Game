window.Game = window.Game || {};
window.Game.Screens = window.Game.Screens || {};

window.Game.Screens.seleccionRaza = {
  seleccionada: null,

  render(contenedor, params = {}) {
    this.seleccionada = window.Game.State.perfil.razaSeleccionada || null;

    const tarjetas = window.Game.RACE_ORDER.map((id, i) => {
      const r = window.Game.RACES[id];
      const progreso = window.Game.State.progresoDe(id);
      const disponible = window.Game.State.calabozoDisponible(id);
      const completo = window.Game.State.calabozoCompleto(id);
      const req = window.Game.State.requisitoDe(id);
      const cal = window.Game.calabozoDe(id);
      const total = cal ? cal.etapas.length : 0;

      const estado = !disponible
        ? `🔒 Termina ${req.calabozo || req.nombre}`
        : completo
          ? `✓ Completado`
          : progreso > 0
            ? `Etapa ${progreso} de ${total}`
            : 'Sin comenzar';

      // El líder de la estirpe (el primero con quien empieza su calabozo),
      // de pie sobre el tapete de su tierra. Cerrada, se ve en silueta.
      const lider = cal && cal.personajesIniciales
        .map((pid) => window.Game.CHARACTERS_BY_ID[pid])
        .find((c) => c && c.imagenFlotante);

      return `
        <button class="raza-tarjeta ${disponible ? '' : 'bloqueada'}
                      ${completo ? 'completada' : ''}"
                data-raza="${id}" data-disponible="${disponible ? '1' : '0'}"
                style="--raza-primario:${r.colorPrimario};--raza-secundario:${r.colorSecundario}">
          <span class="rt-tapete" style="background-image:url('assets/tapetes/${id}.webp')"></span>
          ${lider ? `<img class="rt-lider" src="${lider.imagenFlotante}" alt="" draggable="false">` : ''}
          <span class="raza-orden">${i + 1}</span>
          ${disponible ? '' : '<span class="rt-candado" aria-hidden="true">🔒</span>'}
          <span class="rt-texto">
            <span class="raza-sigil">${r.sigil}</span>
            <span class="raza-nombre">${r.nombre}</span>
            <span class="raza-lema">${r.lema}</span>
            <span class="raza-progreso">${estado}</span>
          </span>
          ${
            // La gema del Eternal caído. Se marca en la tarjeta porque es donde
            // se ve la campaña entera de un vistazo.
            window.Game.State.tieneGema(id)
              ? `<span class="raza-gema" title="${
                  window.Game.gemaDe(id).nombre
                }">${window.Game.gemaDe(id).sigil}</span>`
              : ''
          }
        </button>
      `;
    }).join('');

    contenedor.innerHTML = `
      <div class="fondo-estirpe" id="fondo-estirpe" aria-hidden="true"></div>
      <div class="pantalla">
        <header class="pantalla-cabecera">
          <button class="btn-volver" id="btn-volver">← Volver</button>
          <h2 class="pantalla-titulo">Elige tu estirpe</h2>
          <p class="pantalla-sub">
            La campaña es lineal: cada estirpe se abre al terminar la
            anterior. Los 6 mercenarios pueden acompañar a cualquiera.
          </p>
        </header>

        <div class="raza-rejilla">${tarjetas}</div>

        <!-- La vitrina al LADO de la ficha: esta pantalla no se desplaza y la
             ficha necesita su alto; encima de ella se lo comía. -->
        <div class="raza-bajo">
          ${this.bloqueGemas()}

          <section class="raza-detalle" id="raza-detalle">
            <p class="raza-detalle-vacio">
              Selecciona una estirpe para ver su ficha.
            </p>
          </section>
        </div>

        <footer class="pantalla-pie">
          <button class="btn-primario" id="btn-confirmar" disabled>
            Comenzar historia
          </button>
        </footer>
      </div>
    `;

    contenedor.querySelectorAll('.raza-tarjeta').forEach((el) => {
      el.addEventListener('click', () => {
        // Una estirpe cerrada se puede mirar, pero no elegir.
        this.seleccionar(contenedor, el.dataset.raza, el.dataset.disponible === '1');
      });
    });

    contenedor.querySelector('#btn-volver').addEventListener('click', () => {
      window.Game.Router.ir('mainMenu');
    });

    contenedor.querySelector('#btn-recompensa-vista')?.addEventListener('click', () => {
      window.Game.State.marcarRecompensaAnunciada();
      // Se sustituye SOLO esta sección por su versión de una línea, sin repintar
      // la pantalla: `render()` relee la estirpe elegida del perfil, y ahí solo
      // está la confirmada con «Comenzar historia». Repintando aquí se perdería
      // la ficha que el jugador estaba mirando, que es justo lo que se quiere
      // arreglar. Cambiar la sección se lleva de paso el aviso, que va dentro.
      const seccion = contenedor.querySelector('.gemas');
      if (!seccion) return;
      seccion.outerHTML = this.bloqueGemasCompacto(window.Game.gemasTotales());
      this.conectarHistoriaFinal(contenedor, params);
    });

    this.conectarHistoriaFinal(contenedor, params);

    contenedor.querySelector('#btn-confirmar').addEventListener('click', () => {
      if (!this.seleccionada) return;
      window.Game.State.perfil.razaSeleccionada = this.seleccionada;
      window.Game.State.sesion.raza = this.seleccionada;
      window.Game.State.guardar();
      window.Game.Router.ir('historia', { raza: this.seleccionada });
    });

    if (this.seleccionada) this.seleccionar(contenedor, this.seleccionada);
  },

  /**
   * Las cuatro gemas: las conseguidas y los huecos de las que faltan.
   *
   * Es solo registro —no se usan para nada—, así que se enseña como una
   * vitrina: qué llevas y qué queda. Con las cuatro se anuncia la historia
   * final, que todavía no tiene contenido; no se pinta ningún botón que no
   * lleve a ninguna parte.
   */
  bloqueGemas() {
    const S = window.Game.State;
    const todas = window.Game.gemasTotales();
    if (!todas.length) return '';
    const tengo = S.gemas().length;

    // Con los cuatro reunidos y el aviso ya cerrado, la vitrina no informa de
    // nada: es un trofeo. Se encoge a una línea porque esta pantalla no se
    // desplaza —`.pantalla` es `overflow: hidden`— y lo único flexible es la
    // ficha de la estirpe, que es para lo que se entra aquí. Medido: la versión
    // completa se comía 161 px y dejaba la ficha en 157 de los 322 que necesita.
    if (S.historiaFinalDesbloqueada() && !S.recompensaPorAnunciar()) {
      return this.bloqueGemasCompacto(todas);
    }

    const piezas = todas
      .map(({ raza, gema }) => {
        const mia = S.tieneGema(raza);
        const r = window.Game.RACES[raza];
        return `
          <div class="gema ${mia ? 'conseguida' : 'pendiente'}"
               title="${mia ? gema.mensaje : 'Derriba al Eternal de ' + r.nombre}"
               style="--raza-primario:${r.colorPrimario}">
            <span class="gema-piedra"><span class="gema-sigil">${mia ? gema.sigil : '?'}</span></span>
            <span class="gema-nombre">${mia ? gema.nombre : r.nombre}</span>
          </div>`;
      })
      .join('');

    return `
      <section class="gemas">
        <div class="gemas-cab">
          <strong>Cristales de los Eternals</strong>
          <span class="nota">${tengo} de ${todas.length}</span>
        </div>
        <div class="gemas-fila">${piezas}</div>
        ${
          S.historiaFinalDesbloqueada()
            ? `<div class="gemas-final">
                 <div>
                   <strong>${window.Game.HISTORIA_FINAL.titulo}</strong>
                   <p class="nota">
                     Los cuatro cristales están reunidos.
                     ${S.historiaFinalVista() ? 'Puedes volver a leerla.' : 'Historia secreta desbloqueada.'}
                   </p>
                 </div>
                 <button class="btn-primario" id="btn-historia-final" type="button">
                   ${S.historiaFinalVista() ? 'Leerla de nuevo' : 'Leer la historia secreta'}
                 </button>
               </div>
               ${this.bloqueRecompensaFinal()}`
            : `<p class="nota gemas-pie">
                 Cada Eternal derribado deja el suyo. Los cuatro juntos abren
                 una última historia.
               </p>`
        }
      </section>`;
  },

  /**
   * Engancha el botón de leer la historia oculta. Está aparte porque la sección
   * se puede sustituir en caliente al cerrar el aviso, y entonces hay que
   * volver a conectarlo: el oyente se va con el nodo viejo.
   */
  conectarHistoriaFinal(contenedor, params) {
    contenedor.querySelector('#btn-historia-final')?.addEventListener('click', async () => {
      await window.Game.Cinematica.mostrar(window.Game.HISTORIA_FINAL.texto);
      window.Game.State.marcarHistoriaFinalVista();
      // Repinta para que aparezcan la recompensa y el nuevo rótulo. Si el
      // jugador se fue de la pantalla durante la cinemática, no hay nada que
      // repintar.
      if (window.Game.Router.actual === 'seleccionRaza') this.render(contenedor, params);
    });
  },

  /** La vitrina ya completa, en una línea: los cuatro sigilos y la relectura. */
  bloqueGemasCompacto(todas) {
    const sigilos = todas
      .map(({ raza, gema }) => {
        const r = window.Game.RACES[raza];
        return `<span class="gema-sigil" title="${gema.nombre}"
                      style="--raza-primario:${r.colorPrimario}">${gema.sigil}</span>`;
      })
      .join('');

    return `
      <section class="gemas es-completa">
        <span class="gemas-sigilos">${sigilos}</span>
        <strong>Cristales ${todas.length} de ${todas.length}</strong>
        <span class="nota">· ${window.Game.HISTORIA_FINAL.titulo}</span>
        <button class="gemas-releer" id="btn-historia-final" type="button">
          Leerla de nuevo
        </button>
      </section>`;
  },

  /**
   * La recompensa de la historia oculta, ya cobrada: los mercenarios y los dos
   * modos. Se enseña DESPUÉS de leerla, no antes, porque es el premio del final
   * y no una promesa —y porque leerla es justamente lo que la concede.
   *
   * Es de UN SOLO USO: se cierra con «Entendido» y no vuelve. Fijo ocupaba
   * tanto que hundía la ficha de la estirpe fuera de la pantalla, y esa ficha
   * es para lo que se entra aquí.
   */
  bloqueRecompensaFinal() {
    const S = window.Game.State;
    if (!S.recompensaPorAnunciar()) return '';

    const mercenarios = window.Game.HISTORIA_FINAL.desbloquea.personajes
      .map((id) => window.Game.CHARACTERS_BY_ID[id])
      .filter(Boolean);

    return `
      <div class="gemas-recompensa">
        <span class="gemas-recompensa-titulo">Recompensa recibida</span>
        <div class="gemas-recompensa-cartas">
          ${mercenarios
            .map(
              (c) => `
            <div class="mini-carta" data-lupa="${c.imagen}" data-lupa-nombre="${c.nombre}"
                 title="${c.nombre}">
              <img src="${c.imagen}" alt="${c.nombre}" loading="lazy">
            </div>`
            )
            .join('')}
        </div>
        <p class="nota">
          Los mercenarios se unen a tu causa y pueden acompañar a cualquier
          estirpe. Con ellos se abren el <strong>modo solo</strong> y el
          <strong>constructor de equipos</strong>.
        </p>
        <button class="btn-primario" id="btn-recompensa-vista" type="button">
          Entendido
        </button>
      </div>`;
  },

  seleccionar(contenedor, razaId, disponible = true) {
    this.seleccionada = disponible ? razaId : null;
    const r = window.Game.RACES[razaId];

    contenedor.querySelectorAll('.raza-tarjeta').forEach((el) => {
      el.classList.toggle('activa', el.dataset.raza === razaId);
    });

    // El ambiente sigue a la estirpe que se está mirando, esté disponible o
    // no: enseñar su bosque es parte de dar ganas de llegar hasta ella. Su
    // tema hace lo mismo, y por el mismo motivo.
    window.Game.Audio.ponerMusica(razaId);

    window.Game.Ambiente.aplicar(contenedor.querySelector('#fondo-estirpe'), r);

    // Se resuelve ANTES de pintar la ficha: si el detalle falla al
    // renderizarse, el jugador no debe quedarse sin poder continuar.
    const btn = contenedor.querySelector('#btn-confirmar');
    btn.disabled = !disponible;
    if (disponible) {
      btn.textContent = window.Game.State.calabozoCompleto(razaId)
        ? 'Volver a jugar'
        : 'Comenzar historia';
    } else {
      const req = window.Game.State.requisitoDe(razaId);
      btn.textContent = `🔒 Termina primero ${req.calabozo || req.nombre}`;
    }

    // La sangre es igual para todos; lo que distingue a una raza es su
    // plantilla propia (los mercenarios los comparten todas, así que no
    // cuentan para describirla).
    const propios = window.Game.CHARACTERS.filter((c) => c.raza === razaId);
    const media = (campo) =>
      (propios.reduce((s, p) => s + p[campo], 0) / propios.length).toFixed(1);

    // Curva de costes: cuántas cartas hay en cada escalón.
    const escalones = [...new Set(window.Game.CHARACTERS.map((c) => c.coste))]
      .filter((c) => c !== 5) // el 5 es exclusivo de los mercenarios
      .sort((a, b) => a - b);
    const curva = escalones
      .map((coste) => {
        const n = propios.filter((p) => p.coste === coste).length;
        return `<li class="${n ? '' : 'vacio'}">
                  <span>${coste}</span><strong>${n || '—'}</strong>
                </li>`;
      })
      .join('');

    const detalle = contenedor.querySelector('#raza-detalle');
    detalle.style.setProperty('--raza-primario', r.colorPrimario);
    detalle.style.setProperty('--raza-secundario', r.colorSecundario);
    detalle.innerHTML = `
      <div class="detalle-columna">
        <h3 class="detalle-nombre">${r.sigil} ${r.nombre}</h3>
        <p class="detalle-desc">${r.descripcion}</p>
        <div class="detalle-etiquetas">
          ${r.afinidad.map((a) => `<span class="etiqueta">${a}</span>`).join('')}
          <span class="etiqueta">dificultad ${'◆'.repeat(r.dificultad)}</span>
        </div>
      </div>
      <div class="detalle-columna">
        <div class="detalle-pasiva">
          <span class="detalle-etiqueta-titulo">Curva de coste</span>
          <ul class="detalle-curva">${curva}</ul>
          <p>Cartas propias en cada escalón de sangre derramada.</p>
        </div>
        <ul class="detalle-stats">
          <li><span>Sangre</span><strong>${window.Game.SANGRE_TOTAL}</strong></li>
          <li><span>Personajes propios</span><strong>${propios.length}</strong></li>
          <li><span>Ataque medio</span><strong>${media('ataque')}</strong></li>
          <li><span>Defensa medio</span><strong>${media('defensa')}</strong></li>
        </ul>
      </div>
    `;
  }
};
