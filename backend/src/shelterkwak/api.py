"""Routes HTTP sous /api."""

from __future__ import annotations

from dataclasses import asdict
from datetime import date, datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, col, delete, select

from . import service
from .catalog import Catalog, ContextId, get_catalog
from .db import get_session
from .engine import Evaluation
from .interview import Answer, apply_answers
from .models import (
    Event,
    Household,
    LevelSnapshot,
    Member,
    ObjectiveValidation,
    StockItem,
)

router = APIRouter(prefix="/api")


def get_now() -> datetime:
    return datetime.now().astimezone()


SessionDep = Annotated[Session, Depends(get_session)]
CatalogDep = Annotated[Catalog, Depends(get_catalog)]
NowDep = Annotated[datetime, Depends(get_now)]


# ---------- Schémas d'entrée ----------


class MemberIn(BaseModel):
    name: str = Field(min_length=1)
    type: str
    medical: bool = False


class HouseholdIn(BaseModel):
    name: str = Field(min_length=1)
    context: ContextId
    target_context: ContextId | None = None
    target_date: date | None = None
    members: list[MemberIn] = Field(min_length=1)
    tags: list[str] = Field(default_factory=list)
    priority_axes: list[str] = Field(default_factory=list)
    goal_level: int | None = Field(default=None, ge=1, le=8)
    goal_horizon_months: int | None = None


class OnboardingIn(BaseModel):
    name: str = Field(min_length=1)
    context: ContextId
    target_context: ContextId | None = None
    target_date: date | None = None
    members: list[MemberIn] = Field(min_length=1)
    answers: dict[str, Answer] = Field(default_factory=dict)


class ValidationIn(BaseModel):
    validated_at: date | None = None
    note: str = ""


class StockIn(BaseModel):
    name: str = Field(min_length=1)
    category: str
    quantity: float = Field(ge=0)
    unit_label: str = ""
    amount_per_unit: float = Field(gt=0)
    expires_on: date | None = None


# ---------- Aides ----------


def _require(session: Session) -> service.Loaded:
    loaded = service.load(session)
    if loaded is None:
        raise HTTPException(404, "Aucun foyer : commence par l'onboarding.")
    return loaded


def _check_members(catalog: Catalog, members: list[MemberIn]) -> None:
    valid = {m.id for m in catalog.member_types}
    for m in members:
        if m.type not in valid:
            raise HTTPException(422, f"Type de membre inconnu : {m.type}")
    if not any(m.type != "animal" for m in members):
        raise HTTPException(422, "Le foyer doit compter au moins une personne.")


def _household_out(loaded: service.Loaded, catalog: Catalog) -> dict[str, Any]:
    h = loaded.household
    return {
        "name": h.name,
        "context": h.context,
        "target_context": h.target_context,
        "target_date": h.target_date,
        "tags": h.tags,
        "derived_tags": sorted(loaded.state.tags(catalog) - set(h.tags)),
        "priority_axes": h.priority_axes,
        "goal_level": h.goal_level,
        "goal_horizon_months": h.goal_horizon_months,
        "created_at": h.created_at,
        "members": [{"id": m.id, "name": m.name, "type": m.type, "medical": m.medical} for m in loaded.members],
    }


def _replace_members(session: Session, members: list[MemberIn]) -> None:
    session.exec(delete(Member).where(col(Member.household_id) == service.HOUSEHOLD_ID))  # type: ignore[call-overload]
    for m in members:
        session.add(Member(household_id=service.HOUSEHOLD_ID, name=m.name, type=m.type, medical=m.medical))


def _dashboard(catalog: Catalog, loaded: service.Loaded, ev: Evaluation) -> dict[str, Any]:
    axes = {a.id: a for a in catalog.axes}
    objectives = catalog.objectives_by_id
    counts: dict[str, int] = {}
    for st in ev.statuses.values():
        counts[st.status] = counts.get(st.status, 0) + 1
    nxt = ev.level + 1 if ev.level < 8 else None
    return {
        "household": _household_out(loaded, catalog),
        "level": ev.level,
        "level_info": catalog.level(ev.level).model_dump(),
        "next_level_info": catalog.level(nxt).model_dump() if nxt else None,
        "tiers": [
            {
                **asdict(t),
                "progress": t.progress,
                "name": catalog.level(t.n).name,
                "horizon": catalog.level(t.n).horizon,
            }
            for t in ev.tiers
        ],
        "axis_levels": [
            {"axis": a, "name": axes[a].name, "icon": axes[a].icon, "level": lv} for a, lv in ev.axis_levels.items()
        ],
        "autonomy": [
            {
                **asdict(a),
                "name": catalog.categories_by_id[a.category].name,
                "unit": catalog.categories_by_id[a.category].unit,
            }
            for a in ev.autonomy.values()
        ],
        "checklist": [
            {**asdict(i), "objective_kind": objectives[i.objective_id].kind if i.objective_id else None}
            for i in ev.checklist
        ],
        "counts": counts,
    }


# ---------- Catalogue ----------


@router.get("/catalog")
def read_catalog(catalog: CatalogDep) -> dict[str, Any]:
    return {
        "levels": [lv.model_dump() for lv in catalog.levels],
        "axes": [a.model_dump() for a in catalog.axes],
        "contexts": [c.model_dump() for c in catalog.contexts],
        "member_types": [m.model_dump() for m in catalog.member_types],
        "categories": [c.model_dump() for c in catalog.categories],
        "objective_count": len(catalog.objectives),
    }


@router.get("/interview")
def read_interview(catalog: CatalogDep) -> list[dict[str, Any]]:
    out = []
    for q in catalog.questions:
        data = q.model_dump(exclude={"creates_stock"})
        if q.options_from == "axes":
            data["options"] = [{"value": a.id, "label": f"{a.icon} {a.name}"} for a in catalog.axes]
        out.append(data)
    return out


# ---------- Foyer ----------


@router.get("/household")
def read_household(session: SessionDep, catalog: CatalogDep) -> dict[str, Any]:
    return _household_out(_require(session), catalog)


@router.put("/household")
def update_household(body: HouseholdIn, session: SessionDep, catalog: CatalogDep, now: NowDep) -> dict[str, Any]:
    loaded = _require(session)
    _check_members(catalog, body.members)
    h = loaded.household
    old_ctx, old_n = h.context, len(loaded.members)
    for field in (
        "name",
        "context",
        "target_context",
        "target_date",
        "tags",
        "priority_axes",
        "goal_level",
        "goal_horizon_months",
    ):
        setattr(h, field, getattr(body, field))
    _replace_members(session, body.members)
    session.add(h)
    if old_ctx != body.context:
        ctx_names = {c.id: c.name for c in catalog.contexts}
        service.log(
            session,
            now,
            "context_changed",
            f"Changement de lieu de vie : {ctx_names[old_ctx]} → {ctx_names[body.context]}",
            old=old_ctx,
            new=body.context,
        )
        cause = "changement de lieu de vie"
    else:
        cause = "mise à jour du foyer"
    if len(body.members) != old_n:
        service.log(
            session,
            now,
            "household_updated",
            f"Le foyer passe de {old_n} à {len(body.members)} membre(s)",
            old=old_n,
            new=len(body.members),
        )
        cause = "changement de composition du foyer"
    else:
        service.log(session, now, "household_updated", "Foyer mis à jour")
    service.refresh_level(session, catalog, now, cause)
    return _household_out(_require(session), catalog)


@router.post("/onboarding", status_code=201)
def onboarding(body: OnboardingIn, session: SessionDep, catalog: CatalogDep, now: NowDep) -> dict[str, Any]:
    if service.get_household(session) is not None:
        raise HTTPException(409, "Un foyer existe déjà. Réinitialise pour recommencer.")
    _check_members(catalog, body.members)
    household = Household(
        id=service.HOUSEHOLD_ID,
        name=body.name,
        context=body.context,
        target_context=body.target_context,
        target_date=body.target_date,
        answers=body.answers,
        created_at=now,
    )
    session.add(household)
    _replace_members(session, body.members)
    session.flush()
    state = service.to_state(
        household, [Member(household_id=1, name=m.name, type=m.type, medical=m.medical) for m in body.members]
    )
    result = apply_answers(catalog, state, body.answers)
    household.tags = sorted(result.tags)
    household.priority_axes = result.lists.get("priority_axes", [])
    if "goal_level" in result.sets:
        household.goal_level = int(result.sets["goal_level"])
    if "goal_horizon_months" in result.sets:
        household.goal_horizon_months = int(result.sets["goal_horizon_months"])
    for oid in sorted(result.validates):
        session.add(ObjectiveValidation(objective_id=oid, validated_at=now.date(), source="interview"))
    for s in result.stock:
        session.add(
            StockItem(
                name=s.name,
                category=s.category,
                quantity=s.quantity,
                unit_label=s.unit_label,
                amount_per_unit=s.amount_per_unit,
                created_at=now,
            )
        )
    service.log(
        session,
        now,
        "onboarding_completed",
        f"Interview terminée : {len(result.validates)} objectif(s) déjà acquis, {len(result.stock)} stock(s) estimé(s)",
    )
    ev = service.refresh_level(session, catalog, now, "interview initiale")
    assert ev is not None
    return _dashboard(catalog, _require(session), ev)


@router.post("/reset", status_code=204)
def reset(session: SessionDep) -> None:
    for table in (Member, ObjectiveValidation, StockItem, Event, LevelSnapshot, Household):
        session.exec(delete(table))  # type: ignore[call-overload]
    session.commit()


# ---------- Tableau de bord et objectifs ----------


@router.get("/dashboard")
def dashboard(session: SessionDep, catalog: CatalogDep, now: NowDep) -> dict[str, Any]:
    _require(session)
    ev = service.refresh_level(session, catalog, now, service.TIME_CAUSE)
    assert ev is not None
    return _dashboard(catalog, _require(session), ev)


@router.get("/objectives")
def objectives(session: SessionDep, catalog: CatalogDep, now: NowDep) -> list[dict[str, Any]]:
    loaded = _require(session)
    ev = service.evaluate(catalog, loaded, now)
    sources = {v.objective_id: v for v in loaded.validations}
    out = []
    for o in catalog.objectives:
        st = ev.statuses[o.id]
        v = sources.get(o.id)
        out.append(
            {
                **o.model_dump(),
                "status": st.status,
                "progress": st.progress,
                "validated_at": st.validated_at,
                "expires_on": st.expires_on,
                "source": v.source if v else None,
                "note": v.note if v else "",
            }
        )
    return out


@router.post("/objectives/{objective_id}/validation")
def validate(
    objective_id: str, body: ValidationIn, session: SessionDep, catalog: CatalogDep, now: NowDep
) -> dict[str, Any]:
    _require(session)
    obj = catalog.objectives_by_id.get(objective_id)
    if obj is None:
        raise HTTPException(404, "Objectif inconnu")
    if obj.kind == "stock":
        raise HTTPException(400, "Cet objectif se calcule depuis l'inventaire.")
    when = body.validated_at or now.date()
    if when > now.date():
        raise HTTPException(422, "La date de validation ne peut pas être dans le futur.")
    existing = session.exec(select(ObjectiveValidation).where(ObjectiveValidation.objective_id == objective_id)).first()
    verb = "revalidé" if existing else "validé"
    v = existing or ObjectiveValidation(objective_id=objective_id, validated_at=when)
    v.validated_at, v.source, v.note = when, "manual", body.note
    session.add(v)
    service.log(session, now, "objective_validated", f"Objectif {verb} : {obj.title}", objective_id=objective_id)
    service.refresh_level(session, catalog, now, f"objectif {verb} « {obj.title} »")
    return {"objective_id": objective_id, "validated_at": when}


@router.delete("/objectives/{objective_id}/validation", status_code=204)
def unvalidate(objective_id: str, session: SessionDep, catalog: CatalogDep, now: NowDep) -> None:
    _require(session)
    obj = catalog.objectives_by_id.get(objective_id)
    if obj is None:
        raise HTTPException(404, "Objectif inconnu")
    existing = session.exec(select(ObjectiveValidation).where(ObjectiveValidation.objective_id == objective_id)).first()
    if existing is None:
        return
    session.delete(existing)
    service.log(session, now, "objective_unvalidated", f"Objectif décoché : {obj.title}", objective_id=objective_id)
    service.refresh_level(session, catalog, now, f"objectif décoché « {obj.title} »")


# ---------- Inventaire ----------


def _check_category(catalog: Catalog, category: str) -> None:
    if category not in catalog.categories_by_id:
        raise HTTPException(422, f"Catégorie inconnue : {category}")


@router.get("/stock")
def list_stock(session: SessionDep) -> list[StockItem]:
    _require(session)
    return list(session.exec(select(StockItem).order_by(col(StockItem.category), col(StockItem.expires_on))))


@router.post("/stock", status_code=201)
def add_stock(body: StockIn, session: SessionDep, catalog: CatalogDep, now: NowDep) -> StockItem:
    _require(session)
    _check_category(catalog, body.category)
    item = StockItem(**body.model_dump(), created_at=now)
    session.add(item)
    service.log(session, now, "stock_added", f"Stock ajouté : {body.quantity:g} × {body.name}", category=body.category)
    service.refresh_level(session, catalog, now, f"ajout de stock « {body.name} »")
    session.refresh(item)
    return item


@router.put("/stock/{item_id}")
def update_stock(item_id: int, body: StockIn, session: SessionDep, catalog: CatalogDep, now: NowDep) -> StockItem:
    item = session.get(StockItem, item_id)
    if item is None:
        raise HTTPException(404, "Article inconnu")
    _check_category(catalog, body.category)
    for k, v in body.model_dump().items():
        setattr(item, k, v)
    session.add(item)
    service.log(session, now, "stock_updated", f"Stock modifié : {body.name}", category=body.category)
    service.refresh_level(session, catalog, now, f"modification du stock « {body.name} »")
    session.refresh(item)
    return item


@router.delete("/stock/{item_id}", status_code=204)
def delete_stock(item_id: int, session: SessionDep, catalog: CatalogDep, now: NowDep) -> None:
    item = session.get(StockItem, item_id)
    if item is None:
        raise HTTPException(404, "Article inconnu")
    session.delete(item)
    service.log(session, now, "stock_removed", f"Stock retiré : {item.name}", category=item.category)
    service.refresh_level(session, catalog, now, f"retrait du stock « {item.name} »")


@router.get("/autonomy")
def autonomy(session: SessionDep, catalog: CatalogDep, now: NowDep) -> list[dict[str, Any]]:
    ev = service.evaluate(catalog, _require(session), now)
    return _dashboard(catalog, _require(session), ev)["autonomy"]


# ---------- Historique ----------


@router.get("/history")
def history(session: SessionDep) -> dict[str, Any]:
    _require(session)
    events = session.exec(select(Event).order_by(col(Event.at).desc(), col(Event.id).desc()).limit(300)).all()
    snapshots = session.exec(select(LevelSnapshot).order_by(col(LevelSnapshot.at), col(LevelSnapshot.id))).all()
    return {"events": events, "snapshots": snapshots}
