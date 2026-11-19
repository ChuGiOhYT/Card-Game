"""Ícono y pantalla de arranque de la APK, a partir del ícono del .exe.

    python movil/iconos.py

Toma el cuadro más grande de build/icon.ico y deja:
  - mipmap-*/ic_launcher.png y ic_launcher_round.png (íconos clásicos),
  - mipmap-*/ic_launcher_foreground.png (ícono adaptativo, con margen seguro),
  - drawable*/splash.png: fondo oscuro de la mesa con el ícono en el centro
    (sustituye el logo de Capacitor), del mismo tamaño que el que había.
"""
from pathlib import Path

from PIL import Image, ImageDraw

AQUI = Path(__file__).resolve().parent
RAIZ = AQUI.parent
RES = AQUI / 'android' / 'app' / 'src' / 'main' / 'res'
FONDO = (11, 13, 23)  # #0b0d17, el fondo del juego

CLASICO = {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}
ADAPTATIVO = {'mdpi': 108, 'hdpi': 162, 'xhdpi': 216, 'xxhdpi': 324, 'xxxhdpi': 432}


def icono_base() -> Image.Image:
    ico = Image.open(RAIZ / 'build' / 'icon.ico')
    mejor = max(ico.ico.sizes(), key=lambda s: s[0] * s[1])
    ico.size = mejor
    return ico.convert('RGBA')


def sobre_fondo(icono: Image.Image, lado: int, escala: float, redondo: bool = False) -> Image.Image:
    lienzo = Image.new('RGBA', (lado, lado), FONDO + (255,))
    t = int(lado * escala)
    pieza = icono.resize((t, t), Image.LANCZOS)
    lienzo.alpha_composite(pieza, ((lado - t) // 2, (lado - t) // 2))
    if redondo:
        mascara = Image.new('L', (lado, lado), 0)
        ImageDraw.Draw(mascara).ellipse((0, 0, lado - 1, lado - 1), fill=255)
        lienzo.putalpha(mascara)
    return lienzo


def main() -> None:
    icono = icono_base()
    for dens, lado in CLASICO.items():
        d = RES / f'mipmap-{dens}'
        sobre_fondo(icono, lado, 0.92).save(d / 'ic_launcher.png')
        sobre_fondo(icono, lado, 0.80, redondo=True).save(d / 'ic_launcher_round.png')
    for dens, lado in ADAPTATIVO.items():
        # El sistema recorta el adaptativo: el dibujo va en el 61 % central.
        fg = Image.new('RGBA', (lado, lado), (0, 0, 0, 0))
        t = int(lado * 0.61)
        fg.alpha_composite(icono.resize((t, t), Image.LANCZOS), ((lado - t) // 2, (lado - t) // 2))
        fg.save(RES / f'mipmap-{dens}' / 'ic_launcher_foreground.png')
    (RES / 'values' / 'ic_launcher_background.xml').write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#0B0D17</color>\n</resources>\n', 'utf-8')
    for splash in RES.glob('drawable*/splash.png'):
        w, h = Image.open(splash).size
        lienzo = Image.new('RGB', (w, h), FONDO)
        t = int(min(w, h) * 0.38)
        pieza = icono.resize((t, t), Image.LANCZOS)
        lienzo.paste(pieza, ((w - t) // 2, (h - t) // 2), pieza)
        lienzo.save(splash)
    print('Íconos y pantallas de arranque listos.')


if __name__ == '__main__':
    main()
