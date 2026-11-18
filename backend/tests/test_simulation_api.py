"""Fault injection, reset, auto-cycle and network overrides."""

from __future__ import annotations

from app.models import AlarmSource

from .conftest import API


def test_trigger_marks_station_and_exposes_full_trace(client):
    response = client.post(f"{API}/simulate/trigger/ALM-207")

    assert response.status_code == 200
    body = response.json()
    assert body["already_active"] is False
    assert body["alarm"]["source"] == "MANUAL"
    assert body["alarm"]["rule"]["device_tag"] == "ZS-309"

    state = client.get(f"{API}/state").json()
    stations = {s["station_id"]: s for s in state["stations"]}
    assert stations["STN-03"]["status"] == "CRITICAL"
    assert stations["STN-03"]["active_alarm_codes"] == ["ALM-207"]
    assert stations["STN-04"]["status"] == "NOMINAL"
    assert state["kpis"]["active_interlocks"] == 1
    assert state["event_log"][0]["kind"] == "RAISED"


def test_trigger_is_idempotent_and_case_insensitive(client):
    first = client.post(f"{API}/simulate/trigger/alm-205").json()
    second = client.post(f"{API}/simulate/trigger/ALM-205").json()

    assert second["already_active"] is True
    assert second["alarm"]["event_id"] == first["alarm"]["event_id"]
    assert len(client.get(f"{API}/state").json()["active_alarms"]) == 1


def test_station_status_is_worst_active_severity(client):
    client.post(f"{API}/simulate/trigger/ALM-206")  # WARNING at STN-03
    client.post(f"{API}/simulate/trigger/ALM-205")  # HIGH at STN-03

    stations = {s["station_id"]: s for s in client.get(f"{API}/state").json()["stations"]}
    assert stations["STN-03"]["status"] == "HIGH"
    assert stations["STN-03"]["active_alarm_codes"] == ["ALM-205", "ALM-206"]


def test_unknown_or_malformed_alarm_codes_are_rejected(client):
    assert client.post(f"{API}/simulate/trigger/ALM-999").status_code == 404
    assert client.post(f"{API}/simulate/trigger/not-a-code").status_code == 422
    assert client.post(f"{API}/simulate/clear/ALM-999").status_code == 404


def test_clear_single_alarm(client):
    client.post(f"{API}/simulate/trigger/ALM-203")
    client.post(f"{API}/simulate/trigger/ALM-211")

    assert client.post(f"{API}/simulate/clear/ALM-203").json() == {
        "alarm_code": "ALM-203",
        "cleared": True,
    }
    assert client.post(f"{API}/simulate/clear/ALM-203").json()["cleared"] is False
    active = client.get(f"{API}/state").json()["active_alarms"]
    assert [alarm["rule"]["alarm_code"] for alarm in active] == ["ALM-211"]


def test_reset_restores_nominal_state(client):
    client.post(f"{API}/simulate/trigger/ALM-203")
    client.post(f"{API}/simulate/trigger/ALM-211")
    client.post(f"{API}/simulate/network/SW-CORE-01", json={"status": "OFFLINE"})

    body = client.post(f"{API}/simulate/reset").json()

    assert body["active_alarms"] == []
    assert {s["status"] for s in body["stations"]} == {"NOMINAL"}
    assert {n["status"] for n in body["network_nodes"]} == {"ONLINE"}
    assert body["event_log"][0]["kind"] == "RESET"


def test_reset_and_auto_cycle_are_not_captured_as_alarm_codes(client):
    """Regression guard for the static-versus-parameterised route collision."""
    assert client.post(f"{API}/simulate/reset").status_code == 200
    assert client.post(f"{API}/simulate/auto-cycle", json={"enabled": True}).status_code == 200


def test_auto_cycle_toggle(client):
    url = f"{API}/simulate/auto-cycle"

    assert client.post(url, json={"enabled": True}).json()["auto_cycle"] is True
    assert client.post(url, json={"enabled": False}).json()["auto_cycle"] is False
    assert client.post(url, json={}).status_code == 422


def test_network_override(client):
    url = f"{API}/simulate/network"
    body = client.post(f"{url}/GW-EDGE-01", json={"status": "OFFLINE"}).json()
    node = {n["node_id"]: n for n in body["network_nodes"]}["GW-EDGE-01"]

    assert node["status"] == "OFFLINE" and node["latency_ms"] is None and node["forced"] is True
    assert body["kpis"]["gateway_latency_ms"] is None

    restored = client.post(f"{url}/GW-EDGE-01", json={"status": "ONLINE"}).json()
    node = {n["node_id"]: n for n in restored["network_nodes"]}["GW-EDGE-01"]
    assert node["status"] == "ONLINE" and node["forced"] is False

    assert client.post(f"{url}/NOPE-01", json={"status": "OFFLINE"}).status_code == 404
    assert client.post(f"{url}/GW-EDGE-01", json={"status": "BROKEN"}).status_code == 422


def test_auto_step_never_clears_manual_alarms(engine):
    engine.set_auto_cycle(True)
    engine.trigger("ALM-208", AlarmSource.MANUAL)

    for _ in range(200):
        engine.auto_step()
        snapshot = engine.snapshot()
        codes = {alarm.rule.alarm_code for alarm in snapshot.active_alarms}
        auto = [a for a in snapshot.active_alarms if a.source is AlarmSource.AUTO]
        assert "ALM-208" in codes
        assert len(auto) <= 2


def test_manual_trigger_takes_ownership_of_an_auto_alarm(client, engine):
    engine.set_auto_cycle(True)
    engine.trigger("ALM-207", AlarmSource.AUTO)

    body = client.post(f"{API}/simulate/trigger/ALM-207").json()
    assert body["already_active"] is True
    assert body["alarm"]["source"] == "MANUAL"

    for _ in range(100):
        engine.auto_step()
    codes = {alarm.rule.alarm_code for alarm in engine.snapshot().active_alarms}
    assert "ALM-207" in codes


def test_invalid_numeric_settings_fall_back_to_defaults(monkeypatch):
    from app.config import load_settings

    monkeypatch.setenv("PLANTPULSE_AUTO_EVENT_EVERY_TICKS", "inf")
    monkeypatch.setenv("PLANTPULSE_TICK_SECONDS", "nan")
    settings = load_settings()

    assert settings.auto_event_every_ticks == 6
    assert settings.tick_seconds == 2.0


def test_paused_auto_cycle_produces_no_network_blips(engine):
    for _ in range(300):
        engine.tick()
        assert {n.status.value for n in engine.snapshot().network_nodes} == {"ONLINE"}


def test_critical_alarm_stops_production_counter(engine):
    before = engine.snapshot().kpis
    for _ in range(16):
        engine.tick()
    running = engine.snapshot().kpis
    assert running.cycle_output == before.cycle_output + 2

    engine.trigger("ALM-208")
    for _ in range(40):
        engine.tick()

    stopped = engine.snapshot().kpis
    assert stopped.cycle_output == running.cycle_output
    assert stopped.oee_pct < 70
