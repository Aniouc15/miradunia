"""Étape 4 d'une tranche : prépare les lots de relecture (faits et équité du jeu) des curiosités ajoutées.

Usage : python outils/ajout/etape4_relecture.py <tranche> [taille=45]
Écrit travail/tranche_NN/arelire_NN.md et lots_relecture.json
"""
import sys
from commun import dossier, lire, ecrire_json, lire_source

tranche = int(sys.argv[1])
TAILLE = int(sys.argv[2]) if len(sys.argv) > 2 else 45
D = dossier(tranche)
source = lire_source()
intro = {i["id"]: i["_intro"] for i in lire(D / "valides.json")["items"]}
nouveaux = set(lire(D / "nouveaux.json"))
items = [i for i in source["items"] if i["id"] in nouveaux]
for ancien in D.glob("arelire_*.md"):
    ancien.unlink()
lots = []
for n in range((len(items) + TAILLE - 1) // TAILLE):
    lot = items[n * TAILLE:(n + 1) * TAILLE]
    (D / ("arelire_%02d.md" % (n + 1))).write_text("\n".join(
        "### %s\nNOM AFFICHÉ : %s\nPAYS ATTENDU : %s\nCATÉGORIE : %s — NIVEAU : %d\nARTICLE : %s\nPHRASE : %s\nINTRODUCTION WIKIPÉDIA : %s\n" % (
            i["id"], i["nom"], source["pays"][i["pays"]]["nom"], i["cat"], i["niv"], i["wiki"], i["fait"], intro[i["id"]])
        for i in lot), encoding="utf-8")
    lots.append({"n": n + 1, "ids": [i["id"] for i in lot]})
ecrire_json(D / "lots_relecture.json", lots)
print(len(items), "curiosités en", len(lots), "lots de relecture")
