"""Repères d'achat à revérifier : `uv run python -m shelterkwak.references` (ou `make stale-refs`).

Liste les entrées de `catalog/references.yaml` vérifiées il y a plus d'un an, les plus anciennes
d'abord. Sert de point de départ à la revue du marché.
"""

from __future__ import annotations

from datetime import date, timedelta

from .catalog import Catalog, ItemReference, load_catalog

STALE_AFTER = timedelta(days=365)


def stale(catalog: Catalog, today: date) -> list[ItemReference]:
    return sorted((r for r in catalog.references if today - r.checked > STALE_AFTER), key=lambda r: r.checked)


def main() -> None:
    catalog = load_catalog()
    today = date.today()
    old = stale(catalog, today)
    print(f"{len(catalog.references)} repères d'achat, {len(old)} à revérifier (plus d'un an).")
    for r in old:
        print(f"- {r.item}/{r.tier} : vérifié le {r.checked.isoformat()}")


if __name__ == "__main__":
    main()
