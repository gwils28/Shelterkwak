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

