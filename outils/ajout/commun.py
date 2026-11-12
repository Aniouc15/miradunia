"""Outils communs aux étapes d'ajout de curiosités (une « tranche » = environ 1 000 curiosités)."""
import io, json, re, unicodedata
from pathlib import Path

RACINE = Path(__file__).resolve().parents[2]
SOURCE = RACINE / "outils" / "curiosites.json"
DONNEES = RACINE / "outils" / "cache" / "donnees.json"
LANGUES = RACINE / "outils" / "langues"
CATS = {"monument", "lieu", "plat", "boisson", "fête", "tradition", "instrument", "objet"}


def dossier(tranche):
    d = RACINE / "travail" / ("tranche_%02d" % int(tranche))
    d.mkdir(parents=True, exist_ok=True)
    return d


def lire(chemin, defaut=None):
    chemin = Path(chemin)
    if not chemin.exists():
        return defaut
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except Exception as erreur:
        print("  illisible :", chemin.name, erreur)
        return defaut


def ecrire_json(chemin, valeur, indent=None):
    with open(chemin, "w", encoding="utf-8", newline="\n") as f:
        json.dump(valeur, f, ensure_ascii=False, indent=indent)
        f.write("\n")


def simple(texte):
    texte = unicodedata.normalize("NFKD", str(texte).casefold())
    return "".join(c for c in texte if not unicodedata.combining(c))


def lire_source():
    return json.loads(SOURCE.read_text(encoding="utf-8"))


def ecrire_source(source):
    """Une curiosité par ligne, pour des différences lisibles dans git."""
    lignes = ["{", '  "pays": {']
    codes = list(source["pays"])
    for n, c in enumerate(codes):
        lignes.append("    %s: %s%s" % (json.dumps(c), json.dumps(source["pays"][c], ensure_ascii=False), "," if n < len(codes) - 1 else ""))
    lignes += ["  },", '  "items": [']
    for n, i in enumerate(source["items"]):
        lignes.append("    " + json.dumps(i, ensure_ascii=False) + ("," if n < len(source["items"]) - 1 else ""))
    lignes += ["  ]", "}", ""]
    texte = "\n".join(lignes)
    json.loads(texte)
    io.open(SOURCE, "w", encoding="utf-8", newline="").write(texte)


CHIFFRES_ARABES = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")


def nombres(texte):
    """Nombres écrits en chiffres, séparateurs de milliers et décimales retirés (1 600, 1,600 et 1.600 donnent 1600)."""
    texte = str(texte).translate(CHIFFRES_ARABES)
    texte = re.sub(r"(?<=\d)[\s  .,'’٬٫](?=\d)", "", texte)
    return set(re.findall(r"\d+", texte))


ROMAINS = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "M": 1000}


def siecles(texte):
    """Siècles écrits en chiffres romains (XIIe, xiie) ou arabes (12e siècle)."""
    trouves = set()
    for m in re.finditer(r"\b([IVX]+)(?:e|ᵉ|er)\b", texte):
        valeur, chiffres = 0, m.group(1).upper()
        for k, c in enumerate(chiffres):
            v = ROMAINS[c]
            valeur += -v if k + 1 < len(chiffres) and ROMAINS[chiffres[k + 1]] > v else v
        trouves.add(valeur)
    for m in re.finditer(r"\b(\d+)(?:e|ᵉ|ème|er) siècle", texte):
        trouves.add(int(m.group(1)))
    return trouves
