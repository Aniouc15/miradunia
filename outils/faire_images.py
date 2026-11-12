"""Dessine, à partir du logo (outils/logo.svg, dessiné par ChatGPT le 12/11/2026 : un globe vu à la loupe) :
- site/icone.svg (favicon, coins arrondis), site/favicon.ico, site/icone-180.png, icone-192.png, icone-512.png ;
- les images de partage (1200 x 630) : site/partage.png en français et site/partage-<code>.png pour chaque autre langue.

Les images sont dessinées par le navigateur Edge sans fenêtre (il sait afficher le SVG et écrire l'arabe de droite
à gauche). Le logo de l'en-tête des pages vient du même fichier (construire_site.py).

Usage : python outils/faire_images.py
"""
import html
import json
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

RACINE = Path(__file__).resolve().parent.parent
SITE = RACINE / "site"
LANGUES = RACINE / "outils" / "langues"
LOGO = RACINE / "outils" / "logo.svg"
EDGE = [Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
        Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe")]


def logo(arrondi=0, taille=None, aria=False):
    """Code SVG du logo ; arrondi = rayon des coins du fond (sur 512)."""
    svg = LOGO.read_text(encoding="utf-8").strip()
    if arrondi:
        svg = svg.replace('<rect width="512" height="512"', '<rect width="512" height="512" rx="%d"' % arrondi, 1)
    if taille:
        svg = svg.replace("<svg ", '<svg width="%d" height="%d" ' % (taille, taille), 1)
    if aria:
        svg = svg.replace("<svg ", '<svg aria-hidden="true" ', 1)
    return svg


def photographier(page, cible, largeur, hauteur):
    edge = next((chemin for chemin in EDGE if chemin.exists()), None)
    if edge is None:
        raise SystemExit("Edge introuvable : images non dessinées")
    dossier = Path(tempfile.mkdtemp(prefix="miradunia-"))
    try:
        source = dossier / "page.html"
        source.write_text(page, encoding="utf-8")
        subprocess.run([str(edge), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
                        "--window-size=%d,%d" % (largeur, hauteur), "--screenshot=" + str(cible), source.as_uri()],
                       check=True, capture_output=True, timeout=120)
        Image.open(cible).convert("RGB").crop((0, 0, largeur, hauteur)).save(cible, optimize=True)
    finally:
        shutil.rmtree(dossier, ignore_errors=True)


def icones():
    (SITE / "icone.svg").write_text(logo(arrondi=112) + "\n", encoding="utf-8")
    page = '<!doctype html><html><body style="margin:0;overflow:hidden">%s</body></html>' % logo(taille=512)
    grande = SITE / "icone-512.png"
    photographier(page, grande, 512, 512)
    image = Image.open(grande)
    for taille in (180, 192):
        image.resize((taille, taille), Image.LANCZOS).save(SITE / ("icone-%d.png" % taille), optimize=True)
    image.save(SITE / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("écrit : icone.svg, favicon.ico, icone-180.png, icone-192.png, icone-512.png")


MODELE = """<!doctype html><html lang="{code}" dir="{dir}"><head><meta charset="utf-8"><style>
html, body {{ margin: 0; width: 1200px; height: 630px; overflow: hidden; background: #f5efe3; color: #1f2a2e; }}
body {{ position: relative; font-family: "Segoe UI", Tahoma, system-ui, sans-serif; }}
.marque {{ position: absolute; top: 58px; inset-inline-start: 64px; display: flex; align-items: center; gap: 22px;
  color: #0f6b6b; font: 700 76px Georgia, "Segoe UI", serif; }}
.marque span {{ direction: ltr; unicode-bidi: isolate; }}
.titre {{ position: absolute; top: 186px; inset-inline-start: 64px; width: 650px; font: 700 56px/1.18 Georgia, "Segoe UI", serif; }}
.sous {{ position: absolute; top: 350px; inset-inline-start: 66px; width: 650px; font: 400 30px/1.4 "Segoe UI", Tahoma, sans-serif; }}
.grand {{ position: absolute; top: 90px; inset-inline-end: 70px; }}
.carres {{ position: absolute; bottom: 60px; inset-inline-end: 126px; display: flex; gap: 16px; }}
.carres i {{ display: block; width: 64px; height: 64px; border-radius: 12px; }}
</style></head><body>
<div class="marque">{petit}<span>{marque}</span></div>
<div class="titre">{titre}</div>
<div class="sous">{sous}</div>
<div class="grand">{grand}</div>
<div class="carres"><i style="background:#3aa36a"></i><i style="background:#2b2f33"></i><i style="background:#3aa36a"></i></div>
</body></html>"""


def partages(marque):
    for langue in json.loads((LANGUES / "langues.json").read_text(encoding="utf-8")):
        code = langue["code"]
        chemin = LANGUES / ("ui.fr.json" if code == "fr" else code + ".json")
        if not chemin.exists():
            continue
        donnees = json.loads(chemin.read_text(encoding="utf-8"))
        ui = donnees if code == "fr" else donnees.get("ui", {})
        if "statique.titre" not in ui or "meta.partage" not in ui:
            continue
        page = MODELE.format(code=code, dir=langue["dir"], marque=html.escape(marque), titre=html.escape(ui["statique.titre"]),
                             sous=html.escape(ui["meta.partage"]), petit=logo(arrondi=112, taille=96),
                             grand=logo(arrondi=96, taille=340))
        cible = SITE / ("partage.png" if code == "fr" else "partage-%s.png" % code)
        photographier(page, cible, 1200, 630)
        print("écrit :", cible.name)


if __name__ == "__main__":
    marque = json.loads((RACINE / "outils" / "site.json").read_text(encoding="utf-8"))["marque"]
    icones()
    partages(marque)
    print("Images écrites dans", SITE)
