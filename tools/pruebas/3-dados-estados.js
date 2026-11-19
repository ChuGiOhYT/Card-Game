// Tanda 3: Pip, Brawl, Kaw, Kratox, Sabotaje, Diplomático, Yun.
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

{ // Pip: 2 → intocable 2 turnos; 5 → nada
  dados = [2];
  const m = mesa(['oxi_pip'], ['lun_sadash'], { humanoA: false });
  const pip = sacar(m, m.jugadores[0], 'oxi_pip');
  caso('Pip con 2: intocable', m.tieneEstado('inmune', { uid: pip.uid }), true);
  caso('…2 turnos', m.estadosDe(pip)[0] && m.estadosDe(pip)[0].turnos, 2);
  dados = [5];
  const m2 = mesa(['oxi_pip'], ['lun_sadash'], { humanoA: false });
  const pip2 = sacar(m2, m2.jugadores[0], 'oxi_pip');
  caso('Pip con 5: nada', m2.tieneEstado('inmune', { uid: pip2.uid }), false);
}
{ // Brawl: 4 → arranca la acción del rival; 2 → no
  dados = [4];
  const m = mesa(['oxi_brawl'], ['lun_sadash'], { humanoA: false });
  const sa = sacar(m, m.jugadores[1], 'lun_sadash', 'o_finta');
  sacar(m, m.jugadores[0], 'oxi_brawl');
  caso('Brawl con 4: el rival pierde la acción', sa.accion, null);
  dados = [2];
  const m2 = mesa(['oxi_brawl'], ['lun_sadash'], { humanoA: false });
  const sa2 = sacar(m2, m2.jugadores[1], 'lun_sadash', 'o_finta');
  sacar(m2, m2.jugadores[0], 'oxi_brawl');
  caso('Brawl con 2: la conserva', sa2.accion, 'o_finta');
}
{ // Kaw (humano): elige acción, dado 3 → bloqueada 3 turnos y fuera de disponibles
  dados = [3];
  const m = mesa(['oxi_kaw'], ['lun_sadash'], { accB: ['o_finta', 'd_bloquear'] });
  const [A, B] = m.jugadores;
  sacar(m, A, 'oxi_kaw');
  caso('Kaw pregunta', !!m.eleccionPendiente, true);
  caso('…ocultas sin nombre', m.eleccionPendiente.opciones.map((o) => o.texto), ['Acción oculta 1', 'Acción oculta 2']);
  m.resolverEleccion('d_bloquear');
  caso('Kaw bloquea Bloquear', m.accionesDisponibles(B), ['o_finta']);
}
{ // Kratox (IA): bloquea un personaje del rival y niega sus efectos
  dados = [4];
  const m = mesa(['oxi_kratox'], ['lun_sadash', 'lun_delem'], { humanoA: false });
  const [A, B] = m.jugadores;
  sacar(m, A, 'oxi_kratox');
  const bloqueado = B.reserva.find((i) => m.tieneEstado('personajeBloqueado', { uid: i.uid }));
  caso('Kratox bloquea a uno de la reserva', !!bloqueado, true);
  caso('…4 turnos', bloqueado && m.estadosDe(bloqueado)[0].turnos, 4);
  caso('…que no se puede desplegar', bloqueado && m.puedeDesplegar(B, bloqueado), false);
}
{ // Sabotaje del rival: −2 a tu dado (Finta: 5 → 3 → +1)
  dados = [5];
  const m = mesa(['oxi_krox'], ['lun_sadash'], { humanoA: false });
  const [A, B] = m.jugadores;
  const kr = sacar(m, A, 'oxi_krox', 'o_finta');
  sacar(m, B, 'lun_sadash', 'o_sabotaje');
  G.AccionesIA.aplicar(m, A, kr, 'combate', {});
  caso('Sabotaje: Finta con 5 se queda en 3 (+1)', kr.modificadores.ataque, 1);
}
{ // Diplomático: paga 2 y nadie ataca dos turnos
  const m = mesa(['oxi_pip'], ['lun_sadash'], { humanoA: false });
  const [A] = m.jugadores;
  const p = sacar(m, A, 'oxi_pip', 'n_diplomatico');
  m.derramar(A, 3, 'prueba');
  G.AccionesIA.aplicar(m, A, p, 'equipar', {});
  caso('Diplomático: paga 2', A.sangre.fuera, 2);
  caso('…y pone «sin ataques»', m.tieneEstado('sinAtaques'), true);
}
{ // Yun (humano): con Finta pregunta; elegir +1 (4 → 5) da +2
  dados = [4];
  const m = mesa(['mer_yun', 'oxi_krox'], ['lun_sadash']);
  const [A] = m.jugadores;
  sacar(m, A, 'mer_yun', 'o_finta');
  const yun = inst(A, 'mer_yun');
  G.AccionesIA.aplicarManual(m, A, yun, {});
  caso('Yun pregunta con un dado de acción', !!m.eleccionPendiente, true);
  m.resolverEleccion('1');
  caso('Yun +1: 4 → 5, Finta da +2', yun.modificadores.ataque, 2);
}
{ // Yun (IA) con Bloquear: con 2 prefiere bajar a 1 (niega y devuelve)
  dados = [2];
  const m = mesa(['mer_yun'], ['lun_sadash'], { humanoA: false });
  const [A] = m.jugadores;
  const yun = sacar(m, A, 'mer_yun', 'd_bloquear');
  let res = null;
  G.Manual.tirar(m, { jugador: A, motivo: 'prueba', deAccion: true,
    valor: (n) => (n === 1 || n === 6 ? 3 : n >= 4 ? 2 : 1) }, (r) => { res = r; });
  caso('Yun IA con Bloquear: 2 → 1', res, 1);
}
{ // Krag: dado de personaje, sin Yun aunque esté Yun
  dados = [3];
  const m = mesa(['mer_yun', 'oxi_krag'], ['lun_sadash']);
  const [A] = m.jugadores;
  m.jugadores[0].revelados.add('mer_yun');
  let res = null;
  G.Manual.tirar(m, { jugador: A, motivo: 'Krag', deAccion: false }, (r) => { res = r; });
  caso('Dado de personaje: Yun no pregunta', m.eleccionPendiente, null);
  caso('…y sale tal cual', res, 3);
}

for (const c of casos) console.log(`${c.ok ? 'OK ' : 'MAL'}  ${c.n}: ${c.o}${c.ok ? '' : ` (esperado ${c.e})`}`);
console.log(casos.every((c) => c.ok) ? 'TODO BIEN' : 'HAY FALLOS');
