"""Recorta los emblemas de estirpe de las láminas de Oscar.

    python tools/emblemas/recortar.py

Las láminas (tools/emblemas/estirpes.webp con cuatro, mercenarios.webp con
uno) traen el tablero de «transparencia» DIBUJADO. Los emblemas son
círculos: se busca cada medallón (lo que no es tablero: ni blanco ni gris
claro sin color), se toma su caja y se le aplica una máscara CIRCULAR con el
borde suavizado. Inundar el fondo no servía: los bordes plateados son tan
claros como el tablero.

Deja src/assets/emblemas/<raza>.webp (256×256). La sombra la pone el CSS.
"""
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parents[1]
SALIDA = RAIZ / "src" / "assets" / "emblemas"
LADO = 256

# Qué emblema es de quién, por su posición en la lámina de cuatro (Oscar):
# arriba-izquierda el ojo, arriba-derecha la espada, abajo-izquierda la luna,
# abajo-derecha los engranajes.
POSICIONES = {(0, 0): "reanimado", (0, 1): "desterrado", (1, 0): "lunaria", (1, 1): "oxitron"}


def medallones(img):
    a = np.asarray(img.convert("RGB")).astype(np.int32)
    h, w, _ = a.shape
    luz = a.mean(axis=2)
    sat = a.max(axis=2) - a.min(axis=2)
    # Tablero: claro y sin color.
    tablero = (luz > 185) & (sat < 22)
    objeto = ~tablero
    vistos = np.zeros((h, w), bool)
    cajas = []
    for y0 in range(0, h, 3):
        for x0 in range(0, w, 3):
            if not objeto[y0, x0] or vistos[y0, x0]:
                continue
            cola = deque([(y0, x0)])
            vistos[y0, x0] = True
            ys, xs = [], []
            while cola:
                y, x = cola.popleft()
                ys.append(y)
                xs.append(x)
                for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and objeto[ny, nx] and not vistos[ny, nx]:
                        vistos[ny, nx] = True
                        cola.append((ny, nx))
            if len(ys) > 20000:
                cajas.append((min(ys), max(ys) + 1, min(xs), max(xs) + 1))
    return cajas


def recortar(img, caja):
    y0, y1, x0, x1 = caja
    # Un círculo: centro de la caja y el radio del lado menor, un pelo hacia dentro.
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    r = min(x1 - x0, y1 - y0) / 2 - 2
    lado = int(2 * r)
    x, y = int(cx - r), int(cy - r)
    trozo = img.convert("RGBA").crop((x, y, x + lado, y + lado))
    escala = 4  # máscara a 4× y reducida: borde suave
    m = Image.new("L", (lado * escala, lado * escala), 0)
    ImageDraw.Draw(m).ellipse((0, 0, lado * escala - 1, lado * escala - 1), fill=255)
    m = m.resize((lado, lado), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.6))
    trozo.putalpha(m)
    return trozo.resize((LADO, LADO), Image.LANCZOS)


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    lamina = Image.open(AQUI / "estirpes.webp")
    cajas = medallones(lamina)
    print(f"estirpes.webp: {len(cajas)} medallones")
    w, h = lamina.size
    for caja in cajas:
        fila = int((caja[0] + caja[1]) / 2 > h / 2)
        col = int((caja[2] + caja[3]) / 2 > w / 2)
        raza = POSICIONES[(fila, col)]
        recortar(lamina, caja).save(SALIDA / f"{raza}.webp", "WEBP", quality=92, method=6)
        print(f"  {raza}")
    merc = Image.open(AQUI / "mercenarios.webp")
    cajas = medallones(merc)
    print(f"mercenarios.webp: {len(cajas)} medallones")
    grande = max(cajas, key=lambda c: (c[1] - c[0]) * (c[3] - c[2]))
    recortar(merc, grande).save(SALIDA / "mercenario.webp", "WEBP", quality=92, method=6)
    print("  mercenario")


if __name__ == "__main__":
    main()
