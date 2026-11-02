from __future__ import annotations

from datetime import date

from shelterkwak import replay
from shelterkwak.catalog import Catalog
from shelterkwak.export import LEVEL2, household, onboarding, op, stock, validation

D0 = "2026-11-02"


def ops(*items: dict) -> list[replay.Op]:
    return [replay.Op.from_dict(o) for o in items]


def onboard() -> dict:
    return onboarding(1, "2026-11-02T10:00:00.000Z", household(), LEVEL2, [], D0)


def test_onboarding_reaches_level_2(catalog: Catalog) -> None:
    state = replay.replay(catalog, ops(onboard()))
    ev = replay.evaluate(catalog, state, date(2026, 11, 2))
    assert ev is not None and ev.level == 2


def test_order_is_by_timestamp_not_arrival(catalog: Catalog) -> None:
    late = op(3, "2026-11-04T00:00:00.000Z", "validation.set", validation("securite.alertes", "2026-11-04"))
    early = op(2, "2026-11-03T00:00:00.000Z", "validation.delete", {"objective_id": "securite.alertes"})
    state = replay.replay(catalog, ops(onboard(), late, early))
    assert state.validations["securite.alertes"]["validated_at"] == "2026-11-04"


def test_last_writer_wins_on_tie_by_device(catalog: Catalog) -> None:
    a = op(2, "2026-11-04T00:00:00.000Z", "stock.upsert", stock("s", "PC", "eau", 1, 1), "pc")
    b = op(3, "2026-11-04T00:00:00.000Z", "stock.upsert", stock("s", "Tel", "eau", 1, 1), "phone")
    assert replay.replay(catalog, ops(onboard(), b, a)).stock["s"]["name"] == "Tel"  # "phone" > "pc"


def test_custom_objective_blocks_its_tier(catalog: Catalog) -> None:
    custom = {"id": "perso.x", "axis": "eau", "level": 2, "title": "Perso", "kind": "check", "required": True}
    state = replay.replay(catalog, ops(onboard(), op(2, "2026-11-03T00:00:00.000Z", "custom.upsert", custom)))
    ev = replay.evaluate(catalog, state, date(2026, 11, 3))
    assert ev is not None and ev.level == 1
    assert ev.statuses["perso.x"].status == "todo"


def test_invalid_custom_objective_is_ignored(catalog: Catalog) -> None:
    custom = {"id": "perso.x", "axis": "nope", "level": 2, "title": "Perso", "kind": "check", "required": True}
    state = replay.replay(catalog, ops(onboard(), op(2, "2026-11-03T00:00:00.000Z", "custom.upsert", custom)))
    ev = replay.evaluate(catalog, state, date(2026, 11, 3))
    assert ev is not None and ev.level == 2 and "perso.x" not in ev.statuses


def test_history_records_time_based_drop(catalog: Catalog) -> None:
    h = replay.history(catalog, ops(onboard()), date(2027, 12, 1))  # la trousse (365 j) expire le 2027-11-02
    assert [s["level"] for s in h.snapshots] == [2, 1]
    assert h.snapshots[1]["at"].startswith("2027-11-02")
    assert "trousse" in h.snapshots[1]["cause"].lower()
    assert h.journal[-1]["type"] == "level_changed"


def test_reset_clears_everything(catalog: Catalog) -> None:
    state = replay.replay(catalog, ops(onboard(), op(2, "2026-11-03T00:00:00.000Z", "reset", {})))
    assert state.household is None and not state.validations
