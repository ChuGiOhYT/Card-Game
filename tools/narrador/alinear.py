"""Corta un audio con varias escenas seguidas en una por escena, y comprueba cada una.

Gemini da pocas peticiones al día, así que se le piden varias escenas de una
vez. Aquí Whisper (el de combo-shorts) escucha el audio con tiempos por
palabra, se alinea con los textos esperados y se decide dónde empieza y acaba
cada escena. Una escena NO vale si se oye menos del 85 % de sus palabras o si
dura demasiado para su texto (señal de que el modelo la repitió o leyó algo
de más): se descarta y se vuelve a pedir otro día.

Uso (con el python de combo-shorts\\.venv-voz):
    python alinear.py trabajo.json
trabajo.json: {"audio": "lote.wav", "textos": ["...", "..."], "salida": "cortes.json"}
cortes.json:  [{"i": 0, "ok": true, "inicio": 0.4, "fin": 9.8, "cobertura": 0.97, "motivo": ""}, ...]
"""
import difflib
import json
import os
import re
import sys
import unicodedata
from pathlib import Path

import torch

os.add_dll_directory(str(Path(torch.__file__).parent / "lib"))
from faster_whisper import WhisperModel  # noqa: E402

COMBO = Path(os.environ.get("COMBO_SHORTS", Path.home() / "Documents" / "combo-shorts"))


def norm(p: str) -> str:
    p = unicodedata.normalize("NFD", p.lower())
    p = "".join(c for c in p if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9ñ]+", "", p)


def palabras(texto: str) -> list[str]:
    return [w for w in (norm(x) for x in texto.split()) if w]


def main(ruta: str) -> None:
    t = json.loads(Path(ruta).read_text("utf-8"))
    modelo = WhisperModel(str(COMBO / "modelos" / "whisper-medium"), device="cuda", compute_type="float16")
    segs, info = modelo.transcribe(t["audio"], language="es", word_timestamps=True)
    oidas = [(norm(w.word), w.start, w.end) for s in segs for w in (s.words or []) if norm(w.word)]
    # Una segunda escucha SIN tiempos por palabra: con ellos Whisper a veces
    # se salta un tramo entero (justo una repetición), y sin ellos lo oye.
    # Sirve solo para contar repeticiones; los cortes usan la primera.
    segs2, _ = modelo.transcribe(t["audio"], language="es")
    corrido = [w for s in segs2 for w in palabras(s.text)]

    esperadas, dueno = [], []
    for i, texto in enumerate(t["textos"]):
        for w in palabras(texto):
            esperadas.append(w)
            dueno.append(i)

    sm = difflib.SequenceMatcher(a=esperadas, b=[o[0] for o in oidas], autojunk=False)
    casa = {}
    for bloque in sm.get_matching_blocks():
        for k in range(bloque.size):
            casa[bloque.a + k] = bloque.b + k

    cortes = []
    for i, texto in enumerate(t["textos"]):
        idx = [k for k, d in enumerate(dueno) if d == i]
        hechas = [casa[k] for k in idx if k in casa]
        cobertura = len(hechas) / max(1, len(idx))
        if not hechas:
            cortes.append({"i": i, "ok": False, "inicio": 0, "fin": 0, "cobertura": 0, "motivo": "no se oye"})
            continue
        ini, fin = oidas[min(hechas)][1], oidas[max(hechas)][2]
        # Palabras oídas dentro del tramo frente a las esperadas: si sobran
        # muchas, el modelo repitió o metió algo de más.
        dentro = max(hechas) - min(hechas) + 1
        sobra = dentro / max(1, len(idx))
        dur = fin - ini
        lento = dur / max(1, len(texto))  # segundos por carácter
        motivo = ""
        # Si el principio o el final de la escena se oye más de una vez, el
        # modelo la repitió: el corte mezclaría las dos tomas.
        oido = corrido
        propias = palabras(texto)

        def veces(trozo, en):
            n = len(trozo)
            return sum(1 for j in range(len(en) - n + 1) if en[j:j + n] == trozo) if n else 0

        # Se compara con las veces que ese trozo está en el GUION de la
        # petición: dos escenas que empiezan igual («La magia de la Vida…»)
        # no son una repetición (falso positivo que dejaba sin voz a dos
        # escenas de los reanimados, día tras día).
        guion = [w for x in t["textos"] for w in palabras(x)]
        repetida = len(propias) >= 6 and any(
            veces(tr, oido) > veces(tr, guion) for tr in (propias[:4], propias[-4:]))
        if repetida:
            motivo = "la repite"
        # En frases cortas una sola palabra mal oída hunde la cobertura
        # («Volví. Ella no.»: 2 de 3 = 67 %): se tolera UNA por debajo de 6.
        elif cobertura < (0.85 if len(idx) > 5 else (len(idx) - 1) / len(idx) - 0.01):
            motivo = f"solo se oye el {cobertura:.0%}"
        elif sobra > 1.25:
            motivo = "repite o añade palabras"
        elif lento > 0.16:
            motivo = "demasiado largo para su texto"
        cortes.append({"i": i, "ok": not motivo, "inicio": ini, "fin": fin,
                       "cobertura": round(cobertura, 3), "motivo": motivo})

    # Márgenes: un poco de aire antes y después, sin pisar la escena vecina.
    for k, c in enumerate(cortes):
        if not c["fin"]:
            continue
        previo = max((x["fin"] for x in cortes[:k] if x["fin"]), default=0)
        siguiente = min((x["inicio"] for x in cortes[k + 1:] if x["fin"]), default=info.duration)
        c["inicio"] = round(max(previo, c["inicio"] - 0.15), 3)
        c["fin"] = round(min(siguiente, c["fin"] + 0.45, info.duration), 3)

    Path(t["salida"]).write_text(json.dumps(cortes, ensure_ascii=False, indent=1), "utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
