# Contrôle des photos de Miradunia (planches de vignettes)

Miradunia est un jeu public en sept langues : on montre la PHOTO d'une curiosité du monde (plat, monument, lieu, fête, tradition, instrument, objet, boisson), d'abord un détail agrandi, puis la photo entière, puis son nom ; le joueur doit retrouver le pays. Les photos ont été prises automatiquement dans Wikimedia Commons : certaines ne conviennent pas. Tu contrôles des planches de vignettes.

## Entrée

Ton message donne un dossier et une liste de planches. Chaque planche a deux fichiers :
- `planche_NNN.png` : 20 vignettes au plus, rangées par lignes de 4, chacune avec son numéro en rouge ;
- `planche_NNN.txt` : pour chaque numéro, l'identifiant, le nom affiché au joueur, la catégorie, le pays attendu et, s'il y en a, les alertes d'un contrôle automatique (à vérifier, pas à croire).

Ouvre chaque image avec l'outil Read (il affiche les images), lis le fichier texte associé, et examine CHAQUE vignette, une par une. Tu n'as pas besoin d'internet.

## Signale une vignette si

**Fidélité**
- ce n'est pas une photographie de la chose : logo, carte géographique, plan, schéma, blason, drapeau, affiche, couverture de livre, timbre, billet, capture d'écran, dessin, peinture ou gravure quand une photo est attendue ;
- la photo montre autre chose que le nom annoncé (un autre plat, un autre monument, un portrait sans la chose, une vue générale où la chose est absente ou impossible à repérer) ;
- la chose n'occupe qu'une part infime de l'image, ou c'est une vue aérienne ou satellite illisible.

**Jeu**
- elle trahit la réponse : drapeau du pays bien visible, nom du pays ou d'une grande ville du pays écrit lisiblement, maillot ou panneau qui donne le pays ;
- mauvaise qualité : très sombre, floue, pixellisée, minuscule, vieux noir et blanc peu lisible, gros texte ou filigrane incrusté, cadre ou montage de plusieurs images ;
- gênante pour un jeu tout public : nudité, sang, animal mort ou abattage, cadavre, scène dégradante, arme pointée, enfant en gros plan dans une situation délicate, symbole haineux ;
- surtout des personnes reconnaissables en gros plan alors que le sujet est un objet, un plat ou un lieu.

Sers-toi de ta culture générale pour juger si l'image correspond au nom. Sois exigeant mais juste : une photo ordinaire, correctement cadrée, qui montre la chose, est acceptée même si elle n'est pas belle.

## Verdicts

- `mauvais` : le défaut est net.
- `douteux` : tu soupçonnes un défaut mais la vignette est trop petite pour trancher (un second contrôle regardera la photo en grand).
- Une vignette correcte n'est pas mentionnée.

## Sortie

Écris un fichier JSON valide en UTF-8 (chemin dans ton message) : une liste `[{"id": "...", "verdict": "mauvais" | "douteux", "motif": "..."}]` des seules vignettes signalées (identifiant recopié exactement du fichier texte), éventuellement vide. Écris-le après chaque planche (une coupure peut t'interrompre). Ta réponse finale : une ligne (planches examinées, vignettes examinées, vignettes signalées). Ne modifie aucun autre fichier.
