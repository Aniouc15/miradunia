# Consigne : proposer de nouvelles curiosités pour Miradunia

Miradunia est un jeu public, gratuit, en sept langues : on montre la photo d'une « curiosité du monde » (plat, monument, lieu, fête, tradition, instrument, objet, boisson) et le joueur doit retrouver le pays auquel elle est rattachée. Le jeu compte déjà plusieurs milliers de curiosités ; tu en proposes de NOUVELLES pour une zone du monde.

Ton message indique : ta zone, le nombre demandé, le fichier des curiosités déjà présentes dans ta zone (à lire d'abord : ne propose rien qui y figure déjà, même sous un autre nom ou un autre article), la liste des codes de pays déjà dans le jeu, et le fichier de sortie.

## Règles (une proposition qui en viole une sera rejetée)

1. **Article Wikipédia en français obligatoire.** `wiki` = titre exact de l'article de fr.wikipedia.org consacré à cette curiosité (pas une page d'homonymie, pas l'article d'un pays, d'une région ou d'une ville entière sauf si la ville EST la curiosité, pas un article général du type « Cuisine de X »). Ne propose que des titres dont tu es raisonnablement sûr : un script les vérifie tous ensuite, inutile de les vérifier un par un en ligne (Wikipédia limite fortement les requêtes : au plus une vingtaine de vérifications, pour tes plus gros doutes).
2. **Une bonne photo doit exister** : chose photographiable et reconnaissable (pas une notion abstraite, pas une personne, pas une marque ni un logo, pas un sportif, pas un film, pas un événement historique).
3. **Rattachement net à UN pays.** Rien qui soit autant revendiqué par un autre pays (houmous, baklava, pisco, couscous, kebab, tajine, maté, sirop d'érable, cor des Alpes, azulejo, cajón…), sauf une variante propre au pays. Pas de site à cheval sur une frontière, pas de territoire disputé.
4. **Le nom affiché (`nom`) ne contient ni le nom du pays, ni son adjectif, ni un nom de ville qui trahit trop directement** quand on peut l'éviter (« Sauna » plutôt que « Sauna finlandais »). Français courant, majuscule initiale.
5. **Pas d'œuvre récente protégée** (sculptures, fresques, bâtiments d'architecte postérieurs à 1950 environ).
6. **Pas de sujet sensible** : rien de macabre, de politique, de religieux polémique, de lieu de massacre ou de guerre.
7. **Variété** : au plus 50 % de `monument` + `lieu` ; le reste en `plat`, `boisson`, `fête`, `tradition`, `instrument`, `objet` (exactement ces mots).
8. **De la variété entre pays** : répartis tes propositions sur tous les pays de ta zone, en privilégiant ceux qui ont peu de curiosités dans le fichier existant. Chaque pays NOUVEAU (absent de la liste des codes) doit recevoir au moins 6 propositions : code ISO à deux lettres majuscules, nom français courant, `continent` parmi exactement : Europe, Asie, Afrique, Amériques, Océanie. Uniquement des États souverains reconnus par l'ONU.
9. **Pas trop obscur** : la curiosité doit être connue dans son pays et décrite par un vrai article (pas une ébauche de trois lignes). Niveau `niv` : 1 = la plupart des adultes savent de quel pays il s'agit ; 2 = un amateur de voyages ou de culture générale le sait ; 3 = difficile. Vise environ 20 % de niveau 1, 45 % de niveau 2, 35 % de niveau 3.
   **Contrôle automatique ensuite** : l'élément Wikidata de l'article doit avoir au moins 10 articles Wikipédia (toutes langues confondues) et au plus un pays d'origine (propriété P495), sinon la proposition est rejetée. À la dernière tranche, 40 % des propositions ont été perdues ainsi : vérifie tes candidats douteux par lots avec l'API Wikidata (`wbgetentities`, `props=sitelinks|claims`, 50 identifiants par requête, au plus une dizaine de requêtes) et préfère des curiosités plus connues.
10. **Identifiant** `id` : minuscules ASCII, chiffres et tirets, court, unique, absent du fichier existant.
11. Pas de `fait` à rédiger : il sera écrit ensuite à partir de l'article.

## Sortie

Un fichier JSON valide en UTF-8, au chemin indiqué, de cette forme exacte :

```json
{
  "pays": { "XX": { "nom": "Nom du pays", "continent": "Afrique" } },
  "items": [
    { "id": "sauna", "nom": "Sauna", "pays": "FI", "cat": "tradition", "wiki": "Sauna", "niv": 1 }
  ]
}
```

`pays` ne contient que les NOUVEAUX pays. Écris le fichier tôt et complète-le au fur et à mesure (une coupure peut t'interrompre). Vérifie à la fin avec un petit script Python (écrit dans un fichier puis lancé ; pas de « heredoc ») : le JSON se charge, identifiants uniques, chaque pays utilisé existe (liste des codes ou ton bloc `pays`), nombre demandé atteint.

Réponse finale : deux lignes au plus (nombre de propositions, nouveaux pays, chemin du fichier). Ne modifie aucun autre fichier.
