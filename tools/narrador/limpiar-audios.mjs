/**
 * Quita los «chirridos» de los bordes (restos de la frase vecina y el clic del
 * corte) a los audios que salen cortados de un lote de Gemini:
 *   - las voces de personajes (src/assets/voces)
 *   - el narrador anciano (src/assets/narracion/anciano)
 *
 *   node tools/narrador/limpiar-audios.mjs --prueba   # solo dice qué haría
 *   node tools/narrador/limpiar-audios.mjs            # lo hace
 *
 * Antes de tocar nada guarda los originales en tools/narrador/respaldo-audios/
 * y apunta en limpiados.json lo ya limpio (no se limpia dos veces). Los
 * generadores ya limpian lo nuevo al crearlo. Ver limpiar_voz.py.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buscarFfmpeg } from './gemini-tts.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..', '..');
const COMBO = process.env.COMBO_SHORTS || path.join(os.homedir(), 'Documents', 'combo-shorts');
const PY = path.join(COMBO, '.venv-voz', 'Scripts', 'python.exe');
const ASSETS = path.join(RAIZ, 'src');
const LIMPIADOS = path.join(AQUI, 'limpiados.json');
const TRABAJO = path.join(AQUI, 'trabajo-limpiar');
const prueba = process.argv.includes('--prueba');

export function clave(texto) {
  let h = 0x811c9dc5;
  const t = String(texto).trim();
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

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

function cargar(archivos) {
  const ctx = { window: {}, console };
  vm.createContext(ctx);
  for (const rel of archivos) vm.runInContext(fs.readFileSync(path.join(RAIZ, rel), 'utf8'), ctx, { filename: rel });
  return ctx.window.Game;
}

/** [{ ogg, texto, indice: 'voces'|'narracion', k, tono }] */
function audios() {
  const G = cargar(['src/js/data/races.js', 'src/js/data/characters.js', 'src/js/data/creatures.js',
    'src/js/data/dungeons.js', 'src/js/data/frases.js', 'src/assets/voces/voces.js', 'src/assets/narracion/narracion.js']);
  const textos = {};
  for (const f of Object.values(G.FRASE_ESTIRPE || {})) textos[clave(f.texto)] = f.texto;
  for (const f of Object.values(G.FRASE_ENTRADA || {})) if (typeof f === 'string') textos[clave(f)] = f;
  for (const cal of Object.values(G.DUNGEONS)) {
    const poner = (t) => { if (t && t.texto) textos[clave(t.texto)] = t.texto.trim(); };
    poner(cal.cinematica);
    for (const e of cal.etapas) { poner(e.cineEntrada); poner(e.cineVictoria); }
  }
  const lista = [];
  for (const [k, v] of Object.entries(G.VOCES || {})) {
    if (textos[k]) lista.push({ ogg: path.join(ASSETS, v.src), texto: textos[k], indice: 'voces', k });
  }
  for (const [k, v] of Object.entries(G.NARRACION || {})) {
    if (v.anciano && textos[k]) lista.push({ ogg: path.join(ASSETS, v.anciano.src), texto: textos[k], indice: 'narracion', k, tono: 'anciano' });
  }
  return lista.filter((a) => fs.existsSync(a.ogg));
}

/**
 * Limpia una lista de .ogg en su sitio (los generadores también lo usan).
 * Devuelve { ogg: { antes, despues, ok, motivo } }.
 */
export function limpiarOggs(lista, { respaldo = null } = {}) {
  const ffmpeg = buscarFfmpeg();
  if (!ffmpeg || !fs.existsSync(PY)) throw new Error('Falta ffmpeg o el python de combo-shorts.');
  fs.mkdirSync(TRABAJO, { recursive: true });
  const trabajos = lista.map((a, i) => {
    const entrada = path.join(TRABAJO, `${i}_in.wav`);
    spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', a.ogg, '-ac', '1', '-c:a', 'pcm_s16le', entrada]);
    return { entrada, salida: path.join(TRABAJO, `${i}_out.wav`), texto: paraLaVoz(a.texto) };
  });
  const ruta = path.join(TRABAJO, 'trabajos.json');
  fs.writeFileSync(ruta, JSON.stringify(trabajos), 'utf8');
  const r = spawnSync(PY, [path.join(AQUI, 'limpiar_voz.py'), ruta], { cwd: COMBO, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
  if (r.status !== 0) throw new Error(`limpiar_voz.py: ${(r.stderr || '').split('\n').slice(-4).join(' ')}`);
  const res = {};
  for (const linea of r.stdout.split('\n').filter((l) => l.startsWith('{'))) {
    const x = JSON.parse(linea);
    const a = lista[x.i];
    res[a.ogg] = x;
    if (respaldo === false) continue;
    if (respaldo) {
      const dest = path.join(respaldo, path.relative(ASSETS, a.ogg));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(a.ogg, dest);
    }
    spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', trabajos[x.i].salida, '-ac', '1', '-c:a', 'libopus', '-b:a', '48k', a.ogg]);
  }
  fs.rmSync(TRABAJO, { recursive: true, force: true });
  return res;
}

/** Apunta en limpiados.json unos .ogg ya limpios (los generadores, al crearlos). */
export function apuntarLimpios(oggs) {
  const hechos = new Set(JSON.parse(fs.existsSync(LIMPIADOS) ? fs.readFileSync(LIMPIADOS, 'utf8') : '[]'));
  for (const o of oggs) hechos.add(path.relative(ASSETS, o).replace(/\\/g, '/'));
  fs.writeFileSync(LIMPIADOS, JSON.stringify([...hechos].sort(), null, 1), 'utf8');
}

/** Reescribe la duración en el índice (voces.js o narracion.js). */
function actualizarIndices(lista, res) {
  for (const [nombre, rel, global] of [['voces', 'src/assets/voces/voces.js', 'VOCES'], ['narracion', 'src/assets/narracion/narracion.js', 'NARRACION']]) {
    const ruta = path.join(RAIZ, rel);
    const ctx = { window: {} };
    vm.runInNewContext(fs.readFileSync(ruta, 'utf8'), ctx);
    const idx = ctx.window.Game[global];
    let cambios = 0;
    for (const a of lista.filter((x) => x.indice === nombre)) {
      const r = res[a.ogg];
      if (!r) continue;
      const e = a.tono ? idx[a.k][a.tono] : idx[a.k];
      e.dur = r.despues;
      cambios++;
    }
    if (!cambios) continue;
    const cabecera = fs.readFileSync(ruta, 'utf8').split('\n').filter((l) => l.startsWith('//')).join('\n');
    fs.writeFileSync(ruta, `${cabecera}\nwindow.Game = window.Game || {};\nwindow.Game.${global} = ${JSON.stringify(idx, null, 1)};\n`, 'utf8');
  }
}

const esPrincipal = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esPrincipal) {
  const hechos = new Set(JSON.parse(fs.existsSync(LIMPIADOS) ? fs.readFileSync(LIMPIADOS, 'utf8') : '[]'));
  const lista = audios().filter((a) => !hechos.has(path.relative(ASSETS, a.ogg).replace(/\\/g, '/')));
  console.log(`\n  Por limpiar: ${lista.length} audios${prueba ? ' (prueba: no se toca nada)' : ''}.\n`);
  if (lista.length) {
    const respaldo = prueba ? false : path.join(AQUI, 'respaldo-audios', new Date().toISOString().slice(0, 10));
    const res = limpiarOggs(lista, { respaldo });
    for (const a of lista) {
      const r = res[a.ogg];
      if (!r) continue;
      console.log(`  ${r.ok ? '✔' : '·'} ${path.basename(a.ogg).padEnd(28)} ${String(r.antes).padStart(5)} s → ${String(r.despues).padStart(5)} s  ${r.motivo || ''}`);
    }
    if (!prueba) {
      actualizarIndices(lista, res);
      for (const a of lista) hechos.add(path.relative(ASSETS, a.ogg).replace(/\\/g, '/'));
      fs.writeFileSync(LIMPIADOS, JSON.stringify([...hechos].sort(), null, 1), 'utf8');
      console.log(`\n  Originales guardados en ${respaldo}`);
    }
  }
}
