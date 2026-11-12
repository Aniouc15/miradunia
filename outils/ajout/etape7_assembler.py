"""Étape 7 d'une tranche : ajoute les traductions rendues à outils/langues/<code>.json, après contrôle.

Contrôles par curiosité : nom et phrase présents ; mêmes nombres que la phrase française ; nom sans le nom du pays ;
longueur plausible. Une traduction qui échoue n'est pas ajoutée : la curiosité attendra (construire_site.py ne publie
une curiosité que si elle est prête dans toutes les langues). Les nouveaux pays viennent de trad/sortie/pays_<code>.json.
Les noms corrigés par la relecture des noms (trad/sortie/noms_<code>.json) remplacent ceux des lots.

Usage : python outils/ajout/etape7_assembler.py <tranche> [--ecrire]   (sans --ecrire : bilan seulement)
"""
import io, json, re, sys
from commun import dossier, lire, DONNEES, LANGUES, simple, nombres

tranche = int(sys.argv[1])
ECRIRE = "--ecrire" in sys.argv
D = dossier(tranche)
T = D / "trad"
donnees = lire(DONNEES)
parId = {i["id"]: i for i in donnees["items"]}
for lot in lire(T / "lots.json"):
    code = lot["code"]
    chemin = LANGUES / (code + ".json")
    langue = lire(chemin)
    pays = dict(langue["pays"])
    nouveaux_pays = lire(T / "sortie" / ("pays_%s.json" % code), {}) or {}
    for c in lot["pays"]:
        if str(nouveaux_pays.get(c, "")).strip():
            pays[c] = nouveaux_pays[c].strip()
    rendus = {}
    for n in range(1, lot["lots"] + 1):
        rendus.update({k: v for k, v in (lire(T / "sortie" / ("%s_%02d.json" % (code, n)), {}) or {}).items() if isinstance(v, dict)})
    for ident, correction in (lire(T / "sortie" / ("noms_%s.json" % code), {}) or {}).items():
        if ident in rendus and isinstance(correction, dict) and str(correction.get("nom", "")).strip():
            rendus[ident]["nom"] = correction["nom"].strip()
    ajoutes, problemes = 0, []
    for ident, t in rendus.items():
        item = parId.get(ident)
        if item is None:
            continue
        nom, fait = re.sub(r"\s+", " ", str(t.get("nom", ""))).strip(), re.sub(r"\s+", " ", str(t.get("fait", ""))).strip()
        raison = None
        if not nom or not fait:
            raison = "vide"
        elif nombres(item["fait"]) - nombres(fait):
            raison = "nombre perdu %s" % sorted(nombres(item["fait"]) - nombres(fait))
        elif pays.get(item["pays"]) and simple(pays[item["pays"]]) in simple(nom):
            raison = "pays dans le nom (%s)" % nom
        elif not 0.45 <= len(fait) / max(1, len(item["fait"])) <= 2.2 or len(fait) > 320:
            raison = "longueur anormale"
        if raison:
            problemes.append("%s : %s" % (ident, raison))
            continue
        langue["items"][ident] = {"nom": nom, "fait": fait}
        ajoutes += 1
    manquants = [i for i in lire(D / "nouveaux.json") if i in parId and i not in langue["items"]]
    print("%s : %d traductions ajoutées, %d refusées, %d curiosités encore sans traduction, %d pays ajoutés" % (
        code, ajoutes, len(problemes), len(manquants), len(pays) - len(langue["pays"])))
    for p in problemes[:15]:
        print("   - " + p)
    (T / ("problemes_%s.txt" % code)).write_text("\n".join(problemes + ["manquant : " + m for m in manquants]) + "\n", encoding="utf-8")
    if ECRIRE:
        langue["pays"] = pays
        texte = chemin.read_text(encoding="utf-8")
        indent = 1 if texte.startswith('{\n "') else (2 if texte.startswith('{\n  "') else None)
        io.open(chemin, "w", encoding="utf-8", newline="\n").write(json.dumps(langue, ensure_ascii=False, indent=indent) + "\n")
