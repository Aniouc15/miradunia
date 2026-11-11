"""Écrit les fichiers du site dans chaque langue, sans réseau.

Entrées :
- outils/cache/donnees.json : curiosités, photos, crédits et liens (produit par construire_donnees.py) ;
- outils/site.json : nom du jeu, adresse publique, adresse de contact, langue par défaut ;
- outils/langues/langues.json : langues prévues ;
- outils/langues/ui.fr.json : textes de l'interface en français (la référence) ;
- outils/langues/<code>.json pour chaque autre langue : {"ui": {...}, "pays": {code: nom}, "items": {id: {"nom", "fait"}}}.
Une langue n'est publiée que si sa traduction est complète et passe les contrôles.

Sorties : site/data/data.js (données communes à toutes les langues), site/lang/<code>.js (textes d'une langue),
site/<code>/index.html et manifest.webmanifest (une page par langue), site/index.html (choix de la langue).

Usage : python outils/construire_site.py
"""
import html
import json
import re
import shutil
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
OUTILS = RACINE / "outils"
SITE = RACINE / "site"
REPERES = re.compile(r"\{\w+\}|</?[ab]>")
LOGO = ('<svg viewBox="0 0 64 64" width="30" height="30" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="none" '
        'stroke="currentColor" stroke-width="4"/><path d="M4 32h56M32 4c-14 14-14 42 0 56M32 4c14 14 14 42 0 56" '
        'fill="none" stroke="currentColor" stroke-width="3"/><circle cx="43" cy="22" r="6" fill="#d98a1f"/></svg>')

MODELE_PAGE = """<!doctype html>
<html lang="{code}" dir="{dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{titre}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#0f6b6b">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{marque}">
<meta property="og:title" content="{titre}">
<meta property="og:description" content="{partage}">
<meta property="og:url" content="{url_page}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="{og}">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{url_page}">
{alternatives}
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="../icone.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="../icone-180.png">
<link rel="stylesheet" href="../style.css">
</head>
<body>
<header class="entete">
  <a class="marque" href="#" data-vue="accueil" aria-label="{entete_accueil}">
    {logo}
    <span>{marque}</span>
  </a>
  <span class="serie-entete" id="serie-entete" title="{serie_titre}"></span>
</header>

<main id="app" tabindex="-1">
  <section class="carte"><h1>{statique_titre}</h1><p>{statique_texte}</p></section>
</main>

<nav class="barre" aria-label="{nav_label}">
{boutons}
</nav>

<noscript><p class="carte">{sans_js}</p></noscript>
<script>window.GC_PAGE = {page_js};</script>
<script src="../data/data.js"></script>
<script src="../lang/{code}.js"></script>
<script src="../js/core.js"></script>
<script src="../js/app.js"></script>
</body>
</html>
"""

MODELE_RACINE = """<!doctype html>
<html lang="{code}" dir="{dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{titre}</title>
<meta name="description" content="{description}">
<meta name="theme-color" content="#0f6b6b">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{marque}">
<meta property="og:title" content="{titre}">
<meta property="og:description" content="{partage}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{url}">
{alternatives}
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icone.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icone-180.png">
<link rel="stylesheet" href="style.css">
<script>
(function () {
  // Langue retenue par le joueur, sinon celle du navigateur, sinon la langue par défaut.
  var langues = {langues_js};
  var choix = null;
  try { choix = localStorage.getItem('globecurios_langue'); } catch (e) { choix = null; }
  if (langues.indexOf(choix) < 0) {
    choix = null;
    var preferees = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < preferees.length && !choix; i++) {
      var code = String(preferees[i]).toLowerCase().split('-')[0];
      if (langues.indexOf(code) >= 0) choix = code;
    }
  }
  location.replace((choix || {defaut_js}) + '/' + (location.protocol === 'file:' ? 'index.html' : '') +
    location.search + location.hash);
})();
</script>
</head>
<body>
<main class="choix-langue">
  <h1 class="marque">{logo} <span>{marque}</span></h1>
  <ul>
{liens}
  </ul>
</main>
</body>
</html>
"""


def lire(chemin):
    return json.loads(Path(chemin).read_text(encoding="utf-8"))


def ecrire(chemin, texte):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    with open(chemin, "w", encoding="utf-8", newline="\n") as fichier:
        fichier.write(texte)


def e(texte):
    return html.escape(str(texte), quote=True)


def remplir(modele, valeurs):
    return re.sub(r"\{(\w+)\}", lambda m: str(valeurs[m.group(1)]) if m.group(1) in valeurs else m.group(0), modele)


def js(nom, valeur):
    return "window." + nom + " = " + json.dumps(valeur, ensure_ascii=False, separators=(",", ":")) + ";\n"


def simple(texte):
    """Minuscules sans accents, pour comparer des noms."""
    texte = unicodedata.normalize("NFKD", str(texte).casefold())
    return "".join(c for c in texte if not unicodedata.combining(c))


def texte_simple(valeur, cle):
    """Texte d'interface sans repères ni balises, pour les pages statiques (une entrée au pluriel prend sa forme « other »)."""
    texte = valeur[cle]["other"] if isinstance(valeur[cle], dict) else valeur[cle]
    return re.sub(r"</?[ab]>", "", texte)


def controler_ui(ui, reference):
    erreurs = []
    for cle, francais in reference.items():
        if cle not in ui:
            erreurs.append("texte manquant : " + cle)
            continue
        traduit = ui[cle]
        if isinstance(francais, dict):
            if not isinstance(traduit, dict) or not isinstance(traduit.get("other"), str):
                erreurs.append("forme « other » manquante : " + cle)
                continue
            permis = {m for forme in francais.values() for m in REPERES.findall(forme)}
            for forme, texte in traduit.items():
                if not isinstance(texte, str) or not set(REPERES.findall(texte)) <= permis:
                    erreurs.append("repère inconnu dans %s (%s)" % (cle, forme))
            if set(REPERES.findall(francais["other"])) - set(REPERES.findall(traduit["other"])):
                erreurs.append("repère perdu dans %s (other)" % cle)
        elif not isinstance(traduit, str) or sorted(REPERES.findall(traduit)) != sorted(REPERES.findall(francais)):
            erreurs.append("repères différents : " + cle)
        elif not traduit.strip():
            erreurs.append("texte vide : " + cle)
    erreurs += ["texte inconnu : " + cle for cle in ui if cle not in reference]
    return erreurs


def controler_contenu(langue, pays, items, donnees):
    erreurs = []
    for code in donnees["pays"]:
        if not str(pays.get(code, "")).strip():
            erreurs.append("pays manquant : " + code)
    for item in donnees["items"]:
        texte = items.get(item["id"])
        if not texte or not str(texte.get("nom", "")).strip() or not str(texte.get("fait", "")).strip():
            erreurs.append("curiosité manquante : " + item["id"])
            continue
        nom_pays = pays.get(item["pays"], "")
        if nom_pays and simple(nom_pays) in simple(texte["nom"]):
            erreurs.append("le nom contient le pays : %s (%s)" % (item["id"], texte["nom"]))
        if len(texte["fait"]) > 320:
            erreurs.append("phrase trop longue : " + item["id"])
    return erreurs


def main():
    config = lire(OUTILS / "site.json")
    donnees = lire(OUTILS / "cache" / "donnees.json")
    prevues = lire(OUTILS / "langues" / "langues.json")
    reference = lire(OUTILS / "langues" / "ui.fr.json")
    url = config["url"]

    publiees, rapport = [], []
    for langue in prevues:
        code = langue["code"]
        if code == "fr":
            ui = reference
            pays = {c: p["nom"] for c, p in donnees["pays"].items()}
            items = {i["id"]: {"nom": i["nom"], "fait": i["fait"]} for i in donnees["items"]}
            erreurs = controler_contenu(code, pays, items, donnees)
        else:
            chemin = OUTILS / "langues" / (code + ".json")
            if not chemin.exists():
                rapport.append("%s : pas de traduction" % code)
                continue
            traduction = lire(chemin)
            ui, pays, items = traduction.get("ui", {}), traduction.get("pays", {}), traduction.get("items", {})
            erreurs = controler_ui(ui, reference) + controler_contenu(code, pays, items, donnees)
        if erreurs:
            rapport.append("%s : non publiée, %d problème(s) : %s" % (code, len(erreurs), " ; ".join(erreurs[:8])))
            continue
        publiees.append(dict(langue, ui=ui, pays=pays, items=items))
        rapport.append("%s : publiée" % code)
    if not any(langue["code"] == "fr" for langue in publiees):
        raise SystemExit("Le français ne passe pas les contrôles :\n" + "\n".join(rapport))

    codes = [langue["code"] for langue in publiees]
    defaut = config.get("langue_par_defaut") if config.get("langue_par_defaut") in codes else "fr"

    # Données communes : règles et photos, sans aucun texte propre à une langue.
    ecrire(SITE / "data" / "data.js", js("GC_DATA", {
        "marque": config["marque"], "adresse": config["adresse"], "contact": config.get("contact", ""),
        "langues": [{"code": langue["code"], "nom": langue["nom"]} for langue in publiees],
        "pays": {code: {"continent": fiche["continent"]} for code, fiche in donnees["pays"].items()},
        "items": [{"id": i["id"], "pays": i["pays"], "cat": i["cat"], "niv": i["niv"], "img": i["img"],
                   "credit": i["credit"]} for i in donnees["items"]],
    }))

    alternatives = "\n".join('<link rel="alternate" hreflang="%s" href="%s%s/">' % (c, e(url), c) for c in codes)
    alternatives += '\n<link rel="alternate" hreflang="x-default" href="%s">' % e(url)
    for langue in publiees:
        code, ui = langue["code"], langue["ui"]
        liens = {}
        for item in donnees["items"]:
            liens[item["id"]] = item["liens"].get(code) or item["liens"].get("en") or item["liens"]["fr"]
        ecrire(SITE / "lang" / (code + ".js"), js("GC_LANGUE", {
            "code": code, "locale": langue["locale"], "dir": langue["dir"], "ui": ui, "pays": langue["pays"],
            "items": {i: [langue["items"][i]["nom"], langue["items"][i]["fait"], liens[i]] for i in liens},
        }))
        image = "partage-%s.png" % code if (SITE / ("partage-%s.png" % code)).exists() else "partage.png"
        boutons = []
        for vue in ["accueil", "atlas", "album", "revision", "regles"]:
            pastille = '<span id="pastille-revision" class="pastille" hidden></span>' if vue == "revision" else ""
            boutons.append('  <button type="button" data-vue="%s"><span class="libelle">%s</span>%s</button>'
                           % (vue, e(texte_simple(ui, "nav." + vue)), pastille))
        marque = config["marque"]
        valeurs = {
            "code": code, "dir": langue["dir"], "og": langue["og"], "marque": e(marque), "logo": LOGO,
            "titre": e(remplir(ui["meta.titre"], {"marque": marque})),
            "description": e(ui["meta.description"]), "partage": e(ui["meta.partage"]),
            "url_page": e(url + code + "/"), "image": e(url + image), "alternatives": alternatives,
            "entete_accueil": e(remplir(ui["entete.accueil"], {"marque": marque})),
            "serie_titre": e(ui["entete.serie_titre"]), "nav_label": e(ui["nav.label"]),
            "statique_titre": e(ui["statique.titre"]), "statique_texte": e(remplir(ui["statique.texte"], {"marque": marque})),
            "sans_js": e(remplir(ui["statique.sans_javascript"], {"marque": marque})), "boutons": "\n".join(boutons),
            "page_js": json.dumps({"langue": code, "racine": "../"}),
        }
        ecrire(SITE / code / "index.html", remplir(MODELE_PAGE, valeurs))
        ecrire(SITE / code / "manifest.webmanifest", json.dumps({
            "name": marque, "short_name": marque, "description": ui["statique.titre"],
            "lang": code, "dir": langue["dir"], "start_url": "./", "scope": "../", "display": "standalone",
            "background_color": "#f5efe3", "theme_color": "#0f6b6b",
            "icons": [{"src": "../icone-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                      {"src": "../icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                      {"src": "../icone.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}],
        }, ensure_ascii=False, indent=2) + "\n")

    # Page d'accueil commune : elle envoie vers la langue du joueur, et liste les langues pour les moteurs de recherche.
    premiere = next(langue for langue in publiees if langue["code"] == defaut)
    liens = "\n".join('    <li><a href="%s/" lang="%s" hreflang="%s">%s</a></li>' % (c["code"], c["code"], c["code"], e(c["nom"]))
                      for c in publiees)
    ecrire(SITE / "index.html", remplir(MODELE_RACINE, {
        "code": defaut, "dir": premiere["dir"], "marque": e(config["marque"]), "logo": LOGO,
        "titre": e(remplir(premiere["ui"]["meta.titre"], {"marque": config["marque"]})),
        "description": e(premiere["ui"]["meta.description"]), "partage": e(premiere["ui"]["meta.partage"]),
        "url": e(url), "image": e(url + "partage.png"), "alternatives": alternatives,
        "langues_js": json.dumps(codes), "defaut_js": json.dumps(defaut), "liens": liens,
    }))
    ecrire(SITE / "manifest.webmanifest", json.dumps({
        "name": config["marque"], "short_name": config["marque"], "description": premiere["ui"]["statique.titre"],
        "start_url": "./", "scope": "./", "display": "standalone", "background_color": "#f5efe3", "theme_color": "#0f6b6b",
        "icons": [{"src": "icone-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                  {"src": "icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                  {"src": "icone.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}],
    }, ensure_ascii=False, indent=2) + "\n")

    # Ménage : rien ne reste en ligne d'une langue qui n'est plus publiée.
    for langue in prevues:
        code = langue["code"]
        if code in codes:
            continue
        fichier = SITE / "lang" / (code + ".js")
        if fichier.exists():
            fichier.unlink()
        dossier = SITE / code
        if dossier.is_dir() and (dossier / "index.html").exists() and len(code) == 2:
            shutil.rmtree(dossier)
    print("Site : %d curiosités, %d pays ; langues : %s" % (len(donnees["items"]), len(donnees["pays"]), ", ".join(codes)))
    print("\n".join("  " + ligne for ligne in rapport))


if __name__ == "__main__":
    main()
