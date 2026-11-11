# Consigne : rédiger la phrase de chaque curiosité de Miradunia

Miradunia est un jeu public en français : on montre la photo d'une curiosité du monde et le joueur doit retrouver le pays auquel elle est rattachée. Après sa réponse, le jeu affiche UNE phrase qui lui apprend quelque chose. Tu rédiges ces phrases.

Ton fichier d'entrée (indiqué dans ton message) contient des fiches : identifiant, nom affiché, pays attendu, catégorie, niveau, titre de l'article Wikipédia en français, puis l'INTRODUCTION de cet article.

## Pour chaque fiche

1. **Décide si on la garde** (`garder`). Rejette (`garder: false`, avec `raison`) si l'introduction montre que :
   - l'article ne parle pas de la curiosité annoncée (mauvais article, article trop général, personne, entreprise, marque) ;
   - la curiosité n'est pas nettement rattachée au pays attendu (partagée à égalité avec d'autres pays, située dans un autre pays ou à cheval sur une frontière, territoire disputé) ;
   - le sujet est sensible (massacre, génocide, attentat, polémique politique ou religieuse) ;
   - c'est une œuvre ou un bâtiment d'architecte postérieur à 1950 environ ;
   - l'introduction ne permet d'écrire aucune phrase factuelle intéressante.
2. **Sinon rédige `fait`** : UNE phrase en français (deux courtes au plus), de 90 à 170 caractères, qui apprend un fait précis et mémorable.
   - **Chaque affirmation doit figurer dans l'introduction fournie.** N'ajoute AUCUN chiffre, date, superlatif, classement UNESCO ou anecdote venu de ta mémoire, même si tu en es sûr. Si l'introduction est prudente (« probablement », « selon la tradition »), reste prudent.
   - **Une surprise, pas une fiche technique.** La phrase dit un « pourquoi », un usage étonnant ou un contre-pied (modèles : « Ces cœurs en pâte rouge ne se mangent pas : on les offre en gage d'amour. » ; « Ce tissu sert de vêtement, puis de linceul. »). **Un seul nombre au plus**, et jamais de distance (« à 316 km de… »), de surface, d'altitude ou de date d'inscription au patrimoine mondial.
   - Ne commence pas par le nom de la curiosité (il est affiché juste au-dessus) ; écris par exemple « Ce temple… », « Cette soupe… », « On y… ».
   - La phrase PEUT nommer le pays ou la ville (elle n'apparaît qu'après la réponse).
   - Style simple et direct, sans emphase (« incontournable », « véritable joyau », « emblématique » sont interdits), sans point d'exclamation. Typographie française : guillemets « », espace avant ; : ? et après les milliers (5 895 mètres).
3. **`nom`** : reprends le nom fourni, sauf s'il contient le nom du pays, son adjectif, ou une faute ; dans ce cas corrige-le (français courant, majuscule initiale). Le nom ne doit pas contenir le nom du pays.
4. **`niv`** : reprends le niveau fourni (1 facile, 2 moyen, 3 difficile), sauf s'il est manifestement faux.

## Format de sortie

Écris UN fichier JSON valide en UTF-8, au chemin indiqué dans ton message : une liste contenant UNE entrée par fiche du fichier d'entrée, dans le même ordre.

```json
[
  { "id": "sauna", "garder": true, "nom": "Sauna", "niv": 1, "fait": "Cette pièce chauffée à sec fait partie de la vie quotidienne : le pays en compte plusieurs millions." },
  { "id": "exemple-rejete", "garder": false, "raison": "article sur la ville entière, pas sur le monument" }
]
```

Travaille par tranches : écris le fichier après chaque tranche d'une quarantaine de fiches (une coupure réseau peut t'interrompre). Tu n'as PAS besoin d'internet : tout est dans le fichier d'entrée ; ne consulte aucun site. À la fin, vérifie avec un petit script Python (écrit dans un fichier puis lancé, pas en « heredoc ») que le JSON se charge, qu'il y a une entrée par fiche, que chaque entrée gardée a un `fait` de 90 à 170 caractères, et corrige les écarts.

Ta réponse finale : deux lignes au plus (nombre de fiches gardées, nombre rejetées, chemin du fichier). Ne modifie aucun autre fichier.
