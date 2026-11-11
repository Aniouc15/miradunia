# Relecture des noms traduits de GlobeCurios

GlobeCurios est un jeu public : le joueur voit une curiosité du monde et doit retrouver le PAYS auquel elle est rattachée. Son NOM est affiché pendant le jeu. Un nom qui contient le pays, son adjectif ou un indice trop direct donne la réponse : le jeu devient sans intérêt. D'autres agents viennent de traduire les noms dans une langue (indiquée dans ton message). Tu les relis TOUS. Tu n'as pas besoin d'internet.

## Entrée (dossier indiqué dans ton message)

- `entree/<code>_NN.md` : les fiches d'origine (identifiant, catégorie, pays en français et dans la langue cible, nom français…) ;
- `sortie/<code>_NN.json` : les traductions `{ identifiant: { "nom", "fait" } }` ;
- `sortie/pays_<code>.json` : les noms des pays dans la langue cible (s'il n'existe pas encore, sers-toi du nom de la ligne « pays » des fiches).

Pour lire sans te noyer dans les phrases, écris d'abord un petit script Python (dans un fichier, puis lancé) qui affiche une ligne par fiche : `identifiant | catégorie | pays (langue cible) | nom français | nom traduit`, en lisant les fichiers d'entrée et de sortie. Ne lis pas les phrases.

## Pour chaque nom traduit

Signale-le et propose un remplacement si :
1. il contient le nom du pays attendu (dans la langue cible ou une autre), son adjectif ou son gentilé (« Japanese », « mexicana », « deutsche », « italiano », « brasileiro », « مغربي »…), ou le nom de sa capitale alors que le nom français ne le contient pas ;
2. il révèle davantage le pays que le nom français (le nom traduit doit rester aussi neutre que le nom français) ;
3. il est faux, maladroit, mal orthographié ou n'est pas le nom usuel dans la langue cible ;
4. il ne respecte pas l'usage des majuscules de la langue.

Le remplacement doit désigner la même chose, être naturel dans la langue cible et respecter la règle 1 (nom local translittéré ou description neutre si nécessaire). Un nom de ville, de région ou de site déjà présent dans le nom français peut rester.

## Sortie

1. Écris un fichier JSON valide en UTF-8 (chemin dans ton message) : un objet ne contenant QUE les noms à changer :

```json
{ "tacos-al-pastor": { "nom": "Tacos al pastor", "raison": "le nom proposé contenait « mexicains »" } }
```

   (objet vide `{}` si rien n'est à changer).
2. Vérifie avec un petit script Python (écrit dans un fichier puis lancé ; pas de « heredoc ») que le JSON se charge et que chaque identifiant existe dans les traductions. Corrige les écarts.
3. Ta réponse finale : une ligne (nombre de noms relus, nombre de noms à changer, chemin du fichier). Ne modifie aucun autre fichier.
