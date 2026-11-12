"""Contrôle des photos d'une tranche, à lancer après construire_donnees.py.

  python outils/ajout/etape_photos.py <tranche> planches   -> travail/tranche_NN/planches/planche_NNN.png et .txt
      (20 vignettes par planche, avec les alertes d'un contrôle automatique : nom de fichier Commons révélateur,
      aplats, peu de couleurs, noir et blanc, fond blanc, petite image) ; un agent par groupe de planches suit
      consigne_photos.md et écrit photos_vu_NN.json
  python outils/ajout/etape_photos.py <tranche> second     -> photos_a_revoir.md : vignettes signalées, pour le second
      contrôle en grand (consigne_photos2.md, sortie photos_decisions.json)
  python outils/ajout/etape_photos.py <tranche> retirer    -> retire de curiosites.json les curiosités dont la photo
      est refusée (decision « retirer », ou verdict « mauvais » sans second avis)
"""
import glob, json, re, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from commun import dossier, lire, ecrire_json, lire_source, ecrire_source, RACINE, DONNEES

tranche, action = int(sys.argv[1]), sys.argv[2]
D = dossier(tranche)
TRACES = RACINE / "outils" / "traces"
MOTS = re.compile(r"\b(map|maps|carte|karte|mapa|locator|location|localisation|logo|flag|drapeau|bandera|bandeira|"
                  r"coat[ _-]of[ _-]arms|blason|wappen|escudo|emblem|seal|sceau|plan|diagram|diagramme|schema|schéma|"
                  r"stamp|timbre|banknote|billet|poster|affiche|icon|icone|symbol|screenshot|chart|graph|"
                  r"drawing|dessin|engraving|gravure|lithograph|illustration|postcard|painting|peinture|"
                  r"satellite|nasa|landsat|sentinel|relief|topographic|label|etiquette|package|packaging|menu|sign|panneau)\b", re.I)


def alertes(chemin, fichier):
    raisons = []
    if fichier.lower().endswith((".svg", ".png", ".gif", ".tif", ".tiff")):
        raisons.append("fichier " + fichier.rsplit(".", 1)[-1].lower())
    m = MOTS.search(fichier.replace("_", " "))
    if m:
        raisons.append("nom : " + m.group(0))
    image = Image.open(chemin).convert("RGB")
    pixels = list(image.resize((96, 72)).getdata())
    compte = {}
    for r, g, b in pixels:
        compte[(r // 16, g // 16, b // 16)] = compte.get((r // 16, g // 16, b // 16), 0) + 1
    if max(compte.values()) / len(pixels) >= 0.30:
        raisons.append("aplat")
    if len(compte) < 120:
        raisons.append("peu de couleurs")
    if sum(1 for r, g, b in pixels if max(r, g, b) - min(r, g, b) < 12) / len(pixels) >= 0.92:
        raisons.append("noir et blanc")
    if sum(1 for r, g, b in pixels if min(r, g, b) > 235) / len(pixels) >= 0.35:
        raisons.append("fond blanc")
    if min(image.size) < 200:
        raisons.append("petite %dx%d" % image.size)
    return raisons


source = lire_source()
nouveaux = set(lire(D / "nouveaux.json"))
img = {i["id"]: RACINE / "site" / i["img"] for i in lire(DONNEES)["items"]}
fiches = [i for i in source["items"] if i["id"] in nouveaux and i["id"] in img and img[i["id"]].exists()]

if action == "planches":
    P = D / "planches"
    P.mkdir(exist_ok=True)
    for ancien in P.glob("planche_*"):
        ancien.unlink()
    COL, LARG, HAUT, BANDE, PAR = 4, 300, 225, 30, 20
    police = ImageFont.truetype("arialbd.ttf", 20)
    for debut in range(0, len(fiches), PAR):
        lot, numero = fiches[debut:debut + PAR], debut // PAR + 1
        planche = Image.new("RGB", (COL * LARG, ((len(lot) + COL - 1) // COL) * (HAUT + BANDE)), (40, 40, 40))
        dessin = ImageDraw.Draw(planche)
        lignes = []
        for k, i in enumerate(lot):
            x, y = (k % COL) * LARG, (k // COL) * (HAUT + BANDE)
            photo = Image.open(img[i["id"]]).convert("RGB")
            photo.thumbnail((LARG - 6, HAUT - 6))
            planche.paste(photo, (x + (LARG - photo.width) // 2, y + (HAUT - photo.height) // 2))
            dessin.rectangle([x, y + HAUT, x + LARG - 1, y + HAUT + BANDE - 1], fill=(250, 250, 250))
            dessin.text((x + 8, y + HAUT + 4), str(k + 1), fill=(190, 0, 0), font=police)
            trace = TRACES / (i["id"] + ".source")
            a = alertes(img[i["id"]], trace.read_text(encoding="utf-8") if trace.exists() else "")
            lignes.append("%d | %s | %s | %s | %s%s" % (k + 1, i["id"], i["nom"], i["cat"], source["pays"][i["pays"]]["nom"],
                                                       " | alertes : " + ", ".join(a) if a else ""))
        planche.save(P / ("planche_%03d.png" % numero), optimize=True)
        (P / ("planche_%03d.txt" % numero)).write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print(len(fiches), "photos en", (len(fiches) + PAR - 1) // PAR, "planches dans", P)

elif action == "second":
    vus = {}
    for chemin in glob.glob(str(D / "photos_vu_*.json")):
        for e in lire(chemin, []) or []:
            if e.get("id") in img:
                vus[e["id"]] = e
    parId = {i["id"]: i for i in fiches}
    lignes = ["%s | %s | %s | %s | %s : %s | %s" % (i, parId[i]["nom"], parId[i]["cat"], source["pays"][parId[i]["pays"]]["nom"],
                                                  e.get("verdict"), e.get("motif"), img[i]) for i, e in sorted(vus.items()) if i in parId]
    (D / "photos_a_revoir.md").write_text("\n".join(lignes) + "\n", encoding="utf-8")
    ecrire_json(D / "photos_signalees.json", vus, indent=1)
    print(len(lignes), "photos signalées à revoir en grand :", D / "photos_a_revoir.md")

elif action == "retirer":
    vus = lire(D / "photos_signalees.json", {}) or {}
    decisions = lire(D / "photos_decisions.json", {}) or {}
    refus = {}
    for i, e in vus.items():
        d = decisions.get(i)
        if (d and d.get("decision") == "retirer") or (not d and e.get("verdict") == "mauvais"):
            refus[i] = (d or e).get("motif")
    source["items"] = [i for i in source["items"] if i["id"] not in refus]
    ecrire_source(source)
    ecrire_json(D / "nouveaux.json", [i for i in lire(D / "nouveaux.json") if i not in refus])
    (D / "photos_refusees.txt").write_text("\n".join("%s | %s" % kv for kv in sorted(refus.items())) + "\n", encoding="utf-8")
    print(len(refus), "curiosités retirées pour leur photo ; restent", len(source["items"]))
