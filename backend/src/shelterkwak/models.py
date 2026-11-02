"""Tables SQLite. Une instance = un foyer (id 1)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel


class Household(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    context: str
    target_context: str | None = None
    target_date: date | None = None
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    priority_axes: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    goal_level: int | None = None
    goal_horizon_months: int | None = None
    answers: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime


class Member(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    household_id: int = Field(foreign_key="household.id", index=True)
    name: str
    type: str
    medical: bool = False


class ObjectiveValidation(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    objective_id: str = Field(unique=True, index=True)
    validated_at: date
    source: str = "manual"  # manual | interview
    note: str = ""


class StockItem(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    category: str = Field(index=True)
    quantity: float
    unit_label: str
    amount_per_unit: float
    expires_on: date | None = None
    created_at: datetime


class Event(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    at: datetime = Field(index=True)
    type: str
    message: str
    payload: dict = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))


class LevelSnapshot(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    at: datetime = Field(index=True)
    level: int
    cause: str
