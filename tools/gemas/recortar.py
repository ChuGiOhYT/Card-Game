"""Recorta las cuatro gemas de los Eternales de la lámina de Oscar.

La lámina trae un tablero de «transparencia» DIBUJADO (no es alfa de verdad)
y un halo amarillo alrededor de la gema de fuego. Todo eso es fondo: se
inunda desde los bordes por los píxeles claros, y la inundación se para en
el contorno oscuro de cada gema. Lo que queda son cuatro manchas; cada una se
recorta, se suaviza el borde y se guarda en WebP con alfa.

    python tools/gemas/recortar.py tools/gemas/lamina.png

Deja src/assets/gemas/<raza>.webp. El brillo NO se pinta aquí: lo pone el CSS
(así late y se puede cambiar de color sin repintar).
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / "src" / "assets" / "gemas"
LADO = 256  # lado máximo de cada gema

# Qué gema es de qué campaña (lo decidió Oscar): blanca = Lunaria, amarilla =
# Desterrados, roja = Oxitrón, negra = Reanimados.
def raza_por_color(rgb):
    r, g, b = rgb
    if r > 170 and g > 110 and b < 110:
        return "desterrado"   # amarilla, de fuego
    if r > g + 40:
        return "oxitron"      # roja con venas verdes
    if (r + g + b) / 3 < 100:
        return "reanimado"    # negra con verde
    return "lunaria"          # blanca agrietada


def main(ruta):
    img = Image.open(ruta).convert("RGB")
    a = np.asarray(img).astype(np.int32)
    h, w, _ = a.shape
    luz = a.mean(axis=2)
    # Fondo: claro (tablero blanco/gris y el halo amarillo, que también es claro).
    claro = luz > 150
    fondo = np.zeros((h, w), bool)
    cola = deque()
    for x in range(w):
        for y in (0, h - 1):
            if claro[y, x] and not fondo[y, x]:
                fondo[y, x] = True
                cola.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if claro[y, x] and not fondo[y, x]:
                fondo[y, x] = True
                cola.append((y, x))
    while cola:
        y, x = cola.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and claro[ny, nx] and not fondo[ny, nx]:
                fondo[ny, nx] = True
                cola.append((ny, nx))
    gema = ~fondo

    # Manchas conexas (las cuatro gemas); se ignoran las motas pequeñas.
    etiqueta = np.zeros((h, w), np.int32)
    manchas = []
    n = 0
    for y0 in range(h):
        for x0 in range(w):
            if gema[y0, x0] and not etiqueta[y0, x0]:
                n += 1
                pila = [(y0, x0)]
                etiqueta[y0, x0] = n
                pts = []
                while pila:
                    y, x = pila.pop()
                    pts.append((y, x))
                    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < h and 0 <= nx < w and gema[ny, nx] and not etiqueta[ny, nx]:
                            etiqueta[ny, nx] = n
                            pila.append((ny, nx))
                if len(pts) > 5000:
                    manchas.append((n, pts))
    print(f"{len(manchas)} gemas encontradas")
    SALIDA.mkdir(parents=True, exist_ok=True)
    usadas = set()
    for n, pts in manchas:
        ys = [p[0] for p in pts]
        xs = [p[1] for p in pts]
        y0, y1, x0, x1 = min(ys), max(ys) + 1, min(xs), max(xs) + 1
        alfa = Image.fromarray(((etiqueta[y0:y1, x0:x1] == n) * 255).astype(np.uint8))
        # Borde suave: un pelo hacia dentro y desenfocado (sin halo claro).
        alfa = alfa.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
        trozo = img.crop((x0, y0, x1, y1)).convert("RGBA")
        trozo.putalpha(alfa)
        # Color dominante del interior, para saber de quién es.
        m = np.asarray(alfa) > 200
        rgb = np.asarray(img.crop((x0, y0, x1, y1)))[m].mean(axis=0)
        raza = raza_por_color(rgb)
        assert raza not in usadas, f"dos gemas parecen de {raza}: {rgb}"
        usadas.add(raza)
        trozo.thumbnail((LADO, LADO), Image.LANCZOS)
        # Lienzo cuadrado con margen: el brillo del CSS necesita sitio.
        lienzo = Image.new("RGBA", (LADO, LADO), (0, 0, 0, 0))
        lienzo.paste(trozo, ((LADO - trozo.width) // 2, (LADO - trozo.height) // 2), trozo)
        destino = SALIDA / f"{raza}.webp"
        lienzo.save(destino, "WEBP", quality=92, method=6)
        print(f"  {raza:11s} color medio {tuple(int(c) for c in rgb)} -> {destino.name}")


if __name__ == "__main__":
    main(sys.argv[1])
