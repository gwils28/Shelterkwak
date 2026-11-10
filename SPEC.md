# Shelterkwak — Spécification v1

> Issue de l'interview du 2 novembre 2026. Ce document fait foi pour la v1 ; les écarts
> pris pendant l'implémentation sont consignés dans `docs/implementation-notes.md`.

## 1. Objectif

Application locale (navigateur + serveur sur la machine de l'utilisateur) pour qu'un **foyer**
suive sa préparation et son autonomie face aux crises civiles : coupure d'eau ou d'électricité,
intempéries, pandémie, évacuation, rupture d'approvisionnement, crise économique.

Le niveau du foyer est représenté par un **monument de 9 paliers**, choisi à l'accueil et
modifiable dans l'onglet Foyer (champ `monument` du foyer) : colonne romaine (par défaut),
pyramide d'Égypte, arbre, pyramide aztèque, tour Eiffel, statue de la Liberté, stalactites de
glace, Grande Mosquée de Djenné (Mali), moaï, pagode, bouddha, fusée,
tornade, massif Tamu (volcan sous-marin), cocotier, mont Everest, totem amérindien, phare,
chutes d'Iguazú, Burj Khalifa ou panier de basket. Les paliers acquis prennent chacun leur
couleur, le palier en cours et les suivants restent gris ; le couronnement (chapiteau, pyramidion,
étoile, temple, phare, flamme, aurore boréale, œufs d'autruche, pukao, flèche, flamme du bouddha, décollage, éclair
d'orage, surface de l'océan et navire de forage, noix de coco, drapeaux de prières, oiseau-tonnerre,
lanterne, arc-en-ciel, flèche, ballon) s'illumine au niveau 9. Le niveau monte quand on valide des objectifs, et
redescend quand des stocks périment, qu'une compétence ou un équipement n'est pas revalidé,
qu'on décoche un objectif ou que le foyer s'agrandit.

## 2. Décisions d'architecture

| Sujet | Décision |
|---|---|
| Backend | Python 3.13, FastAPI, SQLModel, SQLite (`data/shelterkwak.db`), géré avec `uv` |
| Front-end | React + TypeScript + Vite, colonne dessinée en SVG |
| Utilisateurs | Une instance = un foyer, plusieurs membres décrits ; pas d'authentification en v1 |
| Interview | Arbre de questions local, déterministe, décrit en YAML ; pas de LLM en v1 |
| Catalogue | Axes, niveaux, objectifs, besoins et interview en YAML versionnés dans `catalog/` |
| Calcul du niveau | **Paliers bloquants** : le niveau N+1 n'est atteint que si tous les objectifs requis des niveaux ≤ N+1 applicables au foyer sont validés |
| Moteur | Module Python pur (`engine.py`), sans I/O, entièrement testé |
| Hors ligne | Aucune dépendance réseau à l'exécution |

## 3. Les 9 niveaux (horizon de résilience)

| N | Nom | Sens |
|---|---|---|
| 0 | Débutant | Point de départ, sans tambour : premiers réflexes et premières réserves à mettre en place |
| 1 | Initié | Le strict minimum pour passer quelques heures de coupure, mais dépend encore des flux quotidiens |
| 2 | Éveillé | Connaît ses risques, a ses papiers, ses contacts et un plan de base |
| 3 | Paré | Tient 3 jours sans eau courante, électricité ni ravitaillement |
| 4 | Prévoyant | Tient 14 jours confiné ou coupé du réseau |
| 5 | Endurant | Tient 3 mois de rupture partielle ; épargne de précaution |
| 6 | Aguerri | 6 mois de réserves et compétences pratiques entretenues |
| 7 | Autonome | Produit une partie de son eau, de sa nourriture et de son énergie |
| 8 | Résilient | Autonomie forte, intégré à une communauté d'entraide, transmet |
| 9 | Anti-fragile | Sort renforcé de chaque choc : tout est éprouvé en conditions réelles, chaque crise améliore le plan, marge pour absorber les chocs des autres |

Chaque niveau, du 1 au 9, a ses critères précis (au moins un par axe, voir `catalog/objectives/`).
Le niveau 1 se mérite : 24 h d'eau et de vivres, une lumière sans réseau à un endroit connu,
les numéros d'urgence, une pharmacie de base, les issues de secours repérées, les réflexes
d'alerte, la fréquence de la radio publique notée, les papiers rangés ensemble, un départ
rapide possible, un guide officiel lu et un proche prévenu.

Le niveau 9 ne s'obtient pas en accumulant du matériel, mais en **éprouvant** le foyer.
Un objectif requis par axe, presque tous à revalider (tous les ans, tous les six mois pour le
retour d'expérience et la radio). Le niveau est donc perdu dès qu'on cesse de s'éprouver :

- 💧 7 jours sans eau du réseau ; 🥫 un mois sans courses ; 🔋 72 h disjoncteur coupé ;
  🧭 évacuation réelle chronométrée (moins de 15 min) ;
- ⛑️ un secouriste avancé (PSE1 ou équivalent) à jour ; 🛠️ chaque compétence critique
  maîtrisée par au moins deux personnes ;
- 🛡️ retour d'expérience écrit après chaque incident ou exercice, plan amélioré ;
- 📻 réseau radio avec le groupe, testé ; 🤝 exercice de crise inopiné avec le groupe ;
- 🏠 capacité d'accueillir un foyer sinistré un mois ; 📁 deux sources de revenus
  indépendantes et douze mois d'épargne.

## 4. Les axes

`eau`, `alimentation`, `energie`, `sante` (santé & hygiène), `abri` (habitat & chauffage),
`securite` (sécurité & protection), `communication` (information & communication),
`mobilite` (mobilité & évacuation), `competences` (savoirs & compétences),
`finances` (finances & administratif), `communaute` (réseau & entraide),
`moral` (moral & cohésion : écoute, sommeil, routine de crise, gestion du stress, enfants),
`defense` (défense personnelle dans le cadre de la loi française : fuir et alerter, légitime
défense, plan intrusion, self-défense ; les armes sont facultatives, sauf la détention en règle
quand le foyer en déclare),
`cyber` (cybersécurité : garder l'accès à ses comptes, ses fichiers et son argent malgré une
arnaque, un piratage, un vol ou la perte du téléphone ; à partir du niveau 2).

Chaque axe a aussi son niveau propre (le plus haut palier dont tous les objectifs requis de
l'axe sont validés), affiché pour repérer le maillon faible.

## 5. Objectifs

Un objectif appartient à un axe et à un niveau. Champs :

- `id`, `axis`, `level`, `title`, `description`, `why` (pourquoi c'est important) ;
- `kind` : `check` (action ou équipement, coché à la main), `skill` (compétence),
  `stock` (calculé automatiquement depuis l'inventaire) ;
- `required` (défaut `true`) : un objectif requis bloque le palier ; un objectif optionnel
  est un bonus recommandé ;
- `contexts` : sous-ensemble de `appartement`, `periurbain`, `rural` (défaut : tous) ;
- `requires_tags` : l'objectif ne s'applique que si le foyer porte l'un de ces tags
  (`enfants`, `bebe`, `seniors`, `animaux`, `traitement_medical`, `vehicule`,
  risques déclarés : `risque_inondation`, `risque_froid`, `risque_industriel`…) ;
- `excludes_tags` : l'objectif ne s'applique pas si le foyer porte l'un de ces tags. Sert
  aux épreuves physiques, remplacées par une variante adaptée (`requires_tags`) quand un
  membre a une mobilité réduite ou un appareil médical électrique ;
- `revalidate_days` : durée de validité d'une validation (compétence à pratiquer,
  équipement à tester, stock à faire tourner) ;
- `due_month` (exclusif de `revalidate_days`) : objectif saisonnier, à refaire chaque année
  avant le 1er de ce mois (bois rentré avant novembre, ramonage avant octobre, débroussaillement
  et plan canicule avant juin). Une validation couvre la prochaine échéance et expire à la
  suivante ;
- pour `kind: stock` : `stock: {category, min_days}`.

### Statut d'un objectif

`na` (non applicable au foyer), `todo`, `done`, `expiring` (expire dans les 30 jours,
encore valide), `grace` (en sursis : expirée depuis moins de 30 jours, compte encore mais
fissure le tambour), `expired` (sursis dépassé), et pour les stocks `done`/`todo` calculés en
temps réel.

### Régression (ce qui fait baisser le niveau)

1. **Péremption des stocks** : un article périmé ne compte plus dans l'autonomie.
2. **Revalidation périodique** : une validation plus vieille que `revalidate_days` (ou dont
   l'échéance saisonnière est passée) entre en **sursis** pendant 30 jours : le tambour est
   fissuré mais reste bâti. Le niveau ne baisse qu'à la fin du sursis. Les stocks périmés,
   eux, cessent de compter immédiatement.
3. **Compétences** : les `skill` ont une `revalidate_days` ; non pratiquées, elles expirent.
4. **Décochage manuel**.
5. **Changement du foyer** : un membre de plus augmente les besoins journaliers, un tag
   nouveau (bébé, animal) rend applicables de nouveaux objectifs requis.

Le niveau est recalculé à chaque lecture ; s'il a changé depuis le dernier instantané, un
évènement `level_changed` est journalisé avec la cause probable.

## 6. Foyer et contexte

- Membres : nom, type (`adulte`, `senior`, `enfant`, `bebe`, `animal`) et, pour les humains,
  des **particularités de santé ou physiques** (`conditions`, liste d'ids de
  `member_conditions` dans `catalog/axes.yaml`) : traitement régulier, lunettes ou lentilles,
  appareil auditif, mobilité réduite, appareil médical électrique, diabète sous insuline,
  allergie sévère, maladie respiratoire, régime strict, grossesse, besoin d'accompagnement,
  traitement à délivrance limitée (stupéfiant, froid strict). Chaque particularité ajoute ses tags au foyer, qui rendent applicables les objectifs
  correspondants (`requires_tags`) à plusieurs paliers. Exemple pour les lunettes : paire de
  secours et ordonnance copiée (2), lunettes dans le sac d'évacuation (3), deux paires de
  rechange et kit de réparation (5). Les opérations écrites avant cet ajout portent
  `medical: true|false` ; `medical: true` est relu comme la condition `traitement`.
- Contexte actuel (`appartement`, `periurbain`, `rural`) et **contexte cible** facultatif
  avec date visée (ex. « maison avec terrain dans 2 ans »). Le contexte se change à tout
  moment (déménagement) ; le niveau est recalculé.
- Les objectifs propres au contexte cible et non applicables aujourd'hui sont proposés dans
  une section **« Préparer la suite »** (compétences et épargne transférables).

## 7. Inventaire et autonomie

Catégories suivies en jours d'autonomie (`catalog/needs.yaml`) :

| Catégorie | Unité de base | Besoin journalier |
|---|---|---|
| `eau` | litre | adulte/senior 4 L (boisson, cuisine, hygiène minimale), enfant 2,5 L, bébé 2 L, petit animal 0,3 L, grand chien 2 L, autre animal 1 L |
| `alimentation` | kcal | adulte 2200, senior 1900, enfant 1700, bébé 900 (animaux exclus) |
| `traitements` | jour | 1 par jour pour chaque membre sous traitement (`per_member_tag`) |
| `cuisson` | jour-personne | adulte/senior 1, enfant 0,7, bébé 0,3 (une cartouche de gaz de 250 g ≈ 3 jours-personne) |

Un article : nom, catégorie, quantité, libellé d'unité, quantité de base par unité
(ex. 6 × bouteille de 1,5 L), date de péremption facultative, emplacement facultatif
(« cellier », « sous l'évier »). Un bouton retire une unité consommée.
Autonomie = somme des articles non périmés ÷ besoin journalier du foyer.
Les stocks estimés pendant l'interview périment au bout de 6 mois : une estimation déclarée doit
être confirmée ou détaillée dans l'Inventaire pour continuer à compter.
Articles périmant sous 30 jours signalés.

## 8. Interview d'inscription

Assistant en 4 étapes : foyer → contexte actuel et cible → questionnaire adaptatif →
résultat (niveau initial, colonne, recommandations).

Le questionnaire (`catalog/interview.yaml`) est une liste ordonnée de questions de type
`single`, `multi`, `boolean` ou `number`, avec `show_if` sur les réponses précédentes.
Chaque option peut :
- `validates` : déclarer des objectifs comme déjà acquis ;
- `tags` : ajouter des tags au foyer (risques, véhicule…) ;
- pour une question `number`, `creates_stock` : créer un article d'inventaire initial
  (ex. litres d'eau stockés, jours de nourriture → convertis en kcal).
La dernière section recueille les **objectifs** : niveau visé et horizon, axes prioritaires.

## 9. Recommandations (« Ta checklist »)

Liste ordonnée, personnalisée au foyer, contexte et tags :
1. objectifs expirés ou bientôt expirés (revalidation) ;
2. articles périmés ou périmant bientôt ;
3. objectifs requis non validés du **prochain palier** (ceux qui bloquent), axes
   prioritaires en premier ;
4. objectifs optionnels du palier courant et suivant ;
5. « Préparer la suite » pour le contexte cible.

## 10. Historique

Journal d'évènements (`objective_validated`, `objective_unvalidated`, `stock_added`,
`stock_updated`, `stock_removed`, `household_updated`, `context_changed`,
`level_changed`, `onboarding_completed`) et courbe du niveau dans le temps à partir des
instantanés.

## 11. Écrans

Cinq onglets : barre en bas de l'écran sur téléphone, rail à gauche sur grand écran. La Crise
n'est pas un onglet : un bouton rouge toujours visible dans l'en-tête. Changer d'onglet ramène en
haut de page.

1. **Onboarding** (si aucun foyer).
2. **Monument** (accueil, `/`) : le monument SVG de 9 paliers en grand, dans une scène teintée
   selon le monument (acquis en couleur, en cours en gris avec barre de progression, à venir en
   gris clair ; fissure sur un palier acquis contenant une validation expirée), niveau et barre
   vers le palier suivant ; puis « Prochaine étape » (3 actions), alertes, autonomie, checklist
   complète et niveau par axe repliables. Animations d'ambiance propres à chaque monument (GSAP,
   `frontend/src/lib/animations.ts`) : décor vivant, palier en cours qui pulse, palier tout juste
   acquis qui se colore avec un éclat. Coupées si l'appareil demande moins d'animations ou via
   l'interrupteur de l'onglet Foyer (réglage propre à l'appareil, non synchronisé).
3. **Objectifs** : filtres par niveau / axe / statut, cocher, décocher, revalider.
4. **Inventaire** (`/inventaire`), deux sous-onglets :
   - **Objets** : cartes par catégorie (`catalog/items.yaml`), grisées tant que le foyer ne les a
     pas, colorées par niveau quand il les a. Certaines cartes ne sont proposées qu'aux foyers
     concernés (armes à feu déclarées, risque industriel) ou sur demande (armes blanches, bombe
     lacrymogène, alcool, tabac) : cachées tant que le foyer ne les possède pas, accessibles via
     « Voir aussi… ». Chaque objet a les cinq niveaux rustique, commun,
     confirmé, épique, légendaire ; le niveau dépend de la qualité, des options, de la quantité,
     du contenu (contenants : contenu minimal détaillé par niveau) ou, pour les réserves (eau,
     vivres, cuisson, traitements), de l'autonomie. Une fiche par carte : niveau, quantité,
     rangement, date de péremption ou de prochaine vérification, objectifs servis ; celle d'une
     réserve porte les articles. Un niveau ne remplit que des objectifs matériels, dans l'ordre
     des paliers ; posséder un objet ne valide rien.
   - **État des lieux** (`/inventaire/etat-des-lieux`) : chiffres clés (maillon faible, objets en
     place, objectifs servis, articles à surveiller), autonomie par catégorie face aux repères
     3 j, 14 j, 90 j, 180 j, projection de l'autonomie sur 12 mois au fil des péremptions,
     prochains achats utiles (réserves comprises, avec ce qui manque), équipement par catégorie et
     par niveau, saison (objectifs à échéance annuelle), échéances mois par mois (articles et
     objets datés), emplacements.
5. **Compétences** (`/competences`) : neuf spécialités (condition physique, stratège de survie,
   soigneur, bricoleur, cuisto, protecteur, rassembleur, pisteur, transmetteur), toutes visibles
   dans une grille de trois colonnes, chacune un arbre de talents (`catalog/talents.yaml`) en cinq rangs
   (novice → maître) et trois branches. Un talent se coche quand ses prérequis sont acquis ; un
   talent verrouillé peut être coché avec ses prérequis manquants, et retirer un talent retire
   ceux qui en dépendent. La fiche d'un talent donne ce qui prouve qu'on l'a acquis, la date et
   une note, et les objectifs liés : cocher un talent ne valide aucun objectif. Le titre de la
   spécialité dépend du rang le plus haut atteint.
6. **Parcours** (`/historique`) : courbe du niveau et journal.
7. **Foyer** : membres, monument, contexte actuel et cible, objectifs déclarés, synchronisation.
8. **Crise** (`/crise`, bouton de l'en-tête) : écran du jour J, hors ligne et imprimable, pensé
   pour une personne sous stress. Dans l'ordre : boutons d'appel (15, 112, 18, 17, SMS 114) et
   rappel de respiration ; fiches réflexes repliées, « Premiers secours » puis « Situations »
   (`catalog/crisis.yaml`, `group`), filtrées selon les risques et les membres du foyer, avec des
   étapes réservées à certains foyers (`{text, tags_any}`) ; fiches du foyer (contacts,
   rendez-vous, qui fait quoi, fiches médicales…) en lecture avec numéros cliquables, modifiables
   derrière un bouton ; « Où est le matériel » (emplacement des objets marqués `crisis` dans
   `items.yaml`, ou rappel qu'il manque) ; réserves avec l'eau « boisson seule » (2 L par
   personne) et les emplacements tirés de l'inventaire.

L'accueil affiche aussi le **meilleur niveau atteint** et le nombre d'actions pour le
retrouver quand le niveau a baissé.

## 12. API (préfixe `/api`)

| Méthode | Chemin | Rôle |
|---|---|---|
| GET | `/catalog` | Niveaux, axes, contextes, catégories |
| GET | `/interview` | Questions de l'interview |
| GET/PUT | `/household` | Foyer, membres, contextes, objectifs déclarés |
| POST | `/onboarding` | Crée le foyer à partir des réponses de l'interview |
| GET | `/dashboard` | Niveau, colonne, niveaux par axe, checklist, alertes |
| GET | `/objectives` | Objectifs avec statut |
| POST/DELETE | `/objectives/{id}/validation` | Valider / décocher |
| GET/POST | `/stock` ; PUT/DELETE `/stock/{id}` | Inventaire |
| GET | `/autonomy` | Jours d'autonomie par catégorie |
| GET | `/history` | Évènements et instantanés de niveau |
| POST | `/reset` | Efface le foyer (recommencer l'onboarding) |

## 13. Hors périmètre v1 (pistes)

Objectifs personnalisés, PWA hors ligne, multi-foyers et authentification, interview
conversationnelle par LLM (local ou API), notifications, export/import JSON, backend Rust,
déploiement sur Raspberry Pi.

## 14. Critères d'acceptation

- `make check` vert : tests du moteur (paliers bloquants, péremption, revalidation,
  changement de foyer, contexte), tests d'API, typecheck et build du front.
- Un foyer créé via l'onboarding voit un niveau initial cohérent avec ses réponses.
- Ajouter un membre peut faire baisser le niveau ; laisser périmer un stock aussi.

---

# v2 — Application hors ligne sur téléphone

> Issue de l'interview du 2 novembre 2026 (deuxième série).

## 15. Décisions

| Sujet | Décision |
|---|---|
| Hors ligne | **PWA autonome** installable sur Android : moteur, catalogue et données sur le téléphone |
| Appareils | Téléphone + PC, synchronisés via le serveur du PC (qui sert aussi de sauvegarde) |
| Accès au PC | Tailscale (`tailscale serve`) : HTTPS valide, à la maison comme dehors, rien d'exposé sur Internet |
| Moteur | Porté en TypeScript ; le moteur Python reste la référence. Des cas de test générés par Python (`fixtures/`) sont rejoués par les deux implémentations |
| Objectifs perso | Créés par l'utilisateur : axe, palier, requis ou bonus, action ou compétence, revalidation facultative. Ils comptent dans le niveau comme ceux du catalogue |
| Relecture du catalogue | Page commentable publiée à part ; les commentaires sont reportés dans `catalog/*.yaml` |

## 16. Modèle de données : journal d'opérations

Toute modification est une **opération** immuable : `{id (uuid), device, at (horodatage ISO), type, payload}`.
L'état se reconstruit en rejouant les opérations triées par `(at, device, id)` ; à égalité de
cible, **la dernière écrite gagne**.

| Type | Effet |
|---|---|
| `household.set` | Remplace le foyer (nom, contextes, membres, tags, axes prioritaires, objectifs) |
| `validation.set` / `validation.delete` | Valide (avec date) / décoche un objectif |
| `stock.upsert` / `stock.delete` | Ajoute ou modifie / retire un article (id stable) |
| `custom.upsert` / `custom.delete` | Crée ou modifie / supprime un objectif perso (`perso.<uuid>`) |
| `notes.set` | Remplace le texte d'une fiche de l'écran Crise (`key` = id de `crisis.yaml`) |
| `item.set` / `item.delete` | Déclare (niveau, quantité, rangement, note, `expires_on` facultatif) / retire une carte d'inventaire (`item_id` = id de `items.yaml`) |
| `talent.set` / `talent.delete` | Coche (date `acquired_on` facultative, note) / retire un talent (`talent_id` = id de `talents.yaml`) |
| `onboarding` | Marque la fin de l'interview (les effets sont des opérations ordinaires émises juste avant) |
| `reset` | Efface tout ce qui précède |

L'historique est **dérivé** : le niveau est recalculé après chaque opération et à chaque date où
un stock expire ou un sursis se termine (les seuls moments où le niveau change sans action).

## 17. Synchronisation

- Le téléphone (et le navigateur du PC) gardent le journal dans IndexedDB et un curseur `server_seq`.
- `POST /api/sync {device, cursor, ops}` : le serveur enregistre les opérations inconnues (dédoublonnage
  par `id`), attribue un numéro croissant et renvoie celles postérieures au curseur.
- Déclenchement : au démarrage, au retour du réseau, après chaque modification (différé de 2 s) et
  toutes les minutes quand l'app est ouverte. Un indicateur affiche l'état (synchronisé, en attente, hors ligne).
- Sauvegarde sans serveur : export / import du journal en JSON depuis l'onglet Foyer.
- `GET /api/dashboard` (Python, lecture seule) recalcule le tableau de bord depuis le journal du serveur.

## 18. Critères d'acceptation v2

- En mode avion, l'app installée s'ouvre, l'onboarding, les validations et l'inventaire fonctionnent.
- Une modification faite hors ligne apparaît sur le PC après la synchronisation, et inversement.
- Les moteurs Python et TypeScript donnent le même résultat sur tous les cas de `fixtures/`.
