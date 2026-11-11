# GlobeCurios

Jeu quotidien gratuit : trois épreuves par jour sur les curiosités du monde (plats, monuments, fêtes, instruments, objets) à replacer dans leur pays. Site statique, sans serveur, sans compte, sans dépendance. Domaine prévu : globecurious.com.

## Jouer en local

Double-cliquer sur `Ouvrir GlobeCurios.bat`, ou ouvrir `site\index.html` dans un navigateur.

- `site\index.html?essai=12` joue le défi n° 12 hors série, sans rien enregistrer. En ligne, seuls les défis passés s'ouvrent ainsi ; sur le PC (fichier local ou `localhost`), tous s'ouvrent, pour tester.
- La progression (série, atlas, album, révisions) reste dans le navigateur.

## Contenu du dossier

| Chemin | Rôle |
|---|---|
| `site/` | Tout ce qui est à mettre en ligne (environ 12 Mo, dont 280 photos) |
| `site/js/core.js` | Règles : défi du jour, points, série, joker, atlas, album, révision, statistiques, sauvegarde |
| `site/js/app.js` | Affichage |
| `site/data/data.js` | Curiosités et crédits des photos. **Fichier produit par le script, ne pas le modifier à la main** |
| `site/partage.png`, `site/icone-*.png` | Image d'aperçu des liens partagés et icônes, produites par `outils/faire_images.py` |
| `outils/curiosites.json` | La source : 60 pays, 280 curiosités, une phrase et un niveau (1 à 3) par curiosité |
| `outils/images_choisies.json` | Photos imposées quand celle de Wikidata ne convient pas |
| `outils/construire_donnees.py` | Va chercher photos, auteurs, licences et liens (Wikipédia, Wikidata, Wikimedia Commons), écrit `data.js` |
| `tests/core.test.js` | Tests des règles et du contenu |

## Ajouter ou corriger une curiosité

1. Modifier `outils/curiosites.json` (`wiki` = titre exact de l'article Wikipédia en français ; `niv` = 1 facile, 2 moyen, 3 difficile).
2. `python outils/construire_donnees.py` puis lire le rapport affiché.
3. `node tests/core.test.js`.

Règles de contenu : au moins 4 curiosités par pays ; le nom affiché ne doit pas contenir le nom du pays ; pas de curiosité revendiquée par deux pays du jeu ; pas de photo montrant le nom du pays, ni d'œuvre récente protégée.

## Règles du jeu

- Défi n° 1 = 11/11/2026, jour de la mise en ligne (`LANCEMENT` dans `core.js`). Le défi est calculé à partir de la date : identique pour tous, change à minuit (heure de l'appareil).
- La semaine monte en difficulté : lundi et mardi faciles, mercredi à vendredi moyens, samedi et dimanche difficiles.
- « D'où ça vient ? » : quatre indices (détail de la photo, photo entière, nom, quatre pays), 100, 70, 40 ou 20 points. Après chaque erreur, le jeu dit si le pays proposé est sur le bon continent.
- « L'intruse » : trois curiosités d'un pays, une d'un pays du même continent. 100 ou 50 points.
- « Les liens » : quatre curiosités pour cinq pays. 100, 70, 45 ou 20 points.
- Série de jours ; à partir de deux jours d'affilée, un jour manqué est pardonné une fois tous les 7 jours.
- Atlas : Découvert (1 bonne réponse), Connu (3, sur au moins 2 curiosités différentes), Maîtrisé (6, sur au moins 3 curiosités différentes, et au moins 75 % de réussite).
- Les défis sont construits par blocs de 14 jours : dans un bloc, aucune curiosité ne revient deux fois.
- La série dépend de la participation, pas du score : finir le défi suffit.
- Album : chaque curiosité rencontrée y entre avec sa fiche.
- Révision : une curiosité ratée revient 1, 3 puis 7 jours après (5 par séance).
- Un essai manqué est enregistré tout de suite : recharger la page ne le rend pas. Restaurer un code de sauvegarde ne permet pas de rejouer le jour en cours.

## Pas encore fait

Mise en ligne, mesure d'audience, version anglaise, pages par pays pour Google, notification quotidienne, jeu hors connexion. Les phrases ont été rédigées par Claude sans relecture humaine : à relire. Aucun essai sur un vrai téléphone.
