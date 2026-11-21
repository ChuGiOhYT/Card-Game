"""Efectos para las voces de personajes (los aplica generar-voces.mjs).

Uso (con el python de combo-shorts\\.venv-voz, que trae numpy y scipy):
    python efectos_voz.py entrada.wav salida.wav robot|coro|eco

- robot: voz metálica de los Oxitrón. Se quita la fase en el dominio de la
  frecuencia (STFT): queda un zumbido de tono fijo con las palabras encima,
  la «robotización» clásica.
- coro:  Fälum, «su voz suena a muchedumbre»: tres copias con retardos y
  tonos apenas distintos.
- eco:   la Reina Lirhym, «su voz la oyen hasta los que no oyen»: dos rebotes.
"""
import sys

import numpy as np
import soundfile as sf
from scipy.signal import istft, resample, stft


def robot(x, hz, tono=170):
    hop = int(hz / tono)  # tono del zumbido (Hz): cada robot el suyo
    _, _, z = stft(x, fs=hz, nperseg=hop * 4, noverlap=hop * 3)
    _, y = istft(np.abs(z), fs=hz, nperseg=hop * 4, noverlap=hop * 3)
    y = y[: len(x)]
    # Un poco de la voz original para que se entienda mejor.
    return 0.8 * y / (np.max(np.abs(y)) + 1e-9) + 0.25 * x / (np.max(np.abs(x)) + 1e-9)


def retardar(x, hz, ms, largo):
    d = int(hz * ms / 1000)
    y = np.zeros(largo)
    y[d: d + len(x)] = x[: max(0, largo - d)]
    return y


def coro(x, hz):
    largo = len(x) + int(hz * 0.1)
    y = retardar(x, hz, 0, largo)
    for ms, ganancia, tono in ((23, 0.6, 1.012), (41, 0.5, 0.988), (67, 0.4, 1.02)):
        copia = resample(x, int(len(x) / tono))
        y += ganancia * retardar(copia, hz, ms, largo)
    return y


def eco(x, hz):
    largo = len(x) + int(hz * 0.8)
    y = retardar(x, hz, 0, largo)
    y += 0.35 * retardar(x, hz, 190, largo)
    y += 0.17 * retardar(x, hz, 380, largo)
    return y


def main(entrada, salida, efecto):
    x, hz = sf.read(entrada, dtype="float64")
    if x.ndim > 1:
        x = x.mean(axis=1)
    nombre, _, tono = efecto.partition("@")  # «robot@110»: zumbido a 110 Hz
    fx = {"robot": robot, "coro": coro, "eco": eco}[nombre]
    y = fx(x, hz, float(tono)) if tono else fx(x, hz)
    y = 0.9 * y / (np.max(np.abs(y)) + 1e-9)
    sf.write(salida, y.astype(np.float32), hz, subtype="PCM_16")


if __name__ == "__main__":
    main(*sys.argv[1:4])
