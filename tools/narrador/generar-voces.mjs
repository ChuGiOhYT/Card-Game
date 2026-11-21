/**
 * Voces de personajes (Gemini TTS, una voz por personaje).
 *
 *   node tools/narrador/generar-voces.mjs --muestras        # cada voz candidata dice TODAS las frases
 *   node tools/narrador/generar-voces.mjs --muestras --voces Kore,Puck
 *   node tools/narrador/generar-voces.mjs                   # las frases finales, con la voz elegida
 *   node tools/narrador/generar-voces.mjs --listar
 *
 * 1) MUESTRAS: una petición por voz candidata con todas las frases seguidas;
 *    Whisper (alinear.py) las corta y las comprueba. Quedan en
 *    tools/narrador/muestras-voces/<Voz>/<personaje>.ogg y se escuchan con
 *    muestras-voces/escuchar.html. Se puede repetir: lo ya hecho no se pide.
 * 2) ELEGIR: en tools/narrador/voces-personajes.json, { "des_annia": "Kore", … }.
 * 3) GENERAR: cada frase con la voz de su personaje. Si la muestra de esa voz
 *    salió bien, se usa tal cual (no gasta cupo). Deja
 *    src/assets/voces/<personaje>-<hash>.ogg y el índice src/assets/voces/voces.js
 *    (por el hash del TEXTO, el mismo que usa el narrador: si cambias un texto,
 *    calla hasta regenerar).
 *
 * Qué frases (src/js/data/frases.js): Game.FRASE_ESTIRPE (la de cada estirpe
 * al elegirla; las muestras solo usan estas) y Game.FRASE_ENTRADA (la de cada
 * personaje al entrar al campo). Las que son `sonido` o `robot: true` no van
 * por aquí: las genera el juego.
 *
 * Efectos por personaje en voces-personajes.json ({ "voz": "Schedar",
 * "efecto": "robot" }): robot, coro, eco (efectos_voz.py, con numpy/scipy
 * del python de combo-shorts).
 *
 * Gemini gratis: 10 peticiones al día por modelo. Se agrupan hasta 6 frases
 * de la MISMA voz por petición; lo que no quepa hoy, mañana.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hablar, buscarFfmpeg, MODELO } from './gemini-tts.mjs';
import { limpiarOggs, apuntarLimpios } from './limpiar-audios.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..');
const COMBO = process.env.COMBO_SHORTS || path.join(os.homedir(), 'Documents', 'combo-shorts');
const PY = path.join(COMBO, '.venv-voz', 'Scripts', 'python.exe');
const SALIDA = path.join(RAIZ, 'src', 'assets', 'voces');
const MUESTRAS = path.join(AQUI, 'muestras-voces');
const ELECCION = path.join(AQUI, 'voces-personajes.json');
const TRABAJO = path.join(AQUI, 'trabajo-voces');

/** Voces candidatas: cuatro de mujer y cuatro de hombre, de timbres distintos. */
const CANDIDATAS = ['Kore', 'Leda', 'Aoede', 'Achernar', 'Puck', 'Fenrir', 'Orus', 'Enceladus'];
// En inglés y como «Say …:», el formato que el modelo NO lee en voz alta.
const ESTILO = 'Say in a natural, expressive voice, as a character of a dark fantasy story saying a short line, ' +
  'keeping the pauses of the ellipses. The text is in Spanish:';

const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);

/* ------------------------------ Utilidades ------------------------------ */

function clave(texto) {
  let h = 0x811c9dc5;
  const t = String(texto).trim();
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function lineas() {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  for (const rel of ['races.js', 'characters.js', 'frases.js']) {
    vm.runInContext(fs.readFileSync(path.join(RAIZ, 'src', 'js', 'data', rel), 'utf8'), ctx, { filename: rel });
  }
  const G = ctx.window.Game;
  const nombre = (id) => (G.CHARACTERS_BY_ID[id] || {}).nombre || id;
  // Los robots (Pip en su frase de estirpe) y los sonidos no tienen voz: los
  // hace el juego.
  const estirpe = Object.entries(G.FRASE_ESTIRPE || {}).filter(([, f]) => !f.robot).map(([raza, f]) => ({
    tipo: 'estirpe', raza, personaje: f.personaje, texto: f.texto.trim(), nombre: nombre(f.personaje)
  }));
  const entrada = Object.entries(G.FRASE_ENTRADA || {}).filter(([, f]) => typeof f === 'string').map(([id, f]) => ({
    tipo: 'entrada', personaje: id, texto: f.trim(), nombre: nombre(id)
  }));
  return [...estirpe, ...entrada];
}

/** Voz y efecto elegidos para un personaje ("Kore" o { voz, efecto }). */
function vozDe(eleccion, personaje) {
  const v = eleccion[personaje];
  if (!v) return null;
  if (typeof v === 'string') return { voz: v, efecto: '' };
  // El tono del robot viaja pegado al efecto («robot@110»): así cambiarlo
  // rehace solo a ese personaje.
  const efecto = v.efecto ? (v.tono ? `${v.efecto}@${v.tono}` : v.efecto) : '';
  return { voz: v.voz, efecto };
}

const POR_PETICION = 6;
const MAX_CARACTERES = 600;

function pronunciacion() {
  const ruta = path.join(AQUI, 'pronunciacion.txt');
  if (!fs.existsSync(ruta)) return [];
  return fs.readFileSync(ruta, 'utf8').split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
}
const REGLAS = pronunciacion();
const paraLaVoz = (t) => {
  let s = t;
  for (const [a, b] of REGLAS) s = s.split(a).join(b);
  return s.replace(/\s*—\s*/g, ', ').replace(/\s+/g, ' ').trim();
};

function wavDePcm(pcm, hz) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(hz, 24); h.writeUInt32LE(hz * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const leerJson = (r, def) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return def; } };

/**
 * Una petición a Gemini con varias frases en una voz; Whisper la corta.
 * Devuelve [{ ok, motivo, dur, ogg }] por frase (ogg = ruta temporal), o
 * { cupo: true } si se acabó el cupo del día.
 */
async function pedir(voz, frases, nombre, efectos = []) {
  const ffmpeg = buscarFfmpeg();
  if (!ffmpeg) throw new Error('No encuentro ffmpeg con libopus.');
  if (!fs.existsSync(PY)) throw new Error(`Falta el python de combo-shorts (Whisper): ${PY}`);
  fs.mkdirSync(TRABAJO, { recursive: true });
  let audio;
  try {
    audio = await hablar({ texto: frases.map(paraLaVoz).join('\n\n'), voz, estilo: ESTILO });
  } catch (e) {
    if (e.cuotaDiaria) return { cupo: true };
    throw e;
  }
  const wav = path.join(TRABAJO, `${nombre}.wav`);
  fs.writeFileSync(wav, wavDePcm(audio.pcm, audio.hz));
  const trabajo = path.join(TRABAJO, `${nombre}.json`), cortes = path.join(TRABAJO, `${nombre}_cortes.json`);
  fs.writeFileSync(trabajo, JSON.stringify({ audio: wav, textos: frases.map(paraLaVoz), salida: cortes }), 'utf8');
  const r = spawnSync(PY, [path.join(AQUI, 'alinear.py'), trabajo], { cwd: COMBO, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0 || !fs.existsSync(cortes)) throw new Error(`Whisper no pudo cortar: ${(r.stderr || '').split('\n').slice(-3).join(' ')}`);
  return JSON.parse(fs.readFileSync(cortes, 'utf8')).map((c, i) => {
    if (!c.ok) return { ok: false, motivo: c.motivo };
    const ogg = path.join(TRABAJO, `${nombre}_${i}.ogg`);
    // Primero el tramo en WAV; si lleva efecto, pasa por efectos_voz.py.
    let tramo = path.join(TRABAJO, `${nombre}_${i}.wav`);
    const cortar = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', wav, '-ss', String(c.inicio), '-to', String(c.fin),
      '-ac', '1', '-c:a', 'pcm_s16le', tramo]);
    if (cortar.status !== 0) return { ok: false, motivo: 'ffmpeg' };
    if (efectos[i]) {
      const conEfecto = path.join(TRABAJO, `${nombre}_${i}_fx.wav`);
      const e = spawnSync(PY, [path.join(AQUI, 'efectos_voz.py'), tramo, conEfecto, efectos[i]], { encoding: 'utf8' });
      if (e.status !== 0) return { ok: false, motivo: `efecto ${efectos[i]}: ${(e.stderr || '').split('\n').slice(-2).join(' ')}` };
      tramo = conEfecto;
    }
    const f = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', tramo, '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', ogg]);
    if (f.status !== 0) return { ok: false, motivo: 'ffmpeg' };
    return { ok: true, dur: Math.round((c.fin - c.inicio) * 100) / 100, ogg };
  });
}

/* ------------------------------- Muestras ------------------------------- */

async function muestras() {
  const L = lineas().filter((l) => l.tipo === 'estirpe');
  const voces = arg('--voces') ? arg('--voces').split(',').map((v) => v.trim()).filter(Boolean) : CANDIDATAS;
  const indice = leerJson(path.join(MUESTRAS, 'muestras.json'), {});
  console.log(`\n  Muestras de voz (${MODELO}): ${voces.length} voces × ${L.length} frases.\n`);
  for (const voz of voces) {
    const ya = indice[voz] || {};
    const faltan = L.filter((l) => !(ya[l.personaje] && ya[l.personaje].texto === l.texto && ya[l.personaje].ok));
    if (!faltan.length) { console.log(`  · ${voz}: ya estaba`); continue; }
    const res = await pedir(voz, faltan.map((l) => l.texto), `muestra_${voz}`);
    if (res.cupo) { console.log('\n  Se acabó el cupo gratuito de hoy: lo que falte, mañana (repite el comando).'); break; }
    fs.mkdirSync(path.join(MUESTRAS, voz), { recursive: true });
    indice[voz] = ya;
    res.forEach((r, i) => {
      const l = faltan[i];
      if (r.ok) fs.copyFileSync(r.ogg, path.join(MUESTRAS, voz, `${l.personaje}.ogg`));
      indice[voz][l.personaje] = { texto: l.texto, ok: r.ok, motivo: r.motivo || '', dur: r.dur || 0 };
    });
    console.log(`  ✔ ${voz}: ${res.filter((r) => r.ok).length}/${res.length} bien${res.some((r) => !r.ok) ? ` (${res.filter((r) => !r.ok).map((r) => r.motivo).join(', ')})` : ''}`);
    fs.writeFileSync(path.join(MUESTRAS, 'muestras.json'), JSON.stringify(indice, null, 1), 'utf8');
  }
  escribirEscuchar(L, indice);
  console.log(`\n  Escúchalas en: ${path.join(MUESTRAS, 'escuchar.html')}`);
  console.log(`  Y elige en ${ELECCION}\n`);
}

function escribirEscuchar(L, indice) {
  L = L.filter((l) => l.tipo === 'estirpe');
  const voces = Object.keys(indice);
  const filas = L.map((l) => `<tr><th>${l.nombre.split(',')[0]}<small>${l.texto}</small></th>${voces.map((v) => {
    const m = indice[v][l.personaje];
    return `<td>${m && m.ok ? `<audio controls preload="none" src="${v}/${l.personaje}.ogg"></audio>` : `<span>${m ? m.motivo || 'mal' : '—'}</span>`}</td>`;
  }).join('')}</tr>`).join('\n');
  fs.writeFileSync(path.join(MUESTRAS, 'escuchar.html'), `<!doctype html><meta charset="utf-8"><title>Voces de personajes</title>
<style>body{background:#0b0d17;color:#e8ecf5;font:14px system-ui;padding:20px}table{border-collapse:collapse}
th,td{border:1px solid #333;padding:8px;vertical-align:top}th small{display:block;color:#9aa3bd;font-weight:normal;max-width:220px}
thead th{color:#d8b968}audio{width:180px}span{color:#f07070}</style>
<h1>Voces de personajes · muestras</h1><p>Elige una voz por personaje y escríbela en tools/narrador/voces-personajes.json.</p>
<table><thead><tr><th></th>${voces.map((v) => `<th>${v}</th>`).join('')}</tr></thead><tbody>
${filas}
</tbody></table>`, 'utf8');
  // La plantilla de la elección, si aún no existe.
  if (!fs.existsSync(ELECCION)) {
    fs.writeFileSync(ELECCION, JSON.stringify(Object.fromEntries(L.map((l) => [l.personaje, ''])), null, 2) + '\n', 'utf8');
  }
}

/* -------------------------------- Generar ------------------------------- */

async function generar({ listar = false } = {}) {
  const L = lineas();
  const eleccion = leerJson(ELECCION, {});
  const muestrasIdx = leerJson(path.join(MUESTRAS, 'muestras.json'), {});
  const indiceRuta = path.join(SALIDA, 'voces.js');
  const anterior = (() => {
    const ctx = { window: {} };
    try { vm.runInNewContext(fs.readFileSync(indiceRuta, 'utf8'), ctx); } catch { return {}; }
    return (ctx.window.Game && ctx.window.Game.VOCES) || {};
  })();
  const indice = {};
  const pendientes = [];
  for (const l of L) {
    const elegida = vozDe(eleccion, l.personaje);
    const k = clave(l.texto);
    const archivo = `${l.personaje}-${k}.ogg`;
    const previa = anterior[k];
    if (!elegida) { console.log(`  · ${l.nombre.split(',')[0]}: sin voz elegida (voces-personajes.json)`); continue; }
    const { voz, efecto } = elegida;
    if (previa && previa.voz === voz && (previa.efecto || '') === efecto && fs.existsSync(path.join(SALIDA, archivo))) {
      indice[k] = previa;
      continue;
    }
    pendientes.push({ ...l, voz, efecto, k, archivo });
  }
  console.log(`\n  Voces de personajes · ${L.length} frases · por generar: ${pendientes.length}`);
  if (listar) { pendientes.forEach((p) => console.log(`   · [${p.voz}${p.efecto ? ` + ${p.efecto}` : ''}] ${p.nombre.split(',')[0]}: ${p.texto}`)); return; }
  fs.mkdirSync(SALIDA, { recursive: true });
  const guardar = () => fs.writeFileSync(indiceRuta,
    '// GENERADO por tools/narrador/generar-voces.mjs: no editar a mano.\n' +
    '// Clave = hash del texto (ui/narrador.js calcula el mismo).\n' +
    'window.Game = window.Game || {};\n' +
    `window.Game.VOCES = ${JSON.stringify(indice, null, 1)};\n`, 'utf8');

  // 1) Las que ya tienen una muestra buena con su voz: se copian.
  const porVoz = {};
  for (const p of pendientes) {
    const m = muestrasIdx[p.voz] && muestrasIdx[p.voz][p.personaje];
    const ogg = path.join(MUESTRAS, p.voz, `${p.personaje}.ogg`);
    if (!p.efecto && m && m.ok && m.texto === p.texto && fs.existsSync(ogg)) {
      fs.copyFileSync(ogg, path.join(SALIDA, p.archivo));
      indice[p.k] = { personaje: p.personaje, voz: p.voz, src: `assets/voces/${p.archivo}`, dur: m.dur };
      console.log(`  ✔ ${p.nombre.split(',')[0]} (${p.voz}) · de la muestra`);
    } else {
      (porVoz[p.voz] = porVoz[p.voz] || []).push(p);
    }
  }
  guardar();
  // 2) El resto: peticiones por voz, de hasta POR_PETICION frases.
  const lotes = [];
  for (const [voz, lista] of Object.entries(porVoz)) {
    let lote = [];
    for (const p of lista) {
      const largo = lote.reduce((n, x) => n + x.texto.length, 0);
      if (lote.length && (lote.length >= POR_PETICION || largo + p.texto.length > MAX_CARACTERES)) { lotes.push([voz, lote]); lote = []; }
      lote.push(p);
    }
    if (lote.length) lotes.push([voz, lote]);
  }
  if (lotes.length) console.log(`\n  Gemini (${MODELO}): ${lotes.reduce((n, [, l]) => n + l.length, 0)} frases en ${lotes.length} peticiones (cupo gratis: 10 al día).\n`);
  let n = 0;
  for (const [voz, lista] of lotes) {
    const res = await pedir(voz, lista.map((p) => p.texto), `final_${voz}_${n++}`, lista.map((p) => p.efecto));
    if (res.cupo) { console.log('\n  Se acabó el cupo gratuito de hoy: lo que falte, mañana (vuelve a abrir GENERAR_VOCES.bat).'); break; }
    const nuevos = [];
    res.forEach((r, i) => {
      const p = lista[i];
      const quien = `${p.nombre.split(',')[0]} (${voz}${p.efecto ? ` + ${p.efecto}` : ''})`;
      if (!r.ok) { console.log(`  · ${quien}: ${r.motivo} → otro día`); return; }
      fs.copyFileSync(r.ogg, path.join(SALIDA, p.archivo));
      indice[p.k] = { personaje: p.personaje, voz, efecto: p.efecto || undefined, src: `assets/voces/${p.archivo}`, dur: r.dur };
      nuevos.push({ ogg: path.join(SALIDA, p.archivo), texto: p.texto, k: p.k });
      console.log(`  ✔ ${quien} · ${r.dur} s`);
    });
    // Bordes limpios (sin restos de la frase vecina ni clic): limpiar_voz.py.
    if (nuevos.length) {
      const limpios = limpiarOggs(nuevos);
      for (const a of nuevos) if (limpios[a.ogg]) indice[a.k].dur = limpios[a.ogg].despues;
      apuntarLimpios(nuevos.map((a) => a.ogg));
    }
    guardar();
  }
  // Audios que ya no usa nadie.
  const usados = new Set(Object.values(indice).map((v) => path.basename(v.src)));
  for (const f of fs.readdirSync(SALIDA)) if (f.endsWith('.ogg') && !usados.has(f)) fs.rmSync(path.join(SALIDA, f));
  console.log(`\n  ✔ Índice: ${Object.keys(indice).length}/${L.length} frases con voz.\n`);
}

try {
  if (args.includes('--muestras')) await muestras();
  else await generar({ listar: args.includes('--listar') });
} finally {
  fs.rmSync(TRABAJO, { recursive: true, force: true });
}
