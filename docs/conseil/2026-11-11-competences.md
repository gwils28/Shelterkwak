# Réunion du conseil — 11 novembre 2026 : l'onglet Compétences

Participants :
- le **Pisteur** (autonomie en milieu naturel et rural) ;
- le **Tacticien** (crise urbaine et logistique) ;
- la **Sentinelle** (santé, publics vulnérables, psychologie).

Question du mainteneur : que manque-t-il d'essentiel à l'onglet Compétences ? Une revue critique
préalable avait relevé cinq manques. Le conseil a été convoqué sur trois d'entre eux :
1. qui sait faire quoi ;
2. la péremption des talents ;
5. les trous du contenu (feu domestique, chaleur, froid, monoxyde de carbone).

Chaque expert a analysé l'application seul. L'agent principal a vérifié leurs constats dans le
code, puis a mené le débat et la synthèse. Le mainteneur a validé le plan (lots A et B),
l'amendement du principe 4 et la 4e branche du Soigneur. La séance s'est terminée le 12 novembre
après une coupure de connexion.

## État initial

- **Compétences** : 9 arbres de 13 talents (117 talents), 5 rangs sur 3 branches.
- **Talents du foyer** : un talent est coché pour le foyer, pas pour une personne. L'onglet
  affiche donc « Secouriste PSC1 ✓ » même quand une seule personne l'a.
  `competences.redondance` ne peut être ni calculé ni prouvé, et `sante.adrenaline_formation`
  (« tous les adultes ») reste hors de portée à cause du principe 4 du 11/11.
- **Badge « à entretenir »** : il dépend seulement des objectifs liés. Un talent sans objectif
  revalidé (pharmacie de famille, condition entretenue) ne vieillit jamais.
- **Contenu** : aucun talent ne couvre le feu domestique, le premier risque réel d'un foyer.
  Chaleur, froid et monoxyde de carbone ont déjà été reportés une fois, faute de place dans la grille.
- **Vérifications de l'agent** :
  - la grille accepte déjà 4 branches (`max_length=4`, tracé calculé sur le nombre de branches) ;
  - sur un téléphone de 360 px, une colonne fait environ 82 px pour un nœud de 60 px ;
  - `stratege.exercice` prouve déjà un objectif revalidé chaque année.

## Points de débat marquants

- **Qui sait faire quoi.** Les trois experts veulent un compteur, pas de prénoms.
  - Le Tacticien : « En crise, on demande "qui d'autre sait ?", pas "est-ce Paul ?" »
  - La Sentinelle refuse aussi les prénoms : croiser identité, conditions de santé et compétences
    crée une donnée de santé nominative, synchronisée entre appareils.
  - Le Pisteur ne voulait pas de preuve automatique pour la redondance, puisque le compteur est
    déclaratif. L'arbitrage lui donne tort : cocher un talent est tout aussi déclaratif.
  - Le Pisteur rappelait aussi que le vrai risque porte sur les savoirs lents (conserves, poêle).
    Ce point est reporté.
  - Idée forte de la Sentinelle : si le compteur atteint le nombre d'adultes, les objectifs
    « tous les adultes » deviennent prouvables. La personne en choc anaphylactique ne se pique pas
    elle-même.
- **Péremption.** Unanimité sur un badge sans retrait, réservé à quelques talents.
  - La Sentinelle voulait 180 jours pour toute la condition physique : trop de badges selon les
    deux autres.
  - La règle « une seule source de vérité » (Tacticien et Pisteur) interdit une durée sur un talent
    dont l'objectif prouvé se revalide déjà.
- **Contenu.** Trois thèses s'opposaient sur la place du feu et du climat :
  - un 10e arbre « Gardien du logement » (Tacticien), qui demandait 13 talents dont un maître, donc
    du remplissage ;
  - une 4e branche chez le Bricoleur (Pisteur) ;
  - une 4e branche « Accidents et climat » chez le Soigneur (Sentinelle), car les accidents de la
    vie courante tuent bien plus que les crises. C'est cette thèse qui a été retenue.

  Autres points :
  - les plantes médicinales sortent de la grille (rang Expert immérité, sosies toxiques) ;
  - le débriefing émotionnel systématique est déconseillé (NICE NG116), il est remplacé par les
    premiers secours psychologiques de l'OMS ;
  - conduite et animaux ne deviennent pas des talents : refusé à l'unanimité.

## Décisions retenues et mises en œuvre

**Lot A : modèle** (moteurs Python et TypeScript, cas de parité)
1. `holders` facultatif dans `talent.set` (1 par défaut). Côté catalogue : `scope: personne | foyer`
   et `critical`. Sur un talent, une pastille « ×2 » ou « 1 » en orange pour un geste vital ;
   en tête d'onglet, un récapitulatif « Talents critiques : X sur Y ont un remplaçant ».
2. `competences.redondance` (`redundancy: true`) est prouvé quand chaque talent critique acquis du
   lieu de vie a au moins 2 personnes qui le maîtrisent. La preuve est datée de la dernière
   déclaration. Le titre dit désormais « deux personnes du foyer » : le réseau est reporté.
3. **Principe 4 amendé** : un objectif `every_adult` est prouvé par un talent quand le nombre de
   personnes qui le maîtrisent atteint le nombre d'adultes (adulte et senior). Pour l'instant,
   seul `sante.adrenaline_formation` porte ce champ.
4. `refresh_days` affiche le badge « à entretenir » sans rien retirer. Il est refusé au chargement
   si l'objectif prouvé a déjà une revalidation. Le bouton « Recyclé aujourd'hui » redate le talent.
5. `retired` sort un talent de la grille. S'il est coché, il s'affiche « Hors de la grille » et
   prouve toujours.

**Lot B : catalogue**
6. Soigneur, 4e branche « Accidents et climat » :
   - `soin.feu` « Feu qui démarre » (contribue à `abri.extincteur`) ;
   - `soin.fumee` « Sortir de la fumée » (contribue à `securite.exercice`) ;
   - `soin.urgences_climat` « Chaleur, froid, CO » ;
   - `soin.maison_sure` « Logement sûr ».
7. `soin.plantes` passe en `retired`. `soin.traitements` « Traitements d'urgence » prend sa case
   et prouve `sante.adrenaline_formation`.
8. Textes revus sans changer les ids :
   - `physique.climat` porte sur l'effort ;
   - `soin.debriefing` et `moral.debriefing` suivent les premiers secours psychologiques.
9. Durées : `abri.coupures` passe en `revalidate_days: 365`. `refresh_days: 365` pour
   `soin.pharmacie`, `physique.maitre`, `pisteur.champignons`, `soin.maitre` et les trois
   nouveaux gestes (feu, fumée, climat).
10. Talents critiques : alerter, GQS, PSC1, coupures, réchaud, feu, fumée, climat et traitement
    de l'eau.
11. Talents de foyer : plan familial, contacts, sauvegarde, plan de communication, rotation des
    stocks, intrusion, tous les talents du Rassembleur.

Bilan : 122 talents, dont 121 dans la grille. Vérifié à 360 px de large.

## Prochaines étapes (reportées)

- Compter le réseau proche (`network`) dans la redondance.
- Étendre `every_adult` aux objectifs « chaque adulte » déjà prouvés (légitime défense, critères
  de départ). Cela ferait retomber des preuves existantes : à décider.
- Redondance des savoirs lents (conserves, chauffage au bois), défendue par le Pisteur.
- Révisions du Pisteur : retirer `pisteur.cap`, ajouter `pisteur.outils`, réécrire `pisteur.maitre`
  en « une semaine d'hiver chez soi ».
- Manques 3 et 4 de la revue : où apprendre chaque talent ; les talents conseillés en premier selon
  les risques du foyer.
- Réserver `soin.traitements` aux foyers concernés quand `requires_tags` existera sur les talents.
