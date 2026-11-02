from __future__ import annotations

from datetime import timedelta

from fastapi.testclient import TestClient

ONBOARDING = {
    "name": "Foyer test",
    "context": "appartement",
    "target_context": "rural",
    "members": [{"name": "Alex", "type": "adulte"}, {"name": "Sam", "type": "adulte", "medical": True}],
    "answers": {
        "risques": ["inondation"],
        "vehicule": "non",
        "eau_litres": 18,
        "vivres_jours": 7,
        "cuisson_jours": 0,
        "traitements_jours": 30,
        "equipement": ["lampes", "trousse", "pastilles"],
        "organisation": ["coupures", "alertes", "contacts", "itineraires", "papiers", "fiches", "inventaire"],
        "reseau": ["voisins"],
        "competences": ["feu"],
        "epargne": "1",
        "objectif_niveau": "4",
        "horizon": "12",
        "axes_prioritaires": ["eau", "pasunaxe"],
    },
}


def test_interview_and_onboarding_flow(client: TestClient) -> None:
    assert client.get("/api/dashboard").status_code == 404
    questions = client.get("/api/interview").json()
    axes_q = next(q for q in questions if q["id"] == "axes_prioritaires")
    assert len(axes_q["options"]) == 11

    r = client.post("/api/onboarding", json=ONBOARDING)
    assert r.status_code == 201, r.text
    dash = r.json()
    assert dash["level"] == 2
    assert dash["household"]["goal_level"] == 4
    assert dash["household"]["priority_axes"] == ["eau"]
    assert "risque_inondation" in dash["household"]["tags"]
    assert "traitement_medical" in dash["household"]["derived_tags"]
    autonomy = {a["category"]: a for a in dash["autonomy"]}
    assert autonomy["eau"]["days"] == 3
    assert round(autonomy["alimentation"]["days"]) == 7
    assert client.post("/api/onboarding", json=ONBOARDING).status_code == 409

    history = client.get("/api/history").json()
    assert [s["level"] for s in history["snapshots"]] == [2]


def test_validate_and_uncheck_moves_level(client: TestClient) -> None:
    client.post("/api/onboarding", json=ONBOARDING)
    assert client.delete("/api/objectives/securite.alertes/validation").status_code == 204
    assert client.get("/api/dashboard").json()["level"] == 1
    assert client.post("/api/objectives/securite.alertes/validation", json={}).status_code == 200
    assert client.get("/api/dashboard").json()["level"] == 2
    levels = [s["level"] for s in client.get("/api/history").json()["snapshots"]]
    assert levels == [2, 1, 2]
    events = [e["type"] for e in client.get("/api/history").json()["events"]]
    assert "level_changed" in events


def test_stock_objective_cannot_be_checked(client: TestClient) -> None:
    client.post("/api/onboarding", json=ONBOARDING)
    assert client.post("/api/objectives/eau.stock_3j/validation", json={}).status_code == 400
    assert client.post("/api/objectives/inconnu/validation", json={}).status_code == 404


def test_stock_crud_and_time_based_regression(client: TestClient, clock) -> None:
    client.post("/api/onboarding", json=ONBOARDING)
    item = client.post(
        "/api/stock",
        json={
            "name": "Packs d'eau",
            "category": "eau",
            "quantity": 4,
            "unit_label": "pack 6 × 1,5 L",
            "amount_per_unit": 9,
            "expires_on": (clock.now.date() + timedelta(days=60)).isoformat(),
        },
    )
    assert item.status_code == 201
    eau = next(a for a in client.get("/api/autonomy").json() if a["category"] == "eau")
    assert eau["days"] == (18 + 36) / 6
    objectives = {o["id"]: o for o in client.get("/api/objectives").json()}
    assert objectives["eau.stock_3j"]["status"] == "done"
    assert objectives["securite.alertes"]["source"] == "interview"

    clock.now += timedelta(days=400)  # la trousse (365 j) expire
    dash = client.get("/api/dashboard").json()
    assert dash["level"] == 1
    assert dash["checklist"][0]["kind"] == "revalidate"
    last = client.get("/api/history").json()["events"][0]
    assert last["type"] == "level_changed" and "temps" in last["message"]

    item_id = item.json()["id"]
    upd = client.put(f"/api/stock/{item_id}", json={**item.json(), "quantity": 1})
    assert upd.status_code == 200 and upd.json()["quantity"] == 1
    assert client.delete(f"/api/stock/{item_id}").status_code == 204
    assert (
        client.post(
            "/api/stock", json={"name": "x", "category": "nope", "quantity": 1, "amount_per_unit": 1}
        ).status_code
        == 422
    )


def test_household_change_logs_context_and_members(client: TestClient) -> None:
    client.post("/api/onboarding", json=ONBOARDING)
    h = client.get("/api/household").json()
    body = {**h, "context": "periurbain", "members": [*h["members"], {"name": "Bébé", "type": "bebe"}]}
    r = client.put("/api/household", json=body)
    assert r.status_code == 200, r.text
    assert len(r.json()["members"]) == 3
    types = [e["type"] for e in client.get("/api/history").json()["events"]]
    assert "context_changed" in types and "household_updated" in types
    objectives = {o["id"]: o for o in client.get("/api/objectives").json()}
    assert objectives["alimentation.bebe"]["status"] == "todo"
    assert objectives["eau.recuperateur"]["status"] == "todo"


def test_household_needs_a_person(client: TestClient) -> None:
    bad = {**ONBOARDING, "members": [{"name": "Rex", "type": "animal"}]}
    assert client.post("/api/onboarding", json=bad).status_code == 422


def test_reset(client: TestClient) -> None:
    client.post("/api/onboarding", json=ONBOARDING)
    assert client.post("/api/reset").status_code == 204
    assert client.get("/api/household").status_code == 404
