"""Étape 6 d'une tranche : prépare la traduction des nouvelles curiosités (et des nouveaux pays) dans chaque langue.
À lancer après construire_donnees.py, qui fournit les liens Wikipédia et les libellés Wikidata de chaque langue.

Usage : python outils/ajout/etape6_traduction.py <tranche> [taille=150]
Écrit travail/tranche_NN/trad/<langue>_NN.md, pays_<langue>.txt (pays à nommer) et lots.json
Les agents rendent trad/sortie/<langue>_NN.json : {id: {"nom", "fait"}} (consigne : outils/ajout/consigne_traduction.md).
"""
import json, subprocess, sys, urllib.parse
from commun import dossier, lire, ecrire_json, DONNEES, LANGUES

tranche = int(sys.argv[1])
TAILLE = int(sys.argv[2]) if len(sys.argv) > 2 else 150
D = dossier(tranche)
T = D / "trad"
(T / "sortie").mkdir(parents=True, exist_ok=True)
donnees = lire(DONNEES)
codes_langues = [l["code"] for l in lire(LANGUES / "langues.json") if l["code"] != "fr"]
existants = {code: lire(LANGUES / (code + ".json"), {"items": {}, "pays": {}}) for code in codes_langues}
nouveaux = set(lire(D / "nouveaux.json"))
items = [i for i in donnees["items"] if i["id"] in nouveaux]
script = ("const codes=%s, langues=%s, r={};for(const l of langues){const n=new Intl.DisplayNames([l],{type:'region'});"
          "r[l]=Object.fromEntries(codes.map(c=>[c,n.of(c)]))}process.stdout.write(JSON.stringify(r))") % (
    json.dumps(list(donnees["pays"])), json.dumps(codes_langues))
cldr = json.loads(subprocess.run(["node", "-e", script], capture_output=True, text=True, encoding="utf-8", check=True).stdout)
for ancien in T.glob("*_[0-9][0-9].md"):
    ancien.unlink()
lots = []
for code in codes_langues:
    a_faire = [i for i in items if i["id"] not in existants[code].get("items", {})]
    pays_manquants = [c for c in donnees["pays"] if c not in existants[code].get("pays", {})]
    (T / ("pays_%s.txt" % code)).write_text("".join("%s | %s | %s\n" % (c, donnees["pays"][c]["nom"], cldr[code][c]) for c in pays_manquants), encoding="utf-8")
    nombre = (len(a_faire) + TAILLE - 1) // TAILLE
    for n in range(nombre):
        blocs = []
        for i in a_faire[n * TAILLE:(n + 1) * TAILLE]:
            titre = i["liens"].get(code)
            titre = urllib.parse.unquote(titre.rsplit("/wiki/", 1)[1]).replace("_", " ") if titre else "(aucun)"
            nom_pays = existants[code].get("pays", {}).get(i["pays"]) or cldr[code][i["pays"]]
            blocs.append("### %s\ncatégorie : %s · pays : %s / %s · niveau %d\nnom (fr) : %s\nlibellé Wikidata (%s) : %s\n"
                         "article Wikipédia (%s) : %s\nphrase (fr) : %s\n" % (
                             i["id"], i["cat"], donnees["pays"][i["pays"]]["nom"], nom_pays, i["niv"],
                             i["nom"], code, i["noms"].get(code, "(aucun)"), code, titre, i["fait"]))
        (T / ("%s_%02d.md" % (code, n + 1))).write_text("\n".join(blocs), encoding="utf-8")
    lots.append({"code": code, "lots": nombre, "pays": pays_manquants})
ecrire_json(T / "lots.json", lots)
print(json.dumps([{"code": l["code"], "lots": l["lots"], "pays": len(l["pays"])} for l in lots]))
