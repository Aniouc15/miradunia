# Miradunia

Jeu quotidien gratuit : trois épreuves par jour sur les curiosités du monde (plats, monuments, fêtes, traditions, instruments, objets) à rattacher à leur pays. Site statique, sans serveur, sans compte, sans dépendance, prévu pour plusieurs langues (une page par langue).

En ligne : https://aniouc15.github.io/miradunia/ (anciens noms : GlobeCurios, puis GlobeCurious ; l'ancienne adresse aniouc15.github.io/globecurios redirige ici) (la page d'accueil envoie vers la langue du joueur, par exemple `fr/`).

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
| `site/data/data.js` | Données communes : pays, curiosités, photos, crédits. **Produit par les scripts** |
| `site/lang/<langue>.js` | Textes d'une langue : interface, noms des pays, nom, phrase et lien Wikipédia de chaque curiosité. **Produit par les scripts** |
| `site/img/` | Une photo libre (Wikimedia Commons) par curiosité |
| `outils/curiosites.json` | La source en français : pays, curiosités, une phrase et un niveau (1 à 3) par curiosité |
| `outils/langues/ui.fr.json` | Textes de l'interface en français (la référence) |
| `outils/langues/<langue>.json` | Traduction d'une langue : `ui`, `pays`, `items` (nom et phrase de chaque curiosité) |
| `outils/langues/langues.json` | Langues prévues |
| `outils/site.json` | Nom du jeu, adresse publique, adresse de contact (vide : pas de lien « Signaler une erreur »), langue par défaut |
| `outils/construire_donnees.py` | Va chercher photos, auteurs, licences et liens dans les autres langues (Wikipédia, Wikidata, Commons), puis lance `construire_site.py` |
| `outils/construire_site.py` | Écrit `data.js`, les fichiers de langue et les pages, sans réseau. Une langue n'est publiée que si sa traduction est complète et passe les contrôles |
| `outils/cache/donnees.json` | Résultat de `construire_donnees.py`, utilisé par `construire_site.py` |
| `tests/core.test.js` | Tests des règles, des données et de chaque langue publiée |

## Ajouter ou corriger une curiosité

1. Modifier `outils/curiosites.json` (`wiki` = titre exact de l'article Wikipédia en français ; `niv` = 1 facile, 2 moyen, 3 difficile).
2. `python outils/construire_donnees.py` puis lire le rapport affiché.
3. Ajouter son nom et sa phrase dans chaque `outils/langues/<langue>.json` (sinon la langue n'est plus publiée), puis `python outils/construire_site.py`.
4. `node tests/core.test.js`.

Règles de contenu : au moins 4 curiosités par pays (sinon le pays est écarté) ; le nom affiché ne doit pas contenir le nom du pays, dans aucune langue ; pas de curiosité revendiquée par plusieurs pays du jeu ; pas de photo montrant le nom ou le drapeau du pays, ni de carte, de logo, de dessin ou d'œuvre récente protégée.

## Mise en ligne

Chaque envoi sur la branche `main` relance les tests puis publie `site/` sur GitHub Pages (`.github/workflows/pages.yml`).

Hébergement prévu sur netvtc.com, à l'adresse https://miradunia.netvtc.com/ (gratuit, compte Cloudflare de netvtc.com) : `wrangler.jsonc` décrit un Worker sans code qui sert `site/`. Première mise en ligne (elle crée l'adresse dans les réglages DNS de netvtc.com), depuis ce dossier :

```
C:\dev\netvtc-auto\node_modules\.bin\wrangler deploy --config wrangler.jsonc
```

Ensuite : régler `url` et `adresse` de `outils/site.json` sur cette adresse, `python outils/construire_site.py`, relancer la même commande, et faire de GitHub Pages une simple redirection.

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
