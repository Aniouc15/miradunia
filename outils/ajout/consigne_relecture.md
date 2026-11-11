# Relecture des nouvelles curiosités de Miradunia (faits et équité du jeu)

Miradunia est un jeu public, en sept langues : on montre la photo et le nom d'une curiosité du monde, le joueur doit retrouver le PAYS auquel elle est rattachée (une seule bonne réponse) ; après la réponse, une PHRASE apprend quelque chose. Les fiches de ton lot viennent d'être préparées par d'autres agents ; la phrase a été écrite à partir de l'introduction de l'article Wikipédia, qui est fournie. Tu es le dernier contrôle avant publication : sois exigeant. Une fiche douteuse retirée ne coûte rien ; une erreur publiée, si.

## Entrée

Ton fichier de lot (chemin dans ton message) : fiches avec `### identifiant`, NOM AFFICHÉ, PAYS ATTENDU, CATÉGORIE, NIVEAU, ARTICLE, PHRASE, INTRODUCTION WIKIPÉDIA. Tu n'as pas besoin d'internet et tu ne consultes aucun site.

## Contrôles, pour CHAQUE fiche

**A. Les faits de la PHRASE.** Découpe-la en affirmations (chiffres, dates, siècles, dimensions, lieux, noms propres, superlatifs, classements, causes). Chacune doit figurer dans l'INTRODUCTION (reformulation fidèle acceptée ; extrapolation, arrondi trompeur, superlatif plus fort que le texte, certitude là où le texte est prudent : refusés). Ta mémoire ne valide rien : une affirmation vraie mais absente de l'introduction est « non soutenue ».

**B. Le jeu.**
1. Le NOM AFFICHÉ ne contient ni le nom du pays, ni son adjectif ou gentilé, ni le nom du pays dans une autre langue ; un nom de ville, de région ou de site est accepté.
2. Un seul pays possible : la curiosité est nettement rattachée au PAYS ATTENDU ; pas partagée à égalité avec un autre pays, pas à cheval sur une frontière, pas dans un territoire disputé, et l'introduction la relie bien à ce pays.
3. Sujet convenable : rien de sensible (massacre, guerre, esclavage, polémique politique ou religieuse, pratique dangereuse ou dégradante).
4. Photo possible et libre : chose que l'on peut photographier et reconnaître ; pas une personne, une marque, une compétition sans objet ni lieu ; pas une œuvre ou un bâtiment d'architecte postérieur à 1950 environ.
5. Catégorie juste (monument, lieu, plat, boisson, fête, tradition, instrument, objet) et niveau juste (1 = la plupart des adultes connaissent le pays ; 2 = amateur de culture générale ; 3 = difficile).
6. Français de la PHRASE : fautes, accords, typographie (« », espace insécable avant ; : ? !, espace dans les milliers), pas de « incontournable », « joyau », « emblématique », pas de point d'exclamation, ne commence pas par le nom de la curiosité.

## Décision par fiche

- `ok` : rien à changer.
- `modifier` : donne seulement les champs à changer parmi `nom`, `cat`, `niv`, `fait`, et une `raison` courte. Une phrase corrigée (`fait`) ne contient QUE des affirmations soutenues par l'introduction, fait 90 à 170 caractères, une phrase (deux courtes au plus), en gardant le plus possible de la phrase d'origine.
- `retirer` : la fiche viole une règle de B (pays, sujet, photo) ou la phrase est fausse et l'introduction ne permet pas d'en écrire une correcte et intéressante. Donne la `raison`.

## Sortie

1. Un fichier JSON valide en UTF-8 (chemin dans ton message) : une liste avec UNE entrée par fiche, dans l'ordre du lot :

```json
[
  { "id": "sauna", "action": "ok" },
  { "id": "exemple", "action": "modifier", "raison": "« 300 mètres » absent de l'introduction (« plus de 200 mètres »)", "fait": "Cette tour de plus de 200 mètres…" },
  { "id": "autre", "action": "retirer", "raison": "plat partagé à égalité avec un pays voisin" }
]
```

   Écris le fichier par tranches de 15 fiches (une coupure peut t'interrompre).
2. Vérifie avec un petit script Python (écrit dans un fichier puis lancé ; pas de « heredoc ») : le JSON se charge ; une entrée par fiche, mêmes identifiants, même ordre ; chaque décision autre que `ok` a une `raison` ; tout `fait` fait 90 à 170 caractères ; tout `niv` vaut 1, 2 ou 3 ; toute `cat` est dans la liste. Corrige les écarts.
3. Réponse finale : une ligne (fiches, ok, modifier, retirer, chemin). Ne modifie aucun autre fichier.
