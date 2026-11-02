# Shelterkwak

App locale de suivi de préparation d'un foyer. Spec : `SPEC.md` ; écarts : `docs/implementation-notes.md`.

## Commandes
- `make check-fast` : ruff + pytest backend. `make check` : tout, front compris (typecheck, vitest, build).
- `make dev` : API :8000 + Vite :5173. `make run` : un seul processus sur :8000.
- Backend : `cd backend && uv run …` (Python 3.13). Front : `cd frontend && npm …`.

## Repères
- Le niveau se calcule uniquement dans `backend/src/shelterkwak/engine.py` (pur, date injectée) ; toute règle de niveau y est testée dans `tests/test_engine.py`.
- Le contenu (objectifs, interview, besoins) vit dans `catalog/*.yaml`, pas dans le code. Un id d'objectif ne se renomme pas : il est stocké en base.
- `frontend/src/lib/interview.ts` duplique `is_visible` et les tags des membres du backend : garder les deux alignés.
- Datetimes avec fuseau (SQLModel l'exige) ; dates de validation et de péremption en `date`.
- Interface et contenu en français.

## Commits
Au nom du mainteneur, sans ligne co-auteur, Conventional Commits en français.

## Compaction
Garder la liste des fichiers modifiés, les commandes de test et les décisions de modélisation (paliers, régression, catalogue).
