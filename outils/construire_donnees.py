"""Va chercher sur Wikipédia, Wikidata et Wikimedia Commons ce dont le jeu a besoin, puis construit le site.

Pour chaque curiosité de outils/curiosites.json : article Wikipédia en français -> élément Wikidata
(image principale P18, articles et noms dans les autres langues) -> fiche Wikimedia Commons (auteur, licence)
-> photo de 560 px enregistrée dans site/img/. Le résultat est gardé dans outils/cache/donnees.json,
puis outils/construire_site.py écrit les fichiers du site dans chaque langue.
Aucune clé, aucun compte, aucun coût. Les photos déjà présentes ne sont pas retéléchargées.

Usage : python outils/construire_donnees.py
"""
import html
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
SOURCE = RACINE / "outils" / "curiosites.json"
REMPLACEMENTS = RACINE / "outils" / "images_choisies.json"
LANGUES = RACINE / "outils" / "langues" / "langues.json"
DOSSIER_IMG = RACINE / "site" / "img"
TRACES = RACINE / "outils" / "traces"
SORTIE = RACINE / "outils" / "cache" / "donnees.json"
RAPPORT = RACINE / "outils" / "rapport_donnees.txt"
AGENT = "MiraduniaDataBuilder/0.2 (https://aniouc15.github.io/miradunia/; jeu educatif statique)"
MINIMUM_PAR_PAYS = 4
LICENCES_OK = ("cc", "public domain", "pd", "gfdl", "gpl", "lgpl", "fal", "no restrictions", "attribution",
               "copyrighted free use", "licence ouverte", "kogl type 1")


def appel(url, params):
    requete = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": AGENT})
    for essai in range(7):
        try:
            with urllib.request.urlopen(requete, timeout=40) as reponse:
                return json.loads(reponse.read().decode("utf-8"))
        except Exception:  # réseau ou débit limité : on patiente puis on réessaie
            if essai == 6:
                raise
            time.sleep(5 + 10 * essai)
    return None


def lots(liste, taille):
    for debut in range(0, len(liste), taille):
        yield liste[debut:debut + taille]


def texte_brut(valeur):
    valeur = re.sub(r"<[^>]+>", "", valeur or "")
    valeur = html.unescape(valeur)
    return re.sub(r"\s+", " ", valeur).strip()


def lien_wikipedia(langue, titre):
    return "https://%s.wikipedia.org/wiki/%s" % (langue, urllib.parse.quote(titre.replace(" ", "_")))


def resoudre_articles(titres):
    """titre demandé -> (titre final, identifiant Wikidata, image de l'article)"""
    resultat = {}
    for lot in lots(titres, 40):
        donnees = appel("https://fr.wikipedia.org/w/api.php", {
            "action": "query", "format": "json", "redirects": 1, "prop": "pageprops|pageimages",
            "ppprop": "wikibase_item", "piprop": "name", "pilimit": 50, "titles": "|".join(lot)})
        requete = donnees.get("query", {})
        suivi = {titre: titre for titre in lot}
        for cle in ("normalized", "redirects"):
            for paire in requete.get(cle, []):
                for origine, courant in list(suivi.items()):
                    if courant == paire["from"]:
                        suivi[origine] = paire["to"]
        pages = {page.get("title"): page for page in requete.get("pages", {}).values()}
        for origine, final in suivi.items():
            page = pages.get(final)
            if page is None or "missing" in page:
                resultat[origine] = (None, None, None)
            else:
                resultat[origine] = (final, page.get("pageprops", {}).get("wikibase_item"), page.get("pageimage"))
        time.sleep(0.3)
    return resultat


def elements_wikidata(identifiants, langues):
    """identifiant Wikidata -> {image (P18), articles {langue: titre}, noms {langue: libellé}}"""
    resultat = {}
    sites = "|".join(langue + "wiki" for langue in langues)
    for lot in lots(identifiants, 40):
        donnees = appel("https://www.wikidata.org/w/api.php", {
            "action": "wbgetentities", "format": "json", "props": "claims|sitelinks|labels",
            "sitefilter": sites, "languages": "|".join(langues), "ids": "|".join(lot)})
        for identifiant, entite in donnees.get("entities", {}).items():
            fiche = {"image": None, "articles": {}, "noms": {}}
            for declaration in entite.get("claims", {}).get("P18", []):
                valeur = declaration.get("mainsnak", {}).get("datavalue", {}).get("value")
                if valeur:
                    fiche["image"] = valeur
                    break
            for site, lien in entite.get("sitelinks", {}).items():
                fiche["articles"][site[:-4]] = lien["title"]
            for langue, libelle in entite.get("labels", {}).items():
                fiche["noms"][langue] = libelle["value"]
            resultat[identifiant] = fiche
        time.sleep(0.3)
    return resultat


def fiches_commons(fichiers):
    """nom de fichier -> {vignette, page, auteur, depot, licence}"""
    resultat = {}
    for lot in lots(fichiers, 20):
        titres = ["File:" + nom for nom in lot]
        donnees = appel("https://commons.wikimedia.org/w/api.php", {
            "action": "query", "format": "json", "prop": "imageinfo",
            "iiprop": "url|user|extmetadata", "iiurlwidth": 640, "titles": "|".join(titres)})
        requete = donnees.get("query", {})
        suivi = {titre: titre for titre in titres}
        for paire in requete.get("normalized", []):
            for origine, courant in list(suivi.items()):
                if courant == paire["from"]:
                    suivi[origine] = paire["to"]
        pages = {page.get("title"): page for page in requete.get("pages", {}).values()}
        for origine, final in suivi.items():
            page = pages.get(final)
            if not page or not page.get("imageinfo"):
                continue
            info = page["imageinfo"][0]
            meta = info.get("extmetadata", {})
            auteur = texte_brut(meta.get("Artist", {}).get("value"))[:80]
            resultat[origine[5:]] = {
                "vignette": info.get("thumburl") or info.get("url"),
                "page": info.get("descriptionurl"),
                # Auteur déclaré ; à défaut, le compte Commons qui a déposé la photo (« depot »).
                "auteur": auteur or (info.get("user") or "")[:80],
                "depot": not auteur,
                "licence": texte_brut(meta.get("LicenseShortName", {}).get("value")),
            }
        time.sleep(0.3)
    return resultat


def telecharger(url, identifiant, fichier):
    """Enregistre la photo en JPEG de 560 px de large au plus (environ 50 Ko)."""
    from io import BytesIO
    from PIL import Image
    cible = DOSSIER_IMG / (identifiant + ".jpg")
    trace = TRACES / (identifiant + ".source")
    TRACES.mkdir(exist_ok=True)
    if not cible.exists() or not trace.exists() or trace.read_text(encoding="utf-8") != fichier:
        for ancien in DOSSIER_IMG.glob(identifiant + ".*"):
            ancien.unlink()
        requete = urllib.request.Request(url, headers={"User-Agent": AGENT})
        for essai in range(6):  # Wikimedia limite le débit : on patiente puis on réessaie
            try:
                with urllib.request.urlopen(requete, timeout=60) as reponse:
                    image = Image.open(BytesIO(reponse.read()))
                break
            except Exception:
                if essai == 5:
                    raise
                time.sleep(10 * (essai + 1))
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGBA")
            fond = Image.new("RGB", image.size, "white")
            fond.paste(image, mask=image.split()[-1])
            image = fond
        image = image.convert("RGB")
        image.thumbnail((560, 560))
        image.save(cible, "JPEG", quality=76, optimize=True, progressive=True)
        trace.write_text(fichier, encoding="utf-8")
        time.sleep(0.6)
    return "img/" + cible.name


def main():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    remplacements = json.loads(REMPLACEMENTS.read_text(encoding="utf-8")) if REMPLACEMENTS.exists() else {}
    langues = [langue["code"] for langue in json.loads(LANGUES.read_text(encoding="utf-8"))]
    items = source["items"]
    DOSSIER_IMG.mkdir(parents=True, exist_ok=True)
    SORTIE.parent.mkdir(parents=True, exist_ok=True)
    problemes = []

    identifiants = [item["id"] for item in items]
    if len(set(identifiants)) != len(identifiants):
        sys.exit("Identifiants en double dans curiosites.json")
    for item in items:
        if item["pays"] not in source["pays"]:
            sys.exit("Pays inconnu pour " + item["id"])

    articles = resoudre_articles([item["wiki"] for item in items])
    wikidata = elements_wikidata(sorted({qid for _, qid, _ in articles.values() if qid}), langues)
    fichiers = {}
    for item in items:
        titre, qid, image_article = articles[item["wiki"]]
        if titre is None:
            problemes.append(f"{item['id']} : article introuvable « {item['wiki']} »")
        fichier = remplacements.get(item["id"]) or (wikidata.get(qid) or {}).get("image") or image_article
        if fichier:
            fichiers[item["id"]] = fichier
        elif titre is not None:
            problemes.append(f"{item['id']} : aucune image trouvée ({qid})")
    fiches = fiches_commons(sorted(set(fichiers.values())))

    sortie_items = []
    photos_vues = {}
    for item in items:
        titre, qid, _ = articles[item["wiki"]]
        fiche = fiches.get(fichiers.get(item["id"], ""))
        if titre is None or fiche is None or not fiche.get("vignette"):
            if titre is not None and item["id"] in fichiers and fiche is None:
                problemes.append(f"{item['id']} : fiche Commons introuvable pour {fichiers[item['id']]}")
            continue
        licence = fiche["licence"]
        if not licence or not licence.lower().startswith(LICENCES_OK):
            problemes.append(f"{item['id']} : licence à vérifier « {licence} » ({fiche['page']})")
            continue
        # Une photo sans auteur connu, ou déjà utilisée par une autre curiosité, n'entre pas dans le jeu.
        if not fiche["auteur"]:
            problemes.append(f"{item['id']} : auteur de la photo inconnu ({fiche['page']})")
            continue
        if fichiers[item["id"]] in photos_vues:
            problemes.append(f"{item['id']} : même photo que {photos_vues[fichiers[item['id']]]} ({fichiers[item['id']]})")
            continue
        try:
            chemin = telecharger(fiche["vignette"], item["id"], fichiers[item["id"]])
        except Exception as erreur:
            problemes.append(f"{item['id']} : téléchargement impossible ({erreur})")
            continue
        photos_vues[fichiers[item["id"]]] = item["id"]
        element = wikidata.get(qid) or {"articles": {}, "noms": {}}
        liens = {langue: lien_wikipedia(langue, titre_langue) for langue, titre_langue in element["articles"].items()}
        liens["fr"] = lien_wikipedia("fr", titre)
        sortie_items.append({
            "id": item["id"], "nom": item["nom"], "pays": item["pays"], "cat": item["cat"], "niv": item["niv"],
            "fait": item["fait"], "img": chemin, "wikidata": qid, "liens": liens, "noms": element["noms"],
            "credit": {"auteur": fiche["auteur"], "depot": fiche["depot"], "licence": licence, "page": fiche["page"]},
        })

    # Un pays n'entre dans le jeu qu'avec au moins MINIMUM_PAR_PAYS curiosités utilisables.
    par_pays = {}
    for item in sortie_items:
        par_pays[item["pays"]] = par_pays.get(item["pays"], 0) + 1
    ecartes = sorted(code for code in source["pays"] if par_pays.get(code, 0) < MINIMUM_PAR_PAYS)
    sortie_items = [item for item in sortie_items if item["pays"] not in ecartes]
    pays_sortie = {code: fiche for code, fiche in source["pays"].items() if code not in ecartes}

    SORTIE.write_text(json.dumps({"pays": pays_sortie, "items": sortie_items}, ensure_ascii=False, indent=1) + "\n",
                      encoding="utf-8")
    # Ménage : les photos et les traces qui ne servent plus sont supprimées.
    utiles = {item["id"] for item in sortie_items}
    supprimees = 0
    for dossier, motif in ((DOSSIER_IMG, "*.jpg"), (TRACES, "*.source")):
        for chemin in dossier.glob(motif):
            if chemin.stem not in utiles:
                chemin.unlink()
                supprimees += 1
    lignes = [f"{len(sortie_items)} curiosités sur {len(items)} retenues, pour {len(pays_sortie)} pays",
              f"Pays écartés (moins de {MINIMUM_PAR_PAYS} curiosités utilisables) : "
              + (", ".join(f"{code} ({par_pays.get(code, 0)})" for code in ecartes) or "aucun"),
              f"Fichiers inutiles supprimés : {supprimees}",
              f"{len(problemes)} problème(s) :"] + ["  - " + p for p in problemes]
    RAPPORT.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print("\n".join(lignes))

    import construire_site  # même dossier
    construire_site.main()


if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    main()
