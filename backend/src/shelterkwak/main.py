"""Application FastAPI. Sert la PWA compilée (frontend/dist) et l'API de synchronisation."""

from __future__ import annotations

import mimetypes
import os

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse

from .api import router
from .catalog import REPO_ROOT, get_catalog

DIST = REPO_ROOT / "frontend" / "dist"
# Fichiers qui doivent toujours être revérifiés, sinon la PWA ne voit jamais ses mises à jour.
NO_CACHE = {"index.html", "sw.js", "manifest.webmanifest"}

mimetypes.add_type("application/manifest+json", ".webmanifest")


def create_app() -> FastAPI:
    get_catalog()  # échoue au démarrage si le catalogue est invalide
    app = FastAPI(title="Shelterkwak", version="0.2.0")
    app.include_router(router)

    if DIST.is_dir():

        @app.get("/{path:path}", include_in_schema=False)
        def spa(path: str) -> FileResponse:
            if path.startswith("api/"):
                raise HTTPException(404)
            file = (DIST / path).resolve()
            if not (path and file.is_file() and DIST.resolve() in file.parents):
                file = DIST / "index.html"
            headers = {"Cache-Control": "no-cache"} if file.name in NO_CACHE else None
            return FileResponse(file, headers=headers)

    return app


app = create_app()


def run() -> None:
    import uvicorn

    host = os.environ.get("SHELTERKWAK_HOST", "127.0.0.1")
    port = int(os.environ.get("SHELTERKWAK_PORT", "8000"))
    uvicorn.run("shelterkwak.main:app", host=host, port=port)
