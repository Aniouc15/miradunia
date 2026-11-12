"""Étape 4 d'une tranche : prépare les lots de relecture (faits et équité du jeu) des curiosités ajoutées.
Relançable : seules les curiosités qui ne sont dans aucun lot forment de nouveaux lots (numérotés à la suite).

Usage : python outils/ajout/etape4_relecture.py <tranche> [taille=45]
Écrit travail/tranche_NN/arelire_NN.md et lots_relecture.json ; affiche les numéros des nouveaux lots
"""
import sys
from commun import dossier, lire, ecrire_json, lire_source

tranche = int(sys.argv[1])
TAILLE = int(sys.argv[2]) if len(sys.argv) > 2 else 45
D = dossier(tranche)
source = lire_source()
tous_pays = dict(source["pays"])
intro = {i["id"]: i["_intro"] for i in lire(D / "valides.json")["items"]}
nouveaux = set(lire(D / "nouveaux.json"))
lots = lire(D / "lots_relecture.json", []) or []
deja = {i for lot in lots for i in lot["ids"]}
items = [i for i in source["items"] if i["id"] in nouveaux and i["id"] not in deja]
crees = []
for k in range((len(items) + TAILLE - 1) // TAILLE):
    lot = items[k * TAILLE:(k + 1) * TAILLE]
    n = len(lots) + 1
    (D / ("arelire_%02d.md" % n)).write_text("\n".join(
        "### %s\nNOM AFFICHÉ : %s\nPAYS ATTENDU : %s\nCATÉGORIE : %s — NIVEAU : %d\nARTICLE : %s\nPHRASE : %s\nINTRODUCTION WIKIPÉDIA : %s\n" % (
            i["id"], i["nom"], tous_pays[i["pays"]]["nom"], i["cat"], i["niv"], i["wiki"], i["fait"], intro[i["id"]])
        for i in lot), encoding="utf-8")
    lots.append({"n": n, "ids": [i["id"] for i in lot]})
    crees.append(n)
ecrire_json(D / "lots_relecture.json", lots)
print(len(items), "curiosités en", len(crees), "nouveaux lots de relecture :", crees)
