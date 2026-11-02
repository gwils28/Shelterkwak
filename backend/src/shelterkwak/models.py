"""Le serveur ne stocke que le journal d'opérations, partagé par tous les appareils du foyer."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class StoredOp(SQLModel, table=True):
    __tablename__ = "op"

    seq: int | None = Field(default=None, primary_key=True)  # ordre de réception par le serveur
    id: str = Field(unique=True, index=True)
    device: str
    at: str = Field(index=True)
    type: str
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    received_at: datetime
