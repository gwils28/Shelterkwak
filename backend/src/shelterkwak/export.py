"""Génère les fichiers partagés avec le front :

- `frontend/src/generated/catalog.json` : le catalogue validé, embarqué dans la PWA ;
- `fixtures/engine.json` et `fixtures/interview.json` : cas calculés par le moteur Python de
  référence, que les tests TypeScript rejouent pour garantir la parité.

Usage : `uv run python -m shelterkwak.export` (ou `make generate`).
"""

from __future__ import annotations

import json
from dataclasses import asdict
from datetime import date
from pathlib import Path
from typing import Any

from . import replay
from .catalog import REPO_ROOT, Catalog, load_catalog
from .engine import HouseholdState, Member, evaluation_to_dict
from .interview import apply_answers

CATALOG_JSON = REPO_ROOT / "frontend" / "src" / "generated" / "catalog.json"
FIXTURES_DIR = REPO_ROOT / "fixtures"


def catalog_dict(catalog: Catalog) -> dict[str, Any]:
    return catalog.model_dump(mode="json")


# ---------- Cas de parité du moteur ----------

ADULTES = [{"name": "Alex", "type": "adulte", "medical": False}, {"name": "Sam", "type": "adulte", "medical": False}]


def household(**kw: Any) -> dict[str, Any]:
    base = {
        "name": "Foyer test",
        "context": "appartement",
        "target_context": None,
        "target_date": None,
        "members": ADULTES,
        "tags": [],
        "priority_axes": [],
        "goal_level": 4,
        "goal_horizon_months": 12,
    }
    return {**base, **kw}


def op(n: int, at: str, type_: str, payload: dict[str, Any], device: str = "phone") -> dict[str, Any]:
    return {"id": f"op-{n:03d}", "device": device, "at": at, "type": type_, "payload": payload}


def stock(id_: str, name: str, category: str, quantity: float, per_unit: float, expires: str | None = None) -> dict:
    return {
        "id": id_,
        "name": name,
        "category": category,
        "quantity": quantity,
        "unit_label": "u",
        "amount_per_unit": per_unit,
        "expires_on": expires,
    }


def validation(oid: str, on: str, source: str = "manual") -> dict[str, Any]:
    return {"objective_id": oid, "validated_at": on, "note": "", "source": source}


LEVEL2 = [
    "eau.robinet_arret",
    "eau.pastilles",
    "alimentation.inventaire",
    "energie.lampes",
    "sante.trousse",
    "sante.fiches",
    "abri.coupures",
    "securite.risques",
    "securite.alertes",
    "communication.contacts_papier",
    "mobilite.itineraires",
    "competences.bilan",
    "finances.papiers",
    "communaute.voisins",
]
LEVEL3 = [
    "eau.contenants",
    "alimentation.sans_cuisson",
    "alimentation.ouvre_boite",
    "energie.batterie",
    "sante.psc1",
    "sante.hygiene_3j",
    "abri.chaleur",
    "abri.detecteurs",
    "abri.extincteur",
    "securite.plan_familial",
    "securite.cles",
    "communication.radio",
    "communication.contact_externe",
    "mobilite.sac",
    "competences.feu",
    "finances.especes",
    "finances.assurances",
    "communaute.fragiles",
]


def onboarding(n: int, at: str, hh: dict, validations: list[str], stocks: list[dict], day: str) -> dict:
    return op(
        n,
        at,
        "onboarding",
        {
            "answers": {},
            "household": hh,
            "validations": [validation(v, day, "interview") for v in validations],
            "stock": stocks,
        },
    )


def engine_cases() -> list[dict[str, Any]]:
    d0 = "2026-11-02"
    t0 = "2026-11-02T10:00:00.000Z"
    base_stock = [
        stock("s-eau", "Eau", "eau", 6, 1.5),
        stock("s-vivres", "Conserves", "alimentation", 30, 900, "2027-03-01"),
        stock("s-gaz", "Cartouches", "cuisson", 2, 1.5),
    ]
    onboard = onboarding(1, t0, household(), LEVEL2 + LEVEL3, base_stock, d0)
    cases: list[dict[str, Any]] = [
        {"name": "vide", "today": d0, "ops": []},
        {"name": "onboarding appartement", "today": d0, "ops": [onboard]},
        {
            "name": "le temps passe : péremptions et revalidations",
            "today": "2027-12-15",
            "ops": [
                onboard,
                op(2, "2026-12-01T08:00:00.000Z", "validation.set", validation("sante.trousse", "2026-12-01")),
            ],
        },
        {
            "name": "foyer qui s'agrandit et déménage",
            "today": "2026-11-20",
            "ops": [
                onboard,
                op(
                    2,
                    "2026-11-10T09:00:00.000Z",
                    "household.set",
                    household(members=[*ADULTES, {"name": "Bébé", "type": "bebe", "medical": False}]),
                ),
                op(
                    3,
                    "2026-11-15T09:00:00.000Z",
                    "household.set",
                    household(
                        members=[*ADULTES, {"name": "Bébé", "type": "bebe", "medical": False}],
                        context="periurbain",
                        target_context="rural",
                        priority_axes=["eau", "communaute"],
                        tags=["vehicule", "risque_froid"],
                    ),
                ),
            ],
        },
        {
            "name": "inventaire : ajout, modification, péremption proche, retrait",
            "today": "2026-11-12",
            "ops": [
                onboard,
                op(2, "2026-11-03T08:00:00.000Z", "stock.upsert", stock("s-packs", "Packs", "eau", 4, 9, "2026-11-30")),
                op(
                    3,
                    "2026-11-04T08:00:00.000Z",
                    "stock.upsert",
                    stock("s-packs", "Packs", "eau", 2.5, 9, "2026-11-30"),
                ),
                op(
                    4,
                    "2026-11-05T08:00:00.000Z",
                    "stock.upsert",
                    stock("s-old", "Vieux riz", "alimentation", 1, 3600, "2026-11-08"),
                ),
                op(5, "2026-11-06T08:00:00.000Z", "stock.delete", {"id": "s-gaz"}),
                op(6, "2026-11-07T08:00:00.000Z", "validation.delete", {"objective_id": "securite.alertes"}),
            ],
        },
        {
            "name": "objectifs perso requis et bonus",
            "today": "2026-11-20",
            "ops": [
                onboard,
                op(9, "2026-11-02T11:00:00.000Z", "stock.upsert", stock("s-eau2", "Bidons", "eau", 20, 1.5)),
                op(
                    2,
                    "2026-11-03T08:00:00.000Z",
                    "custom.upsert",
                    {
                        "id": "perso.chien",
                        "axis": "alimentation",
                        "level": 3,
                        "title": "Croquettes du chien pour 2 semaines",
                        "why": "",
                        "kind": "check",
                        "required": True,
                        "revalidate_days": 10,
                    },
                ),
                op(
                    3,
                    "2026-11-04T08:00:00.000Z",
                    "custom.upsert",
                    {
                        "id": "perso.velo",
                        "axis": "mobilite",
                        "level": 4,
                        "title": "Réviser le vélo",
                        "why": "Avant l'hiver",
                        "kind": "skill",
                        "required": False,
                        "revalidate_days": None,
                    },
                ),
                op(4, "2026-11-05T08:00:00.000Z", "validation.set", validation("perso.chien", "2026-11-05")),
                op(5, "2026-11-06T08:00:00.000Z", "custom.delete", {"id": "perso.velo"}),
            ],
        },
        {
            "name": "conflit : même article modifié sur deux appareils au même instant",
            "today": "2026-11-05",
            "ops": [
                onboard,
                op(2, "2026-11-04T08:00:00.000Z", "stock.upsert", stock("s-eau", "Eau (PC)", "eau", 10, 1.5), "pc"),
                op(3, "2026-11-04T08:00:00.000Z", "stock.upsert", stock("s-eau", "Eau (tél)", "eau", 3, 1.5), "phone"),
            ],
        },
        {
            "name": "remise à zéro puis nouveau foyer rural",
            "today": "2026-11-10",
            "ops": [
                onboard,
                op(2, "2026-11-05T08:00:00.000Z", "reset", {}),
                op(
                    3,
                    "2026-11-06T08:00:00.000Z",
                    "household.set",
                    household(
                        context="rural",
                        members=[
                            {"name": "A", "type": "senior", "medical": True},
                            {"name": "B", "type": "enfant", "medical": False},
                            {"name": "Rex", "type": "animal", "medical": False},
                        ],
                    ),
                ),
                op(4, "2026-11-07T08:00:00.000Z", "stock.upsert", stock("s-med", "Traitement", "traitements", 3, 30)),
                op(5, "2026-11-08T08:00:00.000Z", "validation.set", validation("eau.recuperateur", "2026-11-08")),
            ],
        },
    ]
    catalog = load_catalog()
    out = []
    for case in cases:
        ops = [replay.Op.from_dict(o) for o in case["ops"]]
        today = date.fromisoformat(case["today"])
        state = replay.replay(catalog, ops)
        ev = replay.evaluate(catalog, state, today)
        h = replay.history(catalog, ops, today)
        out.append(
            {
                **case,
                "expected": {
                    "evaluation": evaluation_to_dict(ev) if ev else None,
                    "history": {"snapshots": h.snapshots, "journal": h.journal},
                },
            }
        )
    return out


def interview_cases() -> list[dict[str, Any]]:
    catalog = load_catalog()
    cases = [
        {
            "name": "appartement, réponses complètes",
            "context": "appartement",
            "members": ADULTES,
            "answers": {
                "risques": ["inondation", "froid"],
                "vehicule": "oui",
                "eau_litres": 18,
                "vivres_jours": 7,
                "cuisson_jours": 0,
                "equipement": ["lampes", "trousse", "pastilles"],
                "organisation": ["coupures", "alertes"],
                "competences": [],
                "epargne": "3",
                "credit": "non",
                "production": ["puits"],  # masquée en appartement : ignorée
                "objectif_niveau": "5",
                "horizon": "24",
                "axes_prioritaires": ["eau", "inconnu", "sante"],
            },
        },
        {
            "name": "rural avec traitement et bébé",
            "context": "rural",
            "members": [
                {"name": "A", "type": "adulte", "medical": True},
                {"name": "B", "type": "bebe", "medical": False},
            ],
            "answers": {
                "vivres_jours": 2.5,
                "traitements_jours": 45,
                "production": ["puits", "potager"],
                "reseau": ["voisins"],
            },
        },
        {
            "name": "réponses vides",
            "context": "periurbain",
            "members": ADULTES,
            "answers": {"risques": [], "eau_litres": None, "traitements_jours": 10},
        },
    ]
    out = []
    for c in cases:
        state = HouseholdState(context=c["context"], members=[Member(m["type"], m["medical"]) for m in c["members"]])
        r = apply_answers(catalog, state, c["answers"])
        out.append(
            {
                **c,
                "expected": {
                    "tags": sorted(r.tags),
                    "validates": sorted(r.validates),
                    "sets": r.sets,
                    "lists": r.lists,
                    "stock": [asdict(s) for s in r.stock],
                },
            }
        )
    return out


def render() -> dict[Path, str]:
    def dump(data: Any) -> str:
        return json.dumps(data, ensure_ascii=False, indent=1) + "\n"

    return {
        CATALOG_JSON: dump(catalog_dict(load_catalog())),
        FIXTURES_DIR / "engine.json": dump(engine_cases()),
        FIXTURES_DIR / "interview.json": dump(interview_cases()),
    }


def main() -> None:
    for path, content in render().items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"écrit {path.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
