"""
Capas del escenario 2D del Oasis (calabozo de los Lunarias).

    python tools/fondos2d/oasis.py [capa ...]   -> src/assets/escenario2d/oasis/*.webp

Paleta MEDIDA del fondo de la estirpe (assets/fondos/lunaria.jpg): cielo
#334979, bruma del horizonte #72bfd7, agujas de roca #406f99, árboles #254765,
suelo #336680, cristal #27305e, lo más oscuro #121c32. Acentos violeta y
turquesa (los orbes y los cristales). La luna está arriba a la izquierda: de
ahí viene la luz en todas las capas.
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from pintura import (ALTO, Tira, rgb, rampa, suave, ruido, fbm, tronco, ramas, brillo,
                     mascara_trazos, aguja, cristal, copa_redonda)

H = ALTO
SALIDA = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'escenario2d', 'oasis')

ROCA = ['#0e1730', '#1c2c4c', '#2f4a72', '#4a6f99', '#7aa3c4']
CRISTAL = ['#121436', '#22266a', '#3a42a2', '#6a6ad2', '#c0b8ff']
TEAL = ['#051020', '#0b2236', '#12384e', '#1b5464', '#2f7c86']
CORTEZA = ['#070c18', '#111a2c', '#1d2a40', '#2c3c56', '#425473']
BRUMA = '#5b9dc4'


def lejanos():
    """Agujas y mesetas de roca en la bruma del horizonte."""
    W = 2600
    t = Tira(W)
    rng = np.random.default_rng(1101)
    x = 0
    while x < W:
        alto = rng.uniform(170, 380)
        aguja(t, x, H * 0.66, alto, rng.uniform(60, 130), int(rng.integers(1e6)), ROCA, cresta=rng.uniform(-0.1, 0.15))
        x += rng.uniform(140, 300)
    # Mesetas bajas por detrás de todo, como una cordillera.
    perfil = H * 0.6 + (ruido(W, 1, 240, 1103, periodico=True)[0] - 0.5) * 70
    filas = np.arange(H, dtype=np.float32)[:, None]
    m = suave(-1, 1, filas - perfil[None, :]) * suave(H * 0.75, H * 0.68, filas)
    col = rampa(0.45 + 0.2 * fbm(W, H, 30, 1104, 3, periodico=True), ROCA)
    capa = Tira(W); capa.c = col * m[..., None]; capa.a = m
    capa.c = capa.c + t.c * 0  # (se compone debajo)
    fondo = Tira(W)
    fondo.pegar(0, 0, col, m)
    fondo.pegar(0, 0, np.where(t.a[..., None] > 0, t.c / np.maximum(t.a[..., None], 1e-4), 0), t.a)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    fondo.niebla(BRUMA, np.broadcast_to(0.45 + 0.35 * suave(0.35, 0.68, yy), (H, W)))
    fondo.a *= 0.85; fondo.c *= 0.85
    fondo.desenfocar(2.2)
    return fondo


def medios():
    """Árboles de copa redonda turquesa y racimos de cristal, a media distancia."""
    W = 3000
    t = Tira(W)
    rng = np.random.default_rng(1202)
    x = 100
    while x < W + 60:
        if rng.random() < 0.65:
            alto = rng.uniform(260, 420)
            base = H * rng.uniform(0.76, 0.8)
            curva = rng.uniform(-60, 60)
            tronco(t, x, base, alto, rng.uniform(30, 52), rng.uniform(12, 18), curva, int(rng.integers(1e6)),
                   CORTEZA, None, 0, acampanado=0.9)
            copa_redonda(t, x + curva * 0.6, base - alto * 0.98, rng.uniform(100, 140), rng.uniform(60, 85),
                         int(rng.integers(1e6)), TEAL, borde='#5fc9d0')
        else:
            for k in range(int(rng.integers(3, 6))):
                cristal(t, x + rng.uniform(-40, 40), H * 0.79, rng.uniform(70, 170), rng.uniform(22, 40),
                        rng.uniform(-0.45, 0.45), int(rng.integers(1e6)), CRISTAL, '#a38cff')
        x += rng.uniform(220, 360)
    yy = np.linspace(0, 1, H, dtype=np.float32)[:, None]
    t.niebla(BRUMA, np.broadcast_to(0.22 + 0.22 * suave(0.45, 0.8, yy), (H, W)))
    t.desenfocar(0.8)
    return t


def cercanos():
    """Grandes formaciones de cristal y algún árbol retorcido, en primer término."""
    W = 3600
    t = Tira(W)
    rng = np.random.default_rng(1303)
    for k in range(5):
        x = k * (W / 5) + rng.uniform(-100, 100) + 200
        base = H * 0.9
        if k % 2 == 0:
            for j in range(int(rng.integers(4, 7))):
                cristal(t, x + rng.uniform(-70, 70), base + rng.uniform(-6, 10), rng.uniform(130, 270),
                        rng.uniform(36, 66), rng.uniform(-0.5, 0.5), int(rng.integers(1e6)), CRISTAL, '#b49cff')
        else:
            curva = rng.uniform(-80, 80)
            tronco(t, x, base, 760, rng.uniform(120, 170), 60, curva, int(rng.integers(1e6)),
                   CORTEZA, None, 0, acampanado=0.7, luz_borde=0.2)
            copa_redonda(t, x + curva * 0.5, 30, 230, 120, int(rng.integers(1e6)), TEAL, borde='#5fc9d0')
    t.niebla(BRUMA, 0.05)
    return t


def suelo():
    """Pradera turquesa sobre roca: losas planas, matas, cristalitos y flores que brillan."""
    W = 3600
    t = Tira(W)
    G = H * 0.79
    filas = np.arange(H, dtype=np.float32)[:, None]
    borde = (G + (ruido(W, 1, 320, 1401, periodico=True)[0] - 0.5) * 40
             + (ruido(W, 1, 60, 1402, periodico=True)[0] - 0.5) * 8)
    prof = (filas - borde[None, :]) / (H - G)
    dentro = suave(-0.012, 0.012, prof)
    tex = fbm(W, H, 46, 1403, 4, periodico=True)
    v = 0.6 - 0.55 * np.clip(prof, 0, 1) + 0.2 * (tex - 0.5)
    col = rampa(v, ['#060d1c', '#0c1a2e', '#14304a', '#1f4a62', '#2e6a7a'])
    # Losas de piedra: zonas más claras y planas, con borde.
    losa = suave(0.6, 0.66, fbm(W, H, 120, 1404, 2, periodico=True)) * suave(0.05, 0.15, prof)
    col = col * (1 - (losa * 0.7)[..., None]) + rampa(0.45 + 0.4 * tex, ROCA) * (losa * 0.7)[..., None]
    # Borde de musgo turquesa.
    rim = suave(0.0, 0.01, prof) * suave(0.06, 0.015, prof)
    col = col * (1 - (rim * 0.5)[..., None]) + rampa(0.5 + 0.5 * tex, TEAL) * (rim * 0.5)[..., None]
    t.c = col * dentro[..., None]
    t.a = dentro.copy()

    rng = np.random.default_rng(1405)
    banda_y0 = int(G - 60)
    im = Image.new('RGBA', (W, 110), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, 'RGBA')
    matas = ruido(W, 1, 150, 1406, periodico=True)[0]
    for _ in range(3800):
        x = rng.uniform(0, W)
        if rng.random() > matas[int(x) % W] ** 1.5:
            continue
        by = borde[int(x) % W] - banda_y0 + rng.uniform(0, 8)
        alto = rng.uniform(5, 28) * (0.5 + matas[int(x) % W])
        inc = rng.uniform(-8, 8)
        c = rampa(np.array(rng.uniform(0.1, 1.0)), ['#081a26', '#11344a', '#1f5a6a', '#3c8c8f'])
        col8 = tuple(int(v * 255) for v in c) + (int(rng.uniform(170, 255)),)
        for dx in (-W, 0, W):
            d.line([(x + dx, by), (x + dx + inc, by - alto)], fill=col8, width=2)
    t.pegar_imagen(0, banda_y0, im)
    # Cristalitos clavados en la hierba.
    for _ in range(30):
        x = rng.uniform(0, W)
        y = borde[int(x) % W] + rng.uniform(2, H * 0.1)
        for _k in range(int(rng.integers(1, 4))):
            cristal(t, x + rng.uniform(-14, 14), y, rng.uniform(18, 46), rng.uniform(7, 13),
                    rng.uniform(-0.5, 0.5), int(rng.integers(1e6)), CRISTAL, '#b49cff')
    # Flores que brillan (violeta y turquesa).
    for _ in range(40):
        x = rng.uniform(0, W)
        y = borde[int(x) % W] + rng.uniform(0, H * 0.13)
        col = '#c9a6ff' if rng.random() < 0.6 else '#7ff0f0'
        brillo(t, x, y, rng.uniform(16, 30), col, 0.45)
        brillo(t, x, y, 4, '#ffffff', 0.9)
    return t


def frente_bajo():
    """Hojas y esquirlas de cristal del primer plano: solo asoman, fuera de foco."""
    W = 4000
    t = Tira(W)
    rng = np.random.default_rng(1505)
    x = 250
    while x < W:
        if rng.random() < 0.5:
            for _k in range(int(rng.integers(3, 6))):
                cristal(t, x + rng.uniform(-80, 80), H + rng.uniform(30, 80), rng.uniform(220, 340),
                        rng.uniform(60, 100), rng.uniform(-0.5, 0.5), int(rng.integers(1e6)),
                        ['#05061a', '#0e1238', '#1d2260', '#3a3f90', '#7a78c8'])
        else:
            copa_redonda(t, x, H + 60, 260, 150, int(rng.integers(1e6)),
                         ['#02060c', '#061424', '#0c2234', '#15364a', '#225060'])
        x += rng.uniform(800, 1200)
    t.desenfocar(6)
    return t


def lianas():
    """Enredaderas con brotes que brillan en violeta."""
    W = 3400
    t = Tira(W)
    rng = np.random.default_rng(1606)
    x = 100
    while x < W:
        for _ in range(int(rng.integers(2, 4))):
            lx = x + rng.uniform(-60, 60)
            largo = rng.uniform(120, 300)
            im = Image.new('RGBA', (80, int(largo) + 20), (0, 0, 0, 0))
            d = ImageDraw.Draw(im, 'RGBA')
            fase = rng.uniform(0, 6)
            pts = [(40 + np.sin(y * 0.03 + fase) * 10, y) for y in range(0, int(largo), 6)]
            d.line(pts, fill=(8, 16, 34, 255), width=int(rng.integers(2, 4)))
            for y in range(16, int(largo), 16):
                px = 40 + np.sin(y * 0.03 + fase) * 10
                lado = 1 if rng.random() < 0.5 else -1
                xa, xb = sorted((px + lado * 2, px + lado * 12))
                d.ellipse([xa, y - 3, xb, y + 3], fill=(16, 50, 70, 255))
            t.pegar_imagen(int(lx - 40), -4, im)
            for y in range(30, int(largo), 45):
                px = lx + np.sin(y * 0.03 + fase) * 10
                brillo(t, px, y, 10, '#c9a6ff', 0.6)
        x += rng.uniform(340, 600)
    t.desenfocar(2)
    return t


def poste():
    """Estela de piedra lunar con un orbe encajado arriba (la luz se pinta en el juego)."""
    w, h = 170, 320
    t = Tira(w, h)
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx = 27
    # Fuste: losa alta que se estrecha un poco hacia arriba.
    ancho = 40 - (h - yy) * 0.035
    m = (np.abs(xx - cx) < ancho / 2) & (yy > 70)
    u = (xx - (cx - ancho / 2)) / ancho
    tex = fbm(w, h, 10, 1701, 3)
    v = 0.25 + 0.5 * (1 - u) + 0.2 * (tex - 0.5)
    col = rampa(v, ROCA)
    t.c[m] = col[m]; t.a[m] = 1
    # Media luna grabada.
    r = np.sqrt((xx - cx) ** 2 + (yy - 140) ** 2)
    r2 = np.sqrt((xx - cx - 5) ** 2 + (yy - 137) ** 2)
    luna = (r < 11) & (r2 > 9) & m
    t.c[luna] = rgb('#b9d8ff') * 0.75
    # Cuenco para el orbe.
    cuenco = (np.abs(xx - cx) < 26) & (yy > 60) & (yy < 74)
    t.c[cuenco] = rampa(0.4 + 0.3 * (1 - (xx[cuenco] - cx + 26) / 52), ROCA); t.a[cuenco] = 1
    return t


def main():
    capas = {'lejanos': lejanos, 'medios': medios, 'cercanos': cercanos, 'suelo': suelo,
             'frente': frente_bajo, 'lianas': lianas, 'poste': poste}
    for nombre in sys.argv[1:] or list(capas):
        t = capas[nombre]()
        kb = t.guardar(os.path.join(SALIDA, f'{nombre}.webp')) / 1024
        print(f'  {nombre:9s} {t.w}x{t.h}  {kb:6.0f} KB')


if __name__ == '__main__':
    main()
