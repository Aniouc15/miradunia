"""Étape 3 d'une tranche : ajoute à outils/curiosites.json les curiosités rédigées (redige_NN.json) et gardées.

Usage : python outils/ajout/etape3_ajouter.py <tranche>
Écrit travail/tranche_NN/nouveaux.json (identifiants ajoutés) et rejets_redaction.txt
"""
import glob, re, sys
from pathlib import Path
from commun import dossier, lire, ecrire_json, lire_source, ecrire_source, simple

tranche = int(sys.argv[1])
D = dossier(tranche)
source = lire_source()
valides = lire(D / "valides.json")
parId = {i["id"]: i for i in valides["items"]}
tous_pays = dict(source["pays"]); tous_pays.update(valides["pays"])
deja = {i["id"] for i in source["items"]}
noms = {simple(i["nom"]) for i in source["items"]}
ajouts, rejets = [], []
for chemin in sorted(glob.glob(str(D / "redige_*.json"))):
    for r in lire(chemin, []):
        base = parId.get(r.get("id"))
        if base is None or r["id"] in deja:
            rejets.append((r.get("id"), "inconnu ou déjà présent")); continue
        if not r.get("garder"):
            rejets.append((r["id"], "écarté à la rédaction : " + str(r.get("raison")))); continue
        fait = re.sub(r"\s+", " ", str(r.get("fait", ""))).strip().replace(" !", ".").replace("!", ".")
        nom = str(r.get("nom") or base["nom"]).strip()
        niv = r.get("niv") if r.get("niv") in (1, 2, 3) else base["niv"]
        if not (70 <= len(fait) <= 200):
            rejets.append((r["id"], "phrase de longueur anormale (%d)" % len(fait))); continue
        if simple(tous_pays[base["pays"]]["nom"]) in simple(nom):
            rejets.append((r["id"], "le nom contient le pays : " + nom)); continue
        if simple(nom) in noms:
            rejets.append((r["id"], "nom déjà utilisé : " + nom)); continue
        deja.add(r["id"]); noms.add(simple(nom))
        ajouts.append({"id": r["id"], "nom": nom, "pays": base["pays"], "cat": base["cat"], "wiki": base["wiki"], "fait": fait, "niv": niv})
compte = {}
for i in ajouts:
    compte[i["pays"]] = compte.get(i["pays"], 0) + 1
nouveaux_pays = {c: p for c, p in valides["pays"].items() if compte.get(c, 0) >= 4}
ajouts = [i for i in ajouts if i["pays"] in source["pays"] or i["pays"] in nouveaux_pays]
source["pays"].update(nouveaux_pays)
source["items"] += ajouts
ecrire_source(source)
ecrire_json(D / "nouveaux.json", [i["id"] for i in ajouts])
(D / "rejets_redaction.txt").write_text("\n".join("%s | %s" % r for r in rejets) + "\n", encoding="utf-8")
print("ajoutées :", len(ajouts), "; écartées :", len(rejets), "; nouveaux pays :", sorted(nouveaux_pays), "; total :", len(source["items"]))
