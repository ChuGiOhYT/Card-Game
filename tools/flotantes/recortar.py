"""
Recorta la lámina de figuras de Oscar (fondo gris liso) en retratos flotantes
PNG con transparencia: src/assets/personajes-flotantes/<id>-flotante.png.

    python tools/flotantes/recortar.py              # todas las láminas
    python tools/flotantes/recortar.py lamina.webp  # solo esa

- Alfa por DISTANCIA al gris del fondo (rampa suave), y el color se «des-grisa»
  (C = (I - (1-a)·G) / a): así el halo de Lyla y las chispas quedan como luz y
  no como un borde gris.
- Solo se vuelve transparente el fondo CONECTADO al borde de la lámina (relleno
  desde fuera): la armadura gris de Yun se parece al gris del fondo y, por
  distancia sola, quedaba agujereada.
- Las figuras se separan por COMPONENTES CONEXAS (cada una va a la figura cuyo
  centro le queda más cerca), no por cajas: Tilos roza a Yrving y a Lyla.
"""
import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / 'src/assets/personajes-flotantes'

# Centro aproximado (x, y) de cada figura en cada lámina.
LAMINAS = {
    'lamina-mercenarios.jpg': {  # 896×1200
        'mas_lis': (130, 170),
        'mas_chispa': (470, 230),
        'mas_ceniza': (760, 230),
        # Oscar: Yrving y Tilos cortados por las rodillas, para que se vean más
        # grandes (tercer valor: fracción del alto que se conserva).
        'mer_yrving': (165, 800, 0.72),
        'mer_tilos': (450, 800, 0.72),
        'mer_lyla': (735, 760),
    },
    'lamina-mercenarios-2.webp': {  # 765×1024
        'mer_zhin': (230, 270),
        'mer_errante': (520, 520),
        'mer_yun': (215, 820),
    },
}
ALTO_MAX = 620
D0, D1 = 14.0, 46.0  # rampa del alfa por distancia al gris


def componentes(mask):
    alto, ancho = mask.shape
    etiqueta = np.zeros(mask.shape, np.int32)
    n = 0
    ys, xs = np.nonzero(mask)
    for y, x in zip(ys, xs):
        if etiqueta[y, x]:
            continue
        n += 1
        etiqueta[y, x] = n
        cola = deque([(y, x)])
        while cola:
            cy, cx = cola.popleft()
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < alto and 0 <= nx < ancho and mask[ny, nx] and not etiqueta[ny, nx]:
                    etiqueta[ny, nx] = n
                    cola.append((ny, nx))
    return etiqueta, n


def fondo_conectado(cerca, semillas):
    """Píxeles `cerca` del gris alcanzables desde el borde o desde `semillas`."""
    alto, ancho = cerca.shape
    visto = semillas & cerca
    cola = deque(zip(*np.nonzero(visto)))
    for y in range(alto):
        for x in (0, ancho - 1):
            if cerca[y, x] and not visto[y, x]:
                visto[y, x] = True; cola.append((y, x))
    for x in range(ancho):
        for y in (0, alto - 1):
            if cerca[y, x] and not visto[y, x]:
                visto[y, x] = True; cola.append((y, x))
    while cola:
        cy, cx = cola.popleft()
        for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
            if 0 <= ny < alto and 0 <= nx < ancho and cerca[ny, nx] and not visto[ny, nx]:
                visto[ny, nx] = True; cola.append((ny, nx))
    return visto


def recortar(lamina, FIGURAS):
    img = np.asarray(Image.open(lamina).convert('RGB')).astype(np.float32)
    borde = np.concatenate([img[:4].reshape(-1, 3), img[-4:].reshape(-1, 3), img[:, :4].reshape(-1, 3)])
    gris = np.median(borde, axis=0)
    d = np.sqrt(((img - gris) ** 2).sum(2))
    alfa = np.clip((d - D0) / (D1 - D0), 0, 1)
    # Lo parecido al gris pero encerrado dentro de una figura no es fondo…
    # salvo los huecos de gris EXACTO y de buen tamaño (entre los tentáculos
    # de Errante): el fondo es liso; una armadura gris nunca lo es tanto.
    exacto, k = componentes(d < 8)
    tam = np.bincount(exacto.ravel(), minlength=k + 1)
    huecos = (tam > 150)[exacto] & (exacto > 0)
    alfa = np.where(fondo_conectado(alfa < 1, huecos), alfa, 1.0)

    etiqueta, n = componentes(alfa > 0)
    print(f'gris {gris.round()}, {n} componentes')
    # Cada componente, a la figura más cercana (por su centroide).
    ys, xs = np.nonzero(etiqueta)
    lab = etiqueta[ys, xs]
    sy = np.bincount(lab, ys, n + 1)
    sx = np.bincount(lab, xs, n + 1)
    cnt = np.bincount(lab, minlength=n + 1)
    ids = list(FIGURAS)
    centros = np.array([FIGURAS[i][:2] for i in ids], np.float32)
    duenio = np.zeros(n + 1, np.int32) - 1
    for k in range(1, n + 1):
        cy, cx = sy[k] / cnt[k], sx[k] / cnt[k]
        duenio[k] = int(np.argmin(((centros[:, 0] - cx) ** 2 + (centros[:, 1] - cy) ** 2)))
    # Las motas sueltas (chispas, luciérnagas) van con la figura cuyo CUERPO
    # (su componente mayor) les queda más cerca, no su centro: una luciérnaga
    # de Lyla caía del lado de Tilos.
    cajas = []
    for i in range(len(ids)):
        suyas = np.nonzero(duenio == i)[0]
        mayor = suyas[np.argmax(cnt[suyas])]
        sel = lab == mayor
        cajas.append((xs[sel].min(), xs[sel].max(), ys[sel].min(), ys[sel].max()))
    for k in range(1, n + 1):
        if cnt[k] >= 300:
            continue
        cy, cx = sy[k] / cnt[k], sx[k] / cnt[k]
        dist = [max(x0 - cx, 0, cx - x1) ** 2 + max(y0 - cy, 0, cy - y1) ** 2 for x0, x1, y0, y1 in cajas]
        duenio[k] = int(np.argmin(dist))

    a = alfa[..., None]
    color = np.where(a > 0, (img - (1 - a) * gris) / np.maximum(a, 1e-3), 0)
    color = np.clip(color, 0, 255)
    rgba = np.dstack([color, alfa * 255]).astype(np.uint8)

    SALIDA.mkdir(parents=True, exist_ok=True)
    for i, pid in enumerate(ids):
        suya = duenio[etiqueta] == i
        suya &= etiqueta > 0
        yy, xx = np.nonzero(suya)
        y0, y1, x0, x1 = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
        trozo = rgba[y0:y1, x0:x1].copy()
        trozo[..., 3] = np.where(suya[y0:y1, x0:x1], trozo[..., 3], 0)
        if len(FIGURAS[pid]) > 2:
            # Corte por las rodillas, con un fundido corto para que no sea seco.
            alto = round(trozo.shape[0] * FIGURAS[pid][2])
            trozo = trozo[:alto]
            fundido = min(28, alto // 10)
            rampa = np.linspace(1, 0, fundido)[:, None]
            trozo[-fundido:, :, 3] = (trozo[-fundido:, :, 3] * rampa).astype(np.uint8)
            cols = np.nonzero(trozo[..., 3].max(0) > 0)[0]
            trozo = trozo[:, cols.min():cols.max() + 1]
        im = Image.fromarray(trozo, 'RGBA')
        if im.height > ALTO_MAX:
            im = im.resize((round(im.width * ALTO_MAX / im.height), ALTO_MAX), Image.LANCZOS)
        ruta = SALIDA / f'{pid}-flotante.png'
        im.save(ruta, optimize=True)
        print(f'{pid}: {im.size} -> {ruta.name}')


def main():
    aqui = Path(__file__).parent
    nombres = [Path(a).name for a in sys.argv[1:]] or list(LAMINAS)
    for nombre in nombres:
        print(f'== {nombre}')
        recortar(aqui / nombre, LAMINAS[nombre])


if __name__ == '__main__':
    main()
