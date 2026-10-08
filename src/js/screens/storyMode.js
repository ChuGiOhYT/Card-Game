window.Game = window.Game || {};
window.Game.Screens = window.Game.Screens || {};

window.Game.Screens.historia = {
  /**
   * Mapa de avance: un sendero con un nodo por etapa.
   *
   * Si el calabozo trae `cal.mapa` (arte con coordenadas plantadas a mano
   * sobre su propio camino visible), el sendero se dibuja ENCIMA de esa
   * imagen, en su sistema de píxeles. Si no lo trae, se cae al sendero
   * genérico de siempre —zigzag izquierda/derecha generado— que se adapta
   * solo a calabozos de cualquier largo. Los cuatro calabozos actuales ya
   * tienen su mapa; el modo genérico queda de red para uno nuevo sin arte.
   */
  mapaDeAvance(cal, progreso) {
    const etapas = cal.etapas;
    const artePropio = cal.mapa && cal.mapa.nodos.length === etapas.length;

    const { nodos, ancho, alto, fondo } = artePropio
      ? {
          nodos: etapas.map((e, i) => ({ e, x: cal.mapa.nodos[i].x, y: cal.mapa.nodos[i].y })),
          ancho: cal.mapa.ancho,
          alto: cal.mapa.alto,
          fondo: `<image href="${cal.mapa.imagen}" x="0" y="0"
                          width="${cal.mapa.ancho}" height="${cal.mapa.alto}"/>`
        }
      : this.sendaGenerica(etapas);

    // Un tramo por par de nodos. Se pinta como recorrido cuando la etapa a
    // la que lleva ya está superada.
    const senda = nodos
      .slice(0, -1)
      .map((p, i) => {
        const q = nodos[i + 1];
        const tira = (q.y - p.y) * 0.55;
        const hecho = progreso >= i + 2;
        return `<path class="senda ${hecho ? 'hecha' : ''} ${artePropio ? 'sobre-imagen' : ''}"
                      d="M${p.x} ${p.y} C${p.x} ${p.y + tira}
                         ${q.x} ${q.y - tira} ${q.x} ${q.y}"/>`;
      })
      .join('');

    const marcas = nodos
      .map(({ e, x, y }) => {
        const completada = e.n <= progreso;
        const actual = e.n === progreso + 1;
        const estado = completada ? 'hecha' : actual ? 'actual' : 'cerrada';
        const r = e.esJefe ? 19 : 14;
        // Con arte propio ya no hay un IZQ/DER fijo: el rótulo huye del borde
        // más cercano, según a qué mitad del ancho real haya caído el nodo.
        const alaIzquierda = x < ancho / 2;

        return `
          <g class="mapa-nodo ${estado} ${e.esJefe ? 'es-jefe' : ''} ${artePropio ? 'sobre-imagen' : ''}"
             data-ir-etapa="${e.n}" tabindex="0" role="button">
            <title>${e.n}. ${e.titulo}</title>
            ${e.esJefe ? `<circle class="aro" cx="${x}" cy="${y}" r="${r + 6}"/>` : ''}
            <circle class="halo" cx="${x}" cy="${y}" r="${r + 4}"/>
            <circle class="disco" cx="${x}" cy="${y}" r="${r}"/>
            <text class="marca" x="${x}" y="${y}">${
              completada ? '✓' : e.n
            }</text>
            ${
              // Al costado y no debajo: el nodo del jefe es el último y la
              // lupa anclada al fondo del lateral le comía el rótulo.
              e.esJefe
                ? `<text class="rotulo" x="${
                    alaIzquierda ? x + r + 8 : x - r - 8
                  }" y="${y}" text-anchor="${
                    alaIzquierda ? 'start' : 'end'
                  }">JEFE</text>`
                : ''
            }
          </g>`;
      })
      .join('');

    return `
      <div class="mapa-calabozo ${artePropio ? 'con-arte' : ''}">
        <svg viewBox="0 0 ${ancho} ${alto}" role="img"
             aria-label="Avance: ${progreso} de ${etapas.length} etapas">
          ${fondo || ''}
          <g class="mapa-senda">${senda}</g>
          ${marcas}
        </svg>
      </div>`;
  },

  /**
   * El sendero de respaldo, sin arte propio: zigzag genérico que se adapta a
   * cualquier número de etapas. Es lo que había antes de haber mapas.
   */
  sendaGenerica(etapas) {
    const PASO = 56; // separación vertical entre nodos
    const Y0 = 32;
    const IZQ = 66;
    const DER = 194;
    const ancho = 260;
    const alto = Y0 + (etapas.length - 1) * PASO + 28;
    const nodos = etapas.map((e, i) => ({
      e,
      x: i % 2 === 0 ? IZQ : DER,
      y: Y0 + i * PASO
    }));
    return { nodos, ancho, alto, fondo: '' };
  },

  render(contenedor, params = {}) {
    const razaId = params.raza || window.Game.State.sesion.raza || 'desterrado';
    const r = window.Game.RACES[razaId];
    const cal = window.Game.calabozoDe(razaId);
    const progreso = window.Game.State.progresoDe(razaId);

    // El tema de la estirpe viene sonando desde la pantalla de selección, y
    // `ponerMusica` no reinicia la que ya está puesta: esto solo lo cubre
    // cuando se entra al calabozo por otra vía, como volver de una etapa.
    window.Game.Audio.ponerMusica(razaId);

    if (!cal) {
      const pendiente = window.Game.DUNGEONS_PENDIENTES[razaId];
      contenedor.innerHTML = `
        <div class="pantalla" style="--raza-primario:${r.colorPrimario}">
          <header class="pantalla-cabecera">
            <button class="btn-volver" id="btn-volver">← Cambiar estirpe</button>
            <h2 class="pantalla-titulo tinte">${r.sigil} ${r.nombre}</h2>
            <p class="pantalla-sub">${pendiente ? pendiente.nombre : 'Calabozo'}</p>
          </header>
          <div class="calabozo-pendiente">
            <p>Este calabozo todavía no tiene sus criaturas definidas.</p>
            <p class="nota">
              El único jugable ahora mismo es el Bosque Nocturno, de los Desterrados.
            </p>
          </div>
        </div>`;
      contenedor.querySelector('#btn-volver').addEventListener('click', () => {
        window.Game.Router.ir('seleccionRaza', { modo: 'historia' });
      });
      return;
    }

    const etapas = cal.etapas
      .map((e) => {
        const desbloqueada = e.n <= progreso + 1;
        const completada = e.n <= progreso;
        const equipo = window.Game.equipoDeHistoria(razaId, e.n - 1);

        const criaturas = e.criaturas
          .map((id) => window.Game.CHARACTERS_BY_ID[id])
          .map(
            (c) => `
            <div class="etapa-criatura" data-lupa="${c.imagen}"
                 data-lupa-nombre="${c.nombre}" title="${c.nombre}">
              <img src="${c.imagen}" alt="${c.nombre}" loading="lazy">
            </div>`
          )
          .join('');

        return `
          <article data-ficha-etapa="${e.n}"
                   class="etapa ${desbloqueada ? '' : 'bloqueada'}
                          ${completada ? 'completada' : ''}
                          ${e.esJefe ? 'es-jefe' : ''}">
            <div class="etapa-cab">
              <span class="etapa-num">${String(e.n).padStart(2, '0')}</span>
              <div class="etapa-titulo">
                <strong>${e.titulo}</strong>
                <span class="etapa-meta">
                  ${equipo.personajes.length}
                  ${equipo.personajes.length === 1 ? 'personaje' : 'personajes'}
                  · ${e.criaturas.length}
                  ${e.criaturas.length === 1 ? 'enemigo' : 'enemigos'}
                </span>
              </div>
              <span class="etapa-estado">
                ${completada ? '✓' : desbloqueada ? '▸' : '🔒'}
              </span>
            </div>

            ${
              desbloqueada
                ? `<p class="etapa-narracion">${e.narracion}</p>
                   <div class="etapa-criaturas">${criaturas}</div>
                   <div class="etapa-pie">
                     <span class="nota">
                       Llevas ${equipo.personajes.length}
                       ${equipo.personajes.length === 1 ? 'personaje' : 'personajes'}
                       y ${equipo.acciones.length} acciones.
                     </span>
                     <button class="btn-primario" data-etapa="${e.n}">
                       ${completada ? 'Repetir' : 'Entrar'}
                     </button>
                   </div>`
                : '<p class="etapa-narracion oculta-texto">Supera la etapa anterior.</p>'
            }
          </article>`;
      })
      .join('');

    contenedor.innerHTML = `
      ${window.Game.Ambiente.html(r)}
      <div class="pantalla calabozo"
           style="--raza-primario:${r.colorPrimario};--raza-secundario:${r.colorSecundario}">
        <header class="pantalla-cabecera">
          <button class="btn-volver" id="btn-volver">← Cambiar estirpe</button>
          <h2 class="pantalla-titulo tinte">${cal.nombre}</h2>
          <p class="pantalla-sub">${cal.intro}</p>
        </header>

        <div class="calabozo-cuerpo">
          <div class="etapa-lista">${etapas}</div>
          <aside class="calabozo-lateral">
            <h4 class="seccion-titulo">Mapa del calabozo</h4>
            ${this.mapaDeAvance(cal, progreso)}
            <p class="nota mapa-resumen">
              ${progreso} de ${cal.etapas.length} etapas superadas.
            </p>
            <div class="lupa" id="lupa">
              <div class="lupa-vacia">Pasa el ratón por una criatura</div>
            </div>
          </aside>
        </div>
      </div>
    `;

    contenedor.querySelector('#btn-volver').addEventListener('click', () => {
      window.Game.Router.ir('seleccionRaza', { modo: 'historia' });
    });

    // Un nodo del mapa lleva a su ficha en la lista, no a la partida: entrar
    // sigue siendo cosa del botón de la ficha, también en las ya superadas.
    contenedor.querySelectorAll('[data-ir-etapa]').forEach((nodo) => {
      const irAFicha = () => {
        const ficha = contenedor.querySelector(
          `[data-ficha-etapa="${nodo.dataset.irEtapa}"]`
        );
        if (!ficha) return;
        ficha.scrollIntoView({ behavior: 'smooth', block: 'center' });
        ficha.classList.add('destacada');
        setTimeout(() => ficha.classList.remove('destacada'), 1200);
      };
      nodo.addEventListener('click', irAFicha);
      nodo.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          irAFicha();
        }
      });
    });

    contenedor.querySelectorAll('[data-etapa]').forEach((el) => {
      el.addEventListener('click', async () => {
        const n = Number(el.dataset.etapa);
        const cine = (cal.etapas.find((e) => e.n === n) || {}).cineEntrada;
        // El texto se lee antes de la mesa, no encima de ella: se espera la
        // cinemática y solo después se navega.
        if (cine) {
          await window.Game.Cinematica.mostrar(cine.texto, cine.segundos);
        }
        window.Game.Router.ir('partida', { raza: razaId, etapa: n, modo: 'historia' });
      });
    });

    window.Game.Ambiente.conectar(contenedor);
    window.Game.Lupa.conectar(contenedor);

    // Entrada al calabozo: una vez por sesión y no cada vez que se pinta esta
    // pantalla, que también se vuelve a ella tras cada duelo. Va al final del
    // render y sin esperarla: la pantalla ya está montada debajo del negro, así
    // que el jugador la encuentra lista al saltar.
    //
    // Primero el vídeo y DESPUÉS el texto, encadenados: si se lanzaran a la vez,
    // `Cinematica.mostrar` cortaría el vídeo al montar su propia capa —solo
    // sostiene una—. Cada uno lleva su clave de «visto», así que saltar el vídeo
    // no se salta el texto.
    this.escenaDeEntrada(cal);
  },

  /** El vídeo de entrada, si lo hay, y luego el texto dorado. */
  async escenaDeEntrada(cal) {
    if (cal.videoIntro) {
      await window.Game.Cinematica.videoUnaVez(`intro:${cal.id}`, cal.videoIntro);
    }
    if (cal.cinematica) {
      await window.Game.Cinematica.mostrarUnaVez(
        `calabozo:${cal.id}`,
        cal.cinematica.texto,
        cal.cinematica.segundos
      );
    }
  }
};
