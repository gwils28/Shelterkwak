# Shelterkwak — Spécification v1

> Issue de l'interview du 2 novembre 2026. Ce document fait foi pour la v1 ; les écarts
> pris pendant l'implémentation sont consignés dans `docs/implementation-notes.md`.

## 1. Objectif

Application locale (navigateur + serveur sur la machine de l'utilisateur) pour qu'un **foyer**
suive sa préparation et son autonomie face aux crises civiles : coupure d'eau ou d'électricité,
intempéries, pandémie, évacuation, rupture d'approvisionnement, crise économique.

Le niveau du foyer est représenté par une **colonne romaine de 8 tambours**, du socle
(vulnérable) au chapiteau (autonome). Le niveau monte quand on valide des objectifs, et
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

## 3. Les 8 niveaux (horizon de résilience)

| N | Nom | Sens |
|---|---|---|
| 1 | Vulnérable | Dépend entièrement des flux quotidiens. Point de départ, aucun prérequis |
| 2 | Éveillé | Connaît ses risques, a ses papiers, ses contacts et un plan de base |
| 3 | 72 heures | Tient 3 jours sans eau courante, électricité ni ravitaillement |
| 4 | Deux semaines | Tient 14 jours confiné ou coupé du réseau |
| 5 | Trois mois | Tient 3 mois de rupture partielle ; épargne de précaution |
| 6 | Six mois & savoir-faire | 6 mois de réserves et compétences pratiques entretenues |
| 7 | Semi-autonome | Produit une partie de son eau, de sa nourriture et de son énergie |
| 8 | Autonome & résilient | Autonomie forte, intégré à une communauté d'entraide, transmet |

## 4. Les axes

`eau`, `alimentation`, `energie`, `sante` (santé & hygiène), `abri` (habitat & chauffage),
`securite` (sécurité & protection), `communication` (information & communication),
`mobilite` (mobilité & évacuation), `competences` (savoirs & compétences),
`finances` (finances & administratif), `communaute` (réseau & entraide).

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
- `revalidate_days` : durée de validité d'une validation (compétence à pratiquer,
  équipement à tester, stock à faire tourner) ;
- pour `kind: stock` : `stock: {category, min_days}`.

### Statut d'un objectif

`na` (non applicable au foyer), `todo`, `done`, `expired` (validation trop ancienne),
`expiring` (expire dans les 30 jours, encore valide), et pour les stocks `done`/`todo`
calculés en temps réel.

### Régression (ce qui fait baisser le niveau)

1. **Péremption des stocks** : un article périmé ne compte plus dans l'autonomie.
2. **Revalidation périodique** : une validation plus vieille que `revalidate_days` expire.
3. **Compétences** : les `skill` ont une `revalidate_days` ; non pratiquées, elles expirent.
4. **Décochage manuel**.
5. **Changement du foyer** : un membre de plus augmente les besoins journaliers, un tag
   nouveau (bébé, animal) rend applicables de nouveaux objectifs requis.

Le niveau est recalculé à chaque lecture ; s'il a changé depuis le dernier instantané, un
évènement `level_changed` est journalisé avec la cause probable.

## 6. Foyer et contexte

- Membres : nom, type (`adulte`, `senior`, `enfant`, `bebe`, `animal`), traitement médical
  (oui/non).
- Contexte actuel (`appartement`, `periurbain`, `rural`) et **contexte cible** facultatif
  avec date visée (ex. « maison avec terrain dans 2 ans »). Le contexte se change à tout
  moment (déménagement) ; le niveau est recalculé.
- Les objectifs propres au contexte cible et non applicables aujourd'hui sont proposés dans
  une section **« Préparer la suite »** (compétences et épargne transférables).

## 7. Inventaire et autonomie

Catégories suivies en jours d'autonomie (`catalog/needs.yaml`) :

| Catégorie | Unité de base | Besoin journalier |
|---|---|---|
| `eau` | litre | adulte/senior 3 L, enfant 2 L, bébé 1,5 L, animal 1 L |
| `alimentation` | kcal | adulte 2200, senior 1900, enfant 1700, bébé 900 (animaux exclus) |
| `traitements` | jour | 1 par jour si au moins un membre a un traitement |
| `cuisson` | jour | 1 par jour (combustible pour cuire hors réseau) |

Un article : nom, catégorie, quantité, libellé d'unité, quantité de base par unité
(ex. 6 × bouteille de 1,5 L), date de péremption facultative.
Autonomie = somme des articles non périmés ÷ besoin journalier du foyer.
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

1. **Onboarding** (si aucun foyer).
2. **Colonne** (accueil) : colonne SVG 8 tambours (bâtis, en cours avec % de progression,
   à venir ; fissure sur un tambour bâti contenant une validation expirée), niveau par axe,
   checklist, alertes.
3. **Objectifs** : filtres par niveau / axe / statut, cocher, décocher, revalider.
4. **Inventaire** : articles, autonomie par catégorie face aux paliers 3 j, 14 j, 90 j, 180 j.
5. **Foyer** : membres, contexte actuel et cible, objectifs déclarés.
6. **Historique** : courbe du niveau et journal.

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
| `onboarding` | Marque la fin de l'interview (les effets sont des opérations ordinaires émises juste avant) |
| `reset` | Efface tout ce qui précède |

L'historique est **dérivé** : le niveau est recalculé après chaque opération et à chaque date où
une validation ou un stock expire (les seuls moments où le niveau change sans action).

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
