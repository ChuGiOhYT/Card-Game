/**
 * Banco de simulación de duelos.
 *
 * Juega miles de partidas entre dos estrategias y saca números: quién gana,
 * en cuántos turnos y por qué vía. Sirve para afinar la heurística de
 * `core/ai.js` con datos en vez de con intuición.
 *
 * Corre en Node puro, sin Electron ni navegador. Puede hacerlo porque el
 * motor cumple la regla de que `core/` nunca toca el DOM: basta con darle un
 * `window` de mentira y cargar los archivos en el mismo orden que index.html.
 *
 *   node tools/simular.js                    # 400 duelos por cruce
 *   node tools/simular.js --duelos 2000
 *   node tools/simular.js --contra pasivo    # contra un rival que no hace nada
 *   node tools/simular.js --semilla 7        # reproducible
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const RAIZ = path.join(__dirname, '..');

/* --------------------------- Carga del motor --------------------------- */

// Mismo orden que index.html, pero solo lo que no pinta nada.
const ARCHIVOS = [
  'data/races.js',
  'data/characters.js',
  'data/actions.js',
  'data/creatures.js',
  'data/dungeons.js',
  'core/state.js',
  'core/team.js',
  'core/hades.js',
  'core/manual.js',
  'core/combat.js',
  'core/bossAbilities.js',
  'core/accionesIA.js',
  'core/turnEngine.js',
  'core/ai.js'
];

function cargarMotor() {
  const contexto = { window: {}, console, Math, Date, JSON, Set, Map };
  contexto.globalThis = contexto;
  vm.createContext(contexto);

  for (const rel of ARCHIVOS) {
    const ruta = path.join(RAIZ, 'src', 'js', rel);
    const codigo = fs.readFileSync(ruta, 'utf8');
    try {
      vm.runInContext(codigo, contexto, { filename: rel });
    } catch (err) {
      throw new Error(`Fallo cargando ${rel}: ${err.message}`);
    }
  }
  return contexto.window.Game;
}

/* ------------------------------ Argumentos ----------------------------- */

function argumento(nombre, pordefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i === -1 || i === process.argv.length - 1) return pordefecto;
  const v = process.argv[i + 1];
  return isNaN(Number(v)) ? v : Number(v);
}

/**
 * Azar reproducible. Sin esto, dos tandas no son comparables y no se puede
 * saber si un cambio en la heurística mejoró algo o fue suerte.
 */
function azarSemilla(semilla) {
  let s = semilla >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------- Equipos ------------------------------- */

/**
 * Equipo legal al azar. Sin esto la medición no vale: la heurística es
 * determinista y el motor solo tira dados en efectos que la IA no usa, así
 * que con el equipo predeterminado las mil partidas de un cruce son la misma
 * partida repetida mil veces. La variedad tiene que venir de los equipos.
 */
function equipoAleatorio(G, razaId, azar) {
  const revolver = (xs) => {
    const a = xs.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const propios = G.CHARACTERS.filter(
    (c) => c.raza === razaId || c.raza === 'mercenario'
  );
  // Se siembra con uno de coste 0: sin él no se puede desplegar en el turno 1
  // y `Team.validar` lo rechaza.
  const baratos = propios.filter((c) => c.coste === 0);
  const semilla = revolver(baratos)[0];
  const resto = revolver(propios.filter((c) => c !== semilla));
  const personajes = [semilla, ...resto.slice(0, G.Team.PERSONAJES - 1)].map((c) => c.id);

  const utiles = G.ACTIONS.filter(
    (a) => !a.razaRequerida || a.razaRequerida === razaId
  );
  const ofensivas = revolver(utiles.filter((a) => a.tipo === 'ofensiva'));
  const otras = revolver(utiles.filter((a) => a.tipo !== 'ofensiva'));
  // Al menos una ofensiva, o no hay forma de ganar.
  const acciones = [ofensivas[0], ...revolver([...ofensivas.slice(1), ...otras])]
    .slice(0, G.Team.ACCIONES)
    .map((a) => a.id);

  return { personajes, acciones };
}

/* ------------------------------ Estrategias ---------------------------- */

/** El rival de control: pone personaje y pasa. Sirve de suelo de referencia. */
function jugarPasivo(G, motor) {
  let guarda = 0;
  while (!motor.terminada && motor.jugadorActivo.esIA === false && guarda++ < 12) {
    if (motor.fase === 'personaje' && !motor.jugadorActivo.activos.length) {
      const c = motor.jugadorActivo.reserva.find((i) =>
        motor.puedeDesplegar(motor.jugadorActivo, i)
      );
      if (c) motor.desplegar(c.uid);
    }
    if (motor.ataquePendiente) motor.resolverAtaque();
    else motor.siguienteFase();
    if (motor.fase === 'personaje') break; // ya cerró el turno
  }
}

const ESTRATEGIAS = {
  ia: (G, motor) => G.AI.jugarTurno(motor),
  pasivo: (G, motor) => jugarPasivo(G, motor)
};

/**
 * Variantes de la heurística para compararlas entre sí. La IA es un objeto
 * con estado, así que se intercambian los AJUSTES justo antes de su turno y
 * se restauran después: los dos bandos comparten instancia.
 */
const VARIANTES = {
  base: {},
  /** La heurística anterior a la simulación, para detectar regresiones. */
  clasica: { accionPorSimulacion: false },
  cubrirse6: { sangreParaCubrirse: 6 },
  cubrirse12: { sangreParaCubrirse: 12 },
  oportunista: { relevoOportunista: true },
  insistir: { insistirSinMatar: true },
  simulacion: { accionPorSimulacion: true },
  simulacionYCubrirse: { accionPorSimulacion: true, sangreParaCubrirse: 6 },
  // Menos miedo a morir: a ver si sigue ganando sin atrincherarse.
  agresiva: { pesoMorir: 3 },
  muyAgresiva: { pesoMorir: 1, pesoMatar: 10 },
  temeraria: { pesoMorir: 0, pesoSangreRecibida: 0 },
  /** Ciega al reflejo del escudo: con esto la IA no equipa defensivas. */
  sinReflejo: { pesoReflejo: 0 },
  todo: { sangreParaCubrirse: 6, relevoOportunista: true, insistirSinMatar: true }
};

function conAjustes(G, ajustes, fn) {
  const previos = { ...G.AI.AJUSTES };
  Object.assign(G.AI.AJUSTES, ajustes);
  try {
    return fn();
  } finally {
    Object.assign(G.AI.AJUSTES, previos);
  }
}

/* ------------------------------- Duelo --------------------------------- */

const LIMITE_TURNOS = 120;

function duelo(G, razaA, razaB, estrategiaB, azar, varA = {}, varB = {}) {
  const eqA = equipoAleatorio(G, razaA, azar);
  const eqB = equipoAleatorio(G, razaB, azar);

  // Los dos lados marcados como IA para que ninguno espere a un humano.
  const motor = new G.TurnEngine({
    jugador: G.crearJugador('A', razaA, eqA.personajes, eqA.acciones, true),
    oponente: G.crearJugador('B', razaB, eqB.personajes, eqB.acciones, true),
    alCambiar: () => {}
  });

  let guarda = 0;
  while (!motor.terminada && guarda++ < LIMITE_TURNOS) {
    const esA = motor.turnoDe === 0;
    if (esA) conAjustes(G, varA, () => G.AI.jugarTurno(motor));
    else conAjustes(G, varB, () => ESTRATEGIAS[estrategiaB](G, motor));

    // Red de seguridad: si una estrategia deja el turno a medias, se cierra
    // para que el duelo no se quede colgado y falsee la media de turnos.
    if (!motor.terminada && motor.turnoDe === (esA ? 0 : 1)) {
      if (motor.ataquePendiente) motor.resolverAtaque();
      else motor.siguienteFase();
    }
  }

  if (!motor.terminada) return { resultado: 'tablas', turnos: motor.numeroTurno };
  return {
    resultado: motor.ganador === motor.jugadores[0] ? 'A' : 'B',
    turnos: motor.numeroTurno,
    motivo: motor.motivoFin
  };
}

/* -------------------------------- Tanda -------------------------------- */

function main() {
  const G = cargarMotor();
  const duelos = argumento('duelos', 400);
  const contra = argumento('contra', 'ia');
  const semilla = argumento('semilla', 12345);

  if (!ESTRATEGIAS[contra]) {
    console.error(`Estrategia desconocida: ${contra}. Usa: ${Object.keys(ESTRATEGIAS).join(', ')}`);
    process.exit(1);
  }

  // El motor y la IA tiran de Math.random; se sustituye por el generador con
  // semilla para que la tanda sea repetible.
  const azar = azarSemilla(semilla);
  Math.random = azar;

  // Torneo: cada variante contra la base. Se juega cada emparejamiento dos
  // veces con los bandos cambiados, porque abrir da ventaja (54/46 medido) y
  // sin alternar el resultado diría más de quién empieza que de la variante.
  if (process.argv.includes('--torneo')) {
    console.log(`\nAETERNUM — torneo de variantes`);
    console.log(`${duelos} duelos por variante · semilla ${semilla}\n`);
    const filas = [];
    for (const [nombre, ajustes] of Object.entries(VARIANTES)) {
      if (nombre === 'base') continue;
      let gana = 0, pierde = 0, tablas = 0, turnos = 0, n = 0;
      for (let k = 0; k < duelos; k++) {
        const a = G.RACE_ORDER[k % 4];
        const b = G.RACE_ORDER[(k >> 2) % 4];
        // Ida: la variante abre. Vuelta: abre la base.
        const ida = duelo(G, a, b, 'ia', azar, ajustes, {});
        if (ida.resultado === 'A') gana++; else if (ida.resultado === 'B') pierde++; else tablas++;
        const vuelta = duelo(G, a, b, 'ia', azar, {}, ajustes);
        if (vuelta.resultado === 'B') gana++; else if (vuelta.resultado === 'A') pierde++; else tablas++;
        turnos += ida.turnos + vuelta.turnos;
        n += 2;
      }
      filas.push({
        variante: nombre,
        ajustes: JSON.stringify(ajustes),
        ganaVariante: `${Math.round((gana / n) * 100)}%`,
        ganaBase: `${Math.round((pierde / n) * 100)}%`,
        turnosMedios: Math.round((turnos / n) * 10) / 10
      });
    }
    console.table(filas);
    console.log('\n50% = indistinguible de la base. Por encima, mejora.\n');
    return;
  }

  const razas = G.RACE_ORDER;
  const filas = [];
  let totalA = 0, totalB = 0, tablas = 0, sumaTurnos = 0, n = 0;
  const porMotivo = {};

  for (const a of razas) {
    for (const b of razas) {
      let ga = 0, gb = 0, tb = 0, turnos = 0;
      for (let k = 0; k < duelos; k++) {
        const r = duelo(G, a, b, contra, azar);
        if (r.resultado === 'A') ga++;
        else if (r.resultado === 'B') gb++;
        else tb++;
        turnos += r.turnos;
        if (r.motivo) porMotivo[r.motivo] = (porMotivo[r.motivo] || 0) + 1;
      }
      filas.push({
        cruce: `${a} vs ${b}`,
        ganaA: Math.round((ga / duelos) * 100),
        ganaB: Math.round((gb / duelos) * 100),
        tablas: tb,
        turnosMedios: Math.round((turnos / duelos) * 10) / 10
      });
      totalA += ga; totalB += gb; tablas += tb; sumaTurnos += turnos; n += duelos;
    }
  }

  console.log(`\nAETERNUM — banco de simulación`);
  console.log(`${n} duelos · A = IA · B = ${contra} · semilla ${semilla}\n`);
  console.table(filas);
  console.log(`\nGlobal:`);
  console.log(`  gana A (IA)   ${Math.round((totalA / n) * 100)}%`);
  console.log(`  gana B (${contra})  ${Math.round((totalB / n) * 100)}%`);
  console.log(`  tablas        ${tablas} (${Math.round((tablas / n) * 100)}%)`);
  console.log(`  turnos medios ${Math.round((sumaTurnos / n) * 10) / 10}`);
  console.log(`  fin por       ${JSON.stringify(porMotivo)}\n`);
}

main();
