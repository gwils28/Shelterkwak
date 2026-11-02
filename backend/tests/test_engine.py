from __future__ import annotations

from datetime import date, timedelta

from shelterkwak.catalog import Catalog
from shelterkwak.engine import (
    HouseholdState,
    Member,
    StockLine,
    Validation,
    compute_autonomy,
    daily_need,
    evaluate,
    is_applicable,
)

TODAY = date(2026, 11, 2)
ADULTS = [Member("adulte"), Member("adulte")]


def state(**kw) -> HouseholdState:
    return HouseholdState(context=kw.pop("context", "appartement"), members=kw.pop("members", list(ADULTS)), **kw)


def required_ids(catalog: Catalog, st: HouseholdState, upto: int) -> list[str]:
    tags = st.tags(catalog)
    return [
        o.id
        for o in catalog.objectives
        if o.required and o.level <= upto and o.kind != "stock" and is_applicable(o, st, tags)
    ]


def full_stock(st: HouseholdState, catalog: Catalog, days: float, expires_on: date | None = None) -> list[StockLine]:
    return [
        StockLine(str(i), c.id, c.id, daily_need(catalog, c.id, st) * days, expires_on)
        for i, c in enumerate(catalog.categories)
    ]


def test_new_household_is_vulnerable(catalog: Catalog) -> None:
    ev = evaluate(catalog, state(), [], [], TODAY)
    assert ev.level == 1
    assert ev.tiers[0].state == "built"
    assert ev.tiers[1].state == "current"
    assert all(item.kind == "blocking" and item.level == 2 for item in ev.checklist)


def test_level_2_when_all_level_2_required_done(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(i, TODAY) for i in required_ids(catalog, st, 2)]
    assert evaluate(catalog, st, vals, [], TODAY).level == 2


def test_tiers_are_blocking(catalog: Catalog) -> None:
    """Tout le niveau 3 validé mais un objectif du niveau 2 manquant : on reste au niveau 1."""
    st = state()
    ids = required_ids(catalog, st, 3)
    vals = [Validation(i, TODAY) for i in ids if i != "securite.alertes"]
    ev = evaluate(catalog, st, vals, full_stock(st, catalog, 3), TODAY)
    assert ev.level == 1
    assert ev.tiers[2].required_done == ev.tiers[2].required_total


def test_stock_objectives_follow_inventory(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(i, TODAY) for i in required_ids(catalog, st, 3)]
    assert evaluate(catalog, st, vals, full_stock(st, catalog, 2.5), TODAY).level == 2
    assert evaluate(catalog, st, vals, full_stock(st, catalog, 3), TODAY).level == 3


def test_expired_stock_no_longer_counts(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(i, TODAY) for i in required_ids(catalog, st, 3)]
    stock = full_stock(st, catalog, 5, expires_on=TODAY - timedelta(days=1))
    ev = evaluate(catalog, st, vals, stock, TODAY)
    assert ev.level == 2
    assert ev.autonomy["eau"].days == 0
    assert any(i.kind == "stock_expired" for i in ev.checklist)


def test_stock_expiring_soon_cracks_but_keeps_level(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(i, TODAY) for i in required_ids(catalog, st, 3)]
    stock = full_stock(st, catalog, 5, expires_on=TODAY + timedelta(days=10))
    ev = evaluate(catalog, st, vals, stock, TODAY)
    assert ev.level == 3
    assert ev.statuses["eau.stock_3j"].status == "expiring"
    assert ev.tiers[2].cracked


def test_revalidation_expires_validation(catalog: Catalog) -> None:
    st = state()
    old = TODAY - timedelta(days=400)  # sante.trousse : revalidate_days 365
    vals = [Validation(i, old if i == "sante.trousse" else TODAY) for i in required_ids(catalog, st, 2)]
    ev = evaluate(catalog, st, vals, [], TODAY)
    assert ev.statuses["sante.trousse"].status == "expired"
    assert ev.level == 1
    assert ev.checklist[0].kind == "revalidate"
    assert ev.checklist[0].objective_id == "sante.trousse"


def test_skill_erodes_over_time(catalog: Catalog) -> None:
    st = state()
    v = [Validation("competences.feu", TODAY - timedelta(days=340))]
    assert evaluate(catalog, st, v, [], TODAY).statuses["competences.feu"].status == "expiring"
    v = [Validation("competences.feu", TODAY - timedelta(days=366))]
    assert evaluate(catalog, st, v, [], TODAY).statuses["competences.feu"].status == "expired"


def test_new_member_raises_needs_and_can_drop_level(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(i, TODAY) for i in required_ids(catalog, st, 3)]
    stock = full_stock(st, catalog, 3)
    assert evaluate(catalog, st, vals, stock, TODAY).level == 3
    bigger = state(members=[*ADULTS, Member("enfant")])
    assert evaluate(catalog, bigger, vals, stock, TODAY).level == 2


def test_new_tag_makes_objectives_applicable(catalog: Catalog) -> None:
    st = state()
    assert evaluate(catalog, st, [], [], TODAY).statuses["alimentation.bebe"].status == "na"
    with_baby = state(members=[*ADULTS, Member("bebe")])
    assert evaluate(catalog, with_baby, [], [], TODAY).statuses["alimentation.bebe"].status == "todo"
    medical = state(members=[Member("adulte", medical=True)])
    assert evaluate(catalog, medical, [], [], TODAY).statuses["sante.traitements_7j"].status == "todo"


def test_context_filters_objectives(catalog: Catalog) -> None:
    flat = evaluate(catalog, state(context="appartement"), [], [], TODAY)
    farm = evaluate(catalog, state(context="rural"), [], [], TODAY)
    assert flat.statuses["eau.recuperateur"].status == "na"
    assert farm.statuses["eau.recuperateur"].status == "todo"
    assert farm.statuses["eau.plan_appro"].status == "na"


def test_target_context_suggests_preparation(catalog: Catalog) -> None:
    ev = evaluate(catalog, state(target_context="rural"), [], [], TODAY)
    prepare = {i.objective_id for i in ev.checklist if i.kind == "prepare"}
    assert "eau.recuperateur" in prepare
    assert "eau.plan_appro" not in prepare


def test_priority_axes_come_first(catalog: Catalog) -> None:
    ev = evaluate(catalog, state(priority_axes=["communaute"]), [], [], TODAY)
    assert ev.checklist[0].axis == "communaute"


def test_autonomy_uses_household_needs(catalog: Catalog) -> None:
    st = state(members=[Member("adulte"), Member("enfant"), Member("animal")])
    auto = compute_autonomy(catalog, st, [StockLine("1", "eau", "eau", 60)], TODAY)
    assert auto["eau"].need_per_day == 3 + 2 + 1
    assert auto["eau"].days == 10
    assert auto["traitements"].days is None  # personne sous traitement


def test_axis_levels_spot_weak_link(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(o.id, TODAY) for o in catalog.objectives if o.axis == "communaute"]
    ev = evaluate(catalog, st, vals, [], TODAY)
    assert ev.axis_levels["communaute"] == 8
    assert ev.axis_levels["eau"] == 1
    assert ev.level == 1
