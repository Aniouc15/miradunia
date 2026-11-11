"""Construit site/data/data.js et télécharge les photos à partir de outils/curiosites.json.

Pour chaque curiosité : article Wikipédia en français -> élément Wikidata -> image principale (P18)
-> fiche Wikimedia Commons (auteur, licence) -> vignette de 640 px enregistrée dans site/img/.
Aucune clé, aucun compte, aucun coût. Relancer le script ne retélécharge pas les photos déjà présentes.

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
DOSSIER_IMG = RACINE / "site" / "img"
SORTIE = RACINE / "site" / "data" / "data.js"
RAPPORT = RACINE / "outils" / "rapport_donnees.txt"
AGENT = "GlobeCuriosDataBuilder/0.1 (https://globecurious.com; jeu educatif statique)"
LICENCES_OK = ("cc", "public domain", "pd", "gfdl", "fal", "no restrictions", "attribution", "copyrighted free use", "licence ouverte")


def appel(url, params):
    requete = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": AGENT})
    for essai in range(4):
        try:
            with urllib.request.urlopen(requete, timeout=40) as reponse:
                return json.loads(reponse.read().decode("utf-8"))
        except Exception as erreur:  # réseau : on réessaie
            if essai == 3:
                raise
            time.sleep(2 + 2 * essai)
    return None


def lots(liste, taille):
    for debut in range(0, len(liste), taille):
        yield liste[debut:debut + taille]


def texte_brut(valeur):
    valeur = re.sub(r"<[^>]+>", "", valeur or "")
    valeur = html.unescape(valeur)
    return re.sub(r"\s+", " ", valeur).strip()


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


def images_wikidata(identifiants):
    """identifiant Wikidata -> nom du fichier Commons (P18)"""
    resultat = {}
    for lot in lots(identifiants, 40):
        donnees = appel("https://www.wikidata.org/w/api.php", {
            "action": "wbgetentities", "format": "json", "props": "claims", "ids": "|".join(lot)})
        for identifiant, entite in donnees.get("entities", {}).items():
            for declaration in entite.get("claims", {}).get("P18", []):
                valeur = declaration.get("mainsnak", {}).get("datavalue", {}).get("value")
                if valeur:
                    resultat[identifiant] = valeur
                    break
        time.sleep(0.3)
    return resultat


def fiches_commons(fichiers):
    """nom de fichier -> {vignette, page, auteur, licence}"""
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
            resultat[origine[5:]] = {
                "vignette": info.get("thumburl") or info.get("url"),
                "page": info.get("descriptionurl"),
                # Auteur déclaré ; à défaut, le compte Commons qui a déposé la photo.
                "auteur": (texte_brut(meta.get("Artist", {}).get("value"))
                           or ("compte Commons " + info["user"] if info.get("user") else ""))[:80],
                "licence": texte_brut(meta.get("LicenseShortName", {}).get("value")),
            }
        time.sleep(0.3)
    return resultat


def telecharger(url, identifiant, fichier):
    """Enregistre la photo en JPEG de 560 px de large au plus (environ 50 Ko)."""
    from io import BytesIO
    from PIL import Image
    cible = DOSSIER_IMG / (identifiant + ".jpg")
    trace = RACINE / "outils" / "traces" / (identifiant + ".source")
    trace.parent.mkdir(exist_ok=True)
    if not cible.exists() or not trace.exists() or trace.read_text(encoding="utf-8") != fichier:
        for ancien in DOSSIER_IMG.glob(identifiant + ".*"):
            ancien.unlink()
        requete = urllib.request.Request(url, headers={"User-Agent": AGENT})
        with urllib.request.urlopen(requete, timeout=60) as reponse:
            image = Image.open(BytesIO(reponse.read()))
        if image.mode in ("RGBA", "LA", "P"):
            image = image.convert("RGBA")
            fond = Image.new("RGB", image.size, "white")
            fond.paste(image, mask=image.split()[-1])
            image = fond
        image = image.convert("RGB")
        image.thumbnail((560, 560))
        image.save(cible, "JPEG", quality=76, optimize=True, progressive=True)
        trace.write_text(fichier, encoding="utf-8")
        time.sleep(0.25)
    return "img/" + cible.name


def main():
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    remplacements = json.loads(REMPLACEMENTS.read_text(encoding="utf-8")) if REMPLACEMENTS.exists() else {}
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
    wikidata = images_wikidata(sorted({qid for _, qid, _ in articles.values() if qid}))
    fichiers = {}
    for item in items:
        titre, qid, image_article = articles[item["wiki"]]
        if titre is None:
            problemes.append(f"{item['id']} : article introuvable « {item['wiki']} »")
        fichier = remplacements.get(item["id"]) or wikidata.get(qid) or image_article
        if fichier:
            fichiers[item["id"]] = fichier
        elif titre is not None:
            problemes.append(f"{item['id']} : aucune image trouvée ({qid})")
    fiches = fiches_commons(sorted(set(fichiers.values())))

    sortie_items = []
    for item in items:
        titre = articles[item["wiki"]][0]
        fiche = fiches.get(fichiers.get(item["id"], ""))
        if titre is None or fiche is None or not fiche.get("vignette"):
            if titre is not None and item["id"] in fichiers and fiche is None:
                problemes.append(f"{item['id']} : fiche Commons introuvable pour {fichiers[item['id']]}")
            continue
        licence = fiche["licence"]
        if not licence or not licence.lower().startswith(LICENCES_OK):
            problemes.append(f"{item['id']} : licence à vérifier « {licence} » ({fiche['page']})")
            continue
        try:
            chemin = telecharger(fiche["vignette"], item["id"], fichiers[item["id"]])
        except Exception as erreur:
            problemes.append(f"{item['id']} : téléchargement impossible ({erreur})")
            continue
        sortie_items.append({
            "id": item["id"], "nom": item["nom"], "pays": item["pays"], "cat": item["cat"],
            "niv": item["niv"], "fait": item["fait"], "img": chemin,
            "lien": "https://fr.wikipedia.org/wiki/" + urllib.parse.quote(titre.replace(" ", "_")),
            "credit": {"auteur": fiche["auteur"] or "auteur non indiqué", "licence": licence, "page": fiche["page"]},
        })

    donnees = {"pays": source["pays"], "items": sortie_items}
    SORTIE.write_text("window.GC_DATA = " + json.dumps(donnees, ensure_ascii=False, indent=1) + ";\n", encoding="utf-8")
    par_pays = {}
    for item in sortie_items:
        par_pays[item["pays"]] = par_pays.get(item["pays"], 0) + 1
    faibles = [f"{code} ({nombre})" for code, nombre in sorted(par_pays.items()) if nombre < 3]
    manquants = [code for code in source["pays"] if code not in par_pays]
    lignes = [f"{len(sortie_items)} curiosités sur {len(items)} écrites dans {SORTIE.name}",
              "Pays avec moins de 3 curiosités : " + (", ".join(faibles) or "aucun"),
              "Pays sans curiosité : " + (", ".join(manquants) or "aucun"),
              f"{len(problemes)} problème(s) :"] + ["  - " + p for p in problemes]
    RAPPORT.write_text("\n".join(lignes) + "\n", encoding="utf-8")
    print("\n".join(lignes))


if __name__ == "__main__":
    main()
