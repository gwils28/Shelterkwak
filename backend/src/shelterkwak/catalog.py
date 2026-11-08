"""Chargement et validation du catalogue YAML (niveaux, axes, objectifs, besoins, interview)."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

import yaml
from pydantic import BaseModel as _BaseModel
from pydantic import ConfigDict, Field, model_validator

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CATALOG_DIR = REPO_ROOT / "catalog"

ContextId = Literal["appartement", "periurbain", "rural"]
ALL_CONTEXTS: tuple[ContextId, ...] = ("appartement", "periurbain", "rural")
MAX_LEVEL = 9


class BaseModel(_BaseModel):
    """Refuse les clés inconnues : en YAML, une virgule non protégée dans `{label: a, b}` crée une clé `b`."""

    model_config = ConfigDict(extra="forbid")


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


class MemberCondition(BaseModel):
    """Particularité de santé ou physique d'un membre ; ajoute ses tags au foyer."""

    id: str
    name: str
    tags: list[str]


class CrisisNote(BaseModel):
    """Fiche de l'écran Crise, saisie librement par le foyer (opération notes.set)."""

    id: str
    name: str
    hint: str = ""


class ScenarioStep(BaseModel):
    """Étape réservée aux foyers qui portent l'un des tags."""

    text: str
    tags_any: list[str]


class Scenario(BaseModel):
    """Fiche réflexe : affichée si le foyer porte l'un des tags (toujours si la liste est vide)."""

    id: str
    name: str
    icon: str = ""
    tags_any: list[str] = Field(default_factory=list)
    group: Literal["secours", "situation"] = "situation"
    steps: list[str | ScenarioStep]


class StockRule(BaseModel):
    category: str
    min_days: float


class Objective(BaseModel):
    id: str
    axis: str
    level: int = Field(ge=1, le=MAX_LEVEL)
    title: str
    description: str = ""
    why: str = ""
    kind: Literal["check", "skill", "stock"] = "check"
    required: bool = True
    contexts: list[ContextId] = Field(default_factory=lambda: list(ALL_CONTEXTS))
    requires_tags: list[str] = Field(default_factory=list)
    excludes_tags: list[str] = Field(default_factory=list)  # non applicable si le foyer porte l'un de ces tags
    revalidate_days: int | None = None
    due_month: int | None = Field(default=None, ge=1, le=12)  # à refaire chaque année avant le 1er de ce mois
    stock: StockRule | None = None
    custom: bool = False  # objectif perso créé par le foyer

    @model_validator(mode="after")
    def _stock_consistency(self) -> Objective:
        if (self.kind == "stock") != (self.stock is not None):
            raise ValueError(f"{self.id}: `stock` est requis si et seulement si kind == 'stock'")
        if self.revalidate_days is not None and self.due_month is not None:
            raise ValueError(f"{self.id}: `revalidate_days` et `due_month` sont exclusifs")
        return self


class Category(BaseModel):
    id: str
    name: str
    unit: str
    daily_need: dict[str, float] = Field(default_factory=dict)
    per_household: float | None = None
    per_member_tag: str | None = None  # besoin de 1 par jour pour chaque membre portant ce tag
    applies_if: str | None = None


TierId = Literal["rustique", "commun", "confirme", "epique", "legendaire"]


class ItemTierName(BaseModel):
    id: TierId
    name: str


class ItemGroup(BaseModel):
    id: str
    name: str
    icon: str = ""


class ItemTier(BaseModel):
    """Palier de qualité ou de contenu d'un objet ; `min_days` pour une réserve (jours d'autonomie)."""

    tier: TierId
    contents: str = ""
    min_days: float | None = None
    objectives: list[str] = Field(default_factory=list)
    includes: list[str] = Field(default_factory=list)  # contenu minimal ajouté à ce niveau (contenants)


class Item(BaseModel):
    """Carte de l'inventaire. Son id est stocké dans le journal (opération item.set)."""

    id: str
    group: str
    name: str
    icon: str = ""
    kind: Literal["equipement", "consommable", "reserve"]
    basis: Literal["qualite", "options", "quantite", "contenu", "autonomie"]  # ce qui fait monter le niveau
    category: str | None = None  # catégorie d'autonomie, pour une réserve
    description: str = ""
    objectives: list[str] = Field(default_factory=list)
    tiers: list[ItemTier] = Field(default_factory=list)

    @model_validator(mode="after")
    def _reserve_consistency(self) -> Item:
        if (self.kind == "reserve") != (self.category is not None):
            raise ValueError(f"{self.id}: `category` est requis si et seulement si kind == 'reserve'")
        if any((t.min_days is not None) != (self.kind == "reserve") for t in self.tiers):
            raise ValueError(f"{self.id}: `min_days` est requis sur chaque palier d'une réserve, et seulement là")
        if (self.kind == "reserve") != (self.basis == "autonomie"):
            raise ValueError(f"{self.id}: `basis: autonomie` est réservé aux réserves, et obligatoire pour elles")
        if (self.basis == "contenu") != all(t.includes for t in self.tiers):
            raise ValueError(f"{self.id}: un contenant liste `includes` à chaque niveau, et lui seul")
        return self


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
    member_conditions: list[MemberCondition] = Field(default_factory=list)
    categories: list[Category]
    objectives: list[Objective]
    questions: list[Question]
    crisis_notes: list[CrisisNote] = Field(default_factory=list)
    scenarios: list[Scenario] = Field(default_factory=list)
    item_tiers: list[ItemTierName] = Field(default_factory=list)
    item_groups: list[ItemGroup] = Field(default_factory=list)
    items: list[Item] = Field(default_factory=list)

    def is_animal(self, member_type: str) -> bool:
        return self.member_tags.get(member_type) == "animaux"

    @property
    def objectives_by_id(self) -> dict[str, Objective]:
        return {o.id: o for o in self.objectives}

    @property
    def categories_by_id(self) -> dict[str, Category]:
        return {c.id: c for c in self.categories}

    def with_custom(self, customs: list[dict]) -> Catalog:
        """Catalogue augmenté des objectifs perso du foyer (ignorés s'ils sont invalides)."""
        extra: list[Objective] = []
        axis_ids = {a.id for a in self.axes}
        for c in customs:
            try:
                obj = Objective.model_validate(
                    {**c, "contexts": list(ALL_CONTEXTS), "requires_tags": [], "custom": True}
                )
            except ValueError:
                continue
            if obj.axis in axis_ids and obj.kind != "stock":
                extra.append(obj)
        if not extra:
            return self
        return self.model_copy(update={"objectives": [*self.objectives, *extra]})

    def level(self, n: int) -> Level:
        return next(lv for lv in self.levels if lv.n == n)

    @model_validator(mode="after")
    def _check_references(self) -> Catalog:
        errors: list[str] = []
        if [lv.n for lv in self.levels] != list(range(0, MAX_LEVEL + 1)):
            errors.append(f"les niveaux doivent être numérotés de 0 à {MAX_LEVEL} dans l'ordre")
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
        errors.extend(_item_errors(self, seen, cat_ids))
        if errors:
            raise ValueError("Catalogue invalide :\n- " + "\n- ".join(errors))
        return self


def _item_errors(catalog: Catalog, objective_ids: set[str], cat_ids: set[str]) -> list[str]:
    """Références des cartes d'inventaire : groupe, catégorie, objectifs, ordre des paliers."""
    errors: list[str] = []
    rank = {t.id: i for i, t in enumerate(catalog.item_tiers)}
    group_ids = {g.id for g in catalog.item_groups}
    seen: set[str] = set()
    for it in catalog.items:
        if it.id in seen:
            errors.append(f"objet en double : {it.id}")
        seen.add(it.id)
        if it.group not in group_ids:
            errors.append(f"objet {it.id}: groupe inconnu {it.group}")
        if it.category is not None and it.category not in cat_ids:
            errors.append(f"objet {it.id}: catégorie inconnue {it.category}")
        for oid in [*it.objectives, *(o for t in it.tiers for o in t.objectives)]:
            if oid not in objective_ids:
                errors.append(f"objet {it.id}: objectif inconnu {oid}")
        if [t.tier for t in it.tiers] != list(rank):
            errors.append(f"objet {it.id}: les cinq niveaux sont attendus, dans l'ordre ({', '.join(rank)})")
        days = [t.min_days for t in it.tiers if t.min_days is not None]
        if days != sorted(set(days)):
            errors.append(f"objet {it.id}: `min_days` doit croître d'un palier au suivant")
    return errors


def _read(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def load_catalog(directory: Path | None = None) -> Catalog:
    directory = directory or Path(os.environ.get("SHELTERKWAK_CATALOG", DEFAULT_CATALOG_DIR))
    axes = _read(directory / "axes.yaml")
    axis_rank = {a["id"]: i for i, a in enumerate(axes["axes"])}
    objectives: list[dict] = []
    for path in sorted((directory / "objectives").glob("*.yaml")):
        data = _read(path)
        for o in data.get("objectives", []):
            objectives.append({"axis": data["axis"], **o})
    # Ordre stable : niveau, puis ordre des axes déclaré dans axes.yaml, puis ordre du fichier.
    items = _read(directory / "items.yaml") if (directory / "items.yaml").exists() else {}
    objectives.sort(key=lambda o: (o.get("level", 0), axis_rank.get(o["axis"], len(axis_rank))))
    return Catalog(
        levels=_read(directory / "levels.yaml")["levels"],
        axes=axes["axes"],
        contexts=axes["contexts"],
        member_types=axes["member_types"],
        member_tags=axes.get("member_tags", {}),
        member_conditions=axes.get("member_conditions", []),
        categories=_read(directory / "needs.yaml")["categories"],
        objectives=objectives,
        questions=_read(directory / "interview.yaml")["questions"],
        crisis_notes=_read(directory / "crisis.yaml").get("notes", []),
        scenarios=_read(directory / "crisis.yaml").get("scenarios", []),
        item_tiers=items.get("tiers", []),
        item_groups=items.get("groups", []),
        items=items.get("items", []),
    )


@lru_cache(maxsize=1)
def get_catalog() -> Catalog:
    return load_catalog()
