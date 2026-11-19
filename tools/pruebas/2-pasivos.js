// Prueba de los 8 pasivos en el motor (Node puro). Cada caso monta la mesa a
// mano, llama a notificar() (que recalcula) y mira el combate.
const fs = require('fs');
const vm = require('vm');
const RAIZ = require('path').join(__dirname, '..', '..', 'src', 'js') + '/';
const ARCHIVOS = ['data/races.js', 'data/characters.js', 'data/actions.js', 'data/creatures.js',
  'data/dungeons.js', 'core/state.js', 'core/team.js', 'core/hades.js', 'core/manual.js',
  'core/combat.js', 'core/bossAbilities.js', 'core/accionesIA.js', 'core/efectosPersonaje.js',
  'core/turnEngine.js', 'core/ai.js'];
const ctx = { window: {}, console, Math, Date, JSON, Set, Map };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const rel of ARCHIVOS) vm.runInContext(fs.readFileSync(RAIZ + rel, 'utf8'), ctx, { filename: rel });
const G = ctx.window.Game;
// Las mesas de prueba empiezan en el turno 2: en el 1 quien abre no puede
// atacar (regla de Oscar) y aquí se mide otra cosa. Su propio caso fija el 1.
{ const TE = G.TurnEngine; G.TurnEngine = class extends TE { constructor(o) { super(o); this.numeroTurno = 2; } }; }
const C = G.Combat;

// a: personajes de A, b: de B. Cada jugador: lista de ids. Las acciones: todas.
function mesa(a, b) {
  const accs = G.ACTIONS.map((x) => x.id);
  const m = new G.TurnEngine({
    jugador: G.crearJugador('A', 'x', a, accs, true),
    oponente: G.crearJugador('B', 'y', b, accs, true),
    alCambiar: () => {}
  });
  return m;
}
const inst = (j, id) => [...j.reserva, ...j.activos, ...j.hades].find((i) => i.personaje === id);
const poner = (m, j, id, accion) => {
  const i = inst(j, id);
  j.reserva = j.reserva.filter((x) => x !== i);
  j.activos.push(i);
  j.revelados.add(id);
  if (accion) { i.accion = accion; j.revelados.add(accion); }
  return i;
};
const alHades = (j, id) => { const i = inst(j, id); j.reserva = j.reserva.filter((x) => x !== i); j.hades.push(i); return i; };
const revelar = (j, id) => j.revelados.add(id);

const casos = [];
const caso = (nombre, obtenido, esperado) => casos.push({ nombre, obtenido, esperado, ok: obtenido === esperado });

{ // Gurh: +1 por cada reanimado en el Hades (los dos bandos)
  const m = mesa(['rea_gurh', 'rea_luh', 'rea_vyla'], ['rea_zabar', 'rea_thila']);
  const [A, B] = m.jugadores;
  const g = poner(m, A, 'rea_gurh', 'o_finta');
  alHades(A, 'rea_luh'); alHades(B, 'rea_zabar');
  m.notificar();
  caso('Gurh 2 + 2 reanimados en el Hades', C.ataqueEfectivo(g), 2 + 2);
}
{ // Thila: el activo rival pierde 1/1 por cada reanimado en el Hades
  const m = mesa(['rea_thila', 'rea_luh'], ['des_axel']);
  const [A, B] = m.jugadores;
  poner(m, A, 'rea_thila', 'o_finta');
  const ax = poner(m, B, 'des_axel', 'o_finta');
  alHades(A, 'rea_luh');
  m.notificar();
  caso('Thila: Axel 4 − 1', C.ataqueEfectivo(ax), 3);
}
{ // Ejército desde el Hades: tu Reanimado gana el ataque de TUS reanimados en el Hades
  const m = mesa(['rea_ejercito', 'rea_vyla', 'rea_zabar'], ['rea_gurh']);
  const [A, B] = m.jugadores;
  const v = poner(m, A, 'rea_vyla', 'o_finta');
  alHades(A, 'rea_ejercito'); alHades(A, 'rea_zabar'); alHades(B, 'rea_gurh');
  m.notificar();
  // Vyla 2 + Ejército 1 + Zabar 3 (el Gurh del rival no cuenta: «tus»)
  caso('Ejército: Vyla 2 + 1 + 3', C.ataqueEfectivo(v), 6);
}
{ // Zabar: con Gurh en el Hades duplica ataque (ofensiva) o defensa (defensiva)
  const m = mesa(['rea_zabar', 'rea_gurh'], ['des_axel']);
  const [A] = m.jugadores;
  const z = poner(m, A, 'rea_zabar', 'd_bloquear');
  m.notificar();
  caso('Zabar sin Gurh en el Hades: defensa 4', C.defensaEfectiva(z), 4);
  alHades(A, 'rea_gurh');
  m.notificar();
  caso('Zabar con Gurh en el Hades: defensa 4×2', C.defensaEfectiva(z), 8);
}
{ // Auram: +1 por cada DOS reveladas en el campo (los dos bandos)
  const m = mesa(['des_auram', 'des_axel', 'des_thiana'], ['lun_sadash', 'lun_delem']);
  const [A, B] = m.jugadores;
  const au = poner(m, A, 'des_auram', 'o_finta');      // 2 reveladas: Auram + Finta
  revelar(A, 'des_axel');                               // 3
  poner(m, B, 'lun_sadash', 'd_bloquear');              // 5
  revelar(B, 'lun_delem');                              // 6
  m.notificar();
  caso('Auram 10 + floor(6/2)', C.ataqueEfectivo(au), 13);
  alHades(B, 'lun_delem'); B.revelados.delete('lun_delem');
  m.notificar();
  caso('Auram tras ir uno al Hades: 10 + floor(5/2)', C.ataqueEfectivo(au), 12);
}
{ // Lydia (revelada en la mano): tu Desterrado gana 1 por cada ACCIÓN revelada del oponente
  const m = mesa(['des_lydia', 'des_axel'], ['lun_sadash']);
  const [A, B] = m.jugadores;
  const ax = poner(m, A, 'des_axel', 'o_finta');
  revelar(A, 'des_lydia');
  poner(m, B, 'lun_sadash', 'd_bloquear');
  revelar(B, 'o_inmolacion');
  m.notificar();
  caso('Lydia: Axel 4 + 2 acciones rivales', C.ataqueEfectivo(ax), 6);
  // Lydia sin revelar no hace nada
  const m2 = mesa(['des_lydia', 'des_axel'], ['lun_sadash']);
  const ax2 = poner(m2, m2.jugadores[0], 'des_axel', 'o_finta');
  poner(m2, m2.jugadores[1], 'lun_sadash', 'd_bloquear');
  m2.notificar();
  caso('Lydia sin revelar: Axel 4', C.ataqueEfectivo(ax2), 4);
}
{ // Acompañantes (revelados en la mano): tu Lunaria +1 por cada lunaria revelado (los dos bandos)
  const m = mesa(['lun_acompanantes', 'lun_delem'], ['lun_sadash']);
  const [A, B] = m.jugadores;
  const d = poner(m, A, 'lun_delem', 'o_finta');
  revelar(A, 'lun_acompanantes');
  poner(m, B, 'lun_sadash', 'o_finta');
  m.notificar();
  // Delem 4 + 3 lunaria revelados (Delem, Acompañantes, Sadash) — Delem +2 de su
  // propio efecto solo se da al acoplar por el motor, aquí no se acopló así.
  caso('Acompañantes: Delem 4 + 3', C.ataqueEfectivo(d), 7);
}
{ // Fälum en posición: +1 por cada aliado lunaria revelado EN TU MANO
  const m = mesa(['lun_falum', 'lun_delem', 'lun_seluah'], ['lun_sadash']);
  const [A, B] = m.jugadores;
  const f = poner(m, A, 'lun_falum', 'o_finta');
  revelar(A, 'lun_delem'); revelar(A, 'lun_seluah');
  poner(m, B, 'lun_sadash', 'o_finta');   // del rival: no cuenta
  m.notificar();
  caso('Fälum 6 + 2 aliados', C.ataqueEfectivo(f), 8);
}
{ // Revelada desde que se usa, y deja de estarlo al ir al Hades
  const m = mesa(['des_axel', 'des_annia'], ['lun_sadash']);
  const [A] = m.jugadores;
  m.desplegar(inst(A, 'des_annia').uid, { saltarFase: true });
  caso('Desplegar revela', A.revelados.has('des_annia'), true);
  m.enviarAlHades(A, inst(A, 'des_annia'), 'prueba');
  caso('Al Hades deja de estar revelada', A.revelados.has('des_annia'), false);
}

for (const c of casos) console.log(`${c.ok ? 'OK ' : 'MAL'}  ${c.nombre}: ${c.obtenido}${c.ok ? '' : ` (esperado ${c.esperado})`}`);
console.log(casos.every((c) => c.ok) ? 'TODO BIEN' : 'HAY FALLOS');
