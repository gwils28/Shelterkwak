# Shelterkwak

Suivi de la préparation et de l'autonomie d'un foyer face aux crises civiles (coupures,
intempéries, pandémie, évacuation, ruptures d'approvisionnement). Le niveau du foyer est
représenté par une **colonne romaine de 8 tambours**, du socle (vulnérable) au chapiteau
(autonome et résilient).

- **Interview d'inscription** : foyer, lieu de vie actuel et visé, questionnaire adaptatif,
  objectifs. L'app estime le niveau de départ.
- **Paliers bloquants** : on ne pose le tambour N+1 que si tous les objectifs requis du
  niveau N+1 (et des niveaux inférieurs) sont validés, sur tous les axes.
- **Régression** : stocks périmés, validations et compétences à revalider, décochage,
  agrandissement du foyer.
- **Inventaire** : jours d'autonomie en eau, nourriture, traitements et cuisson, calculés
  pour les membres du foyer.
- **Checklist** personnalisée, niveau par axe (maillon faible), historique du niveau.

Tout tourne en local, sans réseau. Les données restent dans `data/shelterkwak.db`.

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

Vérifications (lint, tests backend, typecheck, tests et build du front) :

```bash
make check
```

## Organisation

| Dossier | Contenu |
|---|---|
| `catalog/` | Le référentiel en YAML : niveaux, axes, objectifs par axe, besoins journaliers, interview |
| `backend/` | API FastAPI + SQLite ; `engine.py` est le moteur pur (niveaux, statuts, checklist) |
| `frontend/` | React + TypeScript + Vite ; la colonne est dans `src/components/Column.tsx` |
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

Le catalogue est validé au démarrage (références, niveaux, catégories) et par
`backend/tests/test_catalog.py`.
