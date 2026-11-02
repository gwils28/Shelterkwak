"""Moteur de calcul : statut des objectifs, autonomie, niveau (paliers bloquants), checklist.

Module pur : aucune I/O, la date du jour est injectée. Tout ce qui fait monter ou
baisser le niveau passe par `evaluate`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal

from .catalog import MAX_LEVEL, Catalog, Objective

EXPIRY_WARNING_DAYS = 30

Status = Literal["na", "todo", "done", "expiring", "expired"]
DONE_STATUSES: frozenset[str] = frozenset({"done", "expiring"})


@dataclass(frozen=True)
class Member:
    type: str
    medical: bool = False


@dataclass
class HouseholdState:
    context: str
    members: list[Member]
    declared_tags: set[str] = field(default_factory=set)
    target_context: str | None = None
    priority_axes: list[str] = field(default_factory=list)
    goal_level: int | None = None

    def tags(self, catalog: Catalog) -> set[str]:
        tags = set(self.declared_tags)
        for m in self.members:
            if m.type in catalog.member_tags:
                tags.add(catalog.member_tags[m.type])
            if m.medical:
                tags.add("traitement_medical")
        return tags


@dataclass(frozen=True)
class Validation:
    objective_id: str
    validated_at: date


@dataclass(frozen=True)
class StockLine:
    id: int
    name: str
    category: str
    total: float  # en unité de base de la catégorie
    expires_on: date | None = None


@dataclass
class CategoryAutonomy:
    category: str
    need_per_day: float
    total: float
    days: float | None  # None : catégorie non applicable au foyer
    days_after_expiring: float | None  # autonomie restante une fois retirés les articles qui périment bientôt


@dataclass
class ObjectiveStatus:
    id: str
    status: Status
    progress: float  # 0..1
    validated_at: date | None = None
    expires_on: date | None = None


@dataclass
class Tier:
    n: int
    state: Literal["built", "current", "future"]
    required_total: int
    required_done: int
    optional_total: int
    optional_done: int
    cracked: bool

    @property
    def progress(self) -> float:
        return 1.0 if self.required_total == 0 else self.required_done / self.required_total


@dataclass
class ChecklistItem:
    kind: Literal["revalidate", "stock_expired", "stock_expiring", "blocking", "optional", "prepare"]
    title: str
    detail: str = ""
    objective_id: str | None = None
    stock_id: int | None = None
    axis: str | None = None
    level: int | None = None


@dataclass
class Evaluation:
    level: int
    tiers: list[Tier]
    axis_levels: dict[str, int]
    statuses: dict[str, ObjectiveStatus]
    autonomy: dict[str, CategoryAutonomy]
    checklist: list[ChecklistItem]


def is_applicable(obj: Objective, state: HouseholdState, tags: set[str], context: str | None = None) -> bool:
    ctx = context or state.context
    if ctx not in obj.contexts:
        return False
    return not obj.requires_tags or bool(tags & set(obj.requires_tags))


def daily_need(catalog: Catalog, category_id: str, state: HouseholdState) -> float:
    cat = catalog.categories_by_id[category_id]
    if cat.applies_if and cat.applies_if not in state.tags(catalog):
        return 0.0
    if cat.per_household is not None:
        has_human = any(m.type != "animal" for m in state.members)
        return cat.per_household if has_human else 0.0
    return sum(cat.daily_need.get(m.type, 0.0) for m in state.members)


def compute_autonomy(
    catalog: Catalog, state: HouseholdState, stock: list[StockLine], today: date
) -> dict[str, CategoryAutonomy]:
    horizon = today + timedelta(days=EXPIRY_WARNING_DAYS)
    result: dict[str, CategoryAutonomy] = {}
    for cat in catalog.categories:
        lines = [s for s in stock if s.category == cat.id]
        valid = sum(s.total for s in lines if s.expires_on is None or s.expires_on >= today)
        lasting = sum(s.total for s in lines if s.expires_on is None or s.expires_on > horizon)
        need = daily_need(catalog, cat.id, state)
        result[cat.id] = CategoryAutonomy(
            category=cat.id,
            need_per_day=need,
            total=valid,
            days=valid / need if need > 0 else None,
            days_after_expiring=lasting / need if need > 0 else None,
        )
    return result


def objective_status(
    obj: Objective,
    applicable: bool,
    validation: Validation | None,
    autonomy: dict[str, CategoryAutonomy],
    today: date,
) -> ObjectiveStatus:
    if not applicable:
        return ObjectiveStatus(obj.id, "na", 0.0)
    if obj.kind == "stock":
        assert obj.stock is not None
        auto = autonomy[obj.stock.category]
        days = auto.days or 0.0
        progress = min(1.0, days / obj.stock.min_days)
        if days < obj.stock.min_days:
            return ObjectiveStatus(obj.id, "todo", progress)
        if (auto.days_after_expiring or 0.0) < obj.stock.min_days:
            return ObjectiveStatus(obj.id, "expiring", 1.0)
        return ObjectiveStatus(obj.id, "done", 1.0)
    if validation is None:
        return ObjectiveStatus(obj.id, "todo", 0.0)
    expires_on = None
    if obj.revalidate_days:
        expires_on = validation.validated_at + timedelta(days=obj.revalidate_days)
        if today >= expires_on:
            return ObjectiveStatus(obj.id, "expired", 0.0, validation.validated_at, expires_on)
        if today >= expires_on - timedelta(days=EXPIRY_WARNING_DAYS):
            return ObjectiveStatus(obj.id, "expiring", 1.0, validation.validated_at, expires_on)
    return ObjectiveStatus(obj.id, "done", 1.0, validation.validated_at, expires_on)


def _climb(objectives: list[Objective], statuses: dict[str, ObjectiveStatus]) -> int:
    """Plus haut niveau N tel que tous les objectifs requis applicables des niveaux 2..N sont validés."""
    level = 1
    for n in range(2, MAX_LEVEL + 1):
        blocking = [
            o
            for o in objectives
            if o.level == n
            and o.required
            and statuses[o.id].status != "na"
            and statuses[o.id].status not in DONE_STATUSES
        ]
        if blocking:
            break
        level = n
    return level


def evaluate(
    catalog: Catalog,
    state: HouseholdState,
    validations: list[Validation],
    stock: list[StockLine],
    today: date,
) -> Evaluation:
    tags = state.tags(catalog)
    by_id = {v.objective_id: v for v in validations}
    autonomy = compute_autonomy(catalog, state, stock, today)
    statuses = {
        o.id: objective_status(o, is_applicable(o, state, tags), by_id.get(o.id), autonomy, today)
        for o in catalog.objectives
    }
    level = _climb(catalog.objectives, statuses)
    axis_levels = {a.id: _climb([o for o in catalog.objectives if o.axis == a.id], statuses) for a in catalog.axes}

    tiers: list[Tier] = []
    for n in range(1, MAX_LEVEL + 1):
        at_level = [o for o in catalog.objectives if o.level == n and statuses[o.id].status != "na"]
        req = [o for o in at_level if o.required]
        opt = [o for o in at_level if not o.required]
        built = n <= level
        cracked = built and any(
            statuses[o.id].status == "expiring" or (not o.required and statuses[o.id].status == "expired")
            for o in at_level
        )
        tiers.append(
            Tier(
                n=n,
                state="built" if built else ("current" if n == level + 1 else "future"),
                required_total=len(req),
                required_done=sum(statuses[o.id].status in DONE_STATUSES for o in req),
                optional_total=len(opt),
                optional_done=sum(statuses[o.id].status in DONE_STATUSES for o in opt),
                cracked=cracked,
            )
        )

    checklist = build_checklist(catalog, state, tags, statuses, stock, level, today)
    return Evaluation(level, tiers, axis_levels, statuses, autonomy, checklist)


def build_checklist(
    catalog: Catalog,
    state: HouseholdState,
    tags: set[str],
    statuses: dict[str, ObjectiveStatus],
    stock: list[StockLine],
    level: int,
    today: date,
) -> list[ChecklistItem]:
    axis_rank = {a.id: i for i, a in enumerate(catalog.axes)}
    prio = {a: i for i, a in enumerate(state.priority_axes)}

    def order(o: Objective) -> tuple[int, int, int]:
        return (o.level, prio.get(o.axis, len(prio)), axis_rank.get(o.axis, 99))

    items: list[ChecklistItem] = []
    objs = sorted(catalog.objectives, key=order)

    for wanted, detail in (
        ("expired", "Validation expirée : à refaire pour garder ton niveau."),
        ("expiring", "Expire bientôt : pense à revalider."),
    ):
        for o in objs:
            st = statuses[o.id]
            if st.status == wanted and o.kind != "stock":
                when = f" (échéance {st.expires_on.isoformat()})" if st.expires_on else ""
                items.append(ChecklistItem("revalidate", o.title, detail + when, o.id, None, o.axis, o.level))

    horizon = today + timedelta(days=EXPIRY_WARNING_DAYS)
    for s in sorted(stock, key=lambda s: s.expires_on or date.max):
        if s.expires_on is None:
            continue
        if s.expires_on < today:
            items.append(
                ChecklistItem(
                    "stock_expired",
                    s.name,
                    f"Périmé depuis le {s.expires_on.isoformat()} : à remplacer.",
                    stock_id=s.id,
                )
            )
        elif s.expires_on <= horizon:
            items.append(
                ChecklistItem(
                    "stock_expiring",
                    s.name,
                    f"Périme le {s.expires_on.isoformat()} : à consommer et renouveler.",
                    stock_id=s.id,
                )
            )

    nxt = level + 1
    if nxt <= MAX_LEVEL:
        for o in objs:
            st = statuses[o.id]
            # Les validations expirées sont déjà listées dans « revalidate ».
            if o.level <= nxt and o.required and st.status == "todo":
                detail = o.why or f"Bloque l'accès au niveau {nxt} ({catalog.level(nxt).name})."
                items.append(ChecklistItem("blocking", o.title, detail, o.id, None, o.axis, o.level))

    for o in objs:
        if not o.required and o.level in (level, nxt) and statuses[o.id].status == "todo":
            items.append(ChecklistItem("optional", o.title, o.why or "Bonus recommandé.", o.id, None, o.axis, o.level))

    if state.target_context and state.target_context != state.context:
        for o in objs:
            if (
                o.required
                and statuses[o.id].status == "na"
                and is_applicable(o, state, tags, context=state.target_context)
            ):
                items.append(
                    ChecklistItem(
                        "prepare",
                        o.title,
                        "Pas encore applicable, mais utile pour ton futur lieu de vie : anticipe compétences et budget.",
                        o.id,
                        None,
                        o.axis,
                        o.level,
                    )
                )
    return items
