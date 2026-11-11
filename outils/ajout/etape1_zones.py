"""Étape 1 d'une tranche : liste, zone par zone, les curiosités déjà présentes (pour que les agents n'en proposent pas
de doublons) et les codes de pays du jeu.

Usage : python outils/ajout/etape1_zones.py <numéro de tranche>
Écrit travail/tranche_NN/existant_zZ.md et travail/tranche_NN/codes.txt
"""
import json, sys
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
tranche = int(sys.argv[1])
dossier = RACINE / "travail" / ("tranche_%02d" % tranche)
dossier.mkdir(parents=True, exist_ok=True)
source = json.loads((RACINE / "outils" / "curiosites.json").read_text(encoding="utf-8"))
zones = json.loads((RACINE / "outils" / "ajout" / "zones.json").read_text(encoding="utf-8"))
pays = source["pays"]


def codes_de(cle):
    z = zones[cle]
    codes = set(z.get("codes", []))
    if "continent" in z:
        codes |= {c for c, p in pays.items() if p["continent"] == z["continent"]}
    if "continent_en_plus" in z:
        codes |= {c for c, p in pays.items() if p["continent"] == z["continent_en_plus"]}
    if "sauf_zone" in z:
        codes -= codes_de(z["sauf_zone"])
    codes -= set(z.get("sauf_codes", []))
    return codes


par_pays = {}
for item in source["items"]:
    par_pays.setdefault(item["pays"], []).append(item)
(dossier / "codes.txt").write_text(", ".join(sorted(pays)) + "\n", encoding="utf-8")
for cle in sorted(zones, key=int):
    codes = sorted(codes_de(cle), key=lambda c: pays.get(c, {}).get("nom", c))
    lignes = ["# Curiosités déjà dans le jeu : %s\n" % zones[cle]["nom"],
              "Nouveaux pays possibles : %s\n" % zones[cle]["nouveaux"]]
    total = 0
    for code in codes:
        items = par_pays.get(code, [])
        total += len(items)
        lignes.append("- %s %s (%d) : %s" % (code, pays[code]["nom"] if code in pays else "?", len(items),
                                            " ; ".join("%s [%s]" % (i["nom"], i["wiki"]) for i in items)))
    (dossier / ("existant_z%s.md" % cle)).write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print("zone %s : %d pays, %d curiosités — %s" % (cle, len(codes), total, zones[cle]["nom"]))
