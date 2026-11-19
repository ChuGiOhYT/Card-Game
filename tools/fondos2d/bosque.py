"""
Capas del escenario 2D del Bosque Nocturno (calabozo de los Desterrados).

    python tools/fondos2d/bosque.py            -> src/assets/escenario2d/bosque/*.webp

Paleta tomada del fondo pintado de la estirpe (assets/fondos/desterrado.jpg):
verdes con bruma turquesa, corteza gris verdosa, musgo, luciérnagas amarillo
verdoso y hongos turquesa (como en el mapa del calabozo). La luz de la luna
llega desde arriba a la izquierda en TODAS las capas: es lo que da coherencia.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from pintura import (ALTO, Tira, rgb, rampa, suave, ruido, fbm, tronco, ramas, follaje,
                     brillo, mascara_trazos)

H = ALTO
SALIDA = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'escenario2d', 'bosque')

# Medida del fondo pintado (desterrado.jpg): bruma lejana #487750, medio
# #2e4b2d, troncos #0f1306, suelo #162712. Inventarla dio postes blancos.
CORTEZA = ['#060b03', '#0f1306', '#1b2412', '#2a371e', '#3c4c2c']
MUSGO = ['#16260f', '#22391a', '#2f4d22', '#3f6429']
HOJAS = ['#07120a', '#0f200f', '#193318', '#264a22', '#36612d']
BRUMA = '#487750'


def raices(tira, x, base, w0, rng, colores, n=6):
    """Raíces gruesas que se abren desde la base y se hunden en el suelo."""
    for k in range(n):
        lado = -1 if k % 2 == 0 else 1
        largo = w0 * (0.55 + rng.random() * 0.6)
        grosor = w0 * (0.16 + rng.random() * 0.1)
        x0 = x + lado * w0 * (0.12 + rng.random() * 0.18)
        x1 = x + lado * (w0 * 0.3 + largo)
        y0, y1 = base - w0 * (0.18 + rng.random() * 0.12), base + 6 + rng.random() * 14
        X0, Y0 = int(min(x0, x1) - grosor * 2), int(y0 - grosor * 2)
        W, Hh = int(abs(x1 - x0) + grosor * 4), int(y1 - y0 + grosor * 4)
        pts = []
        for t in np.linspace(0, 1, 24):
            px = x0 + (x1 - x0) * t
            py = y0 + (y1 - y0) * t ** 1.6 - np.sin(t * np.pi) * grosor * 0.6
            pts.append((px, py, grosor * (1 - t * 0.85)))
        def dib(d, s):
            for (px, py, g) in pts:
                d.ellipse([(px - X0 - g / 2) * s, (py - Y0 - g / 2) * s, (px - X0 + g / 2) * s, (py - Y0 + g / 2) * s], fill=255)
        m = mascara_trazos(W, Hh, dib)
        yy, xx = np.mgrid[0:Hh, 0:W].astype(np.float32)
        tex = fbm(W, Hh, 10, int(rng.integers(1e6)), 3)
        v = 0.25 + 0.45 * (1 - yy / Hh) + 0.25 * (tex - 0.5) + (0.12 if lado < 0 else -0.05)
        tira.pegar(X0, Y0, rampa(v, colores), m)


def hiedra(tira, x, y0, y1, rng, n=40):
    """Hojas de hiedra trepando por el lado iluminado de un tronco."""
    for _ in range(n):
        hx = x + rng.normal(0, 6)
        hy = y0 + rng.random() * (y1 - y0)
        follaje(tira, [(hx, hy)], 9 + rng.random() * 6, rng, HOJAS, densidad=4)


# ----------------------------------------------------------------- capas
def lejanos():
    W = 2400
    t = Tira(W)
    rng = np.random.default_rng(101)
    x = 0
    while x < W:
        alto = rng.uniform(560, 720)
        base = H * rng.uniform(0.69, 0.73)
        tronco(t, x, base, alto, rng.uniform(16, 52), rng.uniform(6, 16), rng.uniform(-40, 40),
               int(rng.integers(1e6)), CORTEZA, None, 0, acampanado=0.5)
        puntas = []
        for _ in range(3):
            yb = base - alto * rng.uniform(0.55, 0.85)
            ramas(t, x, yb, -np.pi / 2 + rng.uniform(-1.1, 1.1), alto * 0.1, 5, 2, rng, '#1a2219', puntas)
        follaje(t, puntas, 26, rng, HOJAS, densidad=8)
        x += rng.uniform(110, 230)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    t.niebla(BRUMA, np.broadcast_to(0.5 + 0.3 * suave(0.3, 0.72, yy), (H, W)))
    t.a *= 0.8
    t.c *= 0.8
    t.desenfocar(2.8)
    return t


def medios():
    W = 3000
    t = Tira(W)
    rng = np.random.default_rng(202)
    x = 120
    while x < W + 60:
        alto = rng.uniform(620, 760)
        base = H * rng.uniform(0.79, 0.82)
        curva = rng.uniform(-90, 90)
        w0 = rng.uniform(70, 110)
        tronco(t, x, base, alto, w0, rng.uniform(22, 34), curva, int(rng.integers(1e6)),
               CORTEZA, MUSGO, 0.25, acampanado=0.8)
        puntas = []
        for k in range(4):
            yb = base - alto * rng.uniform(0.38, 0.62)
            ramas(t, x + curva * 0.55, yb, -np.pi / 2 + (k - 1.5) * 0.7 + rng.uniform(-0.3, 0.3),
                  alto * 0.17, 20, 3, rng, '#121a0e', puntas)
        follaje(t, puntas, 50, rng, HOJAS, densidad=18)
        x += rng.uniform(280, 380)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    t.niebla(BRUMA, np.broadcast_to(0.24 + 0.24 * suave(0.45, 0.82, yy), (H, W)))
    t.desenfocar(0.9)
    return t


def cercanos():
    W = 3600
    t = Tira(W)
    rng = np.random.default_rng(303)
    for k in range(4):
        x = k * (W / 4) + rng.uniform(-120, 120) + 300
        base = H * 0.93
        w0 = rng.uniform(170, 230)
        raices(t, x, base, w0, rng, CORTEZA)
        tronco(t, x, base, 980, w0, w0 * 0.62, rng.uniform(-60, 60), int(rng.integers(1e6)),
               CORTEZA, MUSGO, 0.5, acampanado=0.4, luz_borde=0.14)
        hiedra(t, x - w0 * 0.32, base - 520, base - 60, rng, n=26)
    t.niebla(BRUMA, 0.06)
    return t


def suelo():
    W = 3600
    t = Tira(W)
    G = H * 0.79
    filas = np.arange(H, dtype=np.float32)[:, None]
    borde = (G + (ruido(W, 1, 300, 11, periodico=True)[0] - 0.5) * 46
             + (ruido(W, 1, 60, 21, periodico=True)[0] - 0.5) * 10)
    prof = (filas - borde[None, :]) / (H - G)
    dentro = suave(-0.012, 0.012, prof)
    tex = fbm(W, H, 46, 12, 4, periodico=True)
    v = 0.62 - 0.55 * np.clip(prof, 0, 1) + 0.22 * (tex - 0.5)
    col = rampa(v, ['#040802', '#0a1306', '#122010', '#1b3018', '#284223'])
    # Borde de musgo brillante bajo la línea del suelo.
    rim = suave(0.0, 0.01, prof) * suave(0.06, 0.015, prof)
    m = fbm(W, H, 20, 13, 3, periodico=True)
    col = col * (1 - (rim * 0.45)[..., None]) + rampa(0.3 + 0.7 * m, MUSGO) * (rim * 0.45)[..., None]
    # El sendero.
    centro = G + H * 0.09 + (ruido(W, 1, 300, 14, periodico=True)[0] - 0.5) * 34
    # El sendero aparece y se pierde: no es una franja continua.
    tramo = suave(0.35, 0.6, ruido(W, 1, 500, 16, periodico=True)[0])
    banda = suave(20, 9, np.abs(filas - centro[None, :])) * dentro * tramo[None, :]
    piedra = fbm(W, H, 8, 15, 3, periodico=True)
    senda = rampa(0.3 + 0.5 * piedra, ['#15140d', '#26241a', '#3a3626', '#4c4632'])
    col = col * (1 - (banda * 0.5)[..., None]) + senda * (banda * 0.5)[..., None]
    t.c = col * dentro[..., None]
    t.a = dentro.copy()

    rng = np.random.default_rng(404)
    # Hierba a lo largo del borde (pintada también al otro lado: sin costura).
    banda_y0 = int(G - 60)
    im = Image.new('RGBA', (W, 110), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, 'RGBA')
    matas = ruido(W, 1, 140, 17, periodico=True)[0]
    for _ in range(4200):
        x = rng.uniform(0, W)
        if rng.random() > matas[int(x) % W] ** 1.6:   # en matas, con huecos
            continue
        by = borde[int(x) % W] - banda_y0 + rng.uniform(0, 8)
        alto = rng.uniform(5, 34) * (0.5 + matas[int(x) % W])
        inc = rng.uniform(-9, 9)
        c = rampa(np.array(rng.uniform(0.0, 1.0)), ['#060e05', '#0f1e0c', '#1a3015', '#2b4a22'])
        col8 = tuple(int(v * 255) for v in c) + (int(rng.uniform(170, 255)),)
        for dx in (-W, 0, W):
            d.line([(x + dx, by), (x + dx + inc, by - alto)], fill=col8, width=2)
    t.pegar_imagen(0, banda_y0, im)
    # Hongos que brillan, en racimos.
    for _ in range(16):
        x = rng.uniform(0, W)
        y = borde[int(x) % W] + rng.uniform(4, H * 0.14)
        brillo(t, x, y - 12, rng.uniform(70, 110), '#7ff2cf', 0.3)
        for _k in range(int(rng.integers(3, 7))):
            hx = x + rng.uniform(-16, 16)
            alto = rng.uniform(12, 30)
            r = rng.uniform(6, 13)
            im = Image.new('RGBA', (int(r * 4), int(alto + r * 2)), (0, 0, 0, 0))
            alto *= 0.7
            dd = ImageDraw.Draw(im)
            cx = r * 2
            dd.rectangle([cx - r * 0.12, r * 0.6, cx + r * 0.12, alto + r], fill=(70, 120, 105, 255))
            dd.pieslice([cx - r * 1.5, 0, cx + r * 1.5, r * 1.5], 180, 360, fill=(95, 235, 200, 255))
            dd.pieslice([cx - r * 1.5, r * 0.45, cx + r * 1.5, r * 0.95], 0, 180, fill=(40, 120, 100, 255))
            dd.ellipse([cx - r * 0.9, r * 0.12, cx - r * 0.25, r * 0.38], fill=(220, 255, 240, 220))
            t.pegar_imagen(int(hx - cx), int(y - alto - r), im)
    return t


def frente_bajo():
    """Frondas grandes del primer plano: solo asoman por abajo, fuera de foco."""
    W = 4000
    t = Tira(W)
    rng = np.random.default_rng(505)
    x = 200
    while x < W:
        hb = Image.new('RGBA', (700, 420), (0, 0, 0, 0))
        d = ImageDraw.Draw(hb, 'RGBA')
        for _ in range(int(rng.integers(4, 8))):
            x0 = rng.uniform(200, 500)
            ang = -np.pi / 2 + rng.uniform(-0.9, 0.9)
            largo = rng.uniform(220, 400)
            ancho = rng.uniform(26, 50)
            x1, y1 = x0 + np.cos(ang) * largo, 420 + np.sin(ang) * largo
            pts = []
            for s in np.linspace(0, 1, 18):
                cx, cy = x0 + (x1 - x0) * s, 420 + (y1 - 420) * s
                w = ancho * np.sin(np.pi * min(1, s * 1.1))
                pts.append((cx - np.sin(ang) * w, cy + np.cos(ang) * w))
            for s in np.linspace(1, 0, 18):
                cx, cy = x0 + (x1 - x0) * s, 420 + (y1 - 420) * s
                w = ancho * np.sin(np.pi * min(1, s * 1.1))
                pts.append((cx + np.sin(ang) * w, cy - np.cos(ang) * w))
            d.polygon(pts, fill=(4, 12, 8, 250))
            d.line([(x0, 420), (x1, y1)], fill=(18, 40, 26, 255), width=3)
        t.pegar_imagen(int(x - 350), int(H - 420 + rng.uniform(120, 200)), hb)
        x += rng.uniform(700, 1100)
    t.desenfocar(6)
    return t


def lianas():
    """Lianas que cuelgan del dosel, algo desenfocadas."""
    W = 3400
    t = Tira(W)
    rng = np.random.default_rng(606)
    x = 100
    while x < W:
        for _ in range(int(rng.integers(2, 5))):
            lx = x + rng.uniform(-60, 60)
            largo = rng.uniform(140, 330)
            im = Image.new('RGBA', (80, int(largo) + 20), (0, 0, 0, 0))
            d = ImageDraw.Draw(im, 'RGBA')
            fase = rng.uniform(0, 6)
            pts = [(40 + np.sin(y * 0.03 + fase) * 10, y) for y in range(0, int(largo), 6)]
            d.line(pts, fill=(6, 14, 9, 255), width=int(rng.integers(2, 5)))
            for y in range(14, int(largo), 14):
                px = 40 + np.sin(y * 0.03 + fase) * 10
                lado = 1 if rng.random() < 0.5 else -1
                c = rampa(np.array(rng.uniform(0.0, 0.5)), HOJAS)
                xa, xb = sorted((px + lado * 2, px + lado * 13))
                d.ellipse([xa, y - 3, xb, y + 3], fill=tuple(int(v * 255) for v in c) + (255,))
            t.pegar_imagen(int(lx - 40), -4, im)
        x += rng.uniform(320, 560)
    t.desenfocar(2.2)
    return t


def poste():
    """Poste con farol (el número y la luz se pintan en el juego)."""
    w, h = 170, 320
    t = Tira(w, h)
    # Madera: tronco fino con vetas y luz por la izquierda.
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    def tabla(x0, x1, y0, y1, vertical=True):
        m = ((xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)).astype(np.float32)
        u = (xx - x0) / max(1, x1 - x0) if vertical else (yy - y0) / max(1, y1 - y0)
        veta = ruido(w, h, 5, int(x0 * 7 + y0), False)
        v = 0.25 + 0.55 * (1 - u) + 0.25 * (veta - 0.5)
        t.c = t.c * (1 - m[..., None]) + rampa(v, ['#0d0906', '#22180f', '#3e2c1a', '#5e4428']) * m[..., None]
        t.a = np.maximum(t.a, m)
    tabla(18, 36, 40, h)                     # poste
    tabla(18, 150, 40, 52, vertical=False)   # brazo
    # Escuadra.
    m = ((xx - 36) > 0) & ((yy - 52) > 0) & ((xx - 36) + (yy - 52) < 40) & ((xx - 36) + (yy - 52) > 30)
    t.c[m] = rgb('#2a1e12'); t.a[m] = 1
    # Cadena y farol de hierro (con el cristal vacío: ahí va la luz).
    t.c[52:72, 129:131] = rgb('#151515'); t.a[52:72, 129:131] = 1
    fx0, fx1, fy0, fy1 = 116, 144, 72, 112
    marco = ((xx >= fx0) & (xx < fx1) & (yy >= fy0) & (yy < fy1)) & ~((xx >= fx0 + 4) & (xx < fx1 - 4) & (yy >= fy0 + 6) & (yy < fy1 - 4))
    marco |= (xx >= 129) & (xx < 131) & (yy >= fy0) & (yy < fy1)
    t.c[marco] = rgb('#1a1712'); t.a[marco] = 1
    techo = (yy >= fy0 - 8) & (yy < fy0) & (np.abs(xx - 130) < (yy - (fy0 - 10)) * 1.8)
    t.c[techo] = rgb('#22201a'); t.a[techo] = 1
    return t


def main():
    capas = {
        'lejanos': lejanos, 'medios': medios, 'cercanos': cercanos, 'suelo': suelo,
        'frente': frente_bajo, 'lianas': lianas, 'poste': poste,
    }
    pedidas = sys.argv[1:] or list(capas)
    for nombre in pedidas:
        t = capas[nombre]()
        kb = t.guardar(os.path.join(SALIDA, f'{nombre}.webp')) / 1024
        print(f'  {nombre:9s} {t.w}x{t.h}  {kb:6.0f} KB')


if __name__ == '__main__':
    main()
