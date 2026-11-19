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
const ataque = (m, A, at, B, df) => { // A ataca a B
  m.turnoDe = m.jugadores.indexOf(A); m.fase = 'ataque';
  return m.declararAtaque(at.uid, df.uid);
};
const C = G.CHARACTERS_BY_ID;

{ // Escape (IA defensora): la iban a tumbar y entra el más barato
  const m = mesa(['oxi_krox'], ['lun_lirhym', 'lun_sadash', 'lun_delem'], { humanoA: false });
  const [A, B] = m.jugadores;
  const at = sacar(m, A, 'oxi_krox', 'o_finta');
  at.modificadores = { ataque: 3, defensa: 0 };
  const caro = [...B.reserva].sort((x, y) => C[y.personaje].coste - C[x.personaje].coste)[0];
  const df = sacar(m, B, caro.personaje, 'd_escape');
  m.derramar(B, 0, 'x');
  ataque(m, A, at, B, df);
  caso('Escape: el defensor se va a la reserva', B.reserva.includes(df), true);
  caso('…y el golpe apunta al que entra', !!m.ataquePendiente && m.ataquePendiente.defensorUid === B.activos[0].uid, true);
}
{ // Campo caótico (humano): directo a la sangre
  const m = mesa(['oxi_krox'], ['lun_sadash'], { humanoA: false });
  const [A, B] = m.jugadores; B.esIA = false;
  const at = sacar(m, A, 'oxi_krox', 'o_finta');
  const df = sacar(m, B, 'lun_sadash', 'd_campo_caotico');
  ataque(m, A, at, B, df);
  G.AccionesIA.aplicarManual(m, B, df, { atacanteInst: at, atacante: A, atacanteJugador: A });
  caso('Campo caótico pregunta', !!m.eleccionPendiente && m.eleccionPendiente.titulo.startsWith('Campo'), true);
  m.resolverEleccion('directo');
  caso('…golpe directo', m.ataquePendiente.defensorUid, null);
}
{ // Campo caótico fuera de un ataque: no hace nada
  const m = mesa(['oxi_krox'], ['lun_sadash']);
  const [A] = m.jugadores;
  const x = sacar(m, A, 'oxi_krox', 'd_campo_caotico');
  G.AccionesIA.aplicarManual(m, A, x, {});
  caso('Campo caótico sin ataque: no pregunta', m.eleccionPendiente, null);
}
{ // Biomecánica (IA): suma y al final del turno manda al sacrificado al Hades
  const m = mesa(['oxi_krox'], ['lun_sadash', 'lun_delem', 'mer_tilos'], { humanoA: false });
  const [A, B] = m.jugadores;
  const at = sacar(m, A, 'oxi_krox', 'o_finta');
  const df = sacar(m, B, 'lun_sadash', 'd_biomecanica');
  const golpe = G.Combat.ataqueEfectivo(at) + 1; // + el dado de Krox, fijado a 1
  df.modificadores = { ataque: 0, defensa: golpe - C.lun_sadash.defensa - 1 }; // cae por 1
  dados = [1];
  ataque(m, A, at, B, df);
  caso('Biomecánica: aguanta el golpe', G.Combat.defensaEfectiva(df) >= golpe, true);
  caso('…sin usar a Tilos', B.reserva.some((i) => i.personaje === 'mer_tilos'), true);
  m.ataquePendiente = null;
  m.finalizarTurno();
  caso('…el sacrificado al Hades', B.hades.map((i) => i.personaje), ['lun_delem']);
  caso('…Biomecánica vuelve a la zona', df.accion, null);
}
{ // Encadenar (humano con Oxitrón): el rival (IA) cambia y el que sale queda bloqueado
  const m = mesa(['oxi_krox'], ['lun_sadash', 'lun_delem']);
  const [A, B] = m.jugadores;
  sacar(m, B, 'lun_sadash');
  B.revelados.add('lun_delem');
  const k = sacar(m, A, 'oxi_krox', 'd_encadenar');
  m.derramar(A, 2, 'prueba');
  G.AccionesIA.aplicarManual(m, A, k, {});
  caso('Encadenar: entra Delem', B.activos.map((i) => i.personaje), ['lun_delem']);
  caso('…Sadash bloqueado', m.tieneEstado('personajeBloqueado', { uid: inst(B, 'lun_sadash').uid }), true);
  caso('…pagó 1', A.sangre.fuera, 1);
}
{ // Devoción: al Hades y recupera su coste
  const m = mesa(['oxi_kratox'], ['lun_sadash'], { humanoA: false });
  const [A] = m.jugadores;
  const k = sacar(m, A, 'oxi_kratox', 'n_devocion');
  m.derramar(A, 12, 'prueba');
  const g = A.sangre.gasto;
  G.AccionesIA.aplicar(m, A, k, 'equipar', {});
  caso('Devoción: Kratox al Hades', A.hades.length, 1);
  caso('…recupera su coste', g - A.sangre.gasto, C.oxi_kratox.coste);
}
{ // Llamada (IA): vuelve un Reanimado pagando
  const m = mesa(['rea_luh', 'rea_vyla'], ['lun_sadash'], { humanoA: false });
  const [A] = m.jugadores;
  m.enviarAlHades(A, inst(A, 'rea_vyla'), 'prueba');
  const l = sacar(m, A, 'rea_luh', 'n_llamada');
  m.derramar(A, 8, 'prueba');
  G.AccionesIA.aplicar(m, A, l, 'equipar', {});
  caso('Llamada: Vyla vuelve', A.reserva.some((i) => i.personaje === 'rea_vyla'), true);
}
{ // Investigar (humano): opciones a ciegas y revela
  const m = mesa(['oxi_krox'], ['lun_sadash', 'lun_delem'], { accB: ['o_finta'] });
  const [A, B] = m.jugadores;
  const k = sacar(m, A, 'oxi_krox', 'n_investigar');
  G.AccionesIA.aplicarManual(m, A, k, {});
  caso('Investigar: a ciegas', m.eleccionPendiente.opciones.map((o) => o.texto), ['Acción oculta 1', 'Personaje oculto 1', 'Personaje oculto 2']);
  m.resolverEleccion('o_finta');
  caso('…revela Finta', B.revelados.has('o_finta'), true);
}
{ // Ocultamiento (humano desterrado): voltea dos, pregunta dos veces
  const des = G.CHARACTERS.find((c) => c.raza === 'desterrado');
  const m = mesa(['oxi_krox', des.id], ['lun_sadash'], { accA: ['n_ocultamiento', 'o_finta', 'd_bloquear'] });
  const [A] = m.jugadores;
  const k = sacar(m, A, 'oxi_krox', 'n_ocultamiento');
  G.AccionesIA.aplicarManual(m, A, k, {});
  caso('Ocultamiento sin Desterrado: nada', m.eleccionPendiente, null);
  A.revelados.add('o_finta'); A.revelados.add('d_bloquear');
  const d = sacar(m, A, des.id, 'n_ocultamiento');
  if (m.eleccionPendiente) m.resolverEleccion(m.eleccionPendiente.opciones[0].id);
  G.AccionesIA.aplicarManual(m, A, d, {});
  const n1 = m.eleccionPendiente && m.eleccionPendiente.n;
  m.resolverEleccion('0:o_finta');
  caso('…segunda pregunta con otro número', !!m.eleccionPendiente && m.eleccionPendiente.n !== n1, true);
  m.resolverEleccion('0:d_bloquear');
  caso('…las dos boca abajo', [A.revelados.has('o_finta'), A.revelados.has('d_bloquear')], [false, false]);
}
{ // Comodín (IA): activa una revelada; no otro Comodín
  const m = mesa(['oxi_krox'], ['lun_sadash'], { humanoA: false, accA: ['n_comodin', 'o_finta', 'n_ruego'] });
  const [A] = m.jugadores;
  A.revelados.add('o_finta'); A.revelados.add('n_ruego');
  const k = sacar(m, A, 'oxi_krox', 'n_comodin');
  m.turnoDe = 0;
  G.AccionesIA.alEquipar(m, A, k);
  caso('Comodín: activa Finta', k.accion, 'o_finta');
  caso('…Comodín vuelve disponible', m.accionesDisponibles(A).includes('n_comodin'), true);
}
{ // Tilos (humano): ofensiva +4 y se destruye al final del turno rival
  const m = mesa(['oxi_krox', 'mer_tilos'], ['lun_sadash']);
  const [A] = m.jugadores;
  const k = sacar(m, A, 'oxi_krox');
  A.revelados.add('mer_tilos');
  m.turnoDe = 0;
  G.EfectosPersonaje.alEntrarEnAccion(m);
  caso('Tilos pregunta', !!m.eleccionPendiente && m.eleccionPendiente.titulo.startsWith('Tilos'), true);
  m.resolverEleccion('ofensiva');
  caso('…ataque = Krox + 4', G.Combat.ataqueEfectivo(k), C.oxi_krox.ataque + 4);
  m.finalizarTurno();
  caso('…sigue tras su propio turno', !!k.tilos, true);
  m.finalizarTurno();
  caso('…se destruye al final del turno rival', [!!k.tilos, A.hades.map((i) => i.personaje)], [false, ['mer_tilos']]);
}
for (const c of casos) console.log(`${c.ok ? 'OK ' : 'MAL'}  ${c.n}: ${c.o}${c.ok ? '' : ` (esperado ${c.e})`}`);
console.log(casos.every((c) => c.ok) ? 'TODO BIEN' : 'HAY FALLOS');
