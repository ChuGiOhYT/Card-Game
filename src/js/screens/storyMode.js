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
  /**
   * Nodos y sistema de coordenadas del mapa, con arte propio o genérico. Lo
   * usan el mapa del lateral Y la travesía, para que el personaje camine
   * exactamente por la misma curva que se ve dibujada.
   */
  geometria(cal) {
    const etapas = cal.etapas;
    const artePropio = !!(cal.mapa && cal.mapa.nodos.length === etapas.length);
    const g = artePropio
      ? {
          nodos: etapas.map((e, i) => ({ e, x: cal.mapa.nodos[i].x, y: cal.mapa.nodos[i].y })),
          ancho: cal.mapa.ancho,
          alto: cal.mapa.alto,
          imagen: cal.mapa.imagen
        }
      : { ...this.sendaGenerica(etapas), imagen: '' };
    return { ...g, artePropio };
  },

  /** El tramo curvo de sendero entre dos nodos (el mismo que se dibuja). */
  tramo(p, q) {
    const tira = (q.y - p.y) * 0.55;
    return `M${p.x} ${p.y} C${p.x} ${p.y + tira} ${q.x} ${q.y - tira} ${q.x} ${q.y}`;
  },

  /**
   * De dónde sale el personaje antes de la etapa 1: un punto anterior al
   * primer nodo, prolongando hacia atrás la dirección del sendero.
   */
  puntoDePartida(nodos, ancho, alto) {
    const [a, b] = nodos;
    const x = b ? a.x + (a.x - b.x) * 0.45 : a.x;
    const y = b ? a.y + (a.y - b.y) * 0.45 : a.y + 40;
    return { x: Math.min(ancho - 10, Math.max(10, x)), y: Math.min(alto - 6, Math.max(10, y)) };
  },

  /** Dónde descansa el personaje: en la última etapa superada. */
  puntoDeDescanso(nodos, progreso, ancho, alto) {
    return progreso > 0
      ? nodos[Math.min(progreso, nodos.length) - 1]
      : this.puntoDePartida(nodos, ancho, alto);
  },

  /** Retrato flotante del personaje que encabeza el equipo de la etapa. */
  figuraDelEquipo(razaId, etapasSuperadas) {
    const eq = window.Game.equipoDeHistoria(razaId, etapasSuperadas);
    const p = (eq ? eq.personajes : [])
      .map((id) => window.Game.CHARACTERS_BY_ID[id])
      .find((c) => c && c.imagenFlotante);
    return p ? p.imagenFlotante : null;
  },

  mapaDeAvance(cal, progreso, razaId) {
    const etapas = cal.etapas;
    const { nodos, ancho, alto, imagen, artePropio } = this.geometria(cal);
    const fondo = imagen
      ? `<image href="${imagen}" x="0" y="0" width="${ancho}" height="${alto}"/>`
      : '';

    // Un tramo por par de nodos. Se pinta como recorrido cuando la etapa a
    // la que lleva ya está superada.
    const senda = nodos
      .slice(0, -1)
      .map((p, i) => {
        const hecho = progreso >= i + 2;
        return `<path class="senda ${hecho ? 'hecha' : ''} ${artePropio ? 'sobre-imagen' : ''}"
                      d="${this.tramo(p, nodos[i + 1])}"/>`;
      })
      .join('');

    // Tu personaje, de pie donde lo dejaste: «estás aquí».
    const figura = razaId ? this.figuraDelEquipo(razaId, progreso) : null;
    const descanso = this.puntoDeDescanso(nodos, progreso, ancho, alto);
    const hF = alto * 0.13, wF = hF * 0.8;
    const viajero = figura
      ? `<image class="mapa-viajero" href="${figura}" width="${wF}" height="${hF}"
                x="${descanso.x - wF / 2}" y="${descanso.y - hF}"
                preserveAspectRatio="xMidYMax meet"/>`
      : '';

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
        <svg viewBox="0 0 ${ancho} ${alto}" style="aspect-ratio:${ancho}/${alto}" role="img"
             aria-label="Avance: ${progreso} de ${etapas.length} etapas">
          ${fondo || ''}
          <g class="mapa-senda">${senda}</g>
          ${marcas}
          ${viajero}
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
            <button class="btn-volver" id="btn-volver" aria-label="Cambiar estirpe"><svg class="volver-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><span class="volver-txt">Cambiar estirpe</span></button>
            <h2 class="pantalla-titulo tinte">${window.Game.emblema(r)} ${r.nombre}</h2>
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

    // La etapa que se enseña en la placa: la que toca jugar, o la que se pidió.
    const total = cal.etapas.length;
    this.seleccion = Math.min(total, Math.max(1, Number(params.etapa) || progreso + 1));
    this.ctx = { cal, razaId, progreso, contenedor };

    contenedor.innerHTML = `
      ${window.Game.Ambiente.html(r)}
      <div class="pantalla calabozo"
           style="--raza-primario:${r.colorPrimario};--raza-secundario:${r.colorSecundario}">
        <header class="pantalla-cabecera">
          <button class="btn-volver" id="btn-volver" aria-label="Cambiar estirpe"><svg class="volver-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><span class="volver-txt">Cambiar estirpe</span></button>
          <h2 class="pantalla-titulo tinte">${cal.nombre}</h2>
          <p class="pantalla-sub">${cal.intro}</p>
        </header>

        <!-- El mapa manda: grande, con las etapas como medallones sobre su
             camino. Pulsar uno lo enseña en la placa de al lado, que es donde
             se entra. Antes era una lista larga con un mapa pequeño al lado. -->
        <div class="calabozo-cuerpo calabozo-v2">
          <section class="calabozo-mapa">
            ${this.mapaDeAvance(cal, progreso, razaId)}
            <p class="nota mapa-resumen">
              ${progreso >= total ? 'Calabozo completado' : `${progreso} de ${total} etapas superadas`}
            </p>
          </section>
          <section class="calabozo-ficha" id="calabozo-ficha"></section>
        </div>
      </div>
    `;

    contenedor.querySelector('#btn-volver').addEventListener('click', () => {
      window.Game.Router.ir('seleccionRaza', { modo: 'historia' });
    });

    // Un medallón del mapa la enseña en la placa; entrar sigue siendo cosa del
    // botón de la placa, también en las ya superadas.
    contenedor.querySelectorAll('[data-ir-etapa]').forEach((nodo) => {
      const elegir = () => this.elegirEtapa(Number(nodo.dataset.irEtapa));
      nodo.addEventListener('click', elegir);
      nodo.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          elegir();
        }
      });
    });

    this.viajando = false;
    this.pintarFicha();

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

  elegirEtapa(n) {
    this.seleccion = n;
    this.pintarFicha();
  },

  /** Unas cartas en abanico pequeño (la oleada, la recompensa). */
  abanico(cartas) {
    const medio = (cartas.length - 1) / 2;
    return cartas
      .map((c, i) => {
        const d = i - medio;
        return `<div class="pe-carta" style="--giro:${(d * 7).toFixed(1)}deg;--alto:${(Math.abs(d) * Math.abs(d) * 3).toFixed(1)}px"
                     data-lupa="${c.imagen}" data-lupa-nombre="${c.nombre}" title="${c.nombre}">
                  <img src="${c.imagen}" alt="${c.nombre}" loading="lazy">
                </div>`;
      })
      .join('');
  },

  /**
   * La placa de la etapa elegida: su medallón, título, narración, la oleada y
   * la recompensa en abanico, y un botón grande para entrar. Las flechas pasan
   * a la anterior o la siguiente sin volver al mapa.
   */
  pintarFicha() {
    const { cal, razaId, progreso, contenedor } = this.ctx;
    const caja = contenedor.querySelector('#calabozo-ficha');
    if (!caja) return;
    const n = this.seleccion;
    const e = cal.etapas[n - 1];
    const total = cal.etapas.length;
    const desbloqueada = n <= progreso + 1;
    const completada = n <= progreso;
    const equipo = window.Game.equipoDeHistoria(razaId, n - 1);
    const C = window.Game.CHARACTERS_BY_ID;
    const A = window.Game.ACTIONS_BY_ID;
    const criaturas = e.criaturas.map((id) => C[id]).filter(Boolean);
    const rec = e.recompensa || {};
    const premio = [rec.personaje && C[rec.personaje], rec.accion && A[rec.accion]].filter(Boolean);

    caja.innerHTML = `
      <article class="placa-etapa ${completada ? 'completada' : desbloqueada ? 'actual' : 'bloqueada'}
                      ${e.esJefe ? 'es-jefe' : ''}">
        <div class="pe-cab">
          <button class="pe-flecha" data-mover="-1" ${n === 1 ? 'disabled' : ''}
                  aria-label="Etapa anterior">‹</button>
          <span class="pe-medalla">${completada ? '✓' : n}</span>
          <div class="pe-nombre">
            <span class="pe-sup">Etapa ${n} de ${total}${e.esJefe ? ' · Jefe' : ''}${
              completada ? ' · superada' : desbloqueada ? '' : ' · cerrada'
            }</span>
            <h3 class="pe-titulo">${e.titulo}</h3>
          </div>
          <button class="pe-flecha" data-mover="1" ${n === total ? 'disabled' : ''}
                  aria-label="Etapa siguiente">›</button>
        </div>

        ${
          desbloqueada
            ? `<p class="pe-narracion">${e.narracion}</p>`
            : '<p class="pe-narracion oculta-texto">Supera la etapa anterior para leer lo que espera aquí.</p>'
        }

        <div class="pe-bloques">
          <div class="pe-bloque">
            <span class="pe-rotulo">Oleada · ${criaturas.length}</span>
            <div class="pe-abanico">${this.abanico(criaturas)}</div>
          </div>
          ${
            premio.length
              ? `<div class="pe-bloque">
                   <span class="pe-rotulo">${completada ? 'Conseguido' : 'Recompensa'}</span>
                   <div class="pe-abanico ${desbloqueada ? '' : 'velado'}">${this.abanico(premio)}</div>
                 </div>`
              : ''
          }
        </div>

        <div class="pe-pie">
          <span class="nota">
            Llevas ${equipo.personajes.length}
            ${equipo.personajes.length === 1 ? 'personaje' : 'personajes'}
            y ${equipo.acciones.length} acciones.
          </span>
          ${
            desbloqueada
              ? `<button class="btn-primario btn-entrar" data-etapa="${n}">
                   ${completada ? 'Repetir' : 'Entrar'}
                 </button>`
              : '<span class="pe-candado">🔒 Cerrada</span>'
          }
        </div>
      </article>`;

    // El medallón elegido, marcado en el mapa.
    contenedor.querySelectorAll('[data-ir-etapa]').forEach((g) => {
      g.classList.toggle('seleccionada', Number(g.dataset.irEtapa) === n);
    });

    caja.querySelectorAll('[data-mover]').forEach((b) => {
      b.addEventListener('click', () => this.elegirEtapa(n + Number(b.dataset.mover)));
    });
    caja.querySelector('[data-etapa]')?.addEventListener('click', () => this.entrar(n));
    window.Game.Lupa.conectar(contenedor);

  },

  /** Cinemática de entrada, travesía y al duelo. */
  async entrar(n) {
    // Dos clics seguidos lanzarían dos travesías encima una de otra.
    if (this.viajando) return;
    this.viajando = true;
    const { cal, razaId } = this.ctx;
    const etapa = cal.etapas.find((x) => x.n === n) || {};
    const cine = etapa.cineEntrada;
    // El texto se lee antes de la mesa, no encima de ella: se espera la
    // cinemática y solo después se navega.
    if (cine) {
      await window.Game.Cinematica.mostrar(cine.texto, cine.segundos);
    }
    await this.travesiaHacia(cal, razaId, n);
    window.Game.Router.ir('partida', { raza: razaId, etapa: n, modo: 'historia' });
  },

  /**
   * El personaje recorre el sendero desde la etapa anterior hasta la `n` y
   * le salen al paso sus enemigos. Sirve igual para avanzar que para repetir
   * una etapa ya superada. Si no hay retrato que mueva, no se hace nada y el
   * duelo empieza como antes.
   */
  async travesiaHacia(cal, razaId, n) {
    const figura = this.figuraDelEquipo(razaId, n - 1);
    if (!figura || !window.Game.Travesia) return;
    const { nodos, ancho, alto, imagen } = this.geometria(cal);
    const hasta = nodos[n - 1];
    if (!hasta) return;
    const desde = n > 1 ? nodos[n - 2] : this.puntoDePartida(nodos, ancho, alto);
    const etapa = cal.etapas[n - 1];
    const enemigos = etapa.criaturas.map((id) => window.Game.CHARACTERS_BY_ID[id]).filter(Boolean);

    // Con tema 2D: se recorre el bosque de lado, y el mapa queda de minimapa
    // marcando por dónde vas.
    const E2 = window.Game.Escenario2D;
    if (E2 && E2.tiene(cal.escenario2d)) {
      const raza = window.Game.RACES[razaId];
      const C = window.Game.CHARACTERS_BY_ID;
      const equipo = window.Game.equipoDeHistoria(razaId, n - 1).personajes;
      const liderId = equipo.find((id) => C[id] && C[id].imagenFlotante);
      const actor = (id) => id && C[id] && C[id].imagenFlotante
        ? { id, imagen: C[id].imagenFlotante, voltear: E2.MIRAN_A_LA_IZQUIERDA.has(id) }
        : null;
      // El acompañante es quien le habla en el diálogo de la etapa (si está en
      // el equipo y tiene retrato); sin diálogo, el líder va solo.
      const dialogo = (etapa.dialogo || [])
        .filter((d) => C[d.quien] && d.texto)
        .map((d) => ({ ...d, nombre: C[d.quien].nombre.split(',')[0] }));
      const compId = dialogo.map((d) => d.quien)
        .find((id) => id !== liderId && equipo.includes(id) && C[id].imagenFlotante);
      await E2.recorrer({
        tema: cal.escenario2d,
        fondo: raza && raza.fondo,
        desde: n - 1,
        hasta: n,
        etapas: cal.etapas.length,
        jefe: (cal.etapas.findIndex((e) => e.esJefe) + 1) || cal.etapas.length,
        figura,
        lider: actor(liderId),
        compania: actor(compId),
        dialogo,
        enemigos,
        titulo: `<span>Etapa ${n}</span>${etapa.titulo}`,
        minimapa: { imagen, ancho, alto, nodos, ruta: this.tramo(desde, hasta) }
      });
      return;
    }

    await window.Game.Travesia.recorrer({
      imagen, ancho, alto,
      ruta: this.tramo(desde, hasta),
      figura,
      enemigos: etapa.criaturas.map((id) => window.Game.CHARACTERS_BY_ID[id]).filter(Boolean)
    });
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
