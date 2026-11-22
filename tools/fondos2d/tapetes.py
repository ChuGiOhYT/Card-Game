"""
Tapetes de la mesa de duelo, uno por estirpe (AETERNUM).

La mesa de la partida se pinta sobre el suelo de la tierra de quien juega en
casa: tierra y pasto para los desterrados, placas de hierro con grietas de
fuego para los oxitron, arena clara con cristales bajo la luna para los
lunaria y losas de cripta con huesos y musgo para los reanimados.

Las paletas salen MEDIDAS de los fondos pintados de cada estirpe
(src/assets/fondos/<raza>.jpg: tonos oscuro, mediano y claro), igual que las
capas del escenario 2D: inventarlas dejó colores que no casaban.

El tapete va DEBAJO de las cartas, así que se pinta oscuro y con poco
contraste en el centro de cada lado (donde se leen las cartas) y una viñeta en
los bordes. Las zonas (círculo de runas, huecos de acción y Hades) NO se pintan
aquí: las pone el CSS encima, porque su sitio depende del tamaño de ventana.

    python tools/fondos2d/tapetes.py              # los cuatro
    python tools/fondos2d/tapetes.py oxitron      # uno
"""
import os
import sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from pintura import rgb, rampa, suave, fbm, ruido

W, H = 1600, 1000
RAIZ = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'assets', 'tapetes')


# ------------------------------------------------------------- utilidades
def mezclar(base, color, alfa):
    """base (h,w,3) ← color (3,) o (h,w,3) con alfa (h,w)."""
    a = np.clip(alfa, 0, 1)[..., None]
    return base * (1 - a) + np.asarray(color, np.float32) * a


def capa_trazos(dibujar, ss=2, desenfoque=0):
    """Máscara (h,w) en [0,1] dibujada con PIL a mayor resolución."""
    im = Image.new('L', (W * ss, H * ss), 0)
    dibujar(ImageDraw.Draw(im), ss)
    im = im.resize((W, H), Image.LANCZOS)
    if desenfoque:
        im = im.filter(ImageFilter.GaussianBlur(desenfoque))
    return np.asarray(im, np.float32) / 255


def vineta(img, fuerza=0.55):
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    d = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
    return img * (1 - fuerza * suave(0.55, 1.35, d))[..., None]


def guardar(img, nombre):
    os.makedirs(RAIZ, exist_ok=True)
    a = (np.clip(img, 0, 1) * 255).astype(np.uint8)
    ruta = os.path.join(RAIZ, f'{nombre}.webp')
    Image.fromarray(a, 'RGB').save(ruta, 'WEBP', quality=82, method=6)
    print(f'{ruta}  {os.path.getsize(ruta) // 1024} KB')


# ------------------------------------------------------- desterrado: pasto
def desterrado():
    rng = np.random.default_rng(11)
    # Tierra: marrón oscuro con manchas, teñida hacia el verde medido del bosque.
    t = fbm(W, H, 220, 3, 5)
    img = rampa(t, ['#0d0a05', '#1f170c', '#2e2213', '#3a2b17'])
    img = mezclar(img, rgb('#1e2f18'), 0.25 * np.ones((H, W)))
    # Matas de pasto: donde el ruido grande sube, la tierra se cubre.
    # Transición ancha y sin llegar a cubrir del todo: con un borde duro las
    # matas parecían manchas de camuflaje.
    cobertura = suave(0.38, 0.78, fbm(W, H, 200, 7, 5)) * 0.8
    pasto_base = rampa(fbm(W, H, 50, 9, 3), ['#0d1a0a', '#183014', '#24421c'])
    img = mezclar(img, pasto_base, cobertura * 0.75)

    # Briznas: trazos cortos, más densos donde hay pasto.
    def briznas(d, s):
        for _ in range(26000):
            x, y = rng.random() * W, rng.random() * H
            if rng.random() > 0.15 + 0.85 * cobertura[int(y), int(x)]:
                continue
            l = rng.uniform(6, 16)
            ang = -np.pi / 2 + rng.normal(0, 0.35)
            d.line([(x * s, y * s), ((x + np.cos(ang) * l) * s, (y + np.sin(ang) * l) * s)],
                   fill=int(rng.uniform(120, 255)), width=s)
    m = capa_trazos(briznas)
    img = mezclar(img, rgb('#548454'), m * 0.55)
    img = mezclar(img, rgb('#1e3a17'), capa_trazos(briznas) * 0.4)

    # Piedrecillas claras sueltas.
    def piedras(d, s):
        for _ in range(420):
            x, y, r = rng.random() * W, rng.random() * H, rng.uniform(2, 6)
            d.ellipse([(x - r) * s, (y - r * 0.7) * s, (x + r) * s, (y + r * 0.7) * s], fill=200)
    img = mezclar(img, rgb('#6b6150'), capa_trazos(piedras) * 0.5)
    return vineta(img)


# ------------------------------------------------ oxitron: hierro y fuego
def oxitron():
    rng = np.random.default_rng(23)
    rugoso = fbm(W, H, 90, 31, 5)
    img = rampa(rugoso, ['#0e0906', '#251a14', '#3a2a22', '#463128'])
    # Placas: rejilla irregular con bisel claro arriba-izquierda y sombra abajo.
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    lado = 200
    fx, fy = (xx % lado) / lado, (yy % (lado * 0.75)) / (lado * 0.75)
    junta = np.minimum.reduce([fx, 1 - fx, fy, 1 - fy])
    img = img * (0.55 + 0.45 * suave(0.0, 0.05, junta))[..., None]
    luz = suave(0.0, 0.03, fx) * (1 - suave(0.0, 0.03, fy)) + (1 - suave(0.0, 0.03, fx)) * 0
    img = mezclar(img, rgb('#815d4c'), (1 - suave(0.0, 0.025, fy)) * 0.25)
    # Remaches en las esquinas de cada placa.
    def remaches(d, s):
        for cx in range(0, W + lado, lado):
            for cy in np.arange(0, H + lado, lado * 0.75):
                for ox, oy in ((14, 14), (lado - 14, 14), (14, lado * 0.75 - 14), (lado - 14, lado * 0.75 - 14)):
                    x, y = cx + ox, cy + oy
                    d.ellipse([(x - 4) * s, (y - 4) * s, (x + 4) * s, (y + 4) * s], fill=255)
    img = mezclar(img, rgb('#9a7a64'), capa_trazos(remaches) * 0.55)
    # Óxido en manchas.
    img = mezclar(img, rgb('#5a2a14'), suave(0.6, 0.8, fbm(W, H, 140, 41, 4)) * 0.35)
    # Grietas de fuego: crestas del ruido (donde |n-0.5| es mínimo), brillantes.
    n = fbm(W, H, 260, 51, 5)
    cresta = 1 - suave(0.0, 0.018, np.abs(n - 0.5))
    cresta *= suave(0.45, 0.7, fbm(W, H, 400, 57, 3))      # solo en algunas zonas
    brasa = Image.fromarray((cresta * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(7))
    halo = np.asarray(brasa, np.float32) / 255
    img = mezclar(img, rgb('#ff5a14'), np.clip(halo * 1.6, 0, 1) * 0.55)
    img = mezclar(img, rgb('#ffd27a'), cresta * 0.9)
    return vineta(img, 0.6)


# ----------------------------------------- lunaria: arena y cristal lunar
def lunaria():
    rng = np.random.default_rng(37)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # Ondas de arena: senos deformados por ruido.
    def_ = fbm(W, H, 260, 61, 4) * 60
    ondas = 0.5 + 0.5 * np.sin((yy + def_ + xx * 0.18) / 13)
    base = fbm(W, H, 240, 63, 4)
    v = np.clip(base * 0.75 + ondas * 0.25, 0, 1)
    img = rampa(v, ['#0e1427', '#1f2b48', '#35537e', '#5c6f8f'])
    # Luz de luna: un óvalo frío arriba-derecha.
    d = np.sqrt(((xx - W * 0.72) / (W * 0.6)) ** 2 + ((yy - H * 0.2) / (H * 0.7)) ** 2)
    img = mezclar(img, rgb('#afdcea'), (1 - suave(0.0, 1.0, d)) * 0.18)

    # Cristales: esquirlas alargadas, cian con filo claro.
    def cristales(d, s, filo):
        r2 = np.random.default_rng(71)
        for _ in range(140):
            x, y = r2.random() * W, r2.random() * H
            l, a = r2.uniform(10, 34), r2.uniform(0, np.pi)
            w = l * r2.uniform(0.18, 0.3)
            ca, sa = np.cos(a), np.sin(a)
            p = [(x + ca * l, y + sa * l), (x - sa * w, y + ca * w), (x - ca * l * 0.6, y - sa * l * 0.6),
                 (x + sa * w, y - ca * w)]
            if filo:
                d.line([(p[0][0] * s, p[0][1] * s), (p[2][0] * s, p[2][1] * s)], fill=255, width=s)
            else:
                d.polygon([(px * s, py * s) for px, py in p], fill=230)
    img = mezclar(img, rgb('#3f8fb0'), capa_trazos(lambda d, s: cristales(d, s, False)) * 0.6)
    img = mezclar(img, rgb('#d8f4ff'), capa_trazos(lambda d, s: cristales(d, s, True)) * 0.8)
    halo = capa_trazos(lambda d, s: cristales(d, s, False), desenfoque=9)
    img = mezclar(img, rgb('#afdcea'), halo * 0.25)
    # Granos brillantes de arena.
    granos = (rng.random((H, W)) > 0.9985).astype(np.float32)
    img = mezclar(img, rgb('#e8f6ff'), granos * 0.7)
    return vineta(img, 0.55)


# --------------------------------------- reanimado: losas, huesos y musgo
def reanimado():
    rng = np.random.default_rng(53)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    piedra = fbm(W, H, 120, 81, 5)
    img = rampa(piedra, ['#071011', '#152625', '#243a38', '#33504b'])
    # Losas: filas de alto fijo, juntas verticales desplazadas por fila.
    alto_f = 170
    fila = (yy // alto_f).astype(int)
    desp = (fila * 97) % 240
    ancho = 240 + (fila % 3) * 40
    fx = ((xx + desp) % ancho) / ancho
    fy = (yy % alto_f) / alto_f
    junta = np.minimum.reduce([fx, 1 - fx, fy, 1 - fy])
    img = img * (0.5 + 0.5 * suave(0.0, 0.035, junta))[..., None]
    # Cada losa con su propio tono.
    tono = ruido(W, H, 40, 83)
    img = img * (0.85 + 0.3 * tono)[..., None]
    # Grietas finas.
    n = fbm(W, H, 180, 87, 5)
    grieta = 1 - suave(0.0, 0.012, np.abs(n - 0.5))
    img = img * (1 - grieta * 0.6)[..., None]
    # Musgo en las juntas y manchas.
    musgo = suave(0.55, 0.75, fbm(W, H, 110, 89, 4)) * (1 - suave(0.0, 0.12, junta) * 0.6)
    img = mezclar(img, rgb('#417c70'), musgo * 0.45)

    # Huesos sueltos: cápsulas con dos nudos en los extremos.
    def huesos(d, s):
        for _ in range(26):
            x, y = rng.random() * W, rng.random() * H
            l, a = rng.uniform(26, 52), rng.uniform(0, np.pi)
            ca, sa = np.cos(a) * l / 2, np.sin(a) * l / 2
            d.line([((x - ca) * s, (y - sa) * s), ((x + ca) * s, (y + sa) * s)], fill=230, width=int(6 * s))
            for ex, ey in ((x - ca, y - sa), (x + ca, y + sa)):
                for k in (-1, 1):
                    ox, oy = -np.sin(a) * 4 * k, np.cos(a) * 4 * k
                    d.ellipse([(ex + ox - 5) * s, (ey + oy - 5) * s, (ex + ox + 5) * s, (ey + oy + 5) * s], fill=230)
    m = capa_trazos(huesos)
    sombra = np.asarray(Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)), np.float32) / 255
    img = img * (1 - np.roll(sombra, (4, 4), (0, 1)) * 0.5)[..., None]
    img = mezclar(img, rgb('#a9a48f'), m * 0.75)
    return vineta(img, 0.6)


# ------------------------------- libre: mármol de noche con vetas de oro
def libre():
    """Equipo libre (Oscar): ninguna tierra y todas. Mármol oscuro con los tonos
    de la marca (noche y violeta), vetas de oro y, en cada esquina, el resplandor
    tenue de una estirpe (colorPrimario de races.js). Un filete dorado con
    rombos marca el borde, como el del logo."""
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    piedra = fbm(W, H, 200, 101, 5)
    img = rampa(piedra, ['#07071a', '#110f2a', '#1c1638', '#2a1f47'])
    # Nubes violeta y cian, muy suaves (la nebulosa de la marca).
    img = mezclar(img, rgb('#7b2d96'), suave(0.55, 0.85, fbm(W, H, 320, 103, 4)) * 0.18)
    img = mezclar(img, rgb('#3cc3d4'), suave(0.62, 0.9, fbm(W, H, 280, 107, 4)) * 0.08)

    # Vetas de oro como en el mármol: bandas diagonales largas, deformadas por
    # ruido (las crestas de un ruido suelto salían como garabatos cerrados).
    vetas = np.zeros((H, W), np.float32)
    for sem, periodo, grosor, giro in ((109, 520, 0.035, 0.55), (113, 330, 0.022, -0.35)):
        torcer = (fbm(W, H, 420, sem, 5) - 0.5) * 0.9 + (fbm(W, H, 70, sem + 1, 3) - 0.5) * 0.12
        fase = (xx * np.cos(giro) + yy * np.sin(giro)) / periodo * 2 * np.pi + torcer * 2 * np.pi
        vetas = np.maximum(vetas, 1 - suave(0.0, grosor, np.abs(np.sin(fase / 2))))
    vetas *= 0.25 + 0.75 * suave(0.3, 0.65, fbm(W, H, 380, 117, 3))
    # Bajo las cartas (bandas centrales de cada lado), más tenues.
    vetas *= 1 - 0.45 * (1 - suave(0.0, 0.35, np.abs(xx / W - 0.5)))
    halo = np.asarray(Image.fromarray((vetas * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5)), np.float32) / 255
    img = mezclar(img, rgb('#8a6a2a'), np.clip(halo * 1.4, 0, 1) * 0.35)
    img = mezclar(img, rgb('#e3c27a'), vetas * 0.75)

    # Las cuatro estirpes, una por esquina (desterrado, lunaria, oxitrón, reanimado).
    for (cx, cy), color in (((0, 0), '#7ec8f2'), ((W, 0), '#c07ae8'),
                            ((0, H), '#f0913a'), ((W, H), '#5fd9a8')):
        d = np.sqrt(((xx - cx) / (W * 0.55)) ** 2 + ((yy - cy) / (H * 0.6)) ** 2)
        img = mezclar(img, rgb(color), (1 - suave(0.0, 1.0, d)) ** 1.6 * 0.32)

    # Filete dorado con rombos en las esquinas y a media altura.
    def filete(d, s):
        m = 26
        d.rectangle([m * s, m * s, (W - m) * s, (H - m) * s], outline=255, width=2 * s)
        d.rectangle([(m + 9) * s, (m + 9) * s, (W - m - 9) * s, (H - m - 9) * s], outline=150, width=s)
        for x, y in ((m, m), (W - m, m), (m, H - m), (W - m, H - m), (W / 2, m), (W / 2, H - m), (m, H / 2), (W - m, H / 2)):
            r = 11
            d.polygon([(x * s, (y - r) * s), ((x + r) * s, y * s), (x * s, (y + r) * s), ((x - r) * s, y * s)], fill=255)
    f = capa_trazos(filete)
    img = mezclar(img, rgb('#3a2c10'), np.roll(f, (3, 3), (0, 1)) * 0.6)
    img = mezclar(img, rgb('#d9b866'), f * 0.8)
    return vineta(img, 0.5)


TAPETES = {'desterrado': desterrado, 'oxitron': oxitron, 'lunaria': lunaria, 'reanimado': reanimado,
           'libre': libre}

if __name__ == '__main__':
    for nombre in (sys.argv[1:] or TAPETES):
        guardar(TAPETES[nombre](), nombre)
