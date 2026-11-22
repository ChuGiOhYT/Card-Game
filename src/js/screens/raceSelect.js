window.Game = window.Game || {};
window.Game.Screens = window.Game.Screens || {};

window.Game.Screens.seleccionRaza = {
  seleccionada: null,

  render(contenedor, params = {}) {
    this.seleccionada = window.Game.State.perfil.razaSeleccionada || null;
    this.ultimaVoz = null;

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
            <span class="raza-sigil">${window.Game.emblema(r)}</span>
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
                }">${window.Game.gemaImg(window.Game.gemaDe(id), 30)}</span>`
              : ''
          }
        </button>
      `;
    }).join('');

    contenedor.innerHTML = `
      <div class="fondo-estirpe" id="fondo-estirpe" aria-hidden="true"></div>
      <div class="pantalla">
        <header class="pantalla-cabecera">
          <button class="btn-volver" id="btn-volver" aria-label="Volver"><svg class="volver-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><span class="volver-txt">Volver</span></button>
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

        ${this.bloqueRecompensaFinal()}

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
        // Su protagonista dice su frase (si es una estirpe que ya puedes jugar
        // y no la acaba de decir: volver a pulsar la misma no la repite).
        if (el.dataset.disponible === '1' && this.ultimaVoz !== el.dataset.raza) {
          this.ultimaVoz = el.dataset.raza;
          window.Game.VocesPersonajes?.estirpe(el.dataset.raza);
        }
      });
    });

    contenedor.querySelector('#btn-volver').addEventListener('click', () => {
      window.Game.Router.ir('mainMenu');
    });

    // La ventana de la recompensa: la primera vez sale sola; después se
    // vuelve a abrir siempre con «Ver cartas» (Oscar).
    this.conectarRecompensa(contenedor.querySelector('#recompensa-final'));
    contenedor.querySelector('#btn-ver-cartas')?.addEventListener('click', () => this.abrirCartas(contenedor));
    contenedor.querySelector('#btn-historias')?.addEventListener('click', () => this.abrirHistorias(contenedor));

    this.conectarHistoriaFinal(contenedor, params);

    contenedor.querySelector('#btn-confirmar').addEventListener('click', () => {
      if (!this.seleccionada) return;
      window.Game.State.perfil.razaSeleccionada = this.seleccionada;
      window.Game.State.sesion.raza = this.seleccionada;
      window.Game.State.guardar();
      // Entrar a un calabozo pasa por su pantalla de carga: precarga el mapa,
      // el vídeo y el ambiente mientras se lee una frase de la campaña.
      if (this.entrando) return;
      this.entrando = true;
      const raza = this.seleccionada;
      const C = window.Game.Carga;
      const ir = () => { this.entrando = false; window.Game.Router.ir('historia', { raza }); };
      if (C) C.mostrar({ raza, recursos: C.recursosDeCalabozo(raza), minMs: 2200 }).then(ir);
      else ir();
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
    if (S.historiaFinalDesbloqueada() && S.historiaFinalVista()) {
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
            ${mia
              ? `<span class="gema-piedra con-imagen">${window.Game.gemaImg(gema, 38)}</span>`
              : '<span class="gema-piedra"><span class="gema-sigil">?</span></span>'}
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
                 ${S.historiaFinalVista()
                   ? '<button class="btn-secundario" id="btn-ver-cartas" type="button">Ver cartas</button>' +
                     '<button class="btn-secundario" id="btn-historias" type="button">Historias secretas</button>'
                   : ''}
               </div>`
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
                      style="--raza-primario:${r.colorPrimario}">${window.Game.gemaImg(gema, 26)}</span>`;
      })
      .join('');

    return `
      <section class="gemas es-completa">
        <span class="gemas-sigilos">${sigilos}</span>
        <strong>Cristales ${todas.length} de ${todas.length}</strong>
        <span class="nota">· ${window.Game.HISTORIA_FINAL.titulo}</span>
        <span class="gemas-botones">
          <button class="gemas-releer" id="btn-historias" type="button">Historias secretas</button>
          <button class="gemas-releer" id="btn-ver-cartas" type="button">Ver cartas</button>
          <button class="gemas-releer" id="btn-historia-final" type="button">Leerla de nuevo</button>
        </span>
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
  bloqueRecompensaFinal({ reabierta = false } = {}) {
    const S = window.Game.State;
    if (!reabierta && !S.recompensaPorAnunciar()) return '';

    const mercenarios = window.Game.HISTORIA_FINAL.desbloquea.personajes
      .map((id) => window.Game.CHARACTERS_BY_ID[id])
      .filter(Boolean);

    const gemas = window.Game.gemasTotales()
      .map(({ raza, gema }) => `<span class="rf-gema" title="${gema.nombre}"
        style="--raza-primario:${window.Game.RACES[raza].colorPrimario}">${window.Game.gemaImg(gema, 52)}</span>`)
      .join('');

    // Ventana grande (Oscar: en una casilla pequeña no se podían revisar).
    return `
      <div class="rf-velo" id="recompensa-final" role="dialog" aria-modal="true" aria-labelledby="rf-titulo">
        <div class="rf-caja">
          <div class="rf-gemas">${gemas}</div>
          <h2 class="rf-titulo" id="rf-titulo">${reabierta ? 'Cartas desbloqueadas' : 'Recompensa recibida'}</h2>
          <p class="rf-sub">${reabierta
            ? 'Los mercenarios que se unieron a tu causa: acompañan a cualquier estirpe. Toca una carta para leerla entera.'
            : 'Los cuatro cristales están reunidos. Los mercenarios se unen a tu causa y pueden acompañar a cualquier estirpe. Toca una carta para leerla entera.'}</p>
          <div class="rf-cartas">
            ${mercenarios
              .map(
                (c, i) => `
              <figure class="rf-carta" style="--i:${i}" data-personaje="${c.id}">
                <img src="${c.imagen}" alt="${c.nombre}" draggable="false">
                <figcaption>${c.nombre}</figcaption>
              </figure>`
              )
              .join('')}
          </div>
          <div class="rf-modos">
            <div class="rf-modo"><span class="rf-modo-ico">⚔</span><div><strong>Modo solo</strong><span>Duelos rápidos contra la máquina con cualquier estirpe.</span></div></div>
            <div class="rf-modo"><span class="rf-modo-ico">🃏</span><div><strong>Constructor de equipos</strong><span>Arma tus propios mazos de 5 personajes y 8 acciones.</span></div></div>
          </div>
          <button class="btn-primario rf-ok" id="btn-recompensa-vista" type="button">${reabierta ? 'Cerrar' : 'Entendido'}</button>
        </div>
      </div>`;
  },

  /**
   * Engancha la ventana de las cartas desbloqueadas: se cierra con su botón,
   * con Esc o tocando fuera. Cerrarla la marca como anunciada (la primera vez
   * es la que sale sola). Tocar una carta la amplía.
   */
  conectarRecompensa(ventana) {
    if (!ventana) return;
    const cerrar = () => {
      window.Game.State.marcarRecompensaAnunciada();
      ventana.classList.add('cerrando');
      setTimeout(() => ventana.remove(), 260);
      document.removeEventListener('keydown', alTeclear, true);
    };
    // En captura, para ver la lupa ANTES de que su propio Esc la cierre:
    // con una carta ampliada, Esc cierra solo la carta.
    const alTeclear = (e) => {
      const lupa = document.getElementById('lupa-grande');
      if (e.key === 'Escape' && !(lupa && !lupa.classList.contains('oculto'))) cerrar();
    };
    document.addEventListener('keydown', alTeclear, true);
    ventana.querySelectorAll('.rf-carta').forEach((f) => f.addEventListener('click', () => {
      const img = f.querySelector('img');
      window.Game.Lupa.ampliar(img.getAttribute('src'), img.alt);
    }));
    ventana.querySelector('#btn-recompensa-vista').addEventListener('click', cerrar);
    ventana.addEventListener('click', (e) => { if (e.target === ventana) cerrar(); });
  },

  /**
   * «Ver cartas»: vuelve a abrir la ventana de las cartas desbloqueadas,
   * siempre que se quiera (Oscar). Cada carta lleva `data-personaje`: el
   * sitio donde colgar su historia jugable cuando exista.
   */
  abrirCartas(contenedor) {
    if (contenedor.querySelector('#recompensa-final')) return;
    const raiz = contenedor.querySelector('.pantalla') || contenedor;
    raiz.insertAdjacentHTML('beforeend', this.bloqueRecompensaFinal({ reabierta: true }));
    this.conectarRecompensa(contenedor.querySelector('#recompensa-final'));
  },

  /**
   * Historias secretas (data/historiasSecretas.js): la recompensa de terminar
   * la campaña. Una tarjeta por historia con el mercenario y su mascota, su
   * avance y «Jugar»; las aún no escritas, como «Próximamente».
   */
  abrirHistorias(contenedor) {
    if (contenedor.querySelector('#historias-secretas')) return;
    const G = window.Game;
    const C = G.CHARACTERS_BY_ID;
    const S = G.State;
    const tarjeta = ({ protagonista, mascota, nombre, id = null, total = 0 }) => {
      const p = C[protagonista], m = C[mascota];
      const hechas = id ? S.progresoDe(id) : 0;
      return `
        <article class="hs-tarjeta ${id ? '' : 'proxima'}">
          <div class="hs-cartas">
            ${[p, m].filter(Boolean).map((c) => `<img src="${c.imagen}" alt="${c.nombre}" data-lupa="${c.imagen}" data-lupa-nombre="${c.nombre}" draggable="false">`).join('')}
          </div>
          <strong class="hs-nombre">${nombre}</strong>
          <span class="nota">${id ? (hechas >= total ? 'Completada' : `${hechas} de ${total} etapas`) : 'Próximamente'}</span>
          ${id ? `<button class="btn-primario hs-jugar" data-historia="${id}" type="button">${hechas >= total ? 'Volver a jugar' : hechas ? 'Continuar' : 'Jugar'}</button>` : ''}
        </article>`;
    };
    const lista = [
      ...Object.values(G.HISTORIAS_SECRETAS || {}).map((h) => tarjeta({ ...h, total: h.etapas.length })),
      ...(G.HISTORIAS_PROXIMAS || []).map((h) => tarjeta(h))
    ].join('');
    const raiz = contenedor.querySelector('.pantalla') || contenedor;
    raiz.insertAdjacentHTML('beforeend', `
      <div class="rf-velo" id="historias-secretas" role="dialog" aria-modal="true" aria-labelledby="hs-titulo">
        <div class="rf-caja">
          <h2 class="rf-titulo" id="hs-titulo">Historias secretas</h2>
          <p class="rf-sub">Después de la campaña, cada mercenario guarda su propio relato. Lo juegas solo, con su compañero. Mantén pulsada una carta para verla en grande.</p>
          <div class="hs-lista">${lista}</div>
          <button class="btn-primario rf-ok" id="btn-historias-cerrar" type="button">Cerrar</button>
        </div>
      </div>`);
    const ventana = contenedor.querySelector('#historias-secretas');
    const cerrar = () => {
      ventana.classList.add('cerrando');
      setTimeout(() => ventana.remove(), 260);
      document.removeEventListener('keydown', alTeclear, true);
    };
    const alTeclear = (e) => {
      const lupa = document.getElementById('lupa-grande');
      if (e.key === 'Escape' && !(lupa && !lupa.classList.contains('oculto'))) cerrar();
    };
    document.addEventListener('keydown', alTeclear, true);
    ventana.querySelector('#btn-historias-cerrar').addEventListener('click', cerrar);
    ventana.addEventListener('click', (e) => { if (e.target === ventana) cerrar(); });
    ventana.querySelectorAll('[data-historia]').forEach((b) => b.addEventListener('click', () => {
      if (this.entrando) return;
      this.entrando = true;
      const id = b.dataset.historia;
      const Cg = G.Carga;
      const ir = () => { this.entrando = false; G.Router.ir('historia', { raza: id }); };
      if (Cg) Cg.mostrar({ raza: id, recursos: Cg.recursosDeCalabozo(id), minMs: 2200 }).then(ir);
      else ir();
    }));
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
        <h3 class="detalle-nombre">${window.Game.emblema(r)} ${r.nombre}</h3>
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
