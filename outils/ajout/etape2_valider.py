"""Étape 2 d'une tranche : contrôle des propositions sur Wikipédia, sans IA.

Garde une proposition si : champs valides, pas de doublon (identifiant, nom, article ou élément Wikidata déjà dans le jeu
ou déjà proposé), article français existant, pas une homonymie, une fiche Wikidata, une image, une introduction
d'au moins 120 caractères ; un nouveau pays doit garder au moins 4 propositions valides.
Prépare ensuite les lots à rédiger (introduction de l'article comprise).

Les zones peuvent être traitées à mesure qu'elles arrivent : les propositions déjà validées des autres zones comptent
comme existantes (pas de doublon entre zones).

Usage : python outils/ajout/etape2_valider.py <tranche> <zones, ex. 2,5,6> [taille_des_lots=90]
Écrit travail/tranche_NN/valides_zN.json, rejets_zN.txt, arediger_zN_NN.md, puis valides.json (toutes zones) ;
cache commun travail/cache_wiki.json et travail/cache_wikidata.json
"""
import glob, json, re, sys, time, unicodedata, urllib.parse, urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
tranche = int(sys.argv[1])
ZONES = [int(z) for z in sys.argv[2].split(",")]
TAILLE = int(sys.argv[3]) if len(sys.argv) > 3 else 90
DOSSIER = RACINE / "travail" / ("tranche_%02d" % tranche)
CACHE = RACINE / "travail" / "cache_wiki.json"
SOURCE = json.loads((RACINE / "outils" / "curiosites.json").read_text(encoding="utf-8"))
DONNEES = RACINE / "outils" / "cache" / "donnees.json"
CATS = {"monument", "lieu", "plat", "boisson", "fête", "tradition", "instrument", "objet"}
CONTINENTS = {"Europe", "Asie", "Afrique", "Amériques", "Océanie"}
# Curiosités revendiquées par plusieurs pays, déjà écartées une fois : ne pas les réintroduire.
ECARTES = ("tajine", "harira", "the a la menthe", "djellaba", "fantasia", "santour", "plov", "taboule", "mouhammara",
           "kaieteur", "rupununi", "iwokrama", "moambe", "calulu", "sani", "karisimbi", "kalambo", "cor des alpes",
           "sirop d'erable", "azulejo", "cajon", "couscous", "houmous", "baklava", "pisco", "kebab", "mate", "samovar",
           "fondue", "rai", "casbah d'alger", "dulce de leche", "empanada", "ceviche")
AGENT = "MiraduniaDataBuilder/0.3 (https://miradunia.netvtc.com/; jeu educatif statique)"
cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}


def simple(texte):
    return "".join(c for c in unicodedata.normalize("NFD", str(texte).lower()) if unicodedata.category(c) != "Mn")


def appel(titres):
    url = "https://fr.wikipedia.org/w/api.php?" + urllib.parse.urlencode({
        "action": "query", "prop": "extracts|pageprops|pageimages", "exintro": 1, "explaintext": 1, "redirects": 1,
        "exlimit": 20, "piprop": "name", "pilimit": 20, "titles": "|".join(titres), "format": "json", "formatversion": 2})
    requete = urllib.request.Request(url, headers={"User-Agent": AGENT})
    for essai in range(8):
        try:
            return json.load(urllib.request.urlopen(requete, timeout=40))
        except Exception as erreur:
            print("  attente", essai, erreur, flush=True)
            time.sleep(20 * (essai + 1))
    raise SystemExit("Wikipédia ne répond pas")


pays = dict(SOURCE["pays"])
existants_id = {i["id"] for i in SOURCE["items"]}
existants_wiki = {simple(i["wiki"]) for i in SOURCE["items"]}
existants_nom = {simple(i["nom"]) for i in SOURCE["items"]}
existants_qid = set()
if DONNEES.exists():
    existants_qid = {i.get("wikidata") for i in json.loads(DONNEES.read_text(encoding="utf-8"))["items"] if i.get("wikidata")}
# Curiosités refusées à une tranche précédente (photo ou relecture) : ni le même identifiant ni le même article.
for refus in glob.glob(str(RACINE / "travail" / "tranche_*" / "photos_refusees.txt")) + glob.glob(str(RACINE / "travail" / "tranche_*" / "retraits_relecture.txt")):
    if Path(refus).parent == DOSSIER:
        continue
    wikis = {}
    if (Path(refus).parent / "valides.json").exists():
        wikis = {i["id"]: i["wiki"] for i in json.loads((Path(refus).parent / "valides.json").read_text(encoding="utf-8"))["items"]}
    for ligne in Path(refus).read_text(encoding="utf-8").splitlines():
        ident = ligne.split(" | ")[0].strip()
        if ident:
            existants_id.add(ident)
            if ident in wikis:
                existants_wiki.add(simple(wikis[ident]))
# Propositions déjà validées dans les autres zones de la tranche.
for chemin in glob.glob(str(DOSSIER / "valides_z*.json")):
    if int(re.search(r"valides_z(\d+)", chemin).group(1)) in ZONES:
        continue
    autre = json.loads(Path(chemin).read_text(encoding="utf-8"))
    pays.update(autre["pays"])
    for i in autre["items"]:
        existants_id.add(i["id"]); existants_wiki.add(simple(i["wiki"])); existants_nom.add(simple(i["nom"]))
        existants_qid.add(i.get("_qid"))

candidats, rejets, nouveaux_pays = [], [], {}
for chemin in sorted(glob.glob(str(DOSSIER / "propositions_z*.json"))):
    if int(re.search(r"propositions_z(\d+)", chemin).group(1)) not in ZONES:
        continue
    try:
        d = json.loads(Path(chemin).read_text(encoding="utf-8"))
    except Exception as erreur:
        print("illisible :", chemin, erreur)
        continue
    for code, p in d.get("pays", {}).items():
        if re.fullmatch(r"[A-Z]{2}", code) and p.get("continent") in CONTINENTS and code not in pays:
            nouveaux_pays.setdefault(code, {"nom": p["nom"], "continent": p["continent"]})
    for i in d.get("items", []):
        i["_source"] = Path(chemin).name
        candidats.append(i)
tous_pays = dict(pays)
tous_pays.update(nouveaux_pays)

retenus = []
vus_id, vus_wiki, vus_nom = set(existants_id), set(existants_wiki), set(existants_nom)
for i in candidats:
    raison = None
    cle = simple(str(i.get("nom", "")) + " | " + str(i.get("wiki", "")))
    if any(re.search(r"\b" + re.escape(m) + r"\b", cle) for m in ECARTES):
        raison = "revendiqué par plusieurs pays"
    elif not all(k in i for k in ("id", "nom", "pays", "cat", "wiki", "niv")):
        raison = "champ manquant"
    elif not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", str(i["id"])):
        raison = "identifiant invalide"
    elif i["id"] in vus_id:
        raison = "identifiant déjà pris"
    elif simple(i["wiki"]) in vus_wiki:
        raison = "article déjà utilisé"
    elif simple(i["nom"]) in vus_nom:
        raison = "nom déjà utilisé"
    elif i["pays"] not in tous_pays:
        raison = "pays inconnu"
    elif i["cat"] not in CATS:
        raison = "catégorie inconnue"
    elif i["niv"] not in (1, 2, 3):
        raison = "niveau invalide"
    elif simple(tous_pays[i["pays"]]["nom"]) in simple(i["nom"]):
        raison = "le nom contient le pays"
    if raison:
        rejets.append((i.get("id"), raison))
        continue
    vus_id.add(i["id"]); vus_wiki.add(simple(i["wiki"])); vus_nom.add(simple(i["nom"]))
    retenus.append(i)
print("propositions :", len(candidats), "; retenues avant Wikipédia :", len(retenus), flush=True)

a_demander = sorted({i["wiki"] for i in retenus if i["wiki"] not in cache})
for k in range(0, len(a_demander), 20):
    lot = a_demander[k:k + 20]
    q = appel(lot)["query"]
    renvoi = {n["from"]: n["to"] for n in q.get("normalized", []) + q.get("redirects", [])}
    pages = {p["title"]: p for p in q["pages"]}
    for titre in lot:
        cible = titre
        for _ in range(4):
            cible = renvoi.get(cible, cible)
        p = pages.get(cible, {})
        props = p.get("pageprops", {})
        cache[titre] = {"titre": cible, "absent": bool(p.get("missing")) or not p, "homonymie": "disambiguation" in props,
                        "qid": props.get("wikibase_item"), "image": p.get("pageimage") or props.get("page_image_free"),
                        "intro": (p.get("extract") or "")[:1800]}
    if (k // 20) % 10 == 9 or k + 20 >= len(a_demander):
        CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
        print("  ", min(k + 20, len(a_demander)), "/", len(a_demander), flush=True)
    time.sleep(2)
CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")

# Notoriété (nombre de Wikipédias qui ont un article) et pays d'origine déclarés, depuis Wikidata.
CACHE_WD = RACINE / "travail" / "cache_wikidata.json"
wd = json.loads(CACHE_WD.read_text(encoding="utf-8")) if CACHE_WD.exists() else {}
qids = sorted({cache[i["wiki"]]["qid"] for i in retenus if cache[i["wiki"]].get("qid")} - set(wd))
for k in range(0, len(qids), 50):
    url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode({
        "action": "wbgetentities", "ids": "|".join(qids[k:k + 50]), "props": "sitelinks|claims", "format": "json"})
    for essai in range(8):
        try:
            entites = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": AGENT}), timeout=60))["entities"]
            break
        except Exception as erreur:
            print("  attente wikidata", essai, erreur, flush=True)
            time.sleep(20 * (essai + 1))
    else:
        raise SystemExit("Wikidata ne répond pas")
    for q, e in entites.items():
        liens = [s for s in (e.get("sitelinks") or {}) if re.fullmatch(r"[a-z_]+wiki", s) and s not in ("commonswiki", "specieswiki", "metawiki", "wikidatawiki", "mediawikiwiki", "sourceswiki", "outreachwiki", "incubatorwiki", "wikimaniawiki")]
        origines = [c["mainsnak"].get("datavalue", {}).get("value", {}).get("id") for c in (e.get("claims") or {}).get("P495", [])]
        wd[q] = {"sl": len(liens), "origines": sorted({o for o in origines if o})}
    CACHE_WD.write_text(json.dumps(wd, ensure_ascii=False), encoding="utf-8")
    time.sleep(1)
NOTORIETE_MIN = 10  # moins de 10 Wikipédias : trop obscur pour un défi du jour


def niveau_par_notoriete(sl):
    return 1 if sl >= 60 else 2 if sl >= 30 else 3


valides, vus_qid = [], set(existants_qid)
for i in retenus:
    c = cache[i["wiki"]]
    raison = None
    if c["absent"]: raison = "article introuvable"
    elif c["homonymie"]: raison = "page d'homonymie"
    elif not c["qid"]: raison = "pas de fiche Wikidata"
    elif c["qid"] in vus_qid: raison = "même sujet qu'une curiosité existante ou proposée"
    elif not c["image"]: raison = "article sans image"
    elif len(c["intro"]) < 120: raison = "introduction trop courte"
    elif simple(c["titre"]) in existants_wiki: raison = "article déjà utilisé (après redirection)"
    elif wd.get(c["qid"], {}).get("sl", 0) < NOTORIETE_MIN: raison = "trop peu connu (%d Wikipédias)" % wd.get(c["qid"], {}).get("sl", 0)
    elif len(wd.get(c["qid"], {}).get("origines", [])) > 1: raison = "plusieurs pays d'origine sur Wikidata"
    if raison:
        rejets.append((i["id"], raison + " : " + i["wiki"]))
        continue
    # Niveau : celui proposé, sauf s'il s'écarte de plus d'un cran de celui que donne la notoriété.
    auto = niveau_par_notoriete(wd[c["qid"]]["sl"])
    if abs(auto - i["niv"]) > 1:
        i["niv"] = auto
    i["_notoriete"] = wd[c["qid"]]["sl"]
    i["_qid"] = c["qid"]
    vus_qid.add(c["qid"])
    i["wiki"] = c["titre"]
    i["_intro"] = c["intro"].replace("\n", " ")
    valides.append(i)

par_pays = {}
for i in valides:
    par_pays[i["pays"]] = par_pays.get(i["pays"], 0) + 1
faibles = [c for c in nouveaux_pays if par_pays.get(c, 0) < 4]
valides = [i for i in valides if i["pays"] not in faibles]
for c in faibles:
    rejets.append((c, "nouveau pays avec moins de 4 propositions valides"))
gardes_pays = {c: p for c, p in nouveaux_pays.items() if c not in faibles}
lots = 0
for zone in ZONES:
    source = "propositions_z%d.json" % zone
    de_la_zone = [i for i in valides if i["_source"] == source]
    pays_zone = {c: p for c, p in gardes_pays.items() if any(i["pays"] == c for i in de_la_zone)}
    (DOSSIER / ("valides_z%d.json" % zone)).write_text(json.dumps({"pays": pays_zone, "items": de_la_zone}, ensure_ascii=False, indent=0), encoding="utf-8")
    for ancien in DOSSIER.glob("arediger_z%d_*.md" % zone):
        ancien.unlink()
    for n in range((len(de_la_zone) + TAILLE - 1) // TAILLE):
        lot = de_la_zone[n * TAILLE:(n + 1) * TAILLE]
        (DOSSIER / ("arediger_z%d_%02d.md" % (zone, n + 1))).write_text("\n".join(
            "### %s — %s — pays attendu : %s — catégorie : %s — niveau : %d\nArticle : %s\nINTRODUCTION WIKIPÉDIA : %s\n" % (
                i["id"], i["nom"], tous_pays[i["pays"]]["nom"], i["cat"], i["niv"], i["wiki"], i["_intro"]) for i in lot), encoding="utf-8")
        lots += 1
(DOSSIER / ("rejets_z%s.txt" % "-".join(map(str, ZONES)))).write_text("\n".join("%s | %s" % r for r in rejets) + "\n", encoding="utf-8")
# Toutes les zones validées jusqu'ici, pour les étapes suivantes.
tout = {"pays": {}, "items": []}
for chemin in sorted(glob.glob(str(DOSSIER / "valides_z*.json"))):
    d = json.loads(Path(chemin).read_text(encoding="utf-8"))
    tout["pays"].update(d["pays"])
    tout["items"] += d["items"]
(DOSSIER / "valides.json").write_text(json.dumps(tout, ensure_ascii=False, indent=0), encoding="utf-8")
from collections import Counter
print("zones", ZONES, ": valides", len(valides), "; rejets", len(rejets), "; nouveaux pays gardés", sorted(gardes_pays), "; lots à rédiger", lots)
print("niveaux :", sorted(Counter(i["niv"] for i in valides).items()))
print("rejets par motif :", Counter(re.sub(r"\(\d+ Wikipédias\)", "", r[1].split(" :")[0]).strip() for r in rejets).most_common())
print("total validé dans la tranche :", len(tout["items"]))
