"""Chargement et validation du catalogue YAML (niveaux, axes, objectifs, besoins, interview)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel, Field, model_validator

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CATALOG_DIR = REPO_ROOT / "catalog"

ContextId = Literal["appartement", "periurbain", "rural"]
ALL_CONTEXTS: tuple[ContextId, ...] = ("appartement", "periurbain", "rural")
MAX_LEVEL = 8


class Level(BaseModel):
    n: int
    name: str
    horizon: str
    summary: str


class Axis(BaseModel):
    id: str
    name: str
    icon: str = ""


class NamedId(BaseModel):
    id: str
    name: str


class StockRule(BaseModel):
    category: str
    min_days: float


class Objective(BaseModel):
    id: str
    axis: str
    level: int = Field(ge=2, le=MAX_LEVEL)
    title: str
    description: str = ""
    why: str = ""
    kind: Literal["check", "skill", "stock"] = "check"
    required: bool = True
    contexts: list[ContextId] = Field(default_factory=lambda: list(ALL_CONTEXTS))
    requires_tags: list[str] = Field(default_factory=list)
    revalidate_days: int | None = None
    stock: StockRule | None = None

    @model_validator(mode="after")
    def _stock_consistency(self) -> Objective:
        if (self.kind == "stock") != (self.stock is not None):
            raise ValueError(f"{self.id}: `stock` est requis si et seulement si kind == 'stock'")
        return self


class Category(BaseModel):
    id: str
    name: str
    unit: str
    daily_need: dict[str, float] = Field(default_factory=dict)
    per_household: float | None = None
    applies_if: str | None = None


class ShowIf(BaseModel):
    context_in: list[ContextId] | None = None
    tags_any: list[str] | None = None
    answer: dict[str, str] | None = None  # {question: id, includes: value}


class Option(BaseModel):
    value: str
    label: str
    validates: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    sets: dict[str, int | str] = Field(default_factory=dict)


class CreatesStock(BaseModel):
    category: str
    name: str
    unit_label: str
    amount_per_unit: float | Literal["household_day"]


class Question(BaseModel):
    id: str
    section: str
    type: Literal["single", "multi", "number"]
    text: str
    help: str = ""
    unit: str = ""
    show_if: ShowIf | None = None
    options: list[Option] = Field(default_factory=list)
    options_from: Literal["axes"] | None = None
    sets_list: str | None = None
    creates_stock: CreatesStock | None = None
    answered_validates: list[str] = Field(default_factory=list)  # validés dès que la question a une réponse


class Catalog(BaseModel):
    levels: list[Level]
    axes: list[Axis]
    contexts: list[NamedId]
    member_types: list[NamedId]
    member_tags: dict[str, str]
    categories: list[Category]
    objectives: list[Objective]
    questions: list[Question]

    @property
    def objectives_by_id(self) -> dict[str, Objective]:
        return {o.id: o for o in self.objectives}

    @property
    def categories_by_id(self) -> dict[str, Category]:
        return {c.id: c for c in self.categories}

    def level(self, n: int) -> Level:
        return next(lv for lv in self.levels if lv.n == n)

    @model_validator(mode="after")
    def _check_references(self) -> Catalog:
        errors: list[str] = []
        if [lv.n for lv in self.levels] != list(range(1, MAX_LEVEL + 1)):
            errors.append("les niveaux doivent être numérotés de 1 à 8 dans l'ordre")
        axis_ids = {a.id for a in self.axes}
        cat_ids = {c.id for c in self.categories}
        member_type_ids = {m.id for m in self.member_types}
        seen: set[str] = set()
        for o in self.objectives:
            if o.id in seen:
                errors.append(f"objectif en double : {o.id}")
            seen.add(o.id)
            if o.axis not in axis_ids:
                errors.append(f"{o.id}: axe inconnu {o.axis}")
            if o.stock and o.stock.category not in cat_ids:
                errors.append(f"{o.id}: catégorie de stock inconnue {o.stock.category}")
        for c in self.categories:
            unknown = set(c.daily_need) - member_type_ids
            if unknown:
                errors.append(f"catégorie {c.id}: types de membres inconnus {sorted(unknown)}")
        q_ids: set[str] = set()
        for q in self.questions:
            if q.id in q_ids:
                errors.append(f"question en double : {q.id}")
            q_ids.add(q.id)
            for opt in [*q.options, Option(value="*", label="", validates=q.answered_validates)]:
                for oid in opt.validates:
                    if oid not in seen:
                        errors.append(f"question {q.id}/{opt.value}: objectif inconnu {oid}")
            if q.creates_stock and q.creates_stock.category not in cat_ids:
                errors.append(f"question {q.id}: catégorie inconnue {q.creates_stock.category}")
            if q.type != "number" and not q.options and not q.options_from:
                errors.append(f"question {q.id}: aucune option")
        if errors:
            raise ValueError("Catalogue invalide :\n- " + "\n- ".join(errors))
        return self


def _read(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_catalog(directory: Path | None = None) -> Catalog:
    directory = directory or Path(os.environ.get("SHELTERKWAK_CATALOG", DEFAULT_CATALOG_DIR))
    axes = _read(directory / "axes.yaml")
    objectives: list[dict] = []
    for path in sorted((directory / "objectives").glob("*.yaml")):
        data = _read(path)
        for o in data.get("objectives", []):
            objectives.append({"axis": data["axis"], **o})
    return Catalog(
        levels=_read(directory / "levels.yaml")["levels"],
        axes=axes["axes"],
        contexts=axes["contexts"],
        member_types=axes["member_types"],
        member_tags=axes.get("member_tags", {}),
        categories=_read(directory / "needs.yaml")["categories"],
        objectives=objectives,
        questions=_read(directory / "interview.yaml")["questions"],
    )


@lru_cache(maxsize=1)
def get_catalog() -> Catalog:
    return load_catalog()
