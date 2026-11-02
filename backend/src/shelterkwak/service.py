"""Couche entre la base et le moteur : charge l'état, évalue, journalise."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from sqlmodel import Session, col, select

from . import engine as eng
from .catalog import Catalog
from .models import Event, Household, LevelSnapshot, Member, ObjectiveValidation, StockItem

HOUSEHOLD_ID = 1
TIME_CAUSE = "Évolution dans le temps (péremption ou revalidation)"


@dataclass
class Loaded:
    household: Household
    members: list[Member]
    state: eng.HouseholdState
    validations: list[ObjectiveValidation]
    stock: list[StockItem]


def get_household(session: Session) -> Household | None:
    return session.get(Household, HOUSEHOLD_ID)


def to_state(household: Household, members: list[Member]) -> eng.HouseholdState:
    return eng.HouseholdState(
        context=household.context,
        members=[eng.Member(m.type, m.medical) for m in members],
        declared_tags=set(household.tags),
        target_context=household.target_context,
        priority_axes=list(household.priority_axes),
        goal_level=household.goal_level,
    )


def load(session: Session) -> Loaded | None:
    household = get_household(session)
    if household is None:
        return None
    members = list(session.exec(select(Member).where(Member.household_id == HOUSEHOLD_ID).order_by(col(Member.id))))
    validations = list(session.exec(select(ObjectiveValidation)))
    stock = list(session.exec(select(StockItem).order_by(col(StockItem.category), col(StockItem.expires_on))))
    return Loaded(household, members, to_state(household, members), validations, stock)


def stock_lines(stock: list[StockItem]) -> list[eng.StockLine]:
    return [eng.StockLine(s.id or 0, s.name, s.category, s.quantity * s.amount_per_unit, s.expires_on) for s in stock]


def evaluate(catalog: Catalog, loaded: Loaded, now: datetime) -> eng.Evaluation:
    return eng.evaluate(
        catalog,
        loaded.state,
        [eng.Validation(v.objective_id, v.validated_at) for v in loaded.validations],
        stock_lines(loaded.stock),
        now.date(),
    )


def log(session: Session, now: datetime, type_: str, message: str, **payload: object) -> None:
    session.add(Event(at=now, type=type_, message=message, payload=payload))


def refresh_level(session: Session, catalog: Catalog, now: datetime, cause: str) -> eng.Evaluation | None:
    """Réévalue le foyer ; si le niveau a changé depuis le dernier instantané, le journalise."""
    session.flush()
    loaded = load(session)
    if loaded is None:
        return None
    evaluation = evaluate(catalog, loaded, now)
    last = session.exec(
        select(LevelSnapshot).order_by(col(LevelSnapshot.at).desc(), col(LevelSnapshot.id).desc())
    ).first()
    if last is None or last.level != evaluation.level:
        session.add(LevelSnapshot(at=now, level=evaluation.level, cause=cause))
        if last is not None:
            direction = "monte" if evaluation.level > last.level else "descend"
            name = catalog.level(evaluation.level).name
            log(
                session,
                now,
                "level_changed",
                f"Le foyer {direction} au niveau {evaluation.level} ({name}) : {cause}",
                old=last.level,
                new=evaluation.level,
                cause=cause,
            )
    session.commit()
    return evaluation
