"""Écrit les fichiers du site dans chaque langue, sans réseau.

Entrées :
- outils/cache/donnees.json : curiosités, photos, crédits et liens (produit par construire_donnees.py) ;
- outils/site.json : nom du jeu, adresse publique, adresse de contact, langue par défaut ;
- outils/langues/langues.json : langues prévues ;
- outils/langues/ui.fr.json : textes de l'interface en français (la référence) ;
- outils/langues/<code>.json pour chaque autre langue : {"ui": {...}, "pays": {code: nom}, "items": {id: {"nom", "fait"}}}.
Une langue n'est publiée que si son interface est complète ; une curiosité, que si elle est prête dans toutes les langues publiées.

Sorties : site/data/data.js (données communes à toutes les langues), site/lang/<code>.js (interface et pays d'une langue),
site/textes/<code>/<n>.js (nom, phrase, lien et crédit des curiosités, par paquets), outils/publication.json (vagues),
site/<code>/index.html et manifest.webmanifest (une page par langue), site/index.html (choix de la langue).

Usage : python outils/construire_site.py
"""
import datetime
import html
import json
import re
import shutil
import unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parent.parent
OUTILS = RACINE / "outils"
SITE = RACINE / "site"
PUBLICATION = OUTILS / "publication.json"  # vague de chaque curiosité publiée (voir versions_et_vagues)
PAQUETS = 256  # nombre de fichiers de textes par langue
BLOC = 14  # comme dans site/js/core.js
LANCEMENT = datetime.date(2026, 11, 11)  # défi n° 1, comme dans site/js/core.js
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


def controler_pays(pays, donnees):
    return ["pays manquant : " + code for code in donnees["pays"] if not str(pays.get(code, "")).strip()]


def probleme_item(item, texte, pays):
    """Raison pour laquelle une curiosité ne peut pas être publiée dans une langue, ou None."""
    if not texte or not str(texte.get("nom", "")).strip() or not str(texte.get("fait", "")).strip():
        return "texte manquant"
    if not str(pays.get(item["pays"], "")).strip():
        return "nom du pays manquant"
    nom_pays = pays.get(item["pays"], "")
    if nom_pays and simple(nom_pays) in simple(texte["nom"]):
        return "le nom contient le pays (%s)" % texte["nom"]
    if len(texte["fait"]) > 320:
        return "phrase trop longue"
    return None


def hacher(texte):
    """Même calcul que hacher() dans site/js/core.js (FNV-1a sur 32 bits)."""
    h = 2166136261
    for c in texte:
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    return h


def paquet_de(ident):
    return hacher("paquet-" + ident) % PAQUETS


def nom_photo(ident):
    """Nom neutre de la photo d'une curiosité (img/<nom>.jpg) : le nom du fichier ne doit pas trahir la réponse.
    Même calcul que nomPhoto() dans site/js/core.js."""
    return "%08x%04x" % (hacher("photo-a-" + ident), hacher("photo-b-" + ident) >> 16)


def jour_du_defi(date):
    return (date - LANCEMENT).days


def versions_et_vagues(ids):
    """Numéro de vague de chaque curiosité publiée. Une curiosité déjà publiée garde sa vague ; les nouvelles rejoignent
    une vague qui n'entre dans les défis qu'au début d'un bloc de 14 jours qui commence au plus tôt après-demain
    (le défi du jour ne change jamais, même pour un joueur qui a déjà un jour d'avance sur Paris)."""
    registre = lire(PUBLICATION) if PUBLICATION.exists() else {"versions": [], "items": {}}
    versions, vagues = [list(p) for p in registre["versions"]], dict(registre["items"])
    nouveaux = [i for i in ids if i not in vagues]
    if nouveaux:
        if not versions:
            versions.append([0, 0])
            numero = 0
        else:
            aujourd_hui = jour_du_defi(datetime.date.today())
            debut, numero = versions[-1]
            if debut < aujourd_hui + 2:  # la dernière vague est déjà en jeu (ou presque) : on en ouvre une nouvelle
                debut = -(-(aujourd_hui + 2) // BLOC) * BLOC
                numero += 1
                versions.append([debut, numero])
        for i in nouveaux:
            vagues[i] = numero
    with open(PUBLICATION, "w", encoding="utf-8", newline="\n") as f:
        json.dump({"versions": versions, "items": vagues}, f, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        f.write("\n")
    return versions, vagues


def main():
    config = lire(OUTILS / "site.json")
    donnees = lire(OUTILS / "cache" / "donnees.json")
    prevues = lire(OUTILS / "langues" / "langues.json")
    reference = lire(OUTILS / "langues" / "ui.fr.json")
    url = config["url"]

    # 1. Langues : une langue est publiée si son interface et ses noms de pays sont complets et si elle traduit
    #    au moins 90 % des curiosités. Une curiosité n'est publiée que si elle est prête dans toutes ces langues :
    #    les autres attendent leur traduction (le défi du jour doit être le même pour tous).
    candidates, rapport = [], []
    deja_publiees = set(lire(PUBLICATION)["items"]) if PUBLICATION.exists() else set()
    for langue in prevues:
        code = langue["code"]
        if code == "fr":
            ui = reference
            pays = {c: p["nom"] for c, p in donnees["pays"].items()}
            items = {i["id"]: {"nom": i["nom"], "fait": i["fait"]} for i in donnees["items"]}
            erreurs = []
        else:
            chemin = OUTILS / "langues" / (code + ".json")
            if not chemin.exists():
                rapport.append("%s : pas de traduction" % code)
                continue
            traduction = lire(chemin)
            ui, pays, items = traduction.get("ui", {}), traduction.get("pays", {}), traduction.get("items", {})
            erreurs = controler_ui(ui, reference)
        # Seuls les pays déjà en jeu doivent être nommés ; un nouveau pays attend sa traduction avec ses curiosités.
        pays_en_jeu = {i["pays"] for i in donnees["items"] if i["id"] in deja_publiees}
        erreurs += controler_pays(pays, {"pays": {c: p for c, p in donnees["pays"].items() if c in pays_en_jeu or not deja_publiees}})
        problemes = {}
        for item in donnees["items"]:
            raison = probleme_item(item, items.get(item["id"]), pays)
            if raison:
                problemes[item["id"]] = raison
        # Une langue ne doit pas faire disparaître des curiosités déjà en ligne ; les nouvelles, elles, peuvent attendre.
        perdues = [i for i in problemes if i in deja_publiees]
        if len(perdues) > 0.02 * max(1, len(deja_publiees)):
            erreurs.append("%d curiosités déjà publiées sans traduction utilisable" % len(perdues))
        if erreurs:
            rapport.append("%s : non publiée, %d problème(s) : %s" % (code, len(erreurs), " ; ".join(erreurs[:8])))
            continue
        candidates.append(dict(langue, ui=ui, pays=pays, items=items, problemes=problemes))
    # Une langue traduite qui échoue arrête tout : on ne publie pas un site amputé d'une langue.
    if len(candidates) < len([l for l in prevues if l["code"] == "fr" or (OUTILS / "langues" / (l["code"] + ".json")).exists()]):
        raise SystemExit("Langue en échec, rien n'est écrit :\n" + "\n".join(rapport))
    if not any(langue["code"] == "fr" for langue in candidates):
        raise SystemExit("Le français ne passe pas les contrôles :\n" + "\n".join(rapport))
    publiees = candidates
    attente = {}
    for langue in publiees:
        for ident, raison in langue["problemes"].items():
            attente.setdefault(ident, []).append("%s : %s" % (langue["code"], raison))
        rapport.append("%s : publiée%s" % (langue["code"], " (%d curiosités en attente dans cette langue)" % len(langue["problemes"]) if langue["problemes"] else ""))
    items = [i for i in donnees["items"] if i["id"] not in attente]
    compte = {}
    for i in items:
        compte[i["pays"]] = compte.get(i["pays"], 0) + 1
    # Un pays n'entre dans le jeu qu'avec au moins 4 curiosités publiées.
    trop_peu = {c for c in donnees["pays"] if compte.get(c, 0) < 4}
    for i in items:
        if i["pays"] in trop_peu:
            attente.setdefault(i["id"], []).append("pays avec moins de 4 curiosités publiées")
    items = [i for i in items if i["pays"] not in trop_peu]
    pays_publies = {c: p for c, p in donnees["pays"].items() if c not in trop_peu}
    if attente:
        rapport.append("%d curiosité(s) en attente, détail dans outils/rapport_site.txt" % len(attente))
    (OUTILS / "rapport_site.txt").write_text("\n".join("%s | %s" % (i, " ; ".join(r)) for i, r in sorted(attente.items())) + "\n", encoding="utf-8")

    codes = [langue["code"] for langue in publiees]
    defaut = config.get("langue_par_defaut") if config.get("langue_par_defaut") in codes else "fr"
    versions, vagues = versions_et_vagues([i["id"] for i in items])

    # 2. Données communes : règles et vagues, sans aucun texte propre à une langue. Photo : img/<nom_photo(id)>.jpg.
    for i in items:
        if i["img"] != "img/" + nom_photo(i["id"]) + ".jpg" or not (SITE / i["img"]).exists():
            raise SystemExit("photo mal nommée ou absente : " + i["id"])
    def neutre(i):
        fiche = {"id": i["id"], "pays": i["pays"], "cat": i["cat"], "niv": i["niv"]}
        if vagues[i["id"]]:
            fiche["v"] = vagues[i["id"]]
        aussi = [c for c in i.get("aussi", []) if c in pays_publies]
        if aussi:
            fiche["aussi"] = aussi  # autres pays acceptés comme réponse
        return fiche
    ecrire(SITE / "data" / "data.js", js("GC_DATA", {
        "marque": config["marque"], "adresse": config["adresse"], "contact": config.get("contact", ""),
        "langues": [{"code": langue["code"], "nom": langue["nom"]} for langue in publiees],
        "pays": {code: {"continent": fiche["continent"]} for code, fiche in pays_publies.items()},
        "versions": versions, "paquets": PAQUETS,
        "items": [neutre(i) for i in items],
    }).replace('{"id":', '\n{"id":'))

    # 3. Textes de chaque langue : interface et pays dans lang/<code>.js ; nom, phrase, lien et crédit de chaque curiosité
    #    dans textes/<code>/<paquet>.js, chargés à la demande.
    if (SITE / "textes").exists():
        shutil.rmtree(SITE / "textes")
    alternatives = "\n".join('<link rel="alternate" hreflang="%s" href="%s%s/">' % (c, e(url), c) for c in codes)
    alternatives += '\n<link rel="alternate" hreflang="x-default" href="%s">' % e(url)
    for langue in publiees:
        code, ui = langue["code"], langue["ui"]
        ecrire(SITE / "lang" / (code + ".js"), js("GC_LANGUE", {
            "code": code, "locale": langue["locale"], "dir": langue["dir"], "ui": ui,
            "pays": {c: langue["pays"][c] for c in pays_publies},
        }))
        paquets = [dict() for _ in range(PAQUETS)]
        for item in items:
            texte = langue["items"][item["id"]]
            lien = item["liens"].get(code) or item["liens"].get("en") or item["liens"]["fr"]
            credit = item["credit"]
            paquets[paquet_de(item["id"])][item["id"]] = [texte["nom"], texte["fait"], lien, credit["auteur"],
                                                         credit["licence"], credit["page"], 1 if credit["depot"] else 0]
        for n, contenu in enumerate(paquets):
            ecrire(SITE / "textes" / code / ("%d.js" % n), "GC_PAQUET(%s,%d,%s);\n" % (
                json.dumps(code), n, json.dumps(contenu, ensure_ascii=False, separators=(",", ":"))))
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
        "url": e(url), "alternatives": alternatives,
        "image": e(url + ("partage-%s.png" % defaut if (SITE / ("partage-%s.png" % defaut)).exists() else "partage.png")),
        "langues_js": json.dumps(codes), "defaut_js": json.dumps(defaut), "liens": liens,
    }))
    ecrire(SITE / "manifest.webmanifest", json.dumps({
        "name": config["marque"], "short_name": config["marque"], "description": premiere["ui"]["statique.titre"],
        "start_url": "./", "scope": "./", "display": "standalone", "background_color": "#f5efe3", "theme_color": "#0f6b6b",
        "icons": [{"src": "icone-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any"},
                  {"src": "icone-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any"},
                  {"src": "icone.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any"}],
    }, ensure_ascii=False, indent=2) + "\n")

    # Pour les moteurs de recherche : une adresse par langue, chacune avec ses équivalents dans les autres langues.
    liens_alt = "".join('<xhtml:link rel="alternate" hreflang="%s" href="%s%s/"/>' % (c, e(url), c) for c in codes)
    ecrire(SITE / "sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n'
           + "".join("<url><loc>%s%s/</loc>%s</url>\n" % (e(url), c, liens_alt) for c in codes) + "</urlset>\n")
    ecrire(SITE / "robots.txt", "User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % url)

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
    print("Site : %d curiosités, %d pays ; langues : %s" % (len(items), len(pays_publies), ", ".join(codes)))
    print("\n".join("  " + ligne for ligne in rapport))


if __name__ == "__main__":
    main()
