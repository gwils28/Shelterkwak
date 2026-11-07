from __future__ import annotations

from fastapi.testclient import TestClient

from shelterkwak.export import LEVEL2, household, onboarding, op, stock


def onboard_op() -> dict:
    return onboarding(
        1,
        "2026-11-02T10:00:00.000Z",
        household(),
        LEVEL2,
        [stock("s1", "Eau", "eau", 8, 1), stock("s2", "Vivres", "alimentation", 2, 2200)],
        "2026-11-02",
    )


def test_sync_stores_dedupes_and_returns_others_ops(client: TestClient) -> None:
    r = client.post("/api/sync", json={"device": "phone", "cursor": 0, "ops": [onboard_op()]})
    assert r.status_code == 200, r.text
    assert r.json() == {"accepted": 1, "cursor": 1, "ops": []}

    again = client.post("/api/sync", json={"device": "phone", "cursor": 1, "ops": [onboard_op()]}).json()
    assert again["accepted"] == 0 and again["cursor"] == 1

    pc = client.post("/api/sync", json={"device": "pc", "cursor": 0, "ops": []}).json()
    assert pc["cursor"] == 1 and [o["id"] for o in pc["ops"]] == ["op-001"]

    new = op(2, "2026-11-03T10:00:00.000Z", "validation.delete", {"objective_id": "securite.alertes"}, "pc")
    client.post("/api/sync", json={"device": "pc", "cursor": 1, "ops": [new]})
    back = client.post("/api/sync", json={"device": "phone", "cursor": 1, "ops": []}).json()
    assert back["cursor"] == 2 and back["ops"][0]["id"] == "op-002"
    assert client.get("/api/health").json()["ops"] == 2
    assert len(client.get("/api/ops").json()) == 2


def test_sync_rejects_bad_ops(client: TestClient) -> None:
    bad_type = {**onboard_op(), "type": "drop.table"}
    assert client.post("/api/sync", json={"device": "x", "ops": [bad_type]}).status_code == 422
    bad_time = {**onboard_op(), "at": "02/11/2026"}
    assert client.post("/api/sync", json={"device": "x", "ops": [bad_time]}).status_code == 422


def test_dashboard_and_history_from_journal(client: TestClient) -> None:
    assert client.get("/api/dashboard").status_code == 404
    client.post("/api/sync", json={"device": "phone", "ops": [onboard_op()]})
    dash = client.get("/api/dashboard").json()
    assert dash["level"] == 2
    assert dash["household"]["name"] == "Foyer test"
    hist = client.get("/api/history").json()
    assert hist["snapshots"][0]["level"] == 2
    assert hist["journal"][0]["type"] == "onboarding"
