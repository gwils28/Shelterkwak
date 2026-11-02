# Notes d'implémentation (v1)

Écarts et choix pris pendant l'implémentation, par rapport à `SPEC.md`.

## Moteur
- **Niveau 1 sans prérequis** : les objectifs commencent au niveau 2 ; un foyer qui ne valide
  rien est « Vulnérable » (1).
- **Palier sans objectif applicable** : il est considéré comme validé (par ex. certains
  objectifs de niveau 8 ne concernent pas un appartement). Chaque contexte garde au moins un
  objectif requis par palier (`test_every_context_can_reach_level_8_with_objectives`).
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
