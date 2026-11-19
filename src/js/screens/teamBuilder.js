window.Game = window.Game || {};
window.Game.Screens = window.Game.Screens || {};

window.Game.Screens.constructor = {
  raza: null,
  personajes: [],
  acciones: [],

  render(contenedor) {
    this.raza = window.Game.State.perfil.razaSeleccionada || 'lunaria';
    this.personajes = [];
    this.acciones = [];

    contenedor.innerHTML = `
      <div class="pantalla constructor">
        <header class="pantalla-cabecera">
          <button class="btn-volver" id="btn-volver" aria-label="Volver"><svg class="volver-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg><span class="volver-txt">Volver</span></button>
          <h2 class="pantalla-titulo">Crea tu equipo</h2>
          <p class="pantalla-sub">
            5 personajes de tu raza y 8 acciones. Las acciones son reutilizables
            durante todo el duelo.
          </p>
          <div class="constructor-razas" id="constructor-razas"></div>
        </header>

        <div class="constructor-cuerpo">
          <section class="constructor-pool">
            <h3 class="seccion-titulo">
              Personajes <span id="conteo-personajes"></span>
            </h3>
            <div class="pool-lista" id="pool-personajes"></div>

            <h3 class="seccion-titulo" style="margin-top:18px">
              Acciones <span id="conteo-acciones"></span>
            </h3>
            <div class="pool-acciones" id="pool-acciones"></div>
          </section>

          <aside class="constructor-mazo">
            <div class="lupa" id="lupa">
              <div class="lupa-vacia">Pasa el ratón por una carta</div>
            </div>
            <h3 class="seccion-titulo">Tu equipo</h3>
            <div class="equipo-lista" id="equipo-lista"></div>
            <h3 class="seccion-titulo" style="margin-top:14px">Acciones elegidas</h3>
            <div class="equipo-acciones" id="equipo-acciones"></div>
            <div class="mazo-errores" id="equipo-errores"></div>
            <div class="mazo-acciones">
              <button class="btn-secundario" id="btn-autocompletar">Autocompletar</button>
              <button class="btn-primario" id="btn-guardar" disabled>Guardar</button>
            </div>

            <h3 class="seccion-titulo" style="margin-top:16px">
              Equipos guardados <span id="conteo-guardados"></span>
            </h3>
            <div class="guardados-lista" id="guardados-lista"></div>
          </aside>
        </div>
      </div>
    `;

    contenedor.querySelector('#btn-volver').addEventListener('click', () => {
      window.Game.Router.ir('mainMenu');
    });

    contenedor.querySelector('#btn-autocompletar').addEventListener('click', () => {
      const eq = window.Game.Team.equipoPredeterminado(this.raza);
      this.personajes = eq.personajes;
      this.acciones = eq.acciones;
      this.refrescar(contenedor);
    });

    contenedor.querySelector('#btn-guardar').addEventListener('click', () => {
      this.guardar(contenedor);
    });

    this.pintarSelectorRazas(contenedor);
    this.refrescar(contenedor);
  },

  pintarSelectorRazas(contenedor) {
    const cont = contenedor.querySelector('#constructor-razas');
    cont.innerHTML = window.Game.RACE_ORDER.map((id) => {
      const r = window.Game.RACES[id];
      return `<button data-raza="${id}" class="${id === this.raza ? 'activa' : ''}"
                      style="--raza-primario:${r.colorPrimario}">
                ${r.sigil} ${r.nombre}
              </button>`;
    }).join('');

    cont.querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.raza === this.raza) return;
        this.raza = btn.dataset.raza;
        this.personajes = []; // el pool cambia: el equipo anterior ya no vale
        this.pintarSelectorRazas(contenedor);
        this.refrescar(contenedor);
      });
    });
  },

  refrescar(contenedor) {
    this.pintarPersonajes(contenedor);
    this.pintarAcciones(contenedor);
    this.pintarEquipo(contenedor);
    this.pintarGuardados(contenedor);
    this.conectarLupa(contenedor);
  },

  /**
   * Equipos guardados de la raza actual. Sin esta lista, «Guardar» no daba
   * ninguna señal de haber hecho algo.
   */
  pintarGuardados(contenedor) {
    const todos = window.Game.State.perfil.equiposGuardados;
    const deEstaRaza = todos
      .map((e, i) => ({ ...e, indice: i }))
      .filter((e) => e.raza === this.raza)
      .reverse();

    contenedor.querySelector('#conteo-guardados').textContent =
      deEstaRaza.length ? `(${deEstaRaza.length})` : '';

    const lista = contenedor.querySelector('#guardados-lista');
    lista.innerHTML = deEstaRaza.length
      ? deEstaRaza
          .map(
            (e, pos) => `
        <div class="guardado-fila ${pos === 0 ? 'en-uso' : ''}"
             data-indice="${e.indice}">
          <span class="guardado-nombre">${e.nombre}</span>
          ${pos === 0 ? '<span class="guardado-marca">en uso</span>' : ''}
          <button class="guardado-cargar" data-cargar="${e.indice}"
                  title="Cargar este equipo">↑</button>
          <button class="guardado-borrar" data-borrar="${e.indice}"
                  title="Borrar este equipo">✕</button>
        </div>`
          )
          .join('')
      : `<p class="nota">Ninguno todavía. El duelo usará el equipo
         predeterminado de la raza.</p>`;

    lista.querySelectorAll('[data-cargar]').forEach((el) => {
      el.addEventListener('click', () => {
        const e = todos[Number(el.dataset.cargar)];
        this.personajes = [...e.personajes];
        this.acciones = [...e.acciones];
        this.refrescar(contenedor);
      });
    });

    lista.querySelectorAll('[data-borrar]').forEach((el) => {
      el.addEventListener('click', () => {
        todos.splice(Number(el.dataset.borrar), 1);
        window.Game.State.guardar();
        this.refrescar(contenedor);
      });
    });
  },

  conectarLupa(contenedor) {
    window.Game.Lupa.conectar(contenedor);
  },

  pintarPersonajes(contenedor) {
    const pool = window.Game
      .personajesDeRaza(this.raza)
      .slice()
      .sort((a, b) => a.coste - b.coste);

    contenedor.querySelector('#pool-personajes').innerHTML = pool
      .map((p) => {
        const elegido = this.personajes.includes(p.id);
        return `
        <article class="carta-mini ${elegido ? 'elegida' : ''}"
                 data-id="${p.id}"
                 data-lupa="${p.imagen}" data-lupa-nombre="${p.nombre}"
                 title="${p.nombre}">
          <img src="${p.imagen}" alt="${p.nombre}" loading="lazy">
          <span class="mini-coste">${p.coste}</span>
          <span class="mini-stats">⚔${p.ataque} 🛡${p.defensa}</span>
          ${elegido ? '<span class="mini-check">✓</span>' : ''}
          ${p.raza === 'mercenario' ? '<span class="mini-merc">?</span>' : ''}
        </article>`;
      })
      .join('');

    contenedor.querySelector('#conteo-personajes').textContent =
      `${this.personajes.length} / ${window.Game.Team.PERSONAJES}`;

    contenedor.querySelectorAll('#pool-personajes .carta-mini').forEach((el) => {
      el.addEventListener('click', () => {
        this.alternarPersonaje(el.dataset.id);
        this.refrescar(contenedor);
      });
    });
  },

  pintarAcciones(contenedor) {
    contenedor.querySelector('#pool-acciones').innerHTML = window.Game.ACTIONS.map(
      (a) => {
        const elegida = this.acciones.includes(a.id);
        // Las acciones atadas a otra raza se pueden elegir, pero no harán nada.
        const inerte = a.razaRequerida && a.razaRequerida !== this.raza;
        return `
        <article class="carta-mini accion tipo-${a.tipo} ${elegida ? 'elegida' : ''} ${
          inerte ? 'inerte' : ''
        }"
                 data-id="${a.id}"
                 data-lupa="${a.imagen}" data-lupa-nombre="${a.nombre}"
                 title="${a.nombre}${inerte ? ' — exige otra raza' : ''}">
          <img src="${a.imagen}" alt="${a.nombre}" loading="lazy">
          <span class="mini-tipo tipo-${a.tipo}">${a.tipo[0].toUpperCase()}</span>
          ${elegida ? '<span class="mini-check">✓</span>' : ''}
        </article>`;
      }
    ).join('');

    contenedor.querySelector('#conteo-acciones').textContent =
      `${this.acciones.length} / ${window.Game.Team.ACCIONES}`;

    contenedor.querySelectorAll('#pool-acciones .carta-mini').forEach((el) => {
      el.addEventListener('click', () => {
        this.alternarAccion(el.dataset.id);
        this.refrescar(contenedor);
      });
    });
  },

  pintarEquipo(contenedor) {
    const lista = contenedor.querySelector('#equipo-lista');
    lista.innerHTML = this.personajes.length
      ? this.personajes
          .map((id) => window.Game.CHARACTERS_BY_ID[id])
          .sort((a, b) => a.coste - b.coste)
          .map(
            (p) => `
        <div class="equipo-fila" data-id="${p.id}">
          <span class="mazo-coste">${p.coste}</span>
          <span class="mazo-nombre">${p.nombre}</span>
          <span class="equipo-stats">⚔${p.ataque} 🛡${p.defensa}</span>
        </div>`
          )
          .join('')
      : '<p class="nota">Elige 5 personajes.</p>';

    lista.querySelectorAll('.equipo-fila').forEach((el) => {
      el.addEventListener('click', () => {
        this.alternarPersonaje(el.dataset.id);
        this.refrescar(contenedor);
      });
    });

    const accs = contenedor.querySelector('#equipo-acciones');
    accs.innerHTML = this.acciones.length
      ? this.acciones
          .map((id) => window.Game.ACTIONS_BY_ID[id])
          .map(
            (a) => `
        <span class="ficha-accion tipo-${a.tipo}" data-id="${a.id}"
              title="${a.texto}">${a.nombre}</span>`
          )
          .join('')
      : '<p class="nota">Elige 8 acciones.</p>';

    accs.querySelectorAll('.ficha-accion').forEach((el) => {
      el.addEventListener('click', () => {
        this.alternarAccion(el.dataset.id);
        this.refrescar(contenedor);
      });
    });

    const { valido, errores, avisos } = window.Game.Team.validar(
      this.personajes,
      this.acciones,
      this.raza
    );
    contenedor.querySelector('#equipo-errores').innerHTML =
      (errores.length
        ? errores.map((e) => `<p class="error">${e}</p>`).join('')
        : '<p class="ok">Equipo válido.</p>') +
      avisos.map((a) => `<p class="aviso">${a}</p>`).join('');
    contenedor.querySelector('#btn-guardar').disabled = !valido;
  },

  alternarPersonaje(id) {
    const i = this.personajes.indexOf(id);
    if (i !== -1) {
      this.personajes.splice(i, 1);
    } else if (this.personajes.length < window.Game.Team.PERSONAJES) {
      this.personajes.push(id);
    }
  },

  alternarAccion(id) {
    const i = this.acciones.indexOf(id);
    if (i !== -1) {
      this.acciones.splice(i, 1);
    } else if (this.acciones.length < window.Game.Team.ACCIONES) {
      this.acciones.push(id);
    }
  },

  guardar(contenedor) {
    // Numera dentro de la raza, no sobre el total: «Equipo Lunaria 1, 2…».
    const deEstaRaza = window.Game.State.perfil.equiposGuardados.filter(
      (e) => e.raza === this.raza
    ).length;
    const nombre = `Equipo ${window.Game.RACES[this.raza].nombre} ${deEstaRaza + 1}`;

    window.Game.State.perfil.equiposGuardados.push({
      nombre,
      raza: this.raza,
      personajes: [...this.personajes],
      acciones: [...this.acciones]
    });

    // Repinta ya, sin esperar al disco: el escritorio va por IPC y el usuario
    // no debe ver un retardo entre pulsar y que aparezca el equipo.
    this.pintarGuardados(contenedor);
    contenedor.querySelector('#equipo-errores').innerHTML =
      `<p class="ok">Guardado como «${nombre}». Se usará en tus duelos.</p>`;

    window.Game.State.guardar();
  }
};
