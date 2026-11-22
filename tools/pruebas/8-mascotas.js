// Mascotas de las historias secretas: Lis, Ceniza y Chispa.
const fs = require('fs');
const vm = require('vm');
const RAIZ = require('path').join(__dirname, '..', '..', 'src', 'js') + '/';
const ARCHIVOS = ['data/races.js', 'data/characters.js', 'data/actions.js', 'data/creatures.js',
  'data/dungeons.js', 'core/state.js', 'core/team.js', 'core/hades.js', 'core/manual.js',
  'core/combat.js', 'core/bossAbilities.js', 'core/accionesIA.js', 'core/efectosPersonaje.js',
  'core/turnEngine.js', 'core/ai.js'];
// Dado fijo (sale 1): Acrobático no esquiva y la prueba no depende del azar.
const MathFijo = Object.create(Math); MathFijo.random = () => 0;
const ctx = { window: {}, console: { log() {}, warn() {}, error: console.error }, Math: MathFijo, Date, JSON, Set, Map };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const rel of ARCHIVOS) vm.runInContext(fs.readFileSync(RAIZ + rel, 'utf8'), ctx, { filename: rel });
const G = ctx.window.Game;
const C = G.Combat;

const casos = [];
const caso = (n, o, e) => casos.push({ n, o: JSON.stringify(o), e: JSON.stringify(e), ok: JSON.stringify(o) === JSON.stringify(e) });
const accs = G.ACTIONS.map((x) => x.id);
const mesa = (a, b) => new G.TurnEngine({
  jugador: G.crearJugador('A', 'mascota', a, accs, false, { ignoraCoste: true }),
  oponente: G.crearJugador('B', 'oxitron', b, accs, false, { ignoraCoste: true }),
  alCambiar: () => {}
});
const inst = (j, id) => [...j.reserva, ...j.activos, ...j.hades].find((i) => i.personaje === id);
// Contesta las preguntas que salten (Yrving declara un tipo al entrar).
const contestar = (m) => { let g = 0; while (m.eleccionPendiente && g++ < 5) m.resolverEleccion(m.eleccionPendiente.opciones[0].id); };

caso('las tres mascotas existen y no entran en los mazos de estirpe',
  ['mas_lis', 'mas_ceniza', 'mas_chispa'].map((id) => !!G.CHARACTERS_BY_ID[id]).concat(
    G.personajesDeRaza('desterrado').some((c) => c.raza === 'mascota')), [true, true, true, false]);

{ // Lis revelada en la mano: el activo rival −2/−2. Sin revelar, nada.
  const m = mesa(['mer_yrving', 'mas_lis'], ['oxi_krag']);
  const [A, B] = m.jugadores;
  m.turnoDe = 1;
  m.desplegar(inst(B, 'oxi_krag').uid, { saltarFase: true });
  m.notificar();
  const krag = inst(B, 'oxi_krag');
  caso('Lis sin revelar: el rival no pierde nada', [krag.pasivo?.ataque || 0, krag.pasivo?.defensa || 0], [0, 0]);
  A.revelados.add('mas_lis');
  m.notificar();
  caso('Lis revelada en la mano: rival −2/−2', [krag.pasivo.ataque, krag.pasivo.defensa], [-2, -2]);
}

// Un golpe de B (Krag con Finta) contra el Yrving de A, que se defiende con Bloquear.
const golpe = (conCeniza) => {
  const m = mesa(['mer_yrving', 'mas_ceniza'], ['oxi_krag']);
  const [A, B] = m.jugadores;
  m.desplegar(inst(A, 'mer_yrving').uid, { saltarFase: true });
  contestar(m);
  m.equipar('d_acrobatico', null, { saltarFase: true });
  if (conCeniza) A.revelados.add('mas_ceniza');
  m.turnoDe = 1;
  m.desplegar(inst(B, 'oxi_krag').uid, { saltarFase: true });
  contestar(m);
  m.equipar('o_luna_sangrienta', null, { saltarFase: true });
  contestar(m);
  const yr = inst(A, 'mer_yrving'), kr = inst(B, 'oxi_krag');
  kr.modificadores.ataque = 20; // que el golpe lo tumbe seguro
  yr.modificadores.defensa = 0;
  m.fase = 'ataque';
  m.numeroTurno = 2; // en el primer turno no se ataca
  m.declararAtaque(kr.uid, yr.uid);
  if (m.eleccionPendiente) m.resolverEleccion(m.eleccionPendiente.opciones[0].id);
  if (m.ataquePendiente) m.resolverAtaque();
  if (m.eleccionPendiente) m.resolverEleccion(m.eleccionPendiente.opciones[0].id);
  return { enPosicion: A.activos.some((i) => i.personaje === 'mer_yrving'), sangre: A.sangre.pila };
};
{
  const sin = golpe(false), con = golpe(true);
  caso('sin Ceniza: Yrving cae en batalla', sin.enPosicion, false);
  caso('Ceniza revelada: Yrving sigue en posición', con.enPosicion, true);
  // En defensa, si le rompen el escudo cae SIN daño a la sangre (regla del
  // combate): Ceniza solo evita la caída, no cambia la sangre.
  caso('…y la sangre queda como sin Ceniza (en defensa no pasa)', con.sangre, sin.sangre);
}

{ // Chispa con Tilos: admite una segunda carta y suma las dos.
  const m = mesa(['mas_chispa', 'mer_tilos'], ['oxi_krag']);
  const [A] = m.jugadores;
  m.desplegar(inst(A, 'mas_chispa').uid, { saltarFase: true });
  const ch = inst(A, 'mas_chispa'), ti = inst(A, 'mer_tilos');
  A.reserva = A.reserva.filter((i) => i !== ti);
  ch.tilos = { tipo: 'defensiva', carta: ti };
  m.equipar('o_finta', null, { saltarFase: true });
  caso('Chispa: Tilos sigue equipado tras acoplar una acción', !!ch.tilos, true);
  caso('…y ataca (Finta) y defiende (Tilos +4) a la vez', [C.ataqueEfectivo(ch), C.defensaEfectiva(ch)], [2, 6]);
}
{ // Cualquier otro: acoplar una acción devuelve a Tilos a la mano (como siempre).
  const m = mesa(['mer_yrving', 'mer_tilos'], ['oxi_krag']);
  const [A] = m.jugadores;
  m.desplegar(inst(A, 'mer_yrving').uid, { saltarFase: true });
  contestar(m);
  const yr = inst(A, 'mer_yrving'), ti = inst(A, 'mer_tilos');
  A.reserva = A.reserva.filter((i) => i !== ti);
  yr.tilos = { tipo: 'ofensiva', carta: ti };
  m.equipar('d_bloquear', null, { saltarFase: true });
  caso('sin Chispa: Tilos vuelve a la mano al acoplar', [!!yr.tilos, A.reserva.includes(ti)], [false, true]);
}

for (const c of casos) console.log(`${c.ok ? 'OK ' : 'MAL'}  ${c.n}: ${c.o}${c.ok ? '' : ` (esperado ${c.e})`}`);
console.log(casos.every((c) => c.ok) ? 'TODO BIEN' : 'HAY FALLOS');
