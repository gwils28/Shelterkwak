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
        (lambda it: it["tiers"][4]["objectives"].append("sante.pharmacie_base"), "niveau inférieur"),
        (lambda it: it["tiers"][4]["objectives"].append("sante.psc1"), "compétence"),
    ],
)
def test_invalid_item_is_rejected(catalog: Catalog, change, message: str) -> None:
    data = catalog.model_dump()
    change(next(it for it in data["items"] if it["id"] == "trousse_secours"))
    with pytest.raises(ValueError, match=message):
        Catalog.model_validate(data)
