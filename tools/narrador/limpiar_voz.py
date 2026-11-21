"""Limpia los bordes de frases cortadas de un audio más largo.

Los audios de Gemini traen varias frases seguidas y alinear.py las corta con
un margen de aire; en ese margen se colaba a veces un trozo de la frase
vecina (un «chirrido» al inicio o al final) y el corte seco daba un clic.

Cómo (Oscar pidió recortar y fundir):
  1. Whisper escucha cada audio y se alinea con el texto ESPERADO: las
     palabras de la frase marcan dónde empieza y acaba de verdad.
     (Solo con la energía no vale: «Yo» o «¿verdad?», cortas y tras una pausa,
     parecían restos y se perdían.)
  2. Desde ese tramo se extiende hacia fuera mientras la voz siga SIN
     silencio (para no comerse la cola de la última palabra) y se para en el
     primer silencio: lo que venga detrás es de otra frase.
  3. 50 ms de aire, fundido de entrada (15 ms) y de salida (60 ms).

Uso (python de combo-shorts\\.venv-voz):
    python limpiar_voz.py trabajos.json
trabajos.json: [{"entrada": "a.wav", "salida": "b.wav", "texto": "..."}, ...]
Imprime una línea JSON por trabajo: {"i", "antes", "despues", "ok", "motivo"}.
"""
import difflib
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from alinear import COMBO, WhisperModel, norm, palabras  # noqa: E402

VENTANA_S = 0.010
SILENCIO_S = 0.06
AIRE_S = 0.05
FUNDIDO_ENTRADA_S = 0.015
FUNDIDO_SALIDA_S = 0.060


def energia(x, hz):
    n = max(1, int(hz * VENTANA_S))
    k = len(x) // n
    rms = np.sqrt(np.mean(x[: k * n].reshape(k, n) ** 2, axis=1) + 1e-12)
    umbral = max(0.05 * np.percentile(rms, 95), 0.003)
    return rms > umbral, n


def limpiar(x, hz, ini_s, fin_s):
    voz, n = energia(x, hz)
    k = len(voz)
    a, b = max(0, int(ini_s / VENTANA_S)), min(k, int(fin_s / VENTANA_S) + 1)
    hueco = int(SILENCIO_S / VENTANA_S)
    # Hacia atrás mientras haya voz o huecos más cortos que un silencio.
    i, sin = a, 0
    while i > 0 and sin < hueco:
        i -= 1
        sin = 0 if voz[i] else sin + 1
    a = i + sin
    i, sin = b, 0
    while i < k - 1 and sin < hueco:
        i += 1
        sin = 0 if voz[i] else sin + 1
    b = i - sin + 1
    s0 = max(0, a * n - int(hz * AIRE_S))
    s1 = min(len(x), b * n + int(hz * AIRE_S))
    y = x[s0:s1].copy()
    fe, fs_ = int(hz * FUNDIDO_ENTRADA_S), int(hz * FUNDIDO_SALIDA_S)
    if len(y) > fe + fs_:
        y[:fe] *= np.linspace(0, 1, fe)
        y[-fs_:] *= np.linspace(1, 0, fs_)
    return y


def main(ruta):
    trabajos = json.loads(Path(ruta).read_text("utf-8"))
    modelo = WhisperModel(str(COMBO / "modelos" / "whisper-medium"), device="cuda", compute_type="float16")
    for i, t in enumerate(trabajos):
        x, hz = sf.read(t["entrada"], dtype="float64")
        if x.ndim > 1:
            x = x.mean(axis=1)
        segs, _ = modelo.transcribe(t["entrada"], language="es", word_timestamps=True)
        oidas = [(norm(w.word), w.start, w.end) for s in segs for w in (s.words or []) if norm(w.word)]
        esperadas = palabras(t["texto"])
        sm = difflib.SequenceMatcher(a=esperadas, b=[o[0] for o in oidas], autojunk=False)
        casadas = [bl.b + j for bl in sm.get_matching_blocks() for j in range(bl.size)]
        r = {"i": i, "antes": round(len(x) / hz, 2)}
        if not casadas or len(casadas) < max(1, len(esperadas) // 2):
            # Whisper no la reconoce bien: solo fundidos, sin recortar nada.
            y = x.copy()
            fe, fs_ = int(hz * FUNDIDO_ENTRADA_S), int(hz * FUNDIDO_SALIDA_S)
            y[:fe] *= np.linspace(0, 1, fe)
            y[-fs_:] *= np.linspace(1, 0, fs_)
            r.update(ok=False, motivo="no reconocida: solo fundidos")
        else:
            ini, fin = oidas[min(casadas)][1], oidas[max(casadas)][2]
            y = limpiar(x, hz, ini, fin)
            r.update(ok=True, motivo="")
        sf.write(t["salida"], y.astype(np.float32), hz, subtype="PCM_16")
        r["despues"] = round(len(y) / hz, 2)
        print(json.dumps(r), flush=True)


if __name__ == "__main__":
    main(sys.argv[1])
