"""SSE stream: initial snapshot, multi-client broadcast, heartbeat, slow clients."""

from __future__ import annotations

import asyncio

from app.sse import event_stream

from .conftest import API, parse_sse


def test_stream_endpoint_delivers_initial_snapshot(client):
    client.post(f"{API}/simulate/trigger/ALM-211")

    with client.stream("GET", f"{API}/stream", params={"max_events": 1}) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert response.headers["x-accel-buffering"] == "no"
        body = "".join(response.iter_text())

    frames = [frame for frame in body.split("\n\n") if frame.strip()]
    assert frames[0] == "retry: 3000"
    event, data = parse_sse(frames[1])
    assert event == "snapshot"
    assert [alarm["rule"]["alarm_code"] for alarm in data["active_alarms"]] == ["ALM-211"]


def test_stream_broadcasts_updates_to_every_subscriber(engine):
    async def scenario():
        first = event_stream(engine, heartbeat_seconds=0.05)
        second = event_stream(engine, heartbeat_seconds=0.05)
        for stream in (first, second):
            assert await anext(stream) == "retry: 3000\n\n"
            assert parse_sse(await anext(stream))[0] == "snapshot"
        assert engine.subscriber_count == 2

        engine.trigger("ALM-203")
        engine.publish()
        received = [parse_sse(await anext(stream)) for stream in (first, second)]

        heartbeat = await anext(first)
        await first.aclose()
        await second.aclose()
        return received, heartbeat

    received, heartbeat = asyncio.run(scenario())

    for event, data in received:
        assert event == "update"
        assert data["active_alarms"][0]["rule"]["alarm_code"] == "ALM-203"
    assert heartbeat == "event: heartbeat\ndata: {}\n\n"
    assert engine.subscriber_count == 0


def test_stream_closes_after_max_events_and_unsubscribes(engine):
    async def scenario():
        frames = []
        stream = event_stream(engine, max_events=2, heartbeat_seconds=0.05)
        async for frame in stream:
            frames.append(frame)
            if len(frames) == 2:  # retry hint + snapshot delivered
                engine.publish()
        return frames

    frames = asyncio.run(scenario())

    events = [parse_sse(frame)[0] for frame in frames if frame.startswith("id:")]
    assert events == ["snapshot", "update"]
    assert engine.subscriber_count == 0


def test_every_command_reaches_stream_subscribers(client, engine):
    """The UI learns about state changes only through the stream."""
    queue = engine.subscribe()

    def next_snapshot():
        assert not queue.empty(), "the command did not publish a snapshot"
        return queue.get_nowait()

    client.post(f"{API}/simulate/trigger/ALM-207")
    raised = next_snapshot()
    assert [a.rule.alarm_code for a in raised.active_alarms] == ["ALM-207"]

    client.post(f"{API}/alarms/ALM-207/acknowledge")
    acknowledged = next_snapshot()
    assert acknowledged.active_alarms[0].acknowledged_at is not None

    client.post(f"{API}/simulate/clear/ALM-207")
    cleared = next_snapshot()
    assert cleared.active_alarms == []
    assert [entry.alarm_code for entry in cleared.alarm_history] == ["ALM-207"]

    client.post(f"{API}/simulate/network/GW-EDGE-01", json={"status": "OFFLINE"})
    overridden = next_snapshot()
    assert overridden.kpis.gateway_latency_ms is None

    client.post(f"{API}/simulate/reset")
    reset = next_snapshot()
    assert reset.event_log[0].kind.value == "RESET"

    snapshots = [raised, acknowledged, cleared, overridden, reset]
    sequences = [snapshot.sequence for snapshot in snapshots]
    assert sequences == sorted(set(sequences))
    assert queue.empty()  # one snapshot per command, no duplicates


def test_slow_subscriber_keeps_latest_snapshot(engine):
    queue = engine.subscribe()

    for _ in range(50):
        engine.publish()

    assert queue.full()
    last = None
    while not queue.empty():
        last = queue.get_nowait()
    assert last.sequence == 50
