"""
Pintura procedural de las capas del escenario 2D (AETERNUM).

Mismo enfoque que los fondos de Dracoslayer —numpy + PIL, rampas de luz, ruido
como textura, dirección de luz— pero en alta resolución y con acabado
pictórico, para que case con el arte pintado de las cartas y los retratos.

Cada capa es una TIRA que se repite en horizontal sin costura: todo lo que se
pinta cerca de un borde se pinta también al otro lado (`envolver`), y el ruido
de lo que cruza la tira entera es periódico.

El lienzo guarda color PREMULTIPLICADO por alfa (float32), que es lo que hace
que superponer, desenfocar y mezclar niebla no deje halos.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ALTO = 720


# ----------------------------------------------------------------- color
def rgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)], np.float32)


def rampa(v, colores):
    """Interpola una lista de colores según v en [0,1] (arrays de cualquier forma)."""
    cs = np.stack([rgb(c) for c in colores])
    v = np.clip(np.nan_to_num(np.asarray(v, np.float32), nan=0.0), 0, 1) * (len(cs) - 1)
    i = np.minimum(v.astype(int), len(cs) - 2)
    f = (v - i)[..., None]
    return cs[i] * (1 - f) + cs[i + 1] * f


def suave(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


# ----------------------------------------------------------------- ruido
def ruido(w, h, celda, semilla, periodico=False):
    """Ruido de valor suave en [0,1]. Con `periodico`, se repite en horizontal."""
    rng = np.random.default_rng(semilla)
    gw, gh = max(2, int(np.ceil(w / celda)) + 1), max(2, int(np.ceil(h / celda)) + 1)
    g = rng.random((gh, gw)).astype(np.float32)
    if periodico:
        gw = max(2, int(round(w / celda)))
        g = rng.random((gh, gw)).astype(np.float32)
        g = np.concatenate([g, g[:, :1]], axis=1)
        im = Image.fromarray(g).resize((gw * celda + 1, (gh - 1) * celda + 1), Image.BILINEAR)
        a = np.asarray(im)[:h, :gw * celda]
        if a.shape[1] != w:
            a = np.asarray(Image.fromarray(a).resize((w, a.shape[0]), Image.BILINEAR))
        return a[:h]
    im = Image.fromarray(g).resize(((gw - 1) * celda + 1, (gh - 1) * celda + 1), Image.BICUBIC)
    return np.clip(np.asarray(im)[:h, :w], 0, 1)


def fbm(w, h, celda, semilla, octavas=4, periodico=False):
    total, amp, peso = np.zeros((h, w), np.float32), 1.0, 0.0
    for o in range(octavas):
        c = max(2, int(celda / (2 ** o)))
        total += ruido(w, h, c, semilla + o * 101, periodico) * amp
        peso += amp
        amp *= 0.5
    return total / peso


# ----------------------------------------------------------------- lienzo
class Tira:
    """Una capa: color premultiplicado + alfa, de ANCHO×ALTO, periódica en x."""

    def __init__(self, ancho, alto=ALTO):
        self.w, self.h = ancho, alto
        self.c = np.zeros((alto, ancho, 3), np.float32)
        self.a = np.zeros((alto, ancho), np.float32)

    def pegar(self, x0, y0, color, alfa):
        """Superpone un parche (color sin premultiplicar + alfa) en (x0,y0), con vuelta."""
        hh, ww = alfa.shape
        y1 = y0 + hh
        ya, yb = max(0, y0), min(self.h, y1)
        if ya >= yb:
            return
        sa, sc = alfa[ya - y0:yb - y0], color[ya - y0:yb - y0]
        xs = np.arange(x0, x0 + ww) % self.w
        dst_c, dst_a = self.c[ya:yb][:, xs], self.a[ya:yb][:, xs]
        s = sa[..., None]
        self.c[ya:yb, xs] = sc * s + dst_c * (1 - s)
        self.a[ya:yb, xs] = sa + dst_a * (1 - sa)

    def pegar_imagen(self, x0, y0, im):
        """Pega una imagen PIL RGBA (no premultiplicada) con vuelta."""
        arr = np.asarray(im).astype(np.float32) / 255
        self.pegar(x0, y0, arr[..., :3], arr[..., 3])

    def niebla(self, color, fuerza):
        """Mezcla hacia el color de la niebla. `fuerza` escalar o array (alto,ancho)."""
        f = np.broadcast_to(np.asarray(fuerza, np.float32), self.a.shape)[..., None]
        self.c = self.c * (1 - f) + rgb(color) * self.a[..., None] * f

    def desenfocar(self, radio):
        if radio <= 0:
            return
        pad = int(radio * 3) + 2
        def bl(ch):
            ext = np.pad(ch, ((0, 0), (pad, pad)), mode='wrap')
            im = Image.fromarray(np.clip(ext * 255, 0, 255).astype(np.uint8))
            return np.asarray(im.filter(ImageFilter.GaussianBlur(radio))).astype(np.float32)[:, pad:-pad] / 255
        self.c = np.stack([bl(self.c[..., i]) for i in range(3)], -1)
        self.a = bl(self.a)

    def guardar(self, ruta, calidad=86):
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        a = np.clip(self.a, 0, 1)
        col = np.where(a[..., None] > 1e-4, self.c / np.maximum(a[..., None], 1e-4), 0)
        arr = np.dstack([np.clip(col, 0, 1), a])
        Image.fromarray((arr * 255 + 0.5).astype(np.uint8), 'RGBA').save(ruta, 'WEBP', quality=calidad, method=6)
        return os.path.getsize(ruta)


# ----------------------------------------------------------------- piezas
def mascara_trazos(w, h, dibujar, ss=2):
    """Máscara en [0,1] dibujada con PIL a `ss`× y reducida (bordes suaves)."""
    im = Image.new('L', (w * ss, h * ss), 0)
    dibujar(ImageDraw.Draw(im), ss)
    return np.asarray(im.resize((w, h), Image.LANCZOS)).astype(np.float32) / 255


def tronco(tira, x, base, alto, w0, w1, curva, semilla, colores, musgo_col=None, musgo=0.0,
           acampanado=0.6, luz_borde=0.18):
    """
    Tronco con volumen: forma analítica (centro curvo, ancho que se estrecha y se
    abre en la base), sombreado por la luz de la izquierda, corteza en vetas
    verticales y musgo en el lado iluminado.
    """
    margen = int(w0 * (1 + acampanado) + abs(curva) + 6)
    X0, Y0 = int(x - margen), int(base - alto)
    W, H = margen * 2, int(alto) + 2
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    t = np.clip((base - (Y0 + yy)) / alto, 0, 1)            # 0 base, 1 arriba
    cx = margen + curva * np.sin(t * np.pi * 0.85)
    ancho = w0 + (w1 - w0) * t ** 0.75
    ancho *= 1 + acampanado * np.clip(1 - t / 0.14, 0, 1) ** 2
    d = (xx - cx) / ancho                                   # -0.5 .. 0.5 dentro
    alfa = np.clip((0.5 - np.abs(d)) * ancho / 1.3, 0, 1)
    u = np.clip(d + 0.5, 0, 1)                              # 0 izq (luz) .. 1 der
    veta = fbm(W, H, 18, semilla, 3)
    estria = ruido(W, max(2, H // 14), 6, semilla + 7)
    estria = np.asarray(Image.fromarray(estria).resize((W, H), Image.BICUBIC))
    luz = 0.18 + 0.82 * (1 - u) ** 1.4 + luz_borde * suave(0.86, 1.0, u)
    v = luz * (0.72 + 0.42 * estria) * (0.85 + 0.3 * veta)
    col = rampa(v, colores)
    if musgo_col is not None and musgo > 0:
        m = fbm(W, H, 26, semilla + 13, 3)
        mascara = suave(0.5 - musgo * 0.2, 0.85 - musgo * 0.2, m) * suave(0.7, 0.15, u)
        mascara *= (0.55 + 0.45 * suave(0.05, 0.4, t)) * 0.35
        verde = rampa(0.35 + 0.65 * (1 - u) * (0.7 + 0.5 * m), musgo_col)
        col = col * (1 - mascara[..., None]) + verde * mascara[..., None]
    tira.pegar(X0, Y0, col, alfa)
    return cx, margen, X0, Y0


def ramas(tira, x, y, ang, largo, grosor, prof, rng, color, puntas, ss=2):
    """Ramas recursivas pintadas como trazos que se afinan; deja las puntas."""
    segs = []
    def rec(x, y, ang, largo, grosor, prof):
        x2, y2 = x + np.cos(ang) * largo, y + np.sin(ang) * largo
        segs.append((x, y, x2, y2, grosor))
        if prof <= 1:
            puntas.append((x2, y2))
            return
        for _ in range(2 + (rng.random() < 0.35)):
            rec(x2, y2, ang + (rng.random() - 0.5) * 1.1, largo * (0.6 + rng.random() * 0.2), grosor * 0.62, prof - 1)
    rec(x, y, ang, largo, grosor, prof)
    xs = [s[0] for s in segs] + [s[2] for s in segs]
    ys = [s[1] for s in segs] + [s[3] for s in segs]
    X0, Y0 = int(min(xs) - grosor - 4), int(min(ys) - grosor - 4)
    W, H = int(max(xs) - X0 + grosor + 8), int(max(ys) - Y0 + grosor + 8)
    def dib(d, s):
        for (a, b, c, e, g) in segs:
            d.line([((a - X0) * s, (b - Y0) * s), ((c - X0) * s, (e - Y0) * s)], width=max(1, int(g * s)), joint='curve')
            r = g * s / 2
            d.ellipse([(c - X0) * s - r, (e - Y0) * s - r, (c - X0) * s + r, (e - Y0) * s + r], fill=255)
    m = mascara_trazos(W, H, dib, ss)
    col = np.broadcast_to(rgb(color), (H, W, 3)).copy()
    yy = np.mgrid[0:H, 0:W][0].astype(np.float32)
    col *= (0.8 + 0.4 * (1 - yy / max(1, H)))[..., None]
    tira.pegar(X0, Y0, col, m)


def follaje(tira, puntas, radio, rng, colores, densidad=14, luz=(-0.7, -0.7), ss=2):
    """
    Masas de hojas alrededor de las puntas: muchas hojas pequeñas, más claras
    hacia el lado de la luz (arriba a la izquierda), con transparencia variable.
    """
    if not puntas:
        return
    xs = [p[0] for p in puntas]; ys = [p[1] for p in puntas]
    X0, Y0 = int(min(xs) - radio * 2), int(min(ys) - radio * 2)
    W, H = int(max(xs) - X0 + radio * 2), int(max(ys) - Y0 + radio * 2)
    im = Image.new('RGBA', (W * ss, H * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(im, 'RGBA')
    hojas = []
    for (px, py) in puntas:
        for _ in range(densidad):
            a = rng.random() * 2 * np.pi
            r = radio * np.sqrt(rng.random()) * 1.25
            hx, hy = px + np.cos(a) * r, py + np.sin(a) * r * 0.75
            luzv = 0.5 + 0.5 * (-(np.cos(a) * luz[0] + np.sin(a) * luz[1])) * (r / (radio * 1.25))
            hojas.append((hy, hx, luzv, rng.random()))
    hojas.sort()                                     # las de abajo primero
    for hy, hx, luzv, k in hojas:
        c = rampa(np.array(np.clip(luzv * 0.85 + k * 0.2, 0, 1)), colores)
        al = int(255 * (0.55 + 0.45 * k))
        rx, ry = radio * (0.16 + 0.12 * k), radio * (0.08 + 0.06 * k)
        cx, cy = (hx - X0) * ss, (hy - Y0) * ss
        ang = k * np.pi
        # Hoja: un óvalo alargado y girado (con punta salían medialunas).
        pts = []
        for t in np.linspace(0, 2 * np.pi, 14)[:-1]:
            lx, ly = np.cos(t) * rx, np.sin(t) * ry
            pts.append((cx + (lx * np.cos(ang) - ly * np.sin(ang)) * ss,
                        cy + (lx * np.sin(ang) + ly * np.cos(ang)) * ss))
        d.polygon(pts, fill=tuple(int(v * 255) for v in c) + (al,))
    im = im.resize((W, H), Image.LANCZOS)
    tira.pegar_imagen(X0, Y0, im)


def brillo(tira, x, y, radio, color, fuerza):
    """Halo de luz (hongos, faroles): un degradado radial semitransparente."""
    R = int(radio)
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1].astype(np.float32)
    d = np.sqrt(xx ** 2 + yy ** 2) / R
    a = np.clip(1 - d, 0, 1) ** 2.2 * fuerza
    col = np.broadcast_to(rgb(color), a.shape + (3,))
    tira.pegar(int(x - R), int(y - R), col, a)


def aguja(tira, x, base, alto, ancho, semilla, colores, cresta=0.0, filo=0.2):
    """
    Aguja de roca: silueta irregular con una arista que separa una cara
    iluminada (izquierda, hacia la luna) de otra en sombra. `cresta` desplaza
    la arista; `filo` es la luz extra en el borde iluminado.
    """
    rng = np.random.default_rng(semilla)
    n = 14
    izq, der = [], []
    for k in range(n + 1):
        t = k / n
        w = ancho * (1 - t) ** 0.9 * (0.75 + 0.5 * rng.random())
        y = base - alto * t
        izq.append((x - w / 2 + (rng.random() - 0.5) * ancho * 0.08, y))
        der.append((x + w / 2 + (rng.random() - 0.5) * ancho * 0.08, y))
    cima = (x + (rng.random() - 0.5) * ancho * 0.2, base - alto * 1.02)
    pts = izq + [cima] + der[::-1]
    X0, Y0 = int(x - ancho), int(base - alto * 1.05)
    W, H = int(ancho * 2), int(alto * 1.05) + 4
    m = mascara_trazos(W, H, lambda d, s: d.polygon([((px - X0) * s, (py - Y0) * s) for px, py in pts], fill=255))
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    arista = (x - X0) + cresta * ancho + (yy - H) * 0.05
    cara_luz = xx < arista
    tex = fbm(W, H, 16, semilla + 3, 4)
    estratos = ruido(W, max(2, H // 10), 8, semilla + 5)
    estratos = np.asarray(Image.fromarray(estratos).resize((W, H), Image.BICUBIC))
    v = np.where(cara_luz, 0.62, 0.28) + 0.22 * (tex - 0.5) + 0.12 * (estratos - 0.5)
    v += filo * suave(6, 0, np.abs(xx - arista)) * 0.0
    v = v + 0.15 * (1 - yy / H)                       # algo más claro arriba
    tira.pegar(X0, Y0, rampa(v, colores), m)


def cristal(tira, x, base, alto, ancho, ang, semilla, colores, brillo_col=None):
    """
    Cristal facetado: prisma alargado y apuntado, con dos caras (una clara, una
    oscura), una arista brillante y un poco de luz interior.
    """
    rng = np.random.default_rng(semilla)
    ca, sa = np.cos(ang), np.sin(ang)
    def p(u, v):               # u a lo largo (0 base, 1 punta), v a lo ancho (-.5,.5)
        lx, ly = v * ancho, -u * alto
        return (x + lx * ca - ly * sa, base + lx * sa + ly * ca)
    punta = 0.82
    caras = [
        ([p(0, -0.5), p(punta, -0.5), p(1, 0), p(punta, 0.0), p(0, 0.0)], 0.6),
        ([p(0, 0.0), p(punta, 0.0), p(1, 0), p(punta, 0.5), p(0, 0.5)], 0.25),
    ]
    todos = [q for cara, _ in caras for q in cara]
    X0, Y0 = int(min(q[0] for q in todos) - 4), int(min(q[1] for q in todos) - 4)
    W, H = int(max(q[0] for q in todos) - X0 + 8), int(max(q[1] for q in todos) - Y0 + 8)
    for cara, luz in caras:
        m = mascara_trazos(W, H, lambda d, s, c=cara: d.polygon([((a - X0) * s, (b - Y0) * s) for a, b in c], fill=255))
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        tex = ruido(W, H, 7, int(rng.integers(1e6)))
        # Más oscuro en la base y más claro en la punta, como luz atravesándolo.
        v = luz * 0.7 + 0.35 * (1 - yy / H) + 0.08 * (tex - 0.5)
        tira.pegar(X0, Y0, rampa(v, colores), m * 0.82)
    # Arista central brillante.
    a, b = p(0.05, 0.0), p(0.97, 0.0)
    m = mascara_trazos(W, H, lambda d, s: d.line([((a[0] - X0) * s, (a[1] - Y0) * s), ((b[0] - X0) * s, (b[1] - Y0) * s)], fill=255, width=max(1, int(2 * s))))
    tira.pegar(X0, Y0, np.broadcast_to(rgb(colores[-1]), (H, W, 3)).copy(), m * 0.8)
    if brillo_col:
        cx, cy = p(0.5, 0.0)
        brillo(tira, cx, cy, ancho * 1.6, brillo_col, 0.25)


def copa_redonda(tira, cx, cy, rx, ry, semilla, colores, luz=(-0.6, -0.8), borde=None):
    """
    Masa de follaje redondeada (estilo ilustrado): varios bultos superpuestos,
    cada uno con luz desde arriba a la izquierda y un filo de luz en el borde.
    """
    rng = np.random.default_rng(semilla)
    bultos = [(cx + rng.normal(0, rx * 0.4), cy + rng.normal(0, ry * 0.32),
               rx * rng.uniform(0.3, 0.55), ry * rng.uniform(0.3, 0.55)) for _ in range(13)]
    bultos.sort(key=lambda b: b[1])
    for (bx, by, brx, bry) in bultos:
        X0, Y0 = int(bx - brx - 2), int(by - bry - 2)
        W, H = int(brx * 2 + 4), int(bry * 2 + 4)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        dx, dy = (xx - brx - 2) / brx, (yy - bry - 2) / bry
        r = np.sqrt(dx ** 2 + dy ** 2)
        borde_ruido = 1 + 0.32 * (fbm(W, H, 6, int(rng.integers(1e6)), 3) - 0.5)
        alfa = np.clip((borde_ruido - r) * brx / 2, 0, 1)
        iluminado = np.clip(-(dx * luz[0] + dy * luz[1]) * 0.5 + 0.5, 0, 1)
        tex = fbm(W, H, 4, int(rng.integers(1e6)), 3)
        v = 0.1 + 0.55 * iluminado ** 1.3 + 0.32 * (tex - 0.5)
        col = rampa(v, colores)
        if borde:
            filo = suave(0.78, 1.0, r) * suave(0.55, 0.95, iluminado) * (0.5 + tex)
            filo = np.clip(filo, 0, 1)
            col = col * (1 - filo[..., None] * 0.55) + rgb(borde) * filo[..., None] * 0.55
        tira.pegar(X0, Y0, col, alfa)
