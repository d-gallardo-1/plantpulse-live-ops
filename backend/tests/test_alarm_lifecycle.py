"""Alarm lifecycle: raised -> acknowledged -> cleared, and the history it leaves."""

from __future__ import annotations

from .conftest import API


def _ack(client, code):
    return client.post(f"{API}/alarms/{code}/acknowledge")


def test_new_alarm_is_unacknowledged(client):
    body = client.post(f"{API}/simulate/trigger/ALM-207").json()

    assert body["alarm"]["acknowledged_at"] is None


def test_acknowledge_keeps_alarm_active_and_station_faulted(client):
    client.post(f"{API}/simulate/trigger/ALM-207")

    body = _ack(client, "alm-207").json()

    assert body["already_acknowledged"] is False
    assert body["alarm"]["acknowledged_at"] is not None
    state = client.get(f"{API}/state").json()
    assert [a["rule"]["alarm_code"] for a in state["active_alarms"]] == ["ALM-207"]
    assert state["active_alarms"][0]["acknowledged_at"] == body["alarm"]["acknowledged_at"]
    assert {s["station_id"]: s["status"] for s in state["stations"]}["STN-03"] == "CRITICAL"
    assert state["kpis"]["active_interlocks"] == 1
    assert state["event_log"][0]["kind"] == "ACKNOWLEDGED"


def test_acknowledge_is_idempotent(client):
    client.post(f"{API}/simulate/trigger/ALM-207")
    first = _ack(client, "ALM-207").json()

    second = _ack(client, "ALM-207").json()

    assert second["already_acknowledged"] is True
    assert second["alarm"]["acknowledged_at"] == first["alarm"]["acknowledged_at"]
    kinds = [event["kind"] for event in client.get(f"{API}/state").json()["event_log"]]
    assert kinds.count("ACKNOWLEDGED") == 1


def test_acknowledge_rejects_inactive_unknown_and_malformed_codes(client):
    assert _ack(client, "ALM-207").status_code == 409
    assert _ack(client, "ALM-999").status_code == 404
    assert _ack(client, "nonsense").status_code == 422


def test_history_records_full_lifecycle(client):
    client.post(f"{API}/simulate/trigger/ALM-205")
    acknowledged_at = _ack(client, "ALM-205").json()["alarm"]["acknowledged_at"]
    client.post(f"{API}/simulate/clear/ALM-205")

    state = client.get(f"{API}/state").json()

    assert state["active_alarms"] == []
    (entry,) = state["alarm_history"]
    assert entry["alarm_code"] == "ALM-205"
    assert entry["station_id"] == "STN-03"
    assert entry["severity"] == "HIGH"
    assert entry["acknowledged_at"] == acknowledged_at
    assert entry["raised_at"] <= entry["acknowledged_at"] <= entry["cleared_at"]
    kinds = [event["kind"] for event in reversed(state["event_log"])]
    assert kinds == ["RAISED", "ACKNOWLEDGED", "CLEARED"]


def test_history_shows_alarm_cleared_without_acknowledgement(client):
    client.post(f"{API}/simulate/trigger/ALM-201")
    client.post(f"{API}/simulate/clear/ALM-201")

    (entry,) = client.get(f"{API}/state").json()["alarm_history"]

    assert entry["acknowledged_at"] is None


def test_reset_moves_every_active_alarm_to_history_newest_first(client):
    for code in ("ALM-201", "ALM-203", "ALM-211"):
        client.post(f"{API}/simulate/trigger/{code}")
    _ack(client, "ALM-203")

    body = client.post(f"{API}/simulate/reset").json()

    assert [entry["alarm_code"] for entry in body["alarm_history"]] == [
        "ALM-211",
        "ALM-203",
        "ALM-201",
    ]
    acknowledged = {e["alarm_code"]: e["acknowledged_at"] for e in body["alarm_history"]}
    assert acknowledged["ALM-203"] is not None and acknowledged["ALM-201"] is None


def test_retriggered_alarm_starts_unacknowledged_again(client):
    client.post(f"{API}/simulate/trigger/ALM-207")
    _ack(client, "ALM-207")
    client.post(f"{API}/simulate/clear/ALM-207")

    body = client.post(f"{API}/simulate/trigger/ALM-207").json()

    assert body["already_active"] is False
    assert body["alarm"]["acknowledged_at"] is None


def test_history_is_bounded(engine):
    for _ in range(30):
        engine.trigger("ALM-201")
        engine.clear("ALM-201")

    assert len(engine.snapshot().alarm_history) == 20
