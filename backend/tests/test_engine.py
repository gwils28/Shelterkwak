from __future__ import annotations

from datetime import date, timedelta

from shelterkwak.catalog import MAX_LEVEL, Catalog
from shelterkwak.engine import (
    GRACE_DAYS,
    HouseholdState,
    Member,
    StockLine,
    Validation,
    compute_autonomy,
    daily_need,
    evaluate,
    is_applicable,
    validation_expiry,
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


def test_new_household_starts_exposed(catalog: Catalog) -> None:
    ev = evaluate(catalog, state(), [], [], TODAY)
    assert ev.level == 0
    assert ev.tiers[0].state == "current"
    assert all(item.kind == "blocking" and item.level == 1 for item in ev.checklist)


def test_level_1_needs_its_own_criteria(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(i, TODAY) for i in required_ids(catalog, st, 1)]
    assert evaluate(catalog, st, vals, [], TODAY).level == 0  # ni eau ni vivres pour 24 h
    assert evaluate(catalog, st, vals, full_stock(st, catalog, 1), TODAY).level == 1


def test_level_2_when_all_level_2_required_done(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(i, TODAY) for i in required_ids(catalog, st, 2)]
    assert evaluate(catalog, st, vals, full_stock(st, catalog, 1), TODAY).level == 2


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
    assert ev.level == 0  # plus d'eau ni de vivres : même le niveau 1 tombe
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
    ev = evaluate(catalog, st, vals, full_stock(st, catalog, 1), TODAY)
    assert ev.statuses["sante.trousse"].status == "expired"
    assert ev.level == 1
    assert ev.checklist[0].kind == "revalidate"
    assert ev.checklist[0].objective_id == "sante.trousse"


def test_skill_erodes_over_time(catalog: Catalog) -> None:
    st = state()
    v = [Validation("competences.rechaud", TODAY - timedelta(days=340))]
    assert evaluate(catalog, st, v, [], TODAY).statuses["competences.rechaud"].status == "expiring"
    v = [Validation("competences.rechaud", TODAY - timedelta(days=366))]
    assert evaluate(catalog, st, v, [], TODAY).statuses["competences.rechaud"].status == "grace"
    v = [Validation("competences.rechaud", TODAY - timedelta(days=366 + GRACE_DAYS))]
    assert evaluate(catalog, st, v, [], TODAY).statuses["competences.rechaud"].status == "expired"


def test_grace_cracks_the_tier_without_dropping_it(catalog: Catalog) -> None:
    st = state()
    old = TODAY - timedelta(days=370)  # sante.trousse : revalidate_days 365, sursis en cours
    vals = [Validation(i, old if i == "sante.trousse" else TODAY) for i in required_ids(catalog, st, 2)]
    ev = evaluate(catalog, st, vals, full_stock(st, catalog, 1), TODAY)
    assert ev.statuses["sante.trousse"].status == "grace"
    assert ev.level == 2
    assert ev.tiers[1].cracked
    assert ev.checklist[0].objective_id == "sante.trousse" and "tombe le" in ev.checklist[0].detail


def test_seasonal_objective_expires_at_next_due_date(catalog: Catalog) -> None:
    bois = catalog.objectives_by_id["energie.bois"]  # due_month 11
    assert validation_expiry(bois, date(2026, 9, 15)) == date(2027, 11, 1)
    assert validation_expiry(bois, date(2026, 11, 1)) == date(2027, 11, 1)
    assert validation_expiry(bois, date(2026, 12, 5)) == date(2028, 11, 1)


def test_adapted_variant_replaces_physical_test(catalog: Catalog) -> None:
    ev = evaluate(catalog, state(), [], [], TODAY)
    assert ev.statuses["sante.condition"].status == "todo"
    assert ev.statuses["sante.condition_adaptee"].status == "na"
    pmr = state(members=[Member("adulte", frozenset({"mobilite_reduite"})), Member("adulte")])
    ev = evaluate(catalog, pmr, [], [], TODAY)
    assert ev.statuses["sante.condition"].status == "na"
    assert ev.statuses["sante.condition_adaptee"].status == "todo"


def test_animal_sizes_change_water_needs(catalog: Catalog) -> None:
    st = state(members=[Member("adulte"), Member("animal_petit"), Member("animal_grand")])
    assert daily_need(catalog, "eau", st) == 4 + 0.3 + 2
    only_pets = state(members=[Member("animal_grand")])
    assert daily_need(catalog, "cuisson", only_pets) == 0


def test_needs_scale_with_people_and_treated_members(catalog: Catalog) -> None:
    family = state(members=[Member("adulte"), Member("adulte"), Member("enfant")])
    assert daily_need(catalog, "cuisson", family) == 2.7  # jours-personne
    treated = state(
        members=[
            Member("adulte", frozenset({"traitement"})),
            Member("senior", frozenset({"insuline"})),
            Member("enfant"),
        ]
    )
    assert daily_need(catalog, "traitements", treated) == 2  # un jour de traitement par membre traité
    assert daily_need(catalog, "traitements", family) == 0


def test_non_storable_treatment_swaps_the_90_day_stock_for_a_plan(catalog: Catalog) -> None:
    limited = state(members=[Member("adulte", frozenset({"traitement_limite"})), Member("adulte")])
    ev = evaluate(catalog, limited, [], [], TODAY)
    assert ev.statuses["sante.traitements_90j"].status == "na"
    assert ev.statuses["sante.traitements_plan"].status == "todo"


def test_new_member_raises_needs_and_can_drop_level(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(i, TODAY) for i in required_ids(catalog, st, 3)]
    stock = full_stock(st, catalog, 3)
    assert evaluate(catalog, st, vals, stock, TODAY).level == 3
    bigger = state(members=[*ADULTS, Member("adulte")])
    assert evaluate(catalog, bigger, vals, stock, TODAY).level == 2


def test_new_tag_makes_objectives_applicable(catalog: Catalog) -> None:
    st = state()
    assert evaluate(catalog, st, [], [], TODAY).statuses["alimentation.bebe"].status == "na"
    with_baby = state(members=[*ADULTS, Member("bebe")])
    assert evaluate(catalog, with_baby, [], [], TODAY).statuses["alimentation.bebe"].status == "todo"
    legacy = state(members=[Member.from_dict({"type": "adulte", "medical": True})])
    assert evaluate(catalog, legacy, [], [], TODAY).statuses["sante.traitements_7j"].status == "todo"


def test_member_conditions_bring_their_objectives(catalog: Catalog) -> None:
    st = state()
    assert evaluate(catalog, st, [], [], TODAY).statuses["sante.lunettes_secours"].status == "na"
    myope = state(members=[Member("adulte", frozenset({"vue"})), Member("adulte")])
    ev = evaluate(catalog, myope, [], [], TODAY)
    assert ev.statuses["sante.lunettes_secours"].status == "todo"
    assert ev.statuses["sante.insuline_froid"].status == "na"
    # L'insuline implique aussi un traitement : les réserves de traitement deviennent requises.
    diabetic = state(members=[Member("adulte", frozenset({"insuline"}))])
    ev = evaluate(catalog, diabetic, [], [], TODAY)
    assert ev.statuses["sante.insuline_froid"].status == "todo"
    assert ev.statuses["sante.traitements_7j"].status == "todo"


def test_unknown_condition_is_ignored(catalog: Catalog) -> None:
    st = state(members=[Member("adulte", frozenset({"inexistante"}))])
    assert evaluate(catalog, st, [], [], TODAY).level == 0


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
    assert auto["eau"].need_per_day == 4 + 2.5 + 1
    assert auto["eau"].days == 8
    assert auto["traitements"].days is None  # personne sous traitement


def test_axis_levels_spot_weak_link(catalog: Catalog) -> None:
    st = state()
    vals = [Validation(o.id, TODAY) for o in catalog.objectives if o.axis == "communaute"]
    ev = evaluate(catalog, st, vals, [], TODAY)
    assert ev.axis_levels["communaute"] == MAX_LEVEL
    assert ev.axis_levels["eau"] == 0
    assert ev.level == 0
