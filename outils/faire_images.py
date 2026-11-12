"""Dessine les icônes PNG, l'image de partage française (site/partage.png) et une image de partage par autre langue
traduite (site/partage-<code>.png, 1200 x 630).

Les images des autres langues sont dessinées par le navigateur Edge sans fenêtre (il sait écrire l'arabe de droite
à gauche, ce que Pillow ne fait pas sans bibliothèques supplémentaires). Sans Edge, elles sont simplement sautées.

Usage : python outils/faire_images.py
"""
import html
import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RACINE = Path(__file__).resolve().parent.parent
SITE = RACINE / "site"
LANGUES = RACINE / "outils" / "langues"
FOND, ENCRE, ACCENT, AMBRE, PAPIER = "#f5efe3", "#1f2a2e", "#0f6b6b", "#d98a1f", "#fffdf8"
EDGE = [Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe")]


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


def partage_francais(marque):
    image = Image.new("RGB", (1200, 630), FOND)
    dessin = ImageDraw.Draw(image)
    globe(dessin, 110, 112, 46, ACCENT, 7)
    dessin.text((178, 70), marque, font=police(78), fill=ACCENT)
    dessin.text((64, 196), "Le tour du monde", font=police(60), fill=ENCRE)
    dessin.text((64, 268), "en 3 curiosités par jour", font=police(60), fill=ENCRE)
    dessin.text((66, 362), "Un plat, un monument, une fête, un instrument…", font=police(32, False), fill=ENCRE)
    dessin.text((66, 406), "À quel pays les rattacher ?", font=police(32, False), fill=ENCRE)
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


GLOBE_SVG = ('<svg viewBox="0 0 64 64" width="{t}" height="{t}" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="none" '
             'stroke="#0f6b6b" stroke-width="{e}"/><path d="M4 32h56M32 4c-14 14-14 42 0 56M32 4c14 14 14 42 0 56" fill="none" '
             'stroke="#0f6b6b" stroke-width="{e2}"/><circle cx="43" cy="22" r="6" fill="#d98a1f"/></svg>')
MODELE = """<!doctype html><html lang="{code}" dir="{dir}"><head><meta charset="utf-8"><style>
html, body {{ margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #f5efe3; color: #1f2a2e; }}
body {{ position: relative; font-family: "Segoe UI", Tahoma, system-ui, sans-serif; }}
.marque {{ position: absolute; top: 58px; inset-inline-start: 64px; display: flex; align-items: center; gap: 22px;
  color: #0f6b6b; font: 700 76px Georgia, "Segoe UI", serif; }}
.marque span {{ direction: ltr; unicode-bidi: isolate; }}
.titre {{ position: absolute; top: 186px; inset-inline-start: 64px; width: 650px; font: 700 56px/1.18 Georgia, "Segoe UI", serif; }}
.sous {{ position: absolute; top: 350px; inset-inline-start: 66px; width: 650px; font: 400 30px/1.4 "Segoe UI", Tahoma, sans-serif; }}
.globe {{ position: absolute; top: 96px; inset-inline-end: 70px; }}
.carres {{ position: absolute; bottom: 74px; inset-inline-end: 126px; display: flex; gap: 16px; }}
.carres i {{ display: block; width: 64px; height: 64px; border-radius: 12px; }}
</style></head><body>
<div class="marque">{petit_globe}<span>{marque}</span></div>
<div class="titre">{titre}</div>
<div class="sous">{sous}</div>
<div class="globe">{grand_globe}</div>
<div class="carres"><i style="background:#3aa36a"></i><i style="background:#e0b23c"></i><i style="background:#3aa36a"></i></div>
</body></html>"""


def partages_traduits(marque):
    edge = next((chemin for chemin in EDGE if chemin.exists()), None)
    if edge is None:
        print("Edge introuvable : images de partage des autres langues non dessinées")
        return
    for langue in json.loads((LANGUES / "langues.json").read_text(encoding="utf-8")):
        code = langue["code"]
        chemin = LANGUES / (code + ".json")
        if code == "fr" or not chemin.exists():
            continue
        ui = json.loads(chemin.read_text(encoding="utf-8")).get("ui", {})
        if "statique.titre" not in ui or "meta.partage" not in ui:
            continue
        page = MODELE.format(code=code, dir=langue["dir"], marque=html.escape(marque), titre=html.escape(ui["statique.titre"]),
                             sous=html.escape(ui["meta.partage"]),
                             petit_globe=GLOBE_SVG.format(t=92, e=4, e2=3), grand_globe=GLOBE_SVG.format(t=360, e=3, e2=2))
        dossier = Path(tempfile.mkdtemp(prefix="partage-"))
        try:
            source = dossier / "partage.html"
            source.write_text(page, encoding="utf-8")
            cible = SITE / ("partage-%s.png" % code)
            subprocess.run([str(edge), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                            "--window-size=1200,630", "--screenshot=" + str(cible), source.as_uri()],
                           check=True, capture_output=True, timeout=120)
            image = Image.open(cible).convert("RGB")
            image.crop((0, 0, 1200, 630)).save(cible, optimize=True)
            print("écrit :", cible.name)
        finally:
            shutil.rmtree(dossier, ignore_errors=True)


if __name__ == "__main__":
    marque = json.loads((RACINE / "outils" / "site.json").read_text(encoding="utf-8"))["marque"]
    partage_francais(marque)
    icone(180, "icone-180.png")
    icone(192, "icone-192.png")
    icone(512, "icone-512.png")
    partages_traduits(marque)
    print("Images écrites dans", SITE)
