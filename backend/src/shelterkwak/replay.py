"""Journal d'opérations : rejeu, entrées du moteur, historique dérivé.

Implémentation de référence ; `frontend/src/engine/replay.ts` doit produire exactement
le même résultat (vérifié par les cas de `fixtures/`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from . import engine as eng
from .catalog import Catalog

OP_TYPES = frozenset(
    {
        "household.set",
        "onboarding",
        "validation.set",
        "validation.delete",
        "stock.upsert",
        "stock.delete",
        "custom.upsert",
        "custom.delete",
        "notes.set",
        "reset",
    }
)


@dataclass(frozen=True)
class Op:
    id: str
    device: str
    at: str  # ISO 8601 UTC, ex. 2026-11-02T14:03:00.000Z
    type: str
    payload: dict[str, Any]

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> Op:
        return cls(d["id"], d["device"], d["at"], d["type"], dict(d.get("payload") or {}))


def sort_key(op: Op) -> tuple[str, str, str]:
    return (op.at, op.device, op.id)


@dataclass
class State:
    household: dict[str, Any] | None = None
    validations: dict[str, dict[str, Any]] = field(default_factory=dict)
    stock: dict[str, dict[str, Any]] = field(default_factory=dict)
    custom: dict[str, dict[str, Any]] = field(default_factory=dict)
    notes: dict[str, str] = field(default_factory=dict)  # fiches de l'écran Crise
    onboarded_at: str | None = None


def fmt_qty(x: float) -> str:
    if x == int(x):
        return str(int(x))
    return f"{x:.3f}".rstrip("0").rstrip(".")


def _title(catalog: Catalog, state: State, objective_id: str) -> str:
    if objective_id in state.custom:
        return str(state.custom[objective_id].get("title", objective_id))
    obj = catalog.objectives_by_id.get(objective_id)
    return obj.title if obj else objective_id


def _context_name(catalog: Catalog, ctx: str | None) -> str:
    return next((c.name for c in catalog.contexts if c.id == ctx), str(ctx))


def apply(catalog: Catalog, state: State, op: Op) -> tuple[str, str]:
    """Applique une opération ; renvoie (message du journal, cause d'un éventuel changement de niveau)."""
    p = op.payload
    t = op.type
    if t == "reset":
        state.household, state.onboarded_at = None, None
        state.validations.clear()
        state.stock.clear()
        state.custom.clear()
        state.notes.clear()
        return "Remise à zéro du foyer", "remise à zéro"
    if t == "onboarding":
        state.household = dict(p["household"])
        state.onboarded_at = op.at
        for v in p.get("validations", []):
            state.validations[v["objective_id"]] = dict(v)
        for s in p.get("stock", []):
            state.stock[s["id"]] = dict(s)
        n_val, n_stock = len(p.get("validations", [])), len(p.get("stock", []))
        return (
            f"Interview terminée : {n_val} objectif(s) déjà acquis, {n_stock} stock(s) estimé(s)",
            "interview initiale",
        )
    if t == "household.set":
        old = state.household
        state.household = dict(p)
        if old is None:
            return f"Foyer créé : {p.get('name', '')}", "création du foyer"
        if old.get("context") != p.get("context"):
            a, b = _context_name(catalog, old.get("context")), _context_name(catalog, p.get("context"))
            return f"Changement de lieu de vie : {a} → {b}", "changement de lieu de vie"
        n_old, n_new = len(old.get("members", [])), len(p.get("members", []))
        if n_old != n_new:
            return f"Le foyer passe de {n_old} à {n_new} membre(s)", "changement de composition du foyer"
        return "Foyer mis à jour", "mise à jour du foyer"
    if t == "validation.set":
        oid = p["objective_id"]
        verb = "revalidé" if oid in state.validations else "validé"
        state.validations[oid] = dict(p)
        title = _title(catalog, state, oid)
        return f"Objectif {verb} : {title}", f"objectif {verb} « {title} »"
    if t == "validation.delete":
        oid = p["objective_id"]
        state.validations.pop(oid, None)
        title = _title(catalog, state, oid)
        return f"Objectif décoché : {title}", f"objectif décoché « {title} »"
    if t == "stock.upsert":
        existed = p["id"] in state.stock
        state.stock[p["id"]] = dict(p)
        if existed:
            return f"Stock modifié : {p['name']}", f"modification du stock « {p['name']} »"
        return (
            f"Stock ajouté : {fmt_qty(float(p['quantity']))} × {p['name']}",
            f"ajout de stock « {p['name']} »",
        )
    if t == "stock.delete":
        item = state.stock.pop(p["id"], None)
        name = item["name"] if item else p["id"]
        return f"Stock retiré : {name}", f"retrait du stock « {name} »"
    if t == "custom.upsert":
        existed = p["id"] in state.custom
        state.custom[p["id"]] = dict(p)
        verb = "modifié" if existed else "créé"
        return f"Objectif perso {verb} : {p['title']}", f"objectif perso {verb} « {p['title']} »"
    if t == "custom.delete":
        item = state.custom.pop(p["id"], None)
        state.validations.pop(p["id"], None)
        title = item["title"] if item else p["id"]
        return f"Objectif perso supprimé : {title}", f"objectif perso supprimé « {title} »"
    if t == "notes.set":
        state.notes[p["key"]] = str(p.get("text", ""))
        name = next((n.name for n in catalog.crisis_notes if n.id == p["key"]), p["key"])
        return f"Fiche de crise mise à jour : {name}", f"fiche de crise « {name} »"
    raise ValueError(f"type d'opération inconnu : {t}")


def replay(catalog: Catalog, ops: list[Op]) -> State:
    state = State()
    for op in sorted(ops, key=sort_key):
        apply(catalog, state, op)
    return state


@dataclass
class Inputs:
    catalog: Catalog
    household: eng.HouseholdState
    validations: list[eng.Validation]
    stock: list[eng.StockLine]


def inputs(catalog: Catalog, state: State) -> Inputs | None:
    h = state.household
    if h is None:
        return None
    full = catalog.with_custom(list(state.custom.values()))
    household = eng.HouseholdState(
        context=h["context"],
        members=[eng.Member.from_dict(m) for m in h.get("members", [])],
        declared_tags=set(h.get("tags", [])),
        target_context=h.get("target_context"),
        priority_axes=list(h.get("priority_axes", [])),
        goal_level=h.get("goal_level"),
    )
    validations = [
        eng.Validation(v["objective_id"], date.fromisoformat(v["validated_at"])) for v in state.validations.values()
    ]
    stock = [
        eng.StockLine(
            s["id"],
            s["name"],
            s["category"],
            float(s["quantity"]) * float(s["amount_per_unit"]),
            date.fromisoformat(s["expires_on"]) if s.get("expires_on") else None,
        )
        for s in state.stock.values()
    ]
    return Inputs(full, household, validations, stock)


def evaluate(catalog: Catalog, state: State, today: date) -> eng.Evaluation | None:
    inp = inputs(catalog, state)
    if inp is None:
        return None
    return eng.evaluate(inp.catalog, inp.household, inp.validations, inp.stock, today)


def _expirations(catalog: Catalog, state: State, after: date, until: date) -> list[tuple[date, str]]:
    """Dates (after, until] où une validation ou un stock cesse de compter, avec la cause."""
    full = catalog.with_custom(list(state.custom.values()))
    by_id = full.objectives_by_id
    found: dict[date, list[str]] = {}
    for oid, v in state.validations.items():
        obj = by_id.get(oid)
        expiry = eng.validation_expiry(obj, date.fromisoformat(v["validated_at"])) if obj else None
        if obj and expiry:
            d = expiry + timedelta(days=eng.GRACE_DAYS)  # le tambour tombe à la fin du sursis
            if after < d <= until:
                found.setdefault(d, []).append(f"revalidation dépassée « {obj.title} »")
    for s in state.stock.values():
        if s.get("expires_on"):
            d = date.fromisoformat(s["expires_on"]) + timedelta(days=1)
            if after < d <= until:
                found.setdefault(d, []).append(f"péremption « {s['name']} »")
    return [(d, ", ".join(sorted(causes))) for d, causes in sorted(found.items())]


@dataclass
class History:
    snapshots: list[dict[str, Any]]  # {at, level, cause}
    journal: list[dict[str, Any]]  # {at, type, message, op_id}


def history(catalog: Catalog, ops: list[Op], today: date) -> History:
    state = State()
    snapshots: list[dict[str, Any]] = []
    journal: list[dict[str, Any]] = []
    last: list[int | None] = [None]

    def check(at: str, day: date, cause: str) -> None:
        ev = evaluate(catalog, state, day)
        level = ev.level if ev else None
        if level is None:
            last[0] = None
            return
        if level != last[0]:
            snapshots.append({"at": at, "level": level, "cause": cause})
            if last[0] is not None:
                direction = "monte" if level > last[0] else "descend"
                name = catalog.level(level).name
                journal.append(
                    {
                        "at": at,
                        "type": "level_changed",
                        "message": f"Le foyer {direction} au niveau {level} ({name}) : {cause}",
                        "op_id": None,
                    }
                )
            last[0] = level

    def expirations(after: date | None, until: date) -> None:
        if after is None or state.household is None:
            return
        for d, cause in _expirations(catalog, state, after, until):
            check(f"{d.isoformat()}T00:00:00.000Z", d, cause)

    prev: date | None = None
    for op in sorted(ops, key=sort_key):
        day = date.fromisoformat(op.at[:10])
        expirations(prev, day)
        message, cause = apply(catalog, state, op)
        journal.append({"at": op.at, "type": op.type, "message": message, "op_id": op.id})
        check(op.at, day, cause)
        prev = day
    expirations(prev, today)
    return History(snapshots, journal)
