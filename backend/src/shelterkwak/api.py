"""Routes HTTP sous /api : synchronisation du journal et lecture du tableau de bord."""

from __future__ import annotations

import re
from dataclasses import asdict
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlmodel import Session, col, func, select

from . import replay
from .catalog import MAX_LEVEL, Catalog, get_catalog
from .db import get_session
from .engine import Evaluation
from .models import StoredOp

router = APIRouter(prefix="/api")

ISO_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,6})?Z$")
MAX_OPS_PER_SYNC = 5000


def get_now() -> datetime:
    return datetime.now().astimezone()


SessionDep = Annotated[Session, Depends(get_session)]
CatalogDep = Annotated[Catalog, Depends(get_catalog)]
NowDep = Annotated[datetime, Depends(get_now)]


class OpIn(BaseModel):
    id: str = Field(min_length=1, max_length=64)
    device: str = Field(min_length=1, max_length=64)
    at: str
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)

    @field_validator("at")
    @classmethod
    def _utc(cls, v: str) -> str:
        if not ISO_UTC.match(v):
            raise ValueError("horodatage attendu au format ISO UTC, ex. 2026-11-02T14:03:00.000Z")
        return v

    @field_validator("type")
    @classmethod
    def _known(cls, v: str) -> str:
        if v not in replay.OP_TYPES:
            raise ValueError(f"type d'opération inconnu : {v}")
        return v


class SyncIn(BaseModel):
    device: str = Field(min_length=1, max_length=64)
    cursor: int = Field(default=0, ge=0)
    ops: list[OpIn] = Field(default_factory=list, max_length=MAX_OPS_PER_SYNC)


def _op_out(o: StoredOp) -> dict[str, Any]:
    return {"id": o.id, "device": o.device, "at": o.at, "type": o.type, "payload": o.payload}


def _all_ops(session: Session) -> list[replay.Op]:
    return [replay.Op.from_dict(_op_out(o)) for o in session.exec(select(StoredOp).order_by(col(StoredOp.seq)))]


@router.get("/health")
def health(session: SessionDep, now: NowDep) -> dict[str, Any]:
    count = session.exec(select(func.count()).select_from(StoredOp)).one()
    return {"ok": True, "server_time": now.isoformat(), "ops": count}


@router.post("/sync")
def sync(body: SyncIn, session: SessionDep, now: NowDep) -> dict[str, Any]:
    """Enregistre les opérations inconnues et renvoie celles reçues après `cursor`."""
    known = set(session.exec(select(StoredOp.id).where(col(StoredOp.id).in_([o.id for o in body.ops]))))
    accepted = 0
    for o in body.ops:
        if o.id in known:
            continue
        known.add(o.id)
        session.add(StoredOp(**o.model_dump(), received_at=now))
        accepted += 1
    session.commit()
    rows = session.exec(select(StoredOp).where(col(StoredOp.seq) > body.cursor).order_by(col(StoredOp.seq))).all()
    cursor = rows[-1].seq if rows else body.cursor
    return {
        "accepted": accepted,
        "cursor": cursor,
        "ops": [_op_out(o) for o in rows if o.device != body.device],
    }


@router.get("/ops")
def export_ops(session: SessionDep) -> list[dict[str, Any]]:
    return [_op_out(o) for o in session.exec(select(StoredOp).order_by(col(StoredOp.seq)))]


def dashboard_dict(catalog: Catalog, state: replay.State, ev: Evaluation) -> dict[str, Any]:
    full = catalog.with_custom(list(state.custom.values()))
    axes = {a.id: a for a in full.axes}
    nxt = ev.level + 1 if ev.level < MAX_LEVEL else None
    return {
        "household": state.household,
        "level": ev.level,
        "level_info": full.level(ev.level).model_dump(),
        "next_level_info": full.level(nxt).model_dump() if nxt else None,
        "tiers": [{**asdict(t), "progress": t.progress, "name": full.level(t.n).name} for t in ev.tiers],
        "axis_levels": [{"axis": a, "name": axes[a].name, "level": lv} for a, lv in ev.axis_levels.items()],
        "autonomy": [asdict(a) for a in ev.autonomy.values()],
        "checklist": [asdict(i) for i in ev.checklist],
    }


@router.get("/dashboard")
def dashboard(session: SessionDep, catalog: CatalogDep, now: NowDep) -> dict[str, Any]:
    """Tableau de bord calculé par le moteur Python de référence, depuis le journal du serveur."""
    state = replay.replay(catalog, _all_ops(session))
    ev = replay.evaluate(catalog, state, now.date())
    if ev is None:
        raise HTTPException(404, "Aucun foyer synchronisé.")
    return dashboard_dict(catalog, state, ev)


@router.get("/history")
def history(session: SessionDep, catalog: CatalogDep, now: NowDep) -> dict[str, Any]:
    h = replay.history(catalog, _all_ops(session), now.date())
    return {"snapshots": h.snapshots, "journal": list(reversed(h.journal))}
