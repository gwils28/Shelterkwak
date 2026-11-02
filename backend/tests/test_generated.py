"""Les fichiers générés (catalogue du front, cas de parité) doivent être à jour : `make generate`."""

from __future__ import annotations

from shelterkwak.export import render


def test_generated_files_are_up_to_date() -> None:
    stale = [str(p) for p, content in render().items() if not p.exists() or p.read_text(encoding="utf-8") != content]
    assert not stale, f"Fichiers générés obsolètes, lancer `make generate` : {stale}"
