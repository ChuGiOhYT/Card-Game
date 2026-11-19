// Reglas del turno: un despliegue por turno (el bucle de Sadash).
// El dado se fija sustituyendo Math.random para que cada caso sea determinista.
const fs = require('fs');
const vm = require('vm');
const RAIZ = require('path').join(__dirname, '..', '..', 'src', 'js') + '/';
const ARCHIVOS = ['data/races.js', 'data/characters.js', 'data/actions.js', 'data/creatures.js',
  'data/dungeons.js', 'core/state.js', 'core/team.js', 'core/hades.js', 'core/manual.js',
  'core/combat.js', 'core/bossAbilities.js', 'core/accionesIA.js', 'core/efectosPersonaje.js',
  'core/turnEngine.js', 'core/ai.js'];
let dados = [];
const M = Object.create(Math);
M.random = () => (dados.length ? (dados.shift() - 0.5) / 6 : 0.5);   // dados: valores 1..6
const ctx = { window: {}, console: { log() {}, warn() {}, error: console.error }, Math: M, Date, JSON, Set, Map };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const rel of ARCHIVOS) vm.runInContext(fs.readFileSync(RAIZ + rel, 'utf8'), ctx, { filename: rel });
const G = ctx.window.Game;
// Las mesas de prueba empiezan en el turno 2: en el 1 quien abre no puede
// atacar (regla de Oscar) y aquí se mide otra cosa. Su propio caso fija el 1.
{ const TE = G.TurnEngine; G.TurnEngine = class extends TE { constructor(o) { super(o); this.numeroTurno = 2; } }; }

const casos = [];
const caso = (n, o, e) => casos.push({ n, o: JSON.stringify(o), e: JSON.stringify(e), ok: JSON.stringify(o) === JSON.stringify(e) });
const accs = G.ACTIONS.map((x) => x.id);
const mesa = (a, b, { humanoA = true, accA = accs, accB = accs } = {}) => new G.TurnEngine({
  jugador: G.crearJugador('A', 'oxitron', a, accA, !humanoA),
  oponente: G.crearJugador('B', 'lunaria', b, accB, true),
  alCambiar: () => {}
});
const inst = (j, id) => [...j.reserva, ...j.activos].find((i) => i.personaje === id);
const sacar = (m, j, id, accion) => {
  const quien = m.turnoDe; m.turnoDe = m.jugadores.indexOf(j);
  j.ignoraCoste = true; m.desplegar(inst(j, id).uid, { saltarFase: true }); j.ignoraCoste = false;
  m.turnoDe = quien;
  if (accion) inst(j, id).accion = accion;
  return inst(j, id);
};
{ // Un despliegue por turno: el segundo cambio se niega y Sadash sangra una sola vez
  const m = mesa(['lun_sadash', 'lun_delem', 'lun_lirhym'], ['oxi_pip'], { accA: ['o_finta'] });
  const [A, B] = m.jugadores;
  A.ignoraCoste = true;
  A.revelados.add('lun_delem'); A.revelados.add('lun_lirhym');
  m.turnoDe = 0; m.fase = 'personaje';
  caso('primer despliegue', m.desplegar(inst(A, 'lun_sadash').uid), true);
  const antes = B.sangre.gasto;
  caso('segundo en el mismo turno: no', m.desplegar(inst(A, 'lun_delem').uid), false);
  caso('…Sadash sigue en posición', A.activos.map((i) => i.personaje), ['lun_sadash']);
  caso('…y el rival no sangra', B.sangre.gasto - antes, 0);
  m.finalizarTurno(); m.finalizarTurno();
  m.fase = 'personaje';
  caso('al turno siguiente, otro cambio', m.desplegar(inst(A, 'lun_delem').uid), true);
}
{ // Quien abre no ataca en su primer turno; el otro sí, en el suyo.
  const m = mesa(['oxi_pip'], ['lun_sadash'], { accA: ['o_finta'], accB: ['o_finta'] });
  m.numeroTurno = 1;
  const [A, B] = m.jugadores;
  A.ignoraCoste = true; B.ignoraCoste = true;
  m.desplegar(inst(A, 'oxi_pip').uid);
  m.equipar('o_finta', A.activos[0].uid, { saltarFase: true });
  m.fase = 'ataque';
  caso('turno 1: quien abre no tiene atacantes', m.atacantesDisponibles(A).length, 0);
  m.declararAtaque(A.activos[0].uid);
  caso('…y declarar no hace nada', m.ataquePendiente, null);
  m.finalizarTurno();
  m.desplegar(inst(B, 'lun_sadash').uid);
  m.equipar('o_finta', B.activos[0].uid, { saltarFase: true });
  m.fase = 'ataque';
  caso('turno 2: el otro ya puede atacar', m.atacantesDisponibles(B).length, 1);
}
for (const c of casos) console.log(`${c.ok ? 'OK ' : 'MAL'}  ${c.n}: ${c.o}${c.ok ? '' : ` (esperado ${c.e})`}`);
console.log(casos.every((c) => c.ok) ? 'TODO BIEN' : 'HAY FALLOS');
