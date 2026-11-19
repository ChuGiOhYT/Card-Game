/**
 * Voz del narrador con Gemini TTS (en línea). Lo usan:
 *   - muestras:  node tools/narrador/gemini-tts.mjs --muestras
 *                (la escena del Bosque con varias voces, para elegir)
 *   - generar-narracion.mjs, para los tonos que van por Gemini.
 *
 * La clave se lee de clave_gemini.txt (esta carpeta, o la de edu_gear) o de
 * GEMINI_API_KEY. Nunca se escribe en ningún archivo generado.
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DOCS = path.join(os.homedir(), 'Documents');
export const MODELO = process.env.GEMINI_TTS_MODEL || 'gemini-3.8-flash-tts';

export function claveGemini() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  for (const dir of [AQUI, path.join(DOCS, 'edu_gear')]) {
    const r = path.join(dir, 'clave_gemini.txt');
    if (!fs.existsSync(r)) continue;
    const linea = fs.readFileSync(r, 'utf8').split(/\r?\n/).map((l) => l.trim()).find((l) => l && !l.startsWith('#'));
    if (linea) return linea;
  }
  return null;
}

export function buscarFfmpeg() {
  return [
    process.env.FFMPEG,
    path.join(DOCS, 'editor-cartas', 'bin', 'ffmpeg.exe'),
    path.join(DOCS, 'combo-shorts', 'node_modules', '@remotion', 'compositor-win32-x64-msvc', 'ffmpeg.exe')
  ].filter(Boolean).find((c) => fs.existsSync(c)) || null;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Pide la voz y devuelve { pcm: Buffer s16le mono, hz }. Reintenta los
 * límites de cuota (429) esperando lo que diga Google, hasta 6 veces.
 */
export async function hablar({ texto, voz, estilo }) {
  const clave = claveGemini();
  if (!clave) throw new Error('No encuentro la clave de Gemini (clave_gemini.txt).');
  const cuerpo = {
    contents: [{ parts: [{ text: `${estilo}\n\n${texto}` }] }],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voz } } }
    }
  };
  for (let intento = 1; ; intento++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': clave },
      body: JSON.stringify(cuerpo)
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      const parte = j.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
      if (!parte) throw new Error('Gemini respondió sin audio.');
      const hz = Number((parte.inlineData.mimeType.match(/rate=(\d+)/) || [])[1]) || 24000;
      return { pcm: Buffer.from(parte.inlineData.data, 'base64'), hz };
    }
    const msg = j.error?.message || `HTTP ${r.status}`;
    // El límite diario solo se distingue en los detalles (quotaId «…PerDay…»):
    // esperar no sirve, hay que volver mañana.
    const detalles = JSON.stringify(j.error?.details || []);
    if (r.status === 429 && /PerDay|per day/i.test(detalles + msg)) {
      throw Object.assign(new Error('Cupo diario gratuito agotado.'), { cuotaDiaria: true });
    }
    if ((r.status === 429 || r.status >= 500) && intento < 6) {
      const retraso = (j.error?.details || []).find((d) => d.retryDelay);
      const s = (retraso && parseFloat(retraso.retryDelay)) || Number((msg.match(/retry in ([\d.]+)s/i) || [])[1]) || 20 * intento;
      console.log(`    (Google pide esperar ${Math.ceil(s)} s…)`);
      await espera(Math.ceil(s) * 1000 + 500);
      continue;
    }
    throw Object.assign(new Error(msg), { cuotaDiaria: r.status === 429 && /day|diar/i.test(msg) });
  }
}

/** PCM → .ogg (Opus mono). Devuelve la duración en segundos. */
export function guardarOgg(pcm, hz, destino) {
  const ffmpeg = buscarFfmpeg();
  if (!ffmpeg) throw new Error('No encuentro ffmpeg con libopus.');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 's16le', '-ar', String(hz), '-ac', '1', '-i', 'pipe:0',
    '-c:a', 'libopus', '-b:a', '48k', destino], { input: pcm });
  if (r.status !== 0) throw new Error(`ffmpeg: ${String(r.stderr)}`);
  return pcm.length / 2 / hz;
}

/* ------------------------------- Muestras ------------------------------- */

export const CANDIDATAS = {
  anciano: {
    estilo: 'Narra en español, con la voz de un anciano sabio que cuenta una leyenda antigua: pausado, grave, místico, casi en un susurro, con silencios entre frases. Lee solo el texto siguiente:',
    voces: ['Gacrux', 'Algenib', 'Charon', 'Enceladus']
  },
  mujer: {
    estilo: 'Narra en español, con voz de mujer serena y suave, cálida y un poco misteriosa, como quien cuenta un cuento junto al fuego: lento, íntimo, sin dramatizar. Lee solo el texto siguiente:',
    voces: ['Achernar', 'Vindemiatrix', 'Sulafat', 'Aoede']
  }
};

if (process.argv.includes('--muestras')) {
  const texto = 'El Bosque Nocturno fue cuna de sabios: aquí se pensaba despacio y se hablaba en voz baja. Hoy huele a podredumbre. Bestias enloquecidas, bandidos y conspiradores se reparten la espesura, y nadie sabe qué fue de su guardián.';
  const dir = path.join(AQUI, 'muestras');
  for (const [tipo, { estilo, voces }] of Object.entries(CANDIDATAS)) {
    for (const voz of voces) {
      try {
        const { pcm, hz } = await hablar({ texto, voz, estilo });
        const s = guardarOgg(pcm, hz, path.join(dir, `${tipo}_${voz}.ogg`));
        console.log(`  ✔ ${tipo} · ${voz} · ${s.toFixed(1)} s`);
      } catch (e) {
        console.log(`  ✖ ${tipo} · ${voz}: ${e.message.slice(0, 200)}`);
      }
    }
  }
}
