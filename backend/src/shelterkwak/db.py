from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine

from .catalog import REPO_ROOT

_engine: Engine | None = None


def database_url() -> str:
    if url := os.environ.get("SHELTERKWAK_DB_URL"):
        return url
    path = Path(os.environ.get("SHELTERKWAK_DB", REPO_ROOT / "data" / "shelterkwak.db"))
    path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{path}"


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        _engine = create_engine(database_url(), connect_args={"check_same_thread": False})
        SQLModel.metadata.create_all(_engine)
    return _engine


def set_engine(engine: Engine) -> None:
    """Pour les tests : remplace la base."""
    global _engine
    SQLModel.metadata.create_all(engine)
    _engine = engine


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
