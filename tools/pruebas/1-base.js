// La base de la tanda 1: elecciones, estados con duración, bloqueos.
const fs = require('fs');
const vm = require('vm');
const RAIZ = require('path').join(__dirname, '..', '..', 'src', 'js') + '/';
const ARCHIVOS = ['data/races.js', 'data/characters.js', 'data/actions.js', 'data/creatures.js',
  'data/dungeons.js', 'core/state.js', 'core/team.js', 'core/hades.js', 'core/manual.js',
  'core/combat.js', 'core/bossAbilities.js', 'core/accionesIA.js', 'core/efectosPersonaje.js',
  'core/turnEngine.js', 'core/ai.js'];
const ctx = { window: {}, console: { log() {}, warn() {}, error: console.error }, Math, Date, JSON, Set, Map };
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
const mesa = (a, b, humanoA = true) => new G.TurnEngine({
  jugador: G.crearJugador('A', 'desterrado', a, accs, !humanoA),
  oponente: G.crearJugador('B', 'lunaria', b, accs, true),
  alCambiar: () => {}
});
const inst = (j, id) => [...j.reserva, ...j.activos].find((i) => i.personaje === id);

{ // Humano despliega a Annia con acciones ocultas en el rival → se le pregunta
  const m = mesa(['des_annia'], ['lun_sadash']);
  const [A] = m.jugadores;
  m.desplegar(inst(A, 'des_annia').uid);
  caso('Annia (humano): elección pendiente', !!m.eleccionPendiente, true);
  caso('…con dos opciones', m.eleccionPendiente && m.eleccionPendiente.opciones.map((o) => o.id), ['bono', 'revelar']);
  m.siguienteFase();
  caso('…y no se avanza de fase mientras tanto', m.fase, 'personaje');
  m.resolverEleccion('bono');
  caso('Elegir +1: modificador', inst(A, 'des_annia').modificadores.ataque, 1);
  caso('…y la elección se cierra', m.eleccionPendiente, null);
}
{ // Elegir revelar: 1 acción del rival pasa a revelada, sin bono
  const m = mesa(['des_annia'], ['lun_sadash']);
  const [A, B] = m.jugadores;
  const antes = B.revelados.size;
  m.desplegar(inst(A, 'des_annia').uid);
  m.resolverEleccion('revelar');
  // Ahora se elige CUÁL (por posición; en pantalla, pinchando el reverso).
  const ops = m.eleccionPendiente ? m.eleccionPendiente.opciones : [];
  caso('Elegir revelar: pregunta qué carta', ops.length > 1 && ops.every((o) => /oculta/.test(o.texto)), true);
  m.resolverEleccion(ops[1].id);
  caso('…revela justo la elegida', B.revelados.has(ops[1].id), true);
  caso('Elegir revelar: +1 revelada en el rival', B.revelados.size - antes, 1);
  caso('…sin bono', inst(A, 'des_annia').modificadores.ataque, 0);
}
{ // IA: decide sola, sin dejar nada pendiente
  const m = mesa(['des_annia'], ['lun_sadash'], false);
  const [A] = m.jugadores;
  m.desplegar(inst(A, 'des_annia').uid);
  caso('IA: nada pendiente', m.eleccionPendiente, null);
  caso('IA sin Lydia/Auram toma el bono', inst(A, 'des_annia').modificadores.ataque, 1);
}
{ // Sin nada oculto que revelar, no hay pregunta
  const m = mesa(['des_annia'], ['lun_sadash']);
  const [A, B] = m.jugadores;
  B.acciones.forEach((id) => B.revelados.add(id));
  m.desplegar(inst(A, 'des_annia').uid);
  caso('Sin ocultas: no pregunta', m.eleccionPendiente, null);
  caso('…y aplica el bono', inst(A, 'des_annia').modificadores.ataque, 1);
}
{ // Inmune: no se le puede atacar; caduca contando los turnos de los dos
  const m = mesa(['des_annia'], ['lun_sadash'], false);
  const [A, B] = m.jugadores;
  m.desplegar(inst(A, 'des_annia').uid);
  A.activos[0].accion = 'o_finta';
  m.turnoDe = 1; m.desplegar(inst(B, 'lun_sadash').uid, { saltarFase: true }); m.turnoDe = 0;
  m.ponerEstado({ tipo: 'inmune', jugador: B, uid: B.activos[0].uid, turnos: 2, motivo: 'Pip' });
  m.fase = 'ataque';
  caso('Inmune: sin atacantes disponibles', m.atacantesDisponibles(A).length, 0);
  caso('Inmune: declarar falla', m.declararAtaque(), false);
  m.finalizarTurno();
  caso('Tras 1 turno sigue', m.tieneEstado('inmune'), true);
  m.finalizarTurno();
  caso('Tras 2 turnos (uno de cada) caduca', m.tieneEstado('inmune'), false);
}
{ // Sin ataques (Diplomático)
  const m = mesa(['des_annia'], ['lun_sadash'], false);
  const [A] = m.jugadores;
  m.desplegar(inst(A, 'des_annia').uid);
  A.activos[0].accion = 'o_finta';
  m.ponerEstado({ tipo: 'sinAtaques', turnos: 2, motivo: 'Diplomático' });
  m.fase = 'ataque';
  caso('Sin ataques: nadie puede atacar', m.puedeAtacar(), false);
}
{ // Acción bloqueada: ya no se ofrece ni se acopla
  const m = mesa(['des_annia'], ['lun_sadash']);
  const [A] = m.jugadores;
  G.Manual.bloquear(m, A, 'o_finta', 2, 'Kaw');
  caso('Bloqueada fuera de las disponibles', m.accionesDisponibles(A).includes('o_finta'), false);
}
{ // Personaje bloqueado: no se puede desplegar
  const m = mesa(['des_annia', 'des_axel'], ['lun_sadash']);
  const [A] = m.jugadores;
  const an = inst(A, 'des_annia');
  m.ponerEstado({ tipo: 'personajeBloqueado', jugador: A, uid: an.uid, turnos: 3, motivo: 'Kratox' });
  caso('Personaje bloqueado: no se despliega', m.puedeDesplegar(A, an), false);
}

for (const c of casos) console.log(`${c.ok ? 'OK ' : 'MAL'}  ${c.n}: ${c.o}${c.ok ? '' : ` (esperado ${c.e})`}`);
console.log(casos.every((c) => c.ok) ? 'TODO BIEN' : 'HAY FALLOS');
