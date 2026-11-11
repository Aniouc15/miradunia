"""Dessine l'image de partage (1200 x 630) et les icônes PNG.

Usage : python outils/faire_images.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RACINE = Path(__file__).resolve().parent.parent
SITE = RACINE / "site"
FOND, ENCRE, ACCENT, AMBRE, PAPIER = "#f5efe3", "#1f2a2e", "#0f6b6b", "#d98a1f", "#fffdf8"


def police(taille, gras=True):
    for nom in (("georgiab.ttf", "georgia.ttf") if gras else ("segoeui.ttf", "arial.ttf")):
        try:
            return ImageFont.truetype(nom, taille)
        except OSError:
            continue
    return ImageFont.load_default()


def globe(dessin, cx, cy, r, trait, epaisseur):
    dessin.ellipse((cx - r, cy - r, cx + r, cy + r), outline=trait, width=epaisseur)
    dessin.line((cx - r, cy, cx + r, cy), fill=trait, width=max(2, epaisseur - 1))
    dessin.ellipse((cx - r * 0.45, cy - r, cx + r * 0.45, cy + r), outline=trait, width=max(2, epaisseur - 1))
    p = r * 0.28
    dessin.ellipse((cx + r * 0.42 - p, cy - r * 0.42 - p, cx + r * 0.42 + p, cy - r * 0.42 + p), fill=AMBRE)


def partage():
    image = Image.new("RGB", (1200, 630), FOND)
    dessin = ImageDraw.Draw(image)
    globe(dessin, 110, 112, 46, ACCENT, 7)
    dessin.text((178, 70), "GlobeCurios", font=police(78), fill=ACCENT)
    dessin.text((64, 196), "Le tour du monde", font=police(60), fill=ENCRE)
    dessin.text((64, 268), "en 3 curiosités par jour", font=police(60), fill=ENCRE)
    dessin.text((66, 362), "Un plat, un monument, une fête, un instrument…", font=police(32, False), fill=ENCRE)
    dessin.text((66, 406), "D'où viennent-ils ?", font=police(32, False), fill=ENCRE)
    dessin.rounded_rectangle((64, 492, 520, 570), 18, fill=ACCENT)
    dessin.text((96, 510), "Un défi gratuit par jour", font=police(34, False), fill="white")
    # Grand globe à droite, avec trois carrés de score. Pas de photo : elles demanderaient un crédit sur l'image.
    globe(dessin, 960, 280, 170, ACCENT, 14)
    for n, couleur in enumerate(("#3aa36a", "#e0b23c", "#3aa36a")):
        dessin.rounded_rectangle((846 + n * 80, 492, 846 + n * 80 + 64, 556), 12, fill=couleur)
    image.save(SITE / "partage.png", optimize=True)


def icone(taille, nom):
    image = Image.new("RGB", (taille * 4, taille * 4), ACCENT)
    dessin = ImageDraw.Draw(image)
    globe(dessin, taille * 2, taille * 2, taille * 1.25, FOND, taille // 5)
    image.resize((taille, taille), Image.LANCZOS).save(SITE / nom, optimize=True)


partage()
icone(180, "icone-180.png")
icone(192, "icone-192.png")
icone(512, "icone-512.png")
print("partage.png et icônes écrits dans", SITE)
