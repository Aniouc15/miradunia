# Miradunia

Jeu quotidien gratuit : trois épreuves par jour sur les curiosités du monde (plats, monuments, fêtes, traditions, instruments, objets) à rattacher à leur pays. Site statique, sans serveur, sans compte, sans dépendance, prévu pour plusieurs langues (une page par langue).

En ligne : https://miradunia.netvtc.com/ (la page d'accueil envoie vers la langue du joueur, par exemple `fr/`). Anciens noms : GlobeCurios, puis GlobeCurious. L'ancienne adresse https://aniouc15.github.io/miradunia/ redirige vers la nouvelle, page par page.

## Jouer en local

Double-cliquer sur `Ouvrir Miradunia.bat`, ou ouvrir `site\index.html` dans un navigateur.

- `site\fr\index.html?essai=12` joue le défi n° 12 hors série, sans rien enregistrer. En ligne, seuls les défis passés s'ouvrent ainsi ; sur le PC (fichier local ou `localhost`), tous s'ouvrent, pour tester.
- La progression (série, atlas, album, révisions) reste dans le navigateur ; elle est commune à toutes les langues.

## Contenu du dossier

| Chemin | Rôle |
|---|---|
| `site/` | Tout ce qui est mis en ligne |
| `site/index.html` | Page commune : choisit la langue (choix du joueur, sinon langue du navigateur) |
| `site/<langue>/index.html` | Page du jeu dans une langue (`fr/`, `en/`…), avec son `manifest.webmanifest` |
| `site/js/core.js` | Règles : défi du jour, points, série, joker, atlas, album, révision, statistiques, sauvegarde. Aucun texte |
| `site/js/app.js` | Affichage, dans la langue de la page |
| `site/data/data.js` | Données communes : pays, et pour chaque curiosité son pays, sa catégorie, son niveau et sa vague (`v`). **Produit par les scripts** |
| `site/lang/<langue>.js` | Textes d'une langue : interface et noms des pays. **Produit par les scripts** |
| `site/textes/<langue>/<n>.js` | Nom, phrase, lien Wikipédia et crédit photo des curiosités, en 256 paquets par langue : le jeu ne charge que ceux qu'il affiche. **Produit par les scripts** |
| `site/img/` | Une photo libre (Wikimedia Commons) par curiosité, au nom neutre (`nomPhoto()` dans core.js) pour ne pas trahir la réponse |
| `outils/curiosites.json` | La source en français : pays, curiosités, une phrase et un niveau (1 à 3) par curiosité |
| `outils/publication.json` | Vague de chaque curiosité publiée et date d'entrée de chaque vague dans les défis. **Ne pas effacer** : c'est lui qui garde les défis passés et le défi du jour identiques quand on ajoute des curiosités |
| `outils/langues/ui.fr.json` | Textes de l'interface en français (la référence) |
| `outils/langues/<langue>.json` | Traduction d'une langue : `ui`, `pays`, `items` (nom et phrase de chaque curiosité) |
| `outils/langues/langues.json` | Langues prévues |
| `outils/site.json` | Nom du jeu, adresse publique, adresse de contact (vide : pas de lien « Signaler une erreur »), langue par défaut |
| `outils/construire_donnees.py` | Va chercher photos, auteurs, licences et liens dans les autres langues (Wikipédia, Wikidata, Commons), puis lance `construire_site.py` |
| `outils/construire_site.py` | Écrit `data.js`, les fichiers de langue et de textes, les pages, `sitemap.xml` et `robots.txt`, sans réseau. Une curiosité n'est publiée que si elle est prête dans toutes les langues publiées ; sinon elle attend (détail dans `outils/rapport_site.txt`) |
| `outils/cache/donnees.json` | Résultat de `construire_donnees.py`, utilisé par `construire_site.py` |
| `outils/ajout/` | Chaîne d'ajout par tranches d'environ 1 000 curiosités (consignes des agents et étapes 1 à 7, voir plus bas) |
| `tests/core.test.js` | Tests des règles, des données, des vagues et de chaque langue publiée |

## Vagues : ajouter sans changer les défis

Un défi est calculé à partir de toutes les curiosités en jeu. Pour qu'un ajout ne change ni le défi du jour ni les anciens défis, chaque curiosité appartient à une vague, et une vague n'entre dans les défis qu'au début d'un bloc de 14 jours qui commence au plus tôt après-demain (`versions_et_vagues()` dans `construire_site.py`, `donneesDuJour()` dans `core.js`). Les nouvelles curiosités s'affichent dans l'album tout de suite, mais ne sortent dans les défis qu'à cette date.

## Ajouter ou corriger une curiosité

1. Modifier `outils/curiosites.json` (`wiki` = titre exact de l'article Wikipédia en français ; `niv` = 1 facile, 2 moyen, 3 difficile).
2. `python outils/construire_donnees.py` puis lire le rapport affiché.
3. Ajouter son nom et sa phrase dans chaque `outils/langues/<langue>.json` (sinon elle attend), puis `python outils/construire_site.py`.
4. `node tests/core.test.js`.

## Ajouter une tranche d'environ 1 000 curiosités (`outils/ajout/`)

1. `etape1_zones.py <n>` : liste de l'existant par zone ; puis un agent par zone suit `consigne_propositions.md`.
2. `etape2_valider.py <n> <zones>` : contrôle sur Wikipédia et Wikidata (article, image, introduction, au moins 10 Wikipédias, un seul pays d'origine) ; puis un agent par lot suit `consigne_redaction.md`.
3. `etape3_ajouter.py <n>` : ajoute les phrases gardées à `curiosites.json`.
4. `etape4_relecture.py <n>` puis un agent par lot suit `consigne_relecture.md` (faits et équité du jeu) ; `etape5_appliquer_relecture.py <n>` applique les décisions et signale les nombres absents de l'introduction.
5. `construire_donnees.py` (photos), puis relecture des photos.
6. `etape6_traduction.py <n>` puis un agent par langue et par lot suit `consigne_traduction.md`, et un agent par langue relit les noms (`consigne_noms.md`) ; `etape7_assembler.py <n> --ecrire`.
7. `construire_site.py`, `node tests/core.test.js`, essai dans le navigateur, mise en ligne.

Règles de contenu : au moins 4 curiosités par pays (sinon le pays est écarté) ; le nom affiché ne doit pas contenir le nom du pays, dans aucune langue ; pas de curiosité revendiquée par plusieurs pays du jeu ; pas de photo montrant le nom ou le drapeau du pays, ni de carte, de logo, de dessin ou d'œuvre récente protégée.

## Mise en ligne

Le jeu est servi par https://miradunia.netvtc.com/ : un Worker Cloudflare sans code (`wrangler.jsonc`), gratuit, sur le compte de netvtc.com, qui sert le dossier `site/`. Pour mettre en ligne une nouvelle version, depuis ce dossier :

```
node tests/core.test.js
C:\dev\netvtc-auto\node_modules\.bin\wrangler deploy --config wrangler.jsonc
```

Chaque envoi sur la branche `main` relance les tests sur GitHub et publie sur GitHub Pages le dossier `redirection/`, qui renvoie les anciennes adresses aniouc15.github.io/miradunia/… vers la même page de miradunia.netvtc.com (`.github/workflows/pages.yml`).

La progression des joueurs reste dans leur navigateur, par adresse : celle enregistrée sur l'ancienne adresse ne suit pas d'elle-même (le code de sauvegarde, onglet Règles, permet de la transférer).

## Règles du jeu

- Défi n° 1 = 11/11/2026 (`LANCEMENT` dans `core.js`). Le défi est calculé à partir de la date : identique pour tous et dans toutes les langues, il change à minuit (heure de l'appareil).
- La semaine monte en difficulté : lundi et mardi faciles, mercredi à vendredi moyens, samedi et dimanche difficiles. En semaine, « L'intruse » et « Les liens » n'utilisent que des curiosités faciles ou moyennes ; le week-end, moyennes ou difficiles.
- « D'où ça vient ? » : quatre indices (détail de la photo, photo entière, nom, quatre pays), 100, 70, 40 ou 20 points. Après chaque erreur, le jeu dit si le pays proposé est sur le bon continent.
- « L'intruse » : trois curiosités d'un pays, une d'un pays du même continent. 100 ou 50 points.
- « Les liens » : quatre curiosités pour cinq pays. 100, 70, 45 ou 20 points.
- Les défis sont construits par blocs de 14 jours : dans un bloc, aucune curiosité ne revient deux fois.
- Série de jours ; à partir de deux jours d'affilée, un jour manqué est pardonné une fois tous les 7 jours. La série dépend de la participation, pas du score.
- Atlas : Découvert (1 bonne réponse), Connu (3, sur au moins 2 curiosités différentes), Maîtrisé (6, sur au moins 3 curiosités différentes, et au moins 75 % de réussite).
- Album : chaque curiosité rencontrée y entre avec sa fiche.
- Révision : une curiosité ratée revient 1, 3 puis 7 jours après (5 par séance).
- Un essai manqué est enregistré tout de suite : recharger la page ne le rend pas. Restaurer un code de sauvegarde ne permet pas de rejouer le jour en cours.

## Origine du contenu

Les phrases ont été écrites par des agents Claude à partir de l'introduction de l'article Wikipédia de chaque curiosité, puis contre-vérifiées (faits, équité du jeu) par d'autres agents et par un contrôle automatique des nombres. Ce n'est pas une relecture humaine.

Langues : français (référence), anglais, espagnol, portugais du Brésil, allemand, italien et arabe. Les traductions ont été faites par des agents Claude à partir du français, tous les noms relus par un autre agent (aucun ne doit trahir le pays), puis contrôlées automatiquement (mêmes nombres que le français, nom sans le nom du pays, longueur plausible). Images de partage des autres langues : `python outils/faire_images.py` (dessinées par Edge, qui sait écrire l'arabe).
