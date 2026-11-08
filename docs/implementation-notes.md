# Notes d'implémentation (v1)

Écarts et choix pris pendant l'implémentation, par rapport à `SPEC.md`.

## Moteur
- **Niveau 0 « Débutant »** : le niveau 1 a ses propres critères ; un foyer qui ne les valide
  pas tous est au niveau 0 (socle sans tambour). `levels.yaml` décrit donc les niveaux 0 à 9,
  mais seuls les niveaux 1 à 9 ont des objectifs et des tambours.
- **Palier sans objectif applicable** : il est considéré comme validé (par ex. certains
  objectifs de niveau 8 ne concernent pas un appartement). Chaque contexte garde au moins un
  objectif requis par palier (`test_every_context_can_reach_top_level_with_objectives`).
- **Fissure** : la spec parlait d'une validation expirée sur un tambour bâti, ce qui ne peut
  pas arriver avec des paliers bloquants (le tambour tomberait). La fissure signale donc ce
  qui *va* faire tomber le tambour : validation ou stock qui expire sous 30 jours, ou bonus
  expiré.
- **Stocks** : un objectif `stock` est « à revalider bientôt » quand l'autonomie retombe
  sous le seuil une fois retirés les articles qui périment sous 30 jours.
- **Niveau par axe** : même algorithme restreint à un axe ; le niveau global n'est pas le
  minimum des axes mais la montée palier par palier sur tous les axes (plus strict).
- **Instantanés** : le niveau est recalculé à chaque lecture du tableau de bord et à chaque
  écriture ; un instantané n'est enregistré que si le niveau change, avec sa cause.

## Interview
- `answered_validates` : répondre à la question « compétences » vaut bilan des compétences
  (`competences.bilan`), même sans rien cocher.
- Les réserves déclarées créent des articles « (estimation de l'interview) » sans date de
  péremption, à affiner dans l'inventaire. Les jours de nourriture sont convertis en kcal
  avec les besoins du foyer au moment de l'interview.
- Les validations issues de l'interview sont datées du jour de l'interview : une
  revalidation périodique les fera expirer comme les autres.

## v2 (hors ligne)
- **Onboarding = une seule opération** portant le foyer, les acquis et les stocks estimés,
  pour un journal lisible et un seul calcul de niveau (la spec prévoyait des opérations
  ordinaires suivies d'un marqueur).
- **Aperçu avant enregistrement** : l'écran de résultat de l'interview est calculé sans rien
  écrire ; l'opération est enregistrée au clic sur « Voir ma colonne ».
- **Section passée sans réponse** : « Suivant » enregistre « rien » pour les questions à choix
  multiples de la section (sinon le bilan des compétences n'était jamais validé).
- **Date des opérations** : l'historique place une opération au jour de son horodatage UTC ;
  une action faite juste après minuit (heure de Paris) peut apparaître la veille.
- **Remise à zéro propagée** : `reset` est une opération ; elle efface le foyer sur tous les
  appareils synchronisés. Une sauvegarde JSON permet de revenir en arrière (import).
- **Base v1** : l'ancien schéma (tables foyer, validations…) n'est pas migré ; il est ignoré.
  Seule la table `op` est utilisée.
- **`npm audit`** signale des vulnérabilités modérées dans des dépendances de build de
  workbox (ejs, jake) : elles ne sont pas livrées dans l'application.

## Hors v1 / pistes
Notifications de revalidation, interview conversationnelle (LLM local), multi-foyers, backend Rust,
déploiement sur Raspberry Pi.

## Conseil du 2026-11-06 (voir `docs/conseil/2026-11-06.md`)
- **Sursis** : `GRACE_DAYS = 30` dans les deux moteurs. Une validation expirée passe en `grace`
  (compte encore, fissure le tambour) puis en `expired`. Les stocks ne bénéficient pas du sursis.
- **Saisons** : `due_month` est exclusif de `revalidate_days` (vérifié au chargement du catalogue).
- **Animaux** : un membre est un animal si `member_tags[type] == "animaux"` (`Catalog.is_animal`,
  `isAnimal`). Le type `animal` existant est gardé (« Autre animal ») car il est stocké.
- **Consommer** : le bouton −1 de l'inventaire émet un `stock.upsert` ordinaire, sans nouveau type
  d'opération.
- **Meilleur niveau atteint** : calculé côté app à partir de l'historique rejoué, non stocké.

## Conseil du 2026-11-07 (voir `docs/conseil/2026-11-07.md`)
- **Besoins par membre** : `per_member_tag` (catégorie `traitements`) compte 1 par jour pour chaque
  membre dont les particularités portent le tag ; `member_tags` / `memberTags` dans les deux moteurs.
  La cuisson passe en jours-personne (`daily_need`). Les stocks de cuisson saisis avant ce
  changement (en jours foyer) sont relus en jours-personne : l'autonomie affichée baisse pour les
  foyers de plusieurs personnes, ce qui est volontairement prudent.
- **Stocks de l'interview** : `expires_on` = jour de l'interview + 180 jours, posé par l'app
  (`buildOnboarding`). Les interviews déjà enregistrées ne changent pas (journal immuable).
- **Fiches Crise** : une étape est un texte ou `{text, tags_any}` (`ScenarioStep`), filtrée par
  `scenarioSteps` ; `group` vaut `secours` ou `situation`.
- **Accessibilité** : `prefers-reduced-motion: reduce` coupe aussi les transitions CSS ; les
  icônes d'axe sont masquées aux lecteurs d'écran (sauf dans les `<option>`, où une balise est
  interdite).


## Inventaire en cartes (2026-11-08)
- **Catalogue d'objets** : `catalog/items.yaml` (groupes, paliers, cartes). Un id d'objet est stocké
  dans le journal : il ne se renomme pas. Les paliers sont communs à tous les objets
  (`rustique` → `legendaire`), chaque objet n'en déclare que ceux qui ont un sens.
- **Opérations `item.set` / `item.delete`** : gérées par les deux moteurs, sans effet sur le niveau.
  Un appareil resté sur une ancienne version refuse ces opérations : mettre à jour serveur et app
  ensemble.
- **Pas de validation automatique** : un palier indique les objectifs qu'il remplit et propose de les
  valider (bouton « Valider »), mais posséder un objet ne valide rien tout seul.
- **Réserves** : quatre cartes `kind: reserve` liées aux catégories d'autonomie ; possédées dès qu'un
  article non périmé compte, palier déduit des jours d'autonomie (`min_days`). Les articles restent
  des `stock.upsert`.
- **Cartes affichées** : celles dont un objectif s'applique au foyer (ou sans objectif), et toujours
  celles qu'on possède ; les autres sont derrière « Voir aussi ».
- **Cinq niveaux partout** (2026-11-08, suite) : chaque objet déclare les cinq niveaux dans l'ordre
  (vérifié au chargement). `basis` dit ce qui fait monter le niveau (`qualite`, `options`,
  `quantite`, `contenu`, `autonomie`). Un contenant (`basis: contenu`) liste à chaque niveau
  `includes`, le contenu minimal **ajouté** au niveau précédent. Les objectifs d'un niveau
  s'ajoutent à ceux des niveaux inférieurs (plus de répétition dans le YAML). Un objet déclaré
  avant qu'il ait des niveaux garde `tier: null` et s'affiche « Niveau ? ».
- **État des lieux** : calculé côté app (`lib/inventory.ts`), rien de stocké. La projection
  d'autonomie suppose qu'on ne consomme ni ne rachète : elle ne baisse qu'aux péremptions.
  « Prochains achats » ne retient que les objectifs remplis par un niveau, pas ceux que l'objet
  aide seulement à remplir.
- **Couleurs** : celles des niveaux ne passent pas le test daltonisme (confirmé et épique se
  confondent) ; elles restent sur les cartes, toujours avec le nom du niveau écrit. Les graphiques
  utilisent une palette validée (une couleur fixe par catégorie d'autonomie), avec étiquettes
  directes et vue tableau.

## Conseil du 2026-11-08 (voir `docs/conseil/2026-11-08.md`)
- **Règles des niveaux d'objet**, vérifiées au chargement (`_tier_order_errors`) : un niveau ne
  porte pas de compétence (`kind: skill`), qui reste liée à l'objet seulement ; un niveau ne
  remplit pas d'objectif plus bas que ceux des niveaux précédents. Des objectifs propres à des
  contextes différents peuvent partager un niveau (balcon et solaire fixe).
- **Date sur les objets** : `expires_on` facultatif dans `item.set`. Les deux moteurs stockent la
  charge telle quelle ; seule l'app l'interprète (péremption pour un consommable, prochaine
  vérification pour un équipement). Un objet déclaré avant n'a pas le champ.
- **`crisis: true`** sur un objet : son emplacement s'affiche dans l'écran Crise.
- **Prochains achats** : une réserve y figure avec la quantité manquante pour son prochain niveau ;
  tri par palier de l'objectif, puis requis avant bonus.
- **Saison** : prochaine échéance = 1er du mois `due_month` à venir ; urgente sous 60 jours. Le
  panneau ne s'affiche pas si aucun objectif saisonnier ne concerne le foyer.
- **`thermometre` → `kit_canicule`** : renommé avant toute écriture dans un journal partagé.
