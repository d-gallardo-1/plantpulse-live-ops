"""Plant engine (orchestrator): composes the simulation building blocks.

The engine owns all mutable state. It lives in a single process and a single
event loop, which is why the service must run with exactly one Uvicorn worker.

Building blocks, all in ``app/simulation``:

* ``alarms.py``       alarm lifecycle, history and the background event generator
* ``network.py``      network node telemetry
* ``production.py``   production counter and KPIs
* ``events.py``       rolling event log
* ``broadcaster.py``  fan-out to SSE subscribers
* ``views.py``        station status projection and matrix search
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import Iterable

from .mock_data import GATEWAY_NODE_ID, SHIFT_TARGET
from .models import (
    ActiveAlarm,
    AlarmSource,
    CauseEffectRule,
    EventKind,
    NetworkNodeDefinition,
    NodeStatus,
    PlantSnapshot,
    Station,
)
from .simulation.alarms import AlarmBook, AlarmNotActiveError, UnknownAlarmError
from .simulation.broadcaster import Broadcaster
from .simulation.events import EventLog, utc_now
from .simulation.network import NetworkSimulator, UnknownNodeError
from .simulation.production import ProductionSimulator
from .simulation.views import build_station_states, search_rules

__all__ = ["AlarmNotActiveError", "PlantEngine", "UnknownAlarmError", "UnknownNodeError"]

logger = logging.getLogger("plantpulse.engine")

DEFAULT_MATRIX_SOURCE = "Built-in sample matrix"


class PlantEngine:
    def __init__(
        self,
        *,
        facility: str,
        stations: Iterable[Station],
        rules: Iterable[CauseEffectRule],
        nodes: Iterable[NetworkNodeDefinition],
        auto_cycle: bool = True,
        seed: int | None = None,
    ) -> None:
        self.facility = facility
        self.auto_cycle = auto_cycle
        self.stations = sorted(stations, key=lambda station: station.sequence)
        self._default_rules = list(rules)
        self._matrix_revision = 0
        self._matrix_source = DEFAULT_MATRIX_SOURCE
        self._rng = random.Random(seed)
        self._sequence = 0
        self._log = EventLog()
        self._alarms = AlarmBook(self._default_rules, self._log)
        self._network = NetworkSimulator(nodes, self._rng)
        self._production = ProductionSimulator(self._rng, shift_target=SHIFT_TARGET)
        self._broadcaster = Broadcaster()

    # ----------------------------------------------------------------- matrix

    @property
    def rules(self) -> list[CauseEffectRule]:
        return self._alarms.rules

    def search_rules(self, query: str = "", station_id: str | None = None) -> list[CauseEffectRule]:
        return search_rules(self._alarms.rules, query, station_id)

    def replace_rules(self, rules: Iterable[CauseEffectRule], source: str) -> list[str]:
        """Load a new matrix. Returns the codes of the alarms that were cleared."""
        rules = list(rules)
        cleared = self._alarms.replace_rules(rules)
        self._matrix_revision += 1
        self._matrix_source = source
        self._log.add(EventKind.MATRIX, f"Matrix loaded from {source}: {len(rules)} rule(s)")
        return cleared

    def restore_default_rules(self) -> list[str]:
        return self.replace_rules(self._default_rules, DEFAULT_MATRIX_SOURCE)

    # --------------------------------------------------------------- commands

    def trigger(
        self, alarm_code: str, source: AlarmSource = AlarmSource.MANUAL
    ) -> tuple[ActiveAlarm, bool]:
        return self._alarms.trigger(alarm_code, source)

    def acknowledge(self, alarm_code: str) -> tuple[ActiveAlarm, bool]:
        return self._alarms.acknowledge(alarm_code)

    def clear(self, alarm_code: str) -> bool:
        return self._alarms.clear(alarm_code)

    def reset(self) -> None:
        """Clear every fault and network override; all stations return to nominal."""
        cleared = self._alarms.clear_all()
        self._network.reset()
        self._log.add(EventKind.RESET, f"All faults reset ({cleared} alarm(s) cleared)")

    def set_auto_cycle(self, enabled: bool) -> None:
        if enabled == self.auto_cycle:
            return
        self.auto_cycle = enabled
        state = "enabled" if enabled else "paused"
        self._log.add(EventKind.AUTO_CYCLE, f"Auto-cycle simulation {state}")

    def set_node_status(self, node_id: str, status: NodeStatus) -> None:
        self._network.set_status(node_id, status)
        self._log.add(EventKind.NETWORK, f"{node_id} link forced to {status.value}")

    # -------------------------------------------------------------- simulation

    def tick(self) -> None:
        """Advance simulated telemetry by one step."""
        self._network.tick(allow_blips=self.auto_cycle)
        self._production.tick(line_stopped=self._alarms.line_stopped())

    def auto_step(self) -> None:
        self._alarms.auto_step(self._rng)

    async def run(self, *, tick_seconds: float = 2.0, auto_event_every_ticks: int = 6) -> None:
        """Background loop: telemetry every tick, a simulated event every N ticks."""
        ticks = 0
        while True:
            await asyncio.sleep(tick_seconds)
            ticks += 1
            try:
                self.tick()
                if self.auto_cycle and ticks % auto_event_every_ticks == 0:
                    self.auto_step()
                self.publish()
            except Exception:
                # One failed step must not end the loop: clients would keep
                # receiving heartbeats and show frozen data as if it were live.
                logger.exception("Simulation step failed; continuing")

    # --------------------------------------------------------------- snapshot

    def snapshot(self) -> PlantSnapshot:
        active = self._alarms.active()
        return PlantSnapshot(
            facility=self.facility,
            sequence=self._sequence,
            timestamp=utc_now(),
            auto_cycle=self.auto_cycle,
            stations=build_station_states(self.stations, active),
            active_alarms=active,
            network_nodes=self._network.states(),
            kpis=self._production.kpis(active, self._network.latency_of(GATEWAY_NODE_ID)),
            event_log=self._log.entries(),
            alarm_history=self._alarms.history(),
            matrix_revision=self._matrix_revision,
            matrix_source=self._matrix_source,
        )

    # ---------------------------------------------------------------- fan-out

    @property
    def subscriber_count(self) -> int:
        return self._broadcaster.subscriber_count

    def subscribe(self) -> asyncio.Queue[PlantSnapshot]:
        return self._broadcaster.subscribe()

    def unsubscribe(self, queue: asyncio.Queue[PlantSnapshot]) -> None:
        self._broadcaster.unsubscribe(queue)

    def publish(self) -> PlantSnapshot:
        """Broadcast the current state to every connected SSE client."""
        self._sequence += 1
        snapshot = self.snapshot()
        self._broadcaster.publish(snapshot)
        return snapshot
