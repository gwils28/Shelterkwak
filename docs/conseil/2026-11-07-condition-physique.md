# Réunion du conseil — 7 novembre 2026 : condition physique

Participants : le **Pisteur** (autonomie en milieu naturel et rural), le **Tacticien** (crise
urbaine et logistique), la **Sentinelle** (santé, vulnérables, psychologie). Sujet soumis par le
mainteneur : intégrer la condition physique et le sport (être en forme, natation, vélo,
callisthénie, endurance). Chaque expert a analysé seul un projet en cinq points ; l'agent
principal a vérifié leurs constats dans le catalogue, mené le débat et la synthèse. Plan validé
dans son intégralité par le mainteneur.

## État initial

- `sante.condition` (6) : les adultes valides marchent 15 km avec un sac de 10 kg, variante
  `sante.condition_adaptee` (6) pour la mobilité réduite et l'appareil médical électrique.
- `mobilite.velo` (4, bonus) : le matériel, pas la pratique. Self-défense aux niveaux 5 et 6.
- Rien sur la natation, la force utile en crise ni l'activité régulière.
- La règle « ne jamais traverser une zone inondée » n'existait que dans une fiche Crise.
- Critères requis pour tous : niveau 4 à 30-31, niveau 5 à 18-19, niveau 6 à 12-15.

## Points de débat marquants

- **Activité régulière** — la Sentinelle la voulait requise : la sédentarité est le premier
  risque corrigible. Le Pisteur et le Tacticien : invérifiable, « personne ne prouve
  150 minutes », et c'est une recommandation de santé, pas une capacité de crise. Bonus.
- **Natation et inondation** — le Pisteur voulait l'avancer au niveau 4 en zone inondable.
  Le Tacticien et la Sentinelle : « en crue, on meurt en voiture ou en traversant une eau qui
  court, savoir nager n'y change rien ». Remplacée par une consigne de crue au niveau 3.
- **Enfants** — le Tacticien : « on ne bloque pas un foyer sur un enfant », l'attestation se
  passe vers 9-11 ans. Requis pour les adultes, bonus pour les enfants.
- **Force fonctionnelle** — le Pisteur voulait la fondre dans `sante.condition`, la Sentinelle
  la voulait au niveau 6 avec des charges réduites. Retenue au niveau 5 (le Tacticien : c'est
  le niveau où l'on monte l'eau à pied), charge répartie sur les deux mains, gainage supprimé
  à l'unanimité (« de la salle de sport »). Pas de fusion : changer le sens d'un identifiant
  déjà validé fausserait les validations passées.
- **Vélo** — identifiant distinct de `mobilite.velo`, qui porte sur le matériel.
- **Défaut relevé par la Sentinelle** — `sante.condition` n'excluait ni la grossesse ni les
  maladies respiratoires, contrairement à la règle votée pour la défense.

## Décisions retenues et mises en œuvre

- `sante.natation` (5, requis) : les adultes valides savent nager (attestation du savoir-nager
  en sécurité ou équivalent), sans revalidation.
- `sante.natation_enfants` (5, bonus, foyers avec enfants) : appris ou en cours d'apprentissage.
- `securite.crue` (3, requis pour les foyers en zone inondable) : ne jamais traverser une zone
  inondée, ni à pied ni en voiture.
- `sante.force_fonctionnelle` (5, requis, annuel) : se relever du sol sans appui, porter
  2 × 10 L d'eau sur 100 m, monter 5 étages à son rythme avec le sac ; test accompagné et
  progression conseillée. Exclut mobilité réduite, appareil électrique, grossesse,
  respiratoire (relais : `sante.condition_adaptee` au niveau 6).
- `sante.activite_reguliere` (5, bonus, annuel) : bouger selon ses capacités, repères de
  l'OMS dans le `why`.
- `mobilite.velo_pratique` (5, bonus, tous les 2 ans) : 20 km avec 10 kg en sacoches, casque,
  crevaison réparée.
- `sante.condition` exclut aussi `grossesse` et `respiratoire` ; `sante.condition_adaptee` les
  couvre.
- Interview : cinq options dans « compétences » et une question « crue » affichée aux foyers
  en zone inondable.

## Effets pour le foyer

Aucun identifiant n'a changé et le journal n'est pas réécrit. Le niveau 5 passe à 20-21
critères requis : un foyer déjà au niveau 5 ou plus peut redescendre au niveau 4 jusqu'à
valider la natation et la force fonctionnelle. Un foyer en zone inondable gagne un critère au
niveau 3. Une personne enceinte ou avec une maladie respiratoire passe de `sante.condition` à
sa variante adaptée.

## Prochaines étapes

- Reportés : marche de 5 km en famille vers le point de rassemblement (Pisteur), descente
  d'escalier de nuit avec les sacs dans un exercice existant (Tacticien), effort en canicule et
  sommeil (Sentinelle).
- Le niveau 4 reste à 30-31 critères requis : toujours à arbitrer.
