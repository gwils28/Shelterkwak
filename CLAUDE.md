# Shelterkwak

App locale de suivi de préparation d'un foyer. Spec : `SPEC.md` ; écarts : `docs/implementation-notes.md`.

## Commandes
- `make check-fast` : ruff + pytest backend. `make check` : tout, front compris (typecheck, vitest, build).
- `make dev` : API :8000 + Vite :5173. `make run` : un seul processus sur :8000. `make e2e` : scénario hors ligne Playwright.
- `make generate` après toute modification de `catalog/*.yaml` ou des moteurs.
- Backend : `cd backend && uv run …` (Python 3.13). Front : `cd frontend && npm …`.

## Repères
- Deux moteurs : Python (`engine.py`, `replay.py`, `interview.py`) est la référence, `frontend/src/engine/` en est le port. Toute règle change dans les deux, puis `make generate` : les cas de `fixtures/` sont rejoués par vitest (`parity.test.ts`).
- Données = journal d'opérations (`SPEC.md` §16) ; l'état et l'historique se rejouent, rien d'autre n'est stocké. Ne jamais modifier une opération existante, en ajouter.
- Le serveur ne calcule rien pour l'app : il stocke le journal (`/api/sync`) et sert la PWA.
- Le contenu (objectifs, interview, besoins) vit dans `catalog/*.yaml`, pas dans le code. Un id d'objectif ne se renomme pas : il est stocké en base.
- Datetimes avec fuseau (SQLModel l'exige) ; dates de validation et de péremption en `date`.
- Interface et contenu en français.

## Commits
Au nom du mainteneur, sans ligne co-auteur, Conventional Commits en français.

## Compaction
Garder la liste des fichiers modifiés, les commandes de test et les décisions de modélisation (paliers, régression, catalogue).
