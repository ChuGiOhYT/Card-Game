// Duelo remoto, tanda 2: el anfitrión manda y el invitado juega con un motor
// espejo. Se simulan los dos PC con un canal falso ASÍNCRONO (cada mensaje
// pasa por JSON y llega en otra vuelta del bucle, como por la red).
const fs = require('fs');
const vm = require('vm');
const RAIZ = require('path').join(__dirname, '..', '..', 'src', 'js') + '/';
const ARCHIVOS = ['data/races.js', 'data/characters.js', 'data/actions.js', 'data/creatures.js',
  'data/dungeons.js', 'core/state.js', 'core/team.js', 'core/hades.js', 'core/manual.js',
  'core/combat.js', 'core/bossAbilities.js', 'core/accionesIA.js', 'core/efectosPersonaje.js',
  'core/turnEngine.js', 'core/ai.js', 'core/sincro.js', 'core/dueloRed.js'];
const ctx = { window: {}, console: { log() {}, warn() {}, error: console.error }, Math, Date, JSON, Set, Map };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const rel of ARCHIVOS) vm.runInContext(fs.readFileSync(RAIZ + rel, 'utf8'), ctx, { filename: rel });
const G = ctx.window.Game;

const casos = [];
const caso = (n, o, e) => casos.push({ n, o: JSON.stringify(o), e: JSON.stringify(e), ok: JSON.stringify(o) === JSON.stringify(e) });
const vuelta = () => new Promise((r) => setImmediate(r));
const calmar = async () => { for (let i = 0; i < 6; i++) await vuelta(); };

/** Dos extremos de un canal: lo que envía uno lo recibe el otro, en JSON y más tarde. */
function canal() {
  const hacia = (destino, registro) => ({
    _oy: [],
    on(ev, fn) { if (ev === 'mensaje') this._oy.push(fn); return () => { this._oy = this._oy.filter((f) => f !== fn); }; },
    enviar(d) {
      const txt = JSON.stringify(d);
      registro.push(txt);
      setImmediate(() => destino()._oy.forEach((f) => f(JSON.parse(txt))));
      return true;
    }
  });
  const alInvitado = [], alAnfitrion = [];
  let a, b;
  a = hacia(() => b, alInvitado);
  b = hacia(() => a, alAnfitrion);
  return { anfitrion: a, invitado: b, alInvitado, alAnfitrion };
}

const ACC = ['o_finta', 'd_bloquear', 'd_acrobatico', 'n_ruego', 'o_luna_sangrienta', 'n_diplomatico', 'o_rompescudos', 'n_investigar'];
const LUN = ['lun_sadash', 'lun_delem', 'lun_acompanantes', 'lun_falum', 'lun_seluah'];
const DES = ['des_annia', 'des_axel', 'des_thiana', 'des_erem', 'des_lydia'];

(async () => {
  const c = canal();
  const motor = new G.TurnEngine({
    jugador: G.crearJugador('Anfitrión', 'lunaria', LUN, ACC, false),
    oponente: G.crearJugador('Invitado', 'desterrado', DES, ACC, false),
    alCambiar: () => {}
  });
  const espejo = G.DueloRed.invitado({ red: c.invitado });
  const sesion = G.DueloRed.anfitrion({ motor, red: c.anfitrion });
  motor.iniciar();
  await calmar();

  caso('el invitado recibe la mesa', espejo.listo, true);
  caso('…y sabe que es el jugador 1', espejo.yo, 1);
  caso('…en la misma fase', espejo.fase, motor.fase);
  caso('jugadorActivo conserva la identidad', espejo.jugadorActivo === espejo.jugadores[0], true);
  caso('el registro llega', espejo.registro.map((l) => l.texto), motor.registro.map((l) => l.texto));
  caso('las acciones ocultas del anfitrión van tapadas', espejo.jugadores[0].acciones.every((id) => id.startsWith('?')), true);
  caso('…y su reserva también', espejo.jugadores[0].reserva.every((i) => i.personaje.startsWith('?')), true);
  caso('las cartas propias del invitado se ven', espejo.jugadores[1].reserva.map((i) => i.personaje), DES);
  caso('ningún mensaje al invitado nombra un personaje oculto del anfitrión', c.alInvitado.some((t) => /lun_/.test(t)), false);
  caso('las consultas funcionan en el espejo', espejo.energiaDe(espejo.jugadores[1]), 0);

  // Fuera de turno y cosas no permitidas: se rechazan sin tocar nada.
  const r1 = await espejo.desplegar(espejo.jugadores[1].reserva[0].uid);
  caso('desplegar fuera de turno: rechazado', [r1.ok, r1.motivo], [false, 'No es tu turno.']);
  const r2 = await espejo.intento('_sangre', { $j: 1 }, 5);
  caso('una función interna no se puede pedir', r2.ok, false);
  const r3 = await espejo.enviarAlHades(espejo.jugadores[0], espejo.jugadores[0].reserva[0]);
  caso('mandar al Hades cartas del rival: rechazado', r3.ok, false);
  const r4 = await espejo.derramar(espejo.jugadores[0], 5);
  caso('mover la sangre del rival: rechazado', [r4.ok, motor.jugadores[0].sangre.gasto], [false, 0]);
  caso('la partida no cambió', [motor.fase, motor.turnoDe, motor.jugadores[1].reserva.length], ['personaje', 0, 5]);

  /* --------------------- Jugar: una política sencilla -------------------- */
  // `quien` es el motor (anfitrión) o el espejo (invitado). Una jugada por llamada.
  const jugar = async (quien, idx) => {
    const m = quien;
    const yo = m.jugadores[idx];
    if (m.terminada) return;
    const e = m.eleccionPendiente;
    if (e) { if (e.jugadorIdx === idx) await m.resolverEleccion(e.opciones[0].id); return; }
    if (m.jugadorActivo !== yo) return;
    if (m.ataquePendiente) { await m.resolverAtaque(); return; }
    if (m.fase === 'personaje') {
      if (!yo.activos.length && !m.desplegoEsteTurno) {
        const puede = yo.reserva.find((i) => m.puedeDesplegar(yo, i));
        if (puede) { await m.desplegar(puede.uid); return; }
        if (yo.sangre.pila > 3) { await m.derramar(yo, 1); return; }
      }
      await m.siguienteFase(); return;
    }
    if (m.fase === 'accion') {
      const a = yo.activos[0];
      const libres = m.accionesDisponibles(yo);
      if (a && !a.accion && libres.length) { await m.equipar(libres[0], a.uid); return; }
      await m.siguienteFase(); return;
    }
    if (m.fase === 'ataque') {
      const at = m.atacantesDisponibles(yo);
      if (at.length) { await m.declararAtaque(at[0].uid); return; }
      await m.siguienteFase(); return;
    }
    await m.siguienteFase();
  };

  // El turno del anfitrión, hasta que le toque al invitado.
  for (let i = 0; i < 40 && motor.turnoDe === 0 && !motor.terminada; i++) { await jugar(motor, 0); await calmar(); }
  caso('le toca al invitado (en los dos lados)', [motor.turnoDe, espejo.turnoDe], [1, 1]);

  // Annia del invitado: «revelar» y elegir la acción oculta por su marca.
  await espejo.desplegar(espejo.jugadores[1].reserva.find((i) => i.personaje === 'des_annia').uid);
  await calmar();
  caso('Annia pregunta en el espejo', espejo.eleccionPendiente && espejo.eleccionPendiente.opciones.map((o) => o.id), ['bono', 'revelar']);
  caso('…y en el anfitrión la pregunta es del invitado', motor.eleccionPendiente && motor.eleccionPendiente.jugadorIdx, 1);
  await espejo.resolverEleccion('revelar');
  await calmar();
  const ops = espejo.eleccionPendiente ? espejo.eleccionPendiente.opciones : [];
  caso('las opciones de revelar llegan con marcas, no con ids', ops.length > 1 && ops.every((o) => o.id.startsWith('?')), true);
  const marca = ops[1] && ops[1].id;
  const real = sesion.marcas[marca];
  await espejo.resolverEleccion(marca);
  await calmar();
  caso('el anfitrión revela la carta de esa marca', motor.jugadores[0].revelados.has(real), true);
  caso('…y el espejo ya la ve boca arriba', espejo.jugadores[0].acciones.includes(real), true);

  // Y el resto del duelo, por turnos, hasta que alguien gane.
  let pasos = 0, desfases = 0;
  while (!motor.terminada && pasos++ < 2000) {
    await jugar(motor, 0);
    await calmar();
    await jugar(espejo, 1);
    await calmar();
    const igual = espejo.fase === motor.fase && espejo.turnoDe === motor.turnoDe
      && motor.jugadores.every((j, k) => JSON.stringify(j.sangre) === JSON.stringify(espejo.jugadores[k].sangre));
    if (!igual) desfases++;
  }
  caso('el duelo termina', motor.terminada, true);
  caso('sin un solo desfase entre los dos PC', desfases, 0);
  caso('el espejo sabe quién ganó', espejo.terminada && espejo.ganador && espejo.ganador.nombre, motor.ganador && motor.ganador.nombre);
  caso('mismo turno final', espejo.numeroTurno, motor.numeroTurno);
  const r5 = await espejo.siguienteFase();
  caso('terminado, ya no se acepta nada', r5.ok, false);
  sesion.soltar();
  espejo.soltar();

  for (const x of casos) console.log(`${x.ok ? 'OK ' : 'MAL'}  ${x.n}: ${x.o}${x.ok ? '' : ` (esperado ${x.e})`}`);
  console.log(casos.every((x) => x.ok) ? 'TODO BIEN' : 'HAY FALLOS');
})().catch((e) => { console.log(`MAL  la prueba revienta: ${e.stack}`); });
