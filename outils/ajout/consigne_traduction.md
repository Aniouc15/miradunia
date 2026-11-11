# Traduction des curiosités de GlobeCurios

GlobeCurios est un jeu web gratuit et public : le joueur voit la photo d'une curiosité du monde (plat, monument, lieu, fête, tradition, instrument, objet, boisson) et doit retrouver le PAYS auquel elle est rattachée. Le NOM de la curiosité est affiché au 3e indice (et dans les autres épreuves) ; après la réponse, une PHRASE apprend quelque chose. Le jeu existe en français ; tu le traduis dans une autre langue (indiquée dans ton message).

## Entrée

Ton fichier de lot (chemin dans ton message) contient des fiches :

```
### <identifiant>
catégorie : … · pays : <nom français> / <nom dans la langue cible> · niveau …
nom (fr) : …
libellé Wikidata (<langue>) : …      ← nom de la chose dans la langue cible selon Wikidata, ou (aucun)
article Wikipédia (<langue>) : …     ← titre de l'article dans la langue cible, ou (aucun)
phrase (fr) : …
```

Tu n'as pas besoin d'internet et tu ne dois consulter aucun site : tout est dans le fichier.

## Le nom

1. Donne le nom usuel de la chose dans la langue cible : celui qu'emploient ses locuteurs (le libellé Wikidata et le titre Wikipédia sont de bons indices, pas des obligations), sinon une traduction fidèle du nom français. Garde les noms propres de lieux et de monuments tels qu'on les écrit dans la langue cible (« Tour Eiffel » → « Eiffel Tower »). Si le nom français contient une ville ou une région, garde-la.
2. **Interdit dans le nom** : le nom du pays attendu (dans n'importe quelle langue), son adjectif ou son gentilé (Japanese, japonés, japanisch, giapponese, japonês, ياباني…). Si le nom usuel les contient, prends le nom local translittéré ou une description neutre, comme le nom français l'a fait (exemple : « Nouilles de riz sautées au wok » pour le pad thaï → « Stir-fried rice noodles »). Ne remplace pas non plus un nom neutre par un nom qui révèle le pays.
3. Majuscules selon l'usage de la langue (en anglais, majuscules aux noms propres et aux noms de monuments ; en allemand, aux noms communs). Pas d'article initial inutile.

## La phrase

1. Traduction **fidèle** : mêmes faits, même degré de certitude (« selon la tradition », « l'un des plus grands »…). N'ajoute rien, ne retire rien, ne corrige rien de mémoire.
2. **Les nombres restent les mêmes.** Écris les milliers à la façon de la langue (anglais 1,600 ; allemand, espagnol, italien, portugais 1.600 ; arabe : chiffres occidentaux 0-9). Les siècles s'écrivent selon l'usage de la langue (XIIe siècle → 12th century, siglo XII, século XII, 12. Jahrhundert, XII secolo, القرن الثاني عشر).
3. Style naturel, simple, sans emphase, sans point d'exclamation. Ponctuation et guillemets de la langue cible (anglais “ ” ; allemand „ “ ; espagnol, portugais, italien « » ou “ ” ; arabe « » avec ، ؛ ؟).
4. Si la phrase française ne commence pas par le nom de la curiosité, la traduction non plus.
5. Longueur proche de l'original.

## Notes par langue

- **en** : anglais international, orthographe américaine.
- **es** : espagnol neutre (compréhensible en Espagne et en Amérique latine).
- **pt** : portugais du Brésil.
- **de** : allemand standard.
- **it** : italien standard.
- **ar** : arabe standard moderne, chiffres occidentaux 0-9 ; les noms propres étrangers sont translittérés selon l'usage de Wikipédia en arabe quand il existe.

## Sortie

1. Écris un fichier JSON valide en UTF-8 (chemin dans ton message) : un objet avec UNE entrée par fiche du lot, dans l'ordre du lot :

```json
{
  "sushi": { "nom": "Sushi", "fait": "Originally, fermented rice was used to preserve fish; today's form, nigiri, was born in Edo (Tokyo) in the 19th century." },
  "shamisen": { "nom": "…", "fait": "…" }
}
```

   Écris le fichier par tranches (par exemple 60 fiches à la fois, en complétant le fichier) : une coupure peut t'interrompre.
2. Vérifie avec un petit script Python (écrit dans un fichier puis lancé ; pas de « heredoc ») : le JSON se charge ; il y a exactement une entrée par fiche du lot, mêmes identifiants ; aucun nom ni aucune phrase vide ; chaque nombre écrit en chiffres dans la phrase française se retrouve dans la traduction (compare après avoir retiré les séparateurs de milliers : espaces, points, virgules) ; aucun nom ne contient le nom du pays dans la langue cible (deuxième nom de la ligne « pays »). Corrige les écarts.
3. Ta réponse finale : une ligne (nombre de fiches traduites, chemin du fichier). Ne modifie aucun autre fichier.
