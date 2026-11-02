from __future__ import annotations

from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import create_engine

from shelterkwak import db
from shelterkwak.api import get_now
from shelterkwak.catalog import Catalog, get_catalog
from shelterkwak.main import create_app


@pytest.fixture(scope="session")
def catalog() -> Catalog:
    return get_catalog()


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 11, 2, 12, 0, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def client(clock: Clock) -> TestClient:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    db.set_engine(engine)
    app = create_app()
    app.dependency_overrides[get_now] = clock
    return TestClient(app)
