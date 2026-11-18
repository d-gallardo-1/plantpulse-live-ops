"""Read endpoints: health, state snapshot and matrix search."""

from __future__ import annotations

import pytest

from .conftest import API


def test_health(client):
    body = client.get(f"{API}/health").json()

    assert body["status"] == "ok" and body["simulated"] is True


def test_initial_state_is_nominal(client):
    body = client.get(f"{API}/state").json()

    assert body["simulated"] is True
    assert body["auto_cycle"] is False
    assert body["active_alarms"] == []
    assert [s["status"] for s in body["stations"]] == ["NOMINAL"] * 7
    assert [s["sequence"] for s in body["stations"]] == [1, 2, 3, 4, 5, 6, 7]
    assert len(body["network_nodes"]) == 7
    assert body["kpis"]["active_interlocks"] == 0


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("ALM-203", ["ALM-203"]),
        ("alm203", ["ALM-203"]),
        ("PT-618", ["ALM-211"]),
        ("R2.S2.DI07", ["ALM-207"]),
        ("SCP-01", ["ALM-203", "ALM-208"]),
        # A cabinet search must not leak into a longer tag that contains it.
        ("CP-01", ["ALM-201", "ALM-202"]),
        ("JB-5", ["ALM-209", "ALM-210"]),
        ("di07", ["ALM-207"]),
        ("JB-512", ["ALM-209"]),
        ("hopper gate", ["ALM-207"]),
        ("no-such-tag", []),
    ],
)
def test_matrix_search(client, query, expected):
    body = client.get(f"{API}/matrix", params={"q": query}).json()

    assert [rule["alarm_code"] for rule in body["rules"]] == expected
    assert body["count"] == len(expected)


def test_matrix_without_query_returns_all_rules(client):
    assert client.get(f"{API}/matrix").json()["count"] == 12


def test_matrix_filters_by_station(client):
    body = client.get(f"{API}/matrix", params={"station": "STN-03"}).json()

    assert [rule["alarm_code"] for rule in body["rules"]] == ["ALM-205", "ALM-206", "ALM-207"]
    assert client.get(f"{API}/matrix", params={"station": "bogus"}).status_code == 422


def test_matrix_rejects_oversized_query(client):
    assert client.get(f"{API}/matrix", params={"q": "x" * 81}).status_code == 422
