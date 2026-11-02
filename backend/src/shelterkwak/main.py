"""Application FastAPI. En production locale, sert aussi le front compilé (frontend/dist)."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from .api import router
from .catalog import REPO_ROOT, get_catalog

DIST = REPO_ROOT / "frontend" / "dist"


def create_app() -> FastAPI:
    get_catalog()  # échoue au démarrage si le catalogue est invalide
    app = FastAPI(title="Shelterkwak", version="0.1.0")
    app.include_router(router)

    if DIST.is_dir():

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str) -> FileResponse:
            if path.startswith("api/"):
                raise HTTPException(404)
            file = (DIST / path).resolve()
            if path and file.is_file() and DIST.resolve() in file.parents:
                return FileResponse(file)
            return FileResponse(DIST / "index.html")

    return app


app = create_app()


def run() -> None:
    import uvicorn

    uvicorn.run("shelterkwak.main:app", host="127.0.0.1", port=8000)
