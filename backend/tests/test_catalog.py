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
