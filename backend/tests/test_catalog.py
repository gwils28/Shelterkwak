from __future__ import annotations

import pytest

from shelterkwak.catalog import MAX_LEVEL, Catalog, load_catalog


def test_catalog_loads_and_covers_every_level(catalog: Catalog) -> None:
    levels_with_required = {o.level for o in catalog.objectives if o.required}
    assert levels_with_required == set(range(1, MAX_LEVEL + 1))
    assert {o.axis for o in catalog.objectives} == {a.id for a in catalog.axes}


def test_every_context_can_reach_top_level_with_objectives(catalog: Catalog) -> None:
    # Chaque contexte a au moins un objectif requis par palier : la colonne n'est jamais vide.
    for ctx in ("appartement", "periurbain", "rural"):
        for n in range(1, MAX_LEVEL + 1):
            assert any(
                o.level == n and o.required and ctx in o.contexts and not o.requires_tags for o in catalog.objectives
            ), (ctx, n)


def test_invalid_reference_is_rejected(tmp_path, catalog: Catalog) -> None:
    data = catalog.model_dump()
    data["objectives"][0]["axis"] = "inexistant"
    with pytest.raises(ValueError, match="axe inconnu"):
        Catalog.model_validate(data)


def test_loader_reads_directory() -> None:
    assert len(load_catalog().objectives) > 100


def test_items_cover_every_group_and_reserve_category(catalog: Catalog) -> None:
    assert {i.group for i in catalog.items} == {g.id for g in catalog.item_groups}
    reserves = {i.category for i in catalog.items if i.kind == "reserve"}
    assert reserves == {c.id for c in catalog.categories}


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda it: it["objectives"].append("inexistant"), "objectif inconnu"),
        (lambda it: it.update(group="inexistant"), "groupe inconnu"),
        (lambda it: it["tiers"].reverse(), "les cinq niveaux"),
        (lambda it: it["tiers"].pop(), "les cinq niveaux"),
        (lambda it: it["tiers"][2].update(includes=[]), "includes"),
        (lambda it: it["tiers"][4]["objectives"].append("sante.numeros_urgence"), "niveau inférieur"),
        (lambda it: it["tiers"][4]["objectives"].append("sante.psc1"), "compétence"),
        (lambda it: it["tiers"][0]["objectives"].append(it["tiers"][0]["proves"][0]), "à la fois"),
        (lambda it: it["proves"].append("sante.psc1"), "aucune possession ne prouve"),
        (lambda it: it["tiers"][4]["proves"].append("eau.stock_3j"), "objectif de stock"),
        (lambda it: it["proves"].append("inexistant"), "objectif inconnu"),
    ],
)
def test_invalid_item_is_rejected(catalog: Catalog, change, message: str) -> None:
    data = catalog.model_dump()
    change(next(it for it in data["items"] if it["id"] == "trousse_secours"))
    with pytest.raises(ValueError, match=message):
        Catalog.model_validate(data)


def test_talent_trees_are_complete(catalog: Catalog) -> None:
    assert len(catalog.talent_ranks) == 5
    for spec in catalog.specialties:
        talents = [t for t in catalog.talents if t.specialty == spec.id]
        assert {t.row for t in talents} == {1, 2, 3, 4, 5}, spec.id
        assert len([t for t in talents if t.row == 5]) == 1, spec.id  # un seul talent de maître
        assert {t.col for t in talents} == set(range(1, len(spec.branches) + 1)), spec.id  # aucune branche vide


@pytest.mark.parametrize(
    ("talent_id", "change", "message"),
    [
        ("soin.gqs", lambda t: t["objectives"].append("inexistant"), "objectif inconnu"),
        ("soin.gqs", lambda t: t["proves"].append("eau.stock_3j"), "objectif de stock"),
        ("soin.gqs", lambda t: t.update(specialty="inexistante"), "spécialité inconnue"),
        ("soin.gqs", lambda t: t.update(requires=[]), "au moins un prérequis"),
        ("soin.gqs", lambda t: t.update(requires=["soin.psc1"]), "plus bas dans le même arbre"),
        ("soin.gqs", lambda t: t.update(requires=["cuisto.rotation"]), "plus bas dans le même arbre"),
        ("soin.gqs", lambda t: t.update(requires=["inexistant"]), "prérequis inconnu"),
        ("soin.gqs", lambda t: t.update(col=2), "place déjà prise"),
        ("soin.gqs", lambda t: t.update(col=4), "hors des 3 branches"),
    ],
)
def test_invalid_talent_is_rejected(catalog: Catalog, talent_id: str, change, message: str) -> None:
    data = catalog.model_dump()
    change(next(t for t in data["talents"] if t["id"] == talent_id))
    with pytest.raises(ValueError, match=message):
        Catalog.model_validate(data)


def test_purchase_references_target_existing_cards(catalog: Catalog) -> None:
    assert catalog.references, "catalog/references.yaml est chargé"
    items = {it.id for it in catalog.items}
    assert {r.item for r in catalog.references} <= items


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda r: r.update(item="inexistant"), "objet inconnu"),
        (lambda r: r.update(item="reserve_eau"), "réserve"),
        (lambda r: r.update(refs=r["refs"][:1]), "at least 2"),
        (lambda r: r.update(tier="mythique"), "tier"),
    ],
)
def test_invalid_purchase_reference_is_rejected(catalog: Catalog, change, message: str) -> None:
    data = catalog.model_dump()
    change(data["references"][0])
    with pytest.raises(ValueError, match=message):
        Catalog.model_validate(data)


def test_duplicate_purchase_reference_is_rejected(catalog: Catalog) -> None:
    data = catalog.model_dump()
    data["references"].append(data["references"][0])
    with pytest.raises(ValueError, match="en double"):
        Catalog.model_validate(data)


def test_stale_references_are_listed_oldest_first(catalog: Catalog) -> None:
    from datetime import date

    from shelterkwak.references import stale

    newest = max(r.checked for r in catalog.references)
    assert stale(catalog, newest) == []
    later = stale(catalog, date(newest.year + 2, 1, 1))
    assert len(later) == len(catalog.references)
    assert [r.checked for r in later] == sorted(r.checked for r in later)


def _vivres_commun(data: dict) -> dict:
    item = next(i for i in data["items"] if i["id"] == "reserve_vivres")
    return next(t for t in item["tiers"] if t["tier"] == "commun")


def test_pantry_basket_shares_make_a_whole(catalog: Catalog) -> None:
    item = next(i for i in catalog.items if i.id == "reserve_vivres")
    basket = next(t for t in item.tiers if t.tier == "commun").basket
    assert sum(line.share for line in basket) == 100
    assert "lyophilises" in {line.id for line in basket}


@pytest.mark.parametrize(
    ("change", "message"),
    [
        (lambda t: t["basket"][0].update(share=t["basket"][0]["share"] + 1), "100 %"),
        (lambda t: t["basket"].append(dict(t["basket"][0], share=0)), "greater than 0"),
        (lambda t: t["basket"][1].update(id=t["basket"][0]["id"]), "en double"),
    ],
)
def test_invalid_basket_is_rejected(catalog: Catalog, change, message: str) -> None:
    data = catalog.model_dump()
    change(_vivres_commun(data))
    with pytest.raises(ValueError, match=message):
        Catalog.model_validate(data)


def test_basket_is_reserved_to_reserves(catalog: Catalog) -> None:
    data = catalog.model_dump()
    line = _vivres_commun(data)["basket"][0]
    other = next(i for i in data["items"] if i["kind"] != "reserve")
    other["tiers"][0]["basket"] = [dict(line, share=100)]
    with pytest.raises(ValueError, match="réservé aux réserves"):
        Catalog.model_validate(data)
