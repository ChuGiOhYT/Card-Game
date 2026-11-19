/**
 * Narrador: genera la voz de las cinemáticas de la campaña.
 *
 *   GENERAR_NARRACION.bat                                  (lo normal)
 *   node tools/narrador/generar-narracion.mjs              # lo que falte
 *   node tools/narrador/generar-narracion.mjs --listar     # qué haría, sin generar
 *   node tools/narrador/generar-narracion.mjs --solo desterrado
 *   node tools/narrador/generar-narracion.mjs --tono anciano
 *   node tools/narrador/generar-narracion.mjs --limite 2   # prueba corta
 *
 * Qué narra: la cinemática de cada calabozo (al entrar a su pantalla) y la
 * entrada y la victoria de cada etapa. Los textos salen de
 * src/js/data/dungeons.js: si cambias uno, se rehace solo ese.
 *
 * Tonos (el jugador elige en Sonido → Voz del narrador):
 *   normal   tu voz «mayor» (Chatterbox local, combo-shorts), emoción normal
 *   suave    tu voz «mayor», emoción calma
 *   anciano  Gemini TTS, voz Algenib: anciano místico (EN LÍNEA)
 *
 * Gemini gratis da 10 peticiones al día por modelo. Por eso pide varias
 * escenas en cada petición, las corta con Whisper (alinear.py) y comprueba
 * cada una; lo que salga mal o no quepa en el cupo de hoy queda para la
 * próxima vez. Basta con volver a abrir el .bat cada día hasta que diga
 * «todo al día».
 *
 * Deja:
 *   src/assets/narracion/<tono>/<archivo>.ogg     (Opus mono, ~48 kbps)
 *   src/assets/narracion/narracion.js             (el índice que lee el juego)
 *
 * Pronunciación: tools/narrador/pronunciacion.txt («escrito = dicho»), solo
 * para la voz. Cambiarla rehace lo afectado.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hablar, guardarOgg, buscarFfmpeg, MODELO } from './gemini-tts.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..');
const DOCS = path.join(os.homedir(), 'Documents');
const COMBO = process.env.COMBO_SHORTS || path.join(DOCS, 'combo-shorts');
const PERFIL = process.env.VOZ_PERFIL || 'mayor';
const SALIDA = path.join(RAIZ, 'src', 'assets', 'narracion');
const TRABAJO = path.join(AQUI, 'trabajo');
const PY = path.join(COMBO, '.venv-voz', 'Scripts', 'python.exe');

const TONOS = {
  normal: { motor: 'local', emocion: 'normal' },
  suave: { motor: 'local', emocion: 'calma' },
  anciano: {
    motor: 'gemini',
    voz: 'Algenib',
    // En inglés y como «Say …:», que es el formato que el modelo NO lee en voz
    // alta (en español se leía la instrucción entera).
    estilo: 'Say in the voice of a wise old man telling an ancient legend: slow, deep, mystical, almost whispering, with calm pauses between sentences. The text is in Spanish'
  }
};
/** Escenas por petición a Gemini y tope de caracteres de cada petición. */
const POR_LOTE = 6;
const MAX_CARACTERES = 900;

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const listar = args.includes('--listar');
const solo = arg('--solo');
const soloTono = arg('--tono');
const limite = arg('--limite') ? Number(arg('--limite')) : Infinity;

const fallo = (msg, ayuda) => {
  console.error(`\n  ✖ ${msg}`);
  if (ayuda) console.error(`    ${ayuda}`);
  process.exit(1);
};

/* ----------------------------- Los textos ----------------------------- */

/** El mismo hash que usa el juego (ui/narrador.js): FNV-1a de 32 bits. */
export function clave(texto) {
  let h = 0x811c9dc5;
  const t = String(texto).trim();
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function cargarCalabozos() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  for (const rel of ['races.js', 'characters.js', 'creatures.js', 'dungeons.js']) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, 'src', 'js', 'data', rel), 'utf8'), ctx, { filename: rel });
  }
  return ctx.window.Game.DUNGEONS;
}

function textosANarrar() {
  const lista = [];
  const poner = (donde, texto) => { if (texto && texto.trim()) lista.push({ donde, texto: texto.trim() }); };
  for (const [raza, cal] of Object.entries(cargarCalabozos())) {
    if (solo && raza !== solo) continue;
    poner(`${raza} · calabozo`, cal.cinematica && cal.cinematica.texto);
    for (const e of cal.etapas) {
      poner(`${raza} · etapa ${e.n} · entrada`, e.cineEntrada && e.cineEntrada.texto);
      poner(`${raza} · etapa ${e.n} · victoria`, e.cineVictoria && e.cineVictoria.texto);
    }
  }
  return lista;
}

function pronunciacion() {
  const ruta = path.join(AQUI, 'pronunciacion.txt');
  if (!fs.existsSync(ruta)) return [];
  return fs.readFileSync(ruta, 'utf8').split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
    .filter(([a]) => a);
}

function paraLaVoz(texto, reglas) {
  let t = texto;
  for (const [escrito, dicho] of reglas) t = t.split(escrito).join(dicho);
  // Raya de diálogo: la voz la lee como pausa, no como «guion».
  return t.replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ').trim();
}

/** Nombre del archivo: cambia si cambia el texto dicho o la voz que lo dice. */
function archivoDe(tono, voz) {
  const t = TONOS[tono];
  const firma = t.motor === 'local'
    ? `${voz}|${t.emocion}|${PERFIL}`
    : `${voz}|gemini|${t.voz}|${t.estilo}`;
  return `${tono}/${clave(firma)}.ogg`;
}

/** Duración de un .wav leyendo su cabecera (cualquier formato PCM o float). */
function duracionWav(ruta) {
  const b = fs.readFileSync(ruta);
  let i = 12, bytesPorSegundo = 0, datos = 0;
  while (i + 8 <= b.length) {
    const id = b.toString('ascii', i, i + 4), tam = b.readUInt32LE(i + 4);
    if (id === 'fmt ') bytesPorSegundo = b.readUInt32LE(i + 16);
    if (id === 'data') { datos = tam; break; }
    i += 8 + tam + (tam % 2);
  }
  return bytesPorSegundo ? datos / bytesPorSegundo : 0;
}

function wavDePcm(pcm, hz) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(hz, 24); h.writeUInt32LE(hz * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/* -------------------------------- Plan --------------------------------- */

const reglas = pronunciacion();
const textos = textosANarrar();
const indiceRuta = path.join(SALIDA, 'narracion.js');
const anterior = (() => {
  if (!fs.existsSync(indiceRuta)) return {};
  const ctx = { window: {} };
  try { vm.runInNewContext(fs.readFileSync(indiceRuta, 'utf8'), ctx); } catch { return {}; }
  return (ctx.window.Game && ctx.window.Game.NARRACION) || {};
})();

// Se parte siempre del índice anterior: lo que no se rehace hoy se conserva.
const indice = {};
for (const [k, v] of Object.entries(anterior)) indice[k] = { ...v };
const vigentes = new Set();
const pendientes = { local: [], gemini: [] };
for (const { donde, texto } of textos) {
  const k = clave(texto);
  vigentes.add(k);
  const voz = paraLaVoz(texto, reglas);
  const entrada = indice[k] || {};
  entrada.donde = donde;
  for (const [tono, t] of Object.entries(TONOS)) {
    if (soloTono && tono !== soloTono) continue;
    const archivo = archivoDe(tono, voz);
    const previa = entrada[tono];
    if (previa && previa.src === `assets/narracion/${archivo}` && fs.existsSync(path.join(SALIDA, archivo))) continue;
    delete entrada[tono];
    pendientes[t.motor].push({ k, tono, voz, donde, archivo });
  }
  indice[k] = entrada;
}
// Textos que ya no existen en el juego.
if (!solo) for (const k of Object.keys(indice)) if (!vigentes.has(k)) delete indice[k];

const total = pendientes.local.length + pendientes.gemini.length;
console.log(`\n  Narrador · ${textos.length} textos · tonos: ${Object.keys(TONOS).join(', ')}`);
console.log(`  Por generar: ${total}${total ? ` (${pendientes.local.length} con tu voz, ${pendientes.gemini.length} con Gemini)` : ' (todo al día)'}`);
if (listar) {
  for (const t of [...pendientes.local, ...pendientes.gemini]) console.log(`   · [${t.tono}] ${t.donde}: ${t.voz.slice(0, 70)}…`);
  process.exit(0);
}

const escribirIndice = () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const orden = Object.keys(TONOS);
  const cuerpo = Object.fromEntries(Object.entries(indice).map(([k, v]) => [k, {
    donde: v.donde, ...Object.fromEntries(orden.filter((t) => v[t]).map((t) => [t, v[t]]))
  }]));
  fs.writeFileSync(indiceRuta,
    '// GENERADO por tools/narrador/generar-narracion.mjs: no editar a mano.\n' +
    '// Clave = hash del texto de la cinemática (ui/narrador.js calcula el mismo).\n' +
    'window.Game = window.Game || {};\n' +
    `window.Game.NARRACION = ${JSON.stringify(cuerpo, null, 1)};\n`, 'utf8');
};

const ffmpeg = buscarFfmpeg();
if (total && !ffmpeg) fallo('No encuentro ffmpeg con libopus.', 'Define FFMPEG con la ruta a ffmpeg.exe.');
fs.mkdirSync(TRABAJO, { recursive: true });

/* ----------------------- Tu voz (Chatterbox local) ---------------------- */

const locales = pendientes.local.slice(0, limite);
if (locales.length) {
  if (!fs.existsSync(PY)) fallo('Falta el entorno de la voz.', `Busqué ${PY}`);
  if (!fs.existsSync(path.join(COMBO, 'voces', PERFIL, 'ref_normal.wav'))) {
    fallo(`La voz «${PERFIL}» no tiene sus muestras.`, `Corre scripts/perfil_voz.py ${PERFIL} en combo-shorts.`);
  }
  const conWav = locales.map((t, i) => ({ ...t, wav: path.join(TRABAJO, `${i}_${t.tono}.wav`) }));
  const ruta = path.join(TRABAJO, 'trabajos.json');
  fs.writeFileSync(ruta, JSON.stringify(conWav.map((t) => ({ texto: t.voz, tono: TONOS[t.tono].emocion, salida: t.wav.replace(/\\/g, '/') })), null, 1), 'utf8');
  console.log(`\n  Tu voz: ${locales.length} audios con la tarjeta gráfica…\n`);
  const r = spawnSync(PY, [path.join(COMBO, 'scripts', 'voz_propia.py'), ruta], {
    cwd: COMBO, stdio: 'inherit', env: { ...process.env, PYTHONIOENCODING: 'utf-8', VOZ_PERFIL: PERFIL }
  });
  if (r.error || r.status !== 0) fallo('El generador de voz terminó con error.', 'Si dice «CUDA out of memory», cierra lo que use la gráfica y repite: lo ya hecho no se rehace.');
  for (const t of conWav) {
    if (!fs.existsSync(t.wav)) fallo(`No se generó: ${t.donde} [${t.tono}]`);
    const destino = path.join(SALIDA, t.archivo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    const c = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', t.wav, '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', destino]);
    if (c.status !== 0) fallo(`ffmpeg no pudo comprimir ${t.wav}`, String(c.stderr || ''));
    indice[t.k][t.tono] = { src: `assets/narracion/${t.archivo}`, dur: Math.round(duracionWav(t.wav) * 100) / 100 };
    console.log(`  ✔ [${t.tono}] ${t.donde} · ${indice[t.k][t.tono].dur} s`);
  }
  escribirIndice();
}

/* ------------------------- Gemini (en línea) ---------------------------- */

const remotos = pendientes.gemini.slice(0, Math.max(0, limite - locales.length));
if (remotos.length) {
  if (!fs.existsSync(PY)) fallo('Falta el python de combo-shorts (lo usa Whisper para cortar).', `Busqué ${PY}`);
  // Lotes por tono, de hasta POR_LOTE escenas y MAX_CARACTERES.
  const lotes = [];
  for (const tono of Object.keys(TONOS)) {
    let lote = [];
    for (const t of remotos.filter((x) => x.tono === tono)) {
      const largo = lote.reduce((s, x) => s + x.voz.length, 0);
      if (lote.length && (lote.length >= POR_LOTE || largo + t.voz.length > MAX_CARACTERES)) {
        lotes.push(lote);
        lote = [];
      }
      lote.push(t);
    }
    if (lote.length) lotes.push(lote);
  }
  console.log(`\n  Gemini (${MODELO}): ${remotos.length} escenas en ${lotes.length} peticiones.`);
  console.log('  El plan gratuito da 10 peticiones al día: lo que no quepa hoy, mañana.\n');

  let hechas = 0, malas = 0, cupoAgotado = false;
  for (const [n, lote] of lotes.entries()) {
    const t0 = TONOS[lote[0].tono];
    const texto = lote.map((x) => x.voz).join('\n\n');
    let audio;
    try {
      audio = await hablar({ texto, voz: t0.voz, estilo: `${t0.estilo}:` });
    } catch (e) {
      if (e.cuotaDiaria || /per day|PerDay/i.test(e.message)) {
        cupoAgotado = true;
        break;
      }
      console.log(`  ✖ Petición ${n + 1}: ${e.message.slice(0, 160)}`);
      continue;
    }
    const wav = path.join(TRABAJO, `lote_${n}.wav`);
    fs.writeFileSync(wav, wavDePcm(audio.pcm, audio.hz));
    const trabajo = path.join(TRABAJO, `lote_${n}.json`), cortes = path.join(TRABAJO, `lote_${n}_cortes.json`);
    fs.writeFileSync(trabajo, JSON.stringify({ audio: wav, textos: lote.map((x) => x.voz), salida: cortes }), 'utf8');
    const r = spawnSync(PY, [path.join(AQUI, 'alinear.py'), trabajo], {
      cwd: COMBO, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    if (r.status !== 0 || !fs.existsSync(cortes)) {
      console.log(`  ✖ Petición ${n + 1}: Whisper no pudo cortarla.\n${(r.stderr || '').split('\n').slice(-4).join('\n')}`);
      continue;
    }
    for (const c of JSON.parse(fs.readFileSync(cortes, 'utf8'))) {
      const t = lote[c.i];
      if (!c.ok) {
        malas++;
        console.log(`  · [${t.tono}] ${t.donde}: ${c.motivo} → se repite otro día`);
        continue;
      }
      const destino = path.join(SALIDA, t.archivo);
      fs.mkdirSync(path.dirname(destino), { recursive: true });
      const f = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-ss', String(c.inicio), '-to', String(c.fin),
        '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', destino]);
      if (f.status !== 0) { console.log(`  ✖ ffmpeg: ${String(f.stderr).slice(0, 160)}`); continue; }
      indice[t.k][t.tono] = { src: `assets/narracion/${t.archivo}`, dur: Math.round((c.fin - c.inicio) * 100) / 100 };
      hechas++;
      console.log(`  ✔ [${t.tono}] ${t.donde} · ${indice[t.k][t.tono].dur} s`);
    }
    escribirIndice(); // lo hecho queda guardado aunque se corte después
  }
  const faltan = remotos.length - hechas;
  console.log(`\n  Gemini hoy: ${hechas} escenas listas${malas ? `, ${malas} salieron mal y se repetirán` : ''}.`);
  if (faltan > 0) {
    console.log(cupoAgotado
      ? `  Se acabó el cupo gratuito de hoy. Faltan ${faltan}: vuelve a abrir GENERAR_NARRACION.bat mañana.`
      : `  Faltan ${faltan}: vuelve a abrir GENERAR_NARRACION.bat (si es el mismo día, puede que ya no quede cupo).`);
  }
}

/* -------------------------------- Cierre -------------------------------- */

escribirIndice();
fs.rmSync(TRABAJO, { recursive: true, force: true });
// Audios que ya no usa ningún texto (un texto cambiado deja el suyo viejo).
if (!solo && !soloTono) {
  const usados = new Set(Object.values(indice).flatMap((v) => Object.keys(TONOS).map((t) => v[t] && v[t].src)).filter(Boolean));
  for (const tono of Object.keys(TONOS)) {
    const dir = path.join(SALIDA, tono);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!usados.has(`assets/narracion/${tono}/${f}`)) fs.rmSync(path.join(dir, f));
    }
  }
}
const listos = Object.fromEntries(Object.keys(TONOS).map((t) => [t, Object.values(indice).filter((v) => v[t]).length]));
console.log(`\n  ✔ Índice: ${Object.entries(listos).map(([t, n]) => `${t} ${n}/${textos.length}`).join(' · ')}\n`);
