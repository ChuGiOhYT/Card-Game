// Tanda 4
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
const mesaR = (razaA, a, razaB, b, o = {}) => { const m = mesa(a, b, o); return m; };

{ // Lirhym (humano): bloquea mientras siga en posición
  const m = mesa(['lun_lirhym'], ['oxi_pip'], { accB: ['o_finta', 'd_bloquear'] });
  const [A, B] = m.jugadores;
  const l = sacar(m, A, 'lun_lirhym');
  caso('Lirhym pregunta', !!m.eleccionPendiente, true);
  m.resolverEleccion('o_finta');
  caso('…Finta bloqueada', m.accionesDisponibles(B), ['d_bloquear']);
  m.enviarAlHades(A, l, 'prueba');
  caso('…se libera al irse Lirhym', m.accionesDisponibles(B).length, 2);
}
{ // Vyla (IA): manda a Ejército al Hades
  const m = mesa(['rea_vyla', 'rea_ejercito', 'rea_luh'], ['oxi_pip'], { humanoA: false });
  const [A] = m.jugadores;
  sacar(m, A, 'rea_vyla');
  caso('Vyla: Ejército al Hades', A.hades.map((i) => i.personaje), ['rea_ejercito']);
}
{ // Luh (humano): se cambia por un reanimado revelado
  const m = mesa(['rea_luh', 'rea_vyla'], ['oxi_pip']);
  const [A] = m.jugadores;
  A.revelados.add('rea_vyla');
  sacar(m, A, 'rea_luh');
  caso('Luh pregunta', m.eleccionPendiente && m.eleccionPendiente.opciones.length, 2);
  m.resolverEleccion(inst(A, 'rea_vyla').uid);
  caso('…Luh al Hades', A.hades.map((i) => i.personaje), ['rea_luh']);
  caso('…Vyla en posición', A.activos.map((i) => i.personaje), ['rea_vyla']);
}
{ // Lyla (IA): recupera del Hades pagando
  const m = mesa(['mer_lyla', 'oxi_pip'], ['lun_sadash'], { humanoA: false });
  const [A] = m.jugadores;
  m.enviarAlHades(A, inst(A, 'oxi_pip'), 'prueba');
  m.derramar(A, 5, 'prueba');
  sacar(m, A, 'mer_lyla');
  caso('Lyla recupera a Pip', A.reserva.some((i) => i.personaje === 'oxi_pip'), true);
}
{ // Yrving (humano): el rival solo puede acoplar defensivas
  const m = mesa(['mer_yrving'], ['lun_sadash'], { accB: ['o_finta', 'd_bloquear'] });
  const [A, B] = m.jugadores;
  sacar(m, A, 'mer_yrving');
  caso('Yrving ofrece los tipos que tiene', m.eleccionPendiente.opciones.map((o) => o.id), ['defensiva', 'ofensiva']);
  m.resolverEleccion('defensiva');
  caso('…rival forzado a defensiva', m.accionesDisponibles(B), ['d_bloquear']);
}
{ // Errante: neutra → recupera 1
  const m = mesa(['mer_errante'], ['lun_sadash'], { humanoA: false });
  const [A] = m.jugadores;
  const er = sacar(m, A, 'mer_errante');
  m.derramar(A, 3, 'prueba');
  m.turnoDe = 0; m.fase = 'accion';
  const neutra = G.ACTIONS.find((x) => x.tipo === 'neutral').id;
  G.EfectosPersonaje.CON_DADO.errante.call(G.EfectosPersonaje, m, A, Object.assign(er, { accion: neutra }));
  caso('Errante neutra: recupera 1', A.sangre.gasto, 2);
}
{ // Errante ofensiva (IA): un personaje rival del Hades al vacío
  const m = mesa(['mer_errante'], ['lun_sadash', 'lun_delem'], { humanoA: false });
  const [A, B] = m.jugadores;
  m.enviarAlHades(B, inst(B, 'lun_delem'), 'prueba');
  const er = sacar(m, A, 'mer_errante', 'o_finta');
  G.EfectosPersonaje.CON_DADO.errante.call(G.EfectosPersonaje, m, A, er);
  caso('Errante ofensiva: Delem al vacío', B.vacio.map((i) => i.personaje), ['lun_delem']);
}
{ // Sadash: al retirarse, el rival sangra por lunarias reveladas
  const m = mesa(['oxi_pip'], ['lun_sadash', 'lun_delem'], { humanoA: false });
  const [A, B] = m.jugadores;
  const s = sacar(m, B, 'lun_sadash');
  B.revelados.add('lun_delem');
  const antes = A.sangre.gasto;
  G.EfectosPersonaje.alRetirarse(m, B, s);
  caso('Sadash: rival sangra 2', A.sangre.gasto - antes, 2);
}
{ // Zhin (humano defensor): pregunta y, si dice que no, cae el suyo
  const m = mesa(['oxi_krox'], ['oxi_pip', 'mer_zhin'], { humanoA: false });
  const [A, B] = m.jugadores;
  B.esIA = false;
  const at = sacar(m, A, 'oxi_krox', 'o_finta');
  const df = sacar(m, B, 'oxi_pip', 'd_bloquear');
  B.revelados.add('mer_zhin');
  df.modificadores = { ataque: 0, defensa: -20 };
  m.turnoDe = 0; m.fase = 'ataque';
  m.ataquePendiente = { atacanteUid: at.uid, defensorUid: df.uid };
  m.resolverAtaque();
  caso('Zhin pregunta al humano', !!m.eleccionPendiente, true);
  caso('…y el golpe espera', B.hades.length, 0);
  m.resolverEleccion('no');
  caso('…dejar caer: Pip al Hades', B.hades.map((i) => i.personaje), ['oxi_pip']);
}
{ // Zhin IA: se sacrifica en combate
  const m = mesa(['oxi_krox'], ['oxi_pip', 'mer_zhin'], { humanoA: false });
  const [A, B] = m.jugadores;
  const at = sacar(m, A, 'oxi_krox', 'o_finta');
  const df = sacar(m, B, 'oxi_pip', 'd_bloquear');
  B.revelados.add('mer_zhin');
  df.modificadores = { ataque: 0, defensa: -20 };
  m.turnoDe = 0; m.fase = 'ataque';
  m.ataquePendiente = { atacanteUid: at.uid, defensorUid: df.uid };
  m.resolverAtaque();
  caso('Zhin muere en lugar de Pip', B.hades.map((i) => i.personaje), ['mer_zhin']);
  caso('…Pip sigue en posición', B.activos.includes(df), true);
}
{ // Seluah (humano defensor): pregunta al declararse y el golpe espera
  const m = mesa(['oxi_krox'], ['lun_sadash', 'lun_seluah'], { humanoA: false, accB: ['o_finta', 'd_bloquear'] });
  const [A, B] = m.jugadores;
  B.esIA = false;
  const at = sacar(m, A, 'oxi_krox', 'o_finta');
  const df = sacar(m, B, 'lun_sadash');
  B.revelados.add('lun_seluah');
  m.turnoDe = 0; m.fase = 'ataque';
  m.declararAtaque(at.uid, df.uid);
  caso('Seluah pregunta', m.eleccionPendiente && m.eleccionPendiente.titulo.startsWith('Seluah'), true);
  caso('…el golpe no se resuelve aún', m.resolverAtaque(), null);
  m.resolverEleccion('d_bloquear');
  caso('…Sadash pasa a Bloquear', df.accion, 'd_bloquear');
}
for (const c of casos) console.log(`${c.ok ? 'OK ' : 'MAL'}  ${c.n}: ${c.o}${c.ok ? '' : ` (esperado ${c.e})`}`);
console.log(casos.every((c) => c.ok) ? 'TODO BIEN' : 'HAY FALLOS');
