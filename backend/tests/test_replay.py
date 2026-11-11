from __future__ import annotations

from datetime import date

from shelterkwak import replay
from shelterkwak.catalog import Catalog
from shelterkwak.export import LEVEL2, household, item, onboarding, op, stock, talent, validation

D0 = "2026-11-02"


def ops(*items: dict) -> list[replay.Op]:
    return [replay.Op.from_dict(o) for o in items]


def onboard() -> dict:
    day = [stock("s-eau", "Eau", "eau", 8, 1), stock("s-vivres", "Vivres", "alimentation", 2, 2200)]
    return onboarding(1, "2026-11-02T10:00:00.000Z", household(), LEVEL2, day, D0)


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
    # La trousse (365 j) expire le 2027-11-02 ; le tambour tombe à la fin du sursis de 30 jours.
    h = replay.history(catalog, ops(onboard()), date(2027, 12, 15))
    assert [s["level"] for s in h.snapshots] == [2, 1]
    assert h.snapshots[1]["at"].startswith("2027-12-02")
    assert "trousse" in h.snapshots[1]["cause"].lower()
    assert h.journal[-1]["type"] == "level_changed"


def test_reset_clears_everything(catalog: Catalog) -> None:
    state = replay.replay(catalog, ops(onboard(), op(2, "2026-11-03T00:00:00.000Z", "reset", {})))
    assert state.household is None and not state.validations


def test_crisis_notes_are_replayed(catalog: Catalog) -> None:
    note = op(2, "2026-11-03T00:00:00.000Z", "notes.set", {"key": "contacts", "text": "Maman 06…"})
    h = replay.history(catalog, ops(onboard(), note), date(2026, 11, 3))
    assert replay.replay(catalog, ops(onboard(), note)).notes == {"contacts": "Maman 06…"}
    assert h.journal[-1]["message"] == "Fiche de crise mise à jour : Contacts essentiels"


# ---------- Preuves : objets possédés et talents acquis (docs/conseil/2026-11-11.md) ----------


def bare() -> dict:
    """Interview sans objectif déjà acquis, pour voir les preuves seules."""
    day = [stock("s-eau", "Eau", "eau", 8, 1), stock("s-vivres", "Vivres", "alimentation", 2, 2200)]
    return onboarding(1, "2026-11-02T10:00:00.000Z", household(), [], day, D0)


def _status(catalog: Catalog, state: replay.State, oid: str, today: str = "2026-11-12"):
    ev = replay.evaluate(catalog, state, date.fromisoformat(today))
    assert ev is not None
    return ev.statuses[oid]


def test_item_proves_objectives_of_its_tier_and_below(catalog: Catalog) -> None:
    state = replay.replay(
        catalog, ops(bare(), op(2, "2026-11-03T08:00:00.000Z", "item.set", item("trousse_secours", "commun")))
    )
    for oid in ("sante.pharmacie_base", "sante.trousse"):  # rustique et commun
        s = _status(catalog, state, oid)
        assert (s.status, s.validated_at) == ("done", date(2026, 11, 3)), oid
    assert "sante.trousse" not in state.validations  # rien n'est écrit : la preuve se recalcule


def test_lower_tier_does_not_prove_higher_one(catalog: Catalog) -> None:
    state = replay.replay(
        catalog, ops(bare(), op(2, "2026-11-03T08:00:00.000Z", "item.set", item("trousse_secours", "rustique")))
    )
    assert _status(catalog, state, "sante.pharmacie_base").status == "done"
    assert _status(catalog, state, "sante.trousse").status == "todo"


def test_removing_item_drops_proof_but_keeps_manual_validation(catalog: Catalog) -> None:
    state = replay.replay(
        catalog,
        ops(
            bare(),
            op(2, "2026-11-03T08:00:00.000Z", "validation.set", validation("sante.pharmacie_base", "2026-11-03")),
            op(3, "2026-11-04T08:00:00.000Z", "item.set", item("trousse_secours", "commun")),
            op(4, "2026-11-05T08:00:00.000Z", "item.delete", {"item_id": "trousse_secours"}),
        ),
    )
    assert _status(catalog, state, "sante.pharmacie_base").status == "done"
    assert _status(catalog, state, "sante.trousse").status == "todo"


def test_most_recent_of_manual_validation_and_proof_wins(catalog: Catalog) -> None:
    state = replay.replay(
        catalog,
        ops(
            bare(),
            op(2, "2026-11-03T08:00:00.000Z", "item.set", item("trousse_secours", "commun")),
            op(3, "2026-11-08T08:00:00.000Z", "validation.set", validation("sante.trousse", "2026-11-08")),
        ),
    )
    assert _status(catalog, state, "sante.trousse").validated_at == date(2026, 11, 8)


def test_next_check_of_item_brings_revalidation_forward(catalog: Catalog) -> None:
    # sante.trousse se revalide tous les 365 jours ; la trousse est à vérifier le 10 janvier.
    trousse = item("trousse_secours", "commun", expires="2027-01-10")
    state = replay.replay(catalog, ops(bare(), op(2, "2026-11-03T08:00:00.000Z", "item.set", trousse)))
    assert _status(catalog, state, "sante.trousse").expires_on == date(2027, 1, 10)
    assert _status(catalog, state, "sante.trousse", "2027-01-11").status == "grace"


def test_talent_proves_at_its_acquisition_date(catalog: Catalog) -> None:
    state = replay.replay(
        catalog,
        ops(
            bare(),
            op(2, "2026-11-03T08:00:00.000Z", "talent.set", talent("brico.coupures", "2026-10-01")),
            op(3, "2026-11-04T08:00:00.000Z", "talent.set", talent("transmetteur.plan", None)),
        ),
    )
    assert _status(catalog, state, "eau.robinet_arret").validated_at == date(2026, 10, 1)
    assert _status(catalog, state, "communication.reseau_local").validated_at == date(2026, 11, 4)


def test_reserve_proves_inventory_once_an_article_is_in_stock(catalog: Catalog) -> None:
    state = replay.replay(catalog, ops(bare()))
    assert _status(catalog, state, "alimentation.inventaire").status == "done"
    state = replay.replay(catalog, ops(bare(), op(2, "2026-11-03T08:00:00.000Z", "stock.delete", {"id": "s-vivres"})))
    assert _status(catalog, state, "alimentation.inventaire").status == "todo"


def test_proof_expiry_is_scheduled_in_history(catalog: Catalog) -> None:
    trousse = item("trousse_secours", "commun", expires="2027-01-10")
    state = replay.replay(catalog, ops(bare(), op(2, "2026-11-03T08:00:00.000Z", "item.set", trousse)))
    found = replay._expirations(catalog, state, date(2027, 1, 1), date(2027, 6, 1))
    title = catalog.objectives_by_id["sante.trousse"].title
    assert any(f"revalidation dépassée « {title} »" in cause for _, cause in found)
