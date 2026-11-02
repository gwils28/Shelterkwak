# Shelterkwak : commandes locales
.PHONY: install dev backend frontend build run test check check-fast lint format generate

install:            ## Installe les dépendances Python et Node
	cd backend && uv sync
	cd frontend && npm install

backend:            ## API en rechargement à chaud sur http://127.0.0.1:8000
	cd backend && uv run uvicorn shelterkwak.main:app --reload --host 127.0.0.1 --port 8000 --reload-dir src --reload-dir ../catalog

frontend:           ## Front Vite sur http://localhost:5173 (proxy /api vers le backend)
	cd frontend && npm run dev

dev:                ## Backend et front ensemble (Ctrl+C arrête les deux)
	$(MAKE) -j2 backend frontend

build:              ## Compile le front dans frontend/dist
	cd frontend && npm run build

run: build          ## Un seul processus : API + front compilé sur http://127.0.0.1:8000
	cd backend && uv run shelterkwak

generate:           ## Régénère catalog.json du front et les cas de parité (fixtures/) depuis le YAML
	cd backend && uv run python -m shelterkwak.export

check-fast:         ## Lint et tests backend
	cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q

check: check-fast   ## Tout : backend, typecheck, tests et build du front
	cd frontend && npm run typecheck && npm test && npm run build

format:
	cd backend && uv run ruff format . && uv run ruff check --fix .
