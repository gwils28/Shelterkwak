# Shelterkwak

Suivi de la préparation et de l'autonomie d'un foyer face aux crises civiles (coupures,
intempéries, pandémie, évacuation, ruptures d'approvisionnement). Le niveau du foyer est
représenté par une **colonne romaine de 9 tambours**, du socle (débutant) au chapiteau
(anti-fragile).

- **Interview d'inscription** : foyer, lieu de vie actuel et visé, questionnaire adaptatif,
  objectifs. L'app estime le niveau de départ.
- **Paliers bloquants** : on ne pose le tambour N+1 que si tous les objectifs requis du
  niveau N+1 (et des niveaux inférieurs) sont validés, sur tous les axes.
- **Régression** : stocks périmés, validations et compétences à revalider (avec 30 jours de
  sursis où le tambour est fissuré), objectifs saisonniers, décochage, agrandissement du foyer.
- **Particularités des membres** : lunettes, traitement, mobilité réduite, allergie sévère…
  ajoutent les critères qu'elles impliquent, avec des variantes adaptées aux épreuves physiques.
- **Inventaire** : jours d'autonomie en eau, nourriture, traitements et cuisson, calculés
  pour les membres du foyer.
- **Checklist** personnalisée, niveau par axe (maillon faible), historique du niveau et
  meilleur niveau atteint.
- **Écran Crise** : fiches du foyer et fiches réflexes par scénario, hors ligne et imprimables.

- **Hors ligne sur téléphone** : application installable (PWA) ; les données vivent sur
  l'appareil et se synchronisent avec le serveur du PC quand il est joignable (Tailscale).
- **Objectifs perso** : à toi de les ajouter, requis (bloquent leur palier) ou bonus.

Tout tourne en local, sans service tiers. Chaque appareil garde son journal d'opérations
(IndexedDB) ; le serveur en garde la copie partagée dans `data/shelterkwak.db`.
Installation sur Android : [docs/telephone.md](docs/telephone.md).

## Démarrer

Prérequis : [uv](https://docs.astral.sh/uv/) et Node.js 22+.

```bash
make install
```

```bash
make run
```

Puis ouvrir http://127.0.0.1:8000. Pour développer avec rechargement à chaud
(API sur le port 8000, front Vite sur http://localhost:5173) :

```bash
make dev
```

Vérifications (lint, tests backend, parité des moteurs, typecheck, tests et build du front) :

```bash
make check
```

## Organisation

| Dossier | Contenu |
|---|---|
| `catalog/` | Le référentiel en YAML : niveaux, axes, objectifs par axe, besoins journaliers, interview |
| `backend/` | FastAPI + SQLite : sert la PWA, stocke le journal partagé (`/api/sync`) ; `engine.py` et `replay.py` sont le moteur de référence |
| `frontend/` | PWA React + TypeScript + Vite ; moteur porté dans `src/engine/`, journal local dans `src/store/` |
| `fixtures/` | Cas calculés par le moteur Python et rejoués par le moteur TypeScript (parité) |
| `SPEC.md` | Spécification v1 issue de l'interview |
| `docs/implementation-notes.md` | Écarts et choix faits pendant l'implémentation |

## Enrichir le catalogue

Ajouter un objectif = ajouter une entrée dans `catalog/objectives/<axe>.yaml` :

```yaml
  - id: eau.exemple
    level: 4                 # 2 à 8
    kind: check              # check | skill | stock
    required: true           # false = bonus, ne bloque pas le palier
    contexts: [periurbain, rural]   # défaut : tous
    requires_tags: [animaux] # facultatif
    revalidate_days: 365     # facultatif : expire et fait baisser le niveau
    title: …
    why: …
```

Puis régénérer le catalogue embarqué dans l'app et les cas de parité :

```bash
make generate
```

Le catalogue est validé au démarrage (références, niveaux, catégories) et par
`backend/tests/test_catalog.py` ; un test échoue si `make generate` a été oublié.

Scénario de bout en bout téléphone + PC avec passage en mode avion (Playwright requis,
serveur lancé avec `make run` sur une base vide) :

```bash
make e2e
```
