"""Étape 5 d'une tranche : applique les décisions de relecture (relu_NN.json) à outils/curiosites.json, puis contrôle
mécaniquement que chaque nombre et chaque siècle des phrases ajoutées figurent dans l'introduction Wikipédia.
Une curiosité sans relecture est retirée (on ne publie rien de non relu).

Usage : python outils/ajout/etape5_appliquer_relecture.py <tranche> [--essai]
Écrit travail/tranche_NN/retraits_relecture.txt et nombres_suspects.txt
"""
import re, sys
from commun import dossier, lire, ecrire_json, lire_source, ecrire_source, simple, nombres, siecles, CATS

tranche = int(sys.argv[1])
ESSAI = "--essai" in sys.argv
D = dossier(tranche)
source = lire_source()
parId = {i["id"]: i for i in source["items"]}
intro = {i["id"]: i["_intro"] for i in lire(D / "valides.json")["items"]}
noms_pris = {simple(i["nom"]): i["id"] for i in source["items"]}
retraits, modifs, compte = {}, {}, {"ok": 0, "modifier": 0, "retirer": 0, "sans_relecture": 0}
for lot in lire(D / "lots_relecture.json"):
    decisions = {e.get("id"): e for e in (lire(D / ("relu_%02d.json" % lot["n"]), []) or [])}
    for ident in lot["ids"]:
        if ident not in parId:
            continue
        e = decisions.get(ident)
        if e is None:
            compte["sans_relecture"] += 1
            retraits[ident] = "non relue (lot %02d)" % lot["n"]
            continue
        action = e.get("action")
        compte[action] = compte.get(action, 0) + 1
        if action == "retirer":
            retraits[ident] = str(e.get("raison"))
            continue
        if action != "modifier":
            continue
        m = {}
        if e.get("fait"):
            fait = re.sub(r"\s+", " ", e["fait"]).strip()
            if 70 <= len(fait) <= 200:
                m["fait"] = fait
            else:
                retraits[ident] = "phrase corrigée de longueur anormale"
                continue
        if e.get("nom") and e["nom"].strip() != parId[ident]["nom"]:
            nom = e["nom"].strip()
            if simple(source["pays"][parId[ident]["pays"]]["nom"]) not in simple(nom) and noms_pris.get(simple(nom), ident) == ident:
                noms_pris.pop(simple(parId[ident]["nom"]), None)
                noms_pris[simple(nom)] = ident
                m["nom"] = nom
        if e.get("niv") in (1, 2, 3):
            m["niv"] = e["niv"]
        if e.get("cat") in CATS:
            m["cat"] = e["cat"]
        if m:
            modifs[ident] = m

items = []
for i in source["items"]:
    if i["id"] in retraits:
        continue
    if i["id"] in modifs:
        i = dict(i); i.update(modifs[i["id"]])
    items.append(i)
suspects = []
for i in items:
    if i["id"] not in intro:
        continue
    texte, src = i["fait"], intro[i["id"]]
    manquants = sorted(n for n in nombres(texte) - nombres(src) if not (len(n) == 1))
    s_manquants = sorted(siecles(texte) - siecles(src) - {int(n) for n in nombres(src) if n.isdigit() and int(n) < 30})
    if manquants or s_manquants:
        suspects.append("%s | nombres %s | siècles %s | %s" % (i["id"], manquants, s_manquants, texte))
print("décisions :", compte, "; retirées :", len(retraits), "; modifiées :", len(modifs), "; total après :", len(items))
print(len(suspects), "phrases avec un nombre ou un siècle absent de l'introduction (voir nombres_suspects.txt)")
(D / "retraits_relecture.txt").write_text("\n".join("%s | %s" % kv for kv in sorted(retraits.items())) + "\n", encoding="utf-8")
(D / "nombres_suspects.txt").write_text("\n".join(suspects) + "\n", encoding="utf-8")
if not ESSAI:
    source["items"] = items
    ecrire_source(source)
    nouveaux = [x for x in lire(D / "nouveaux.json") if x not in retraits]
    ecrire_json(D / "nouveaux.json", nouveaux)
    print("curiosites.json écrit ;", len(nouveaux), "curiosités nouvelles restantes")
