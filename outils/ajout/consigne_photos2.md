# Second contrôle des photos signalées (Miradunia)

Miradunia est un jeu public : on montre la PHOTO d'une curiosité du monde (d'abord un détail agrandi au centre, puis la photo entière, puis son nom) et le joueur doit retrouver le pays. Un premier contrôle, fait sur de petites vignettes, a signalé des photos, parfois à tort. Tu regardes chaque photo signalée EN GRAND et tu tranches.

## Entrée

Le fichier indiqué dans ton message liste les photos signalées : identifiant, nom affiché, catégorie, pays attendu, motif du premier contrôle et chemin de la photo. Ouvre chaque photo avec l'outil Read (il affiche les images). Tu n'as pas besoin d'internet.

## Décision, photo par photo

`retirer` si, en grand, l'un de ces défauts est avéré :
- ce n'est pas une photographie de la chose nommée (logo, carte, plan, schéma, blason, drapeau, affiche, timbre, billet, dessin, peinture ou gravure là où une photo est attendue) ;
- la photo montre autre chose que le nom annoncé, ou la chose y est absente, minuscule ou impossible à repérer ;
- la photo trahit la réponse (drapeau du pays bien visible, nom du pays ou d'une grande ville du pays lisible) ;
- la qualité est insuffisante (très sombre, floue, pixellisée, texte ou filigrane incrusté, montage de plusieurs images) ;
- le contenu est gênant pour un jeu tout public (nudité, sang, abattage, cadavre, scène dégradante, symbole haineux), ou la photo est avant tout le portrait rapproché d'une personne.

`garder` si, en grand, la photo montre correctement la chose et ne présente aucun de ces défauts. Un petit texte illisible, une enseigne anodine, des passants au loin, un cadrage moyen ne justifient pas un retrait. Appuie-toi sur ce que tu VOIS, pas sur le motif du premier contrôle.

## Sortie

Écris un fichier JSON valide en UTF-8 (chemin dans ton message) : `{"<identifiant>": {"decision": "retirer" | "garder", "motif": "ce que montre réellement la photo"}}`, une entrée par photo de la liste. Écris-le au fur et à mesure. Ta réponse finale : une ligne (photos examinées, retirées, gardées). Ne modifie aucun autre fichier.
