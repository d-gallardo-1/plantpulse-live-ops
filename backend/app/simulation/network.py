"""Simulated ping and packet-loss telemetry for network and edge nodes."""

from __future__ import annotations

import random
from typing import Iterable

from ..models import NetworkNodeDefinition, NetworkNodeState, NodeStatus

#: Chance per tick that a healthy node shows a short degradation (auto-cycle only).
_BLIP_PROBABILITY = 0.02


class UnknownNodeError(KeyError):
    pass


class NetworkSimulator:
    def __init__(self, nodes: Iterable[NetworkNodeDefinition], rng: random.Random) -> None:
        self._nodes = list(nodes)
        self._rng = rng
        self._forced: dict[str, NodeStatus] = {}
        self._blip_ticks: dict[str, int] = {}
        self._live: dict[str, tuple[float | None, float]] = {}
        self.refresh()

    def set_status(self, node_id: str, status: NodeStatus) -> None:
        """Force a node into a status until it is set back to ONLINE or reset."""
        if node_id not in {node.node_id for node in self._nodes}:
            raise UnknownNodeError(node_id)
        if status is NodeStatus.ONLINE:
            self._forced.pop(node_id, None)
        else:
            self._forced[node_id] = status
        self._blip_ticks.pop(node_id, None)
        self.refresh()

    def reset(self) -> None:
        self._forced.clear()
        self._blip_ticks.clear()
        self.refresh()

    def tick(self, *, allow_blips: bool) -> None:
        if allow_blips:
            for node in self._nodes:
                healthy = node.node_id not in self._forced and node.node_id not in self._blip_ticks
                if healthy and self._rng.random() < _BLIP_PROBABILITY:
                    self._blip_ticks[node.node_id] = self._rng.randint(2, 4)
        self.refresh()
        for node_id in list(self._blip_ticks):
            self._blip_ticks[node_id] -= 1
            if self._blip_ticks[node_id] <= 0:
                del self._blip_ticks[node_id]

    def refresh(self) -> None:
        """Draw new latency and packet-loss readings for every node."""
        for node in self._nodes:
            status = self.status_of(node.node_id)
            if status is NodeStatus.OFFLINE:
                self._live[node.node_id] = (None, 100.0)
            elif status is NodeStatus.DEGRADED:
                latency = node.baseline_latency_ms * self._rng.uniform(6.0, 14.0)
                loss = self._rng.uniform(3.0, 12.0)
                self._live[node.node_id] = (round(latency, 1), round(loss, 1))
            else:
                latency = node.baseline_latency_ms * self._rng.uniform(0.85, 1.25)
                loss = 0.0 if self._rng.random() < 0.9 else self._rng.uniform(0.1, 0.4)
                self._live[node.node_id] = (round(latency, 1), round(loss, 1))

    def status_of(self, node_id: str) -> NodeStatus:
        if node_id in self._forced:
            return self._forced[node_id]
        if node_id in self._blip_ticks:
            return NodeStatus.DEGRADED
        return NodeStatus.ONLINE

    def latency_of(self, node_id: str) -> float | None:
        return self._live[node_id][0]

    def states(self) -> list[NetworkNodeState]:
        return [
            NetworkNodeState(
                node_id=node.node_id,
                description=node.description,
                kind=node.kind,
                ip_address=node.ip_address,
                status=self.status_of(node.node_id),
                latency_ms=self._live[node.node_id][0],
                packet_loss_pct=self._live[node.node_id][1],
                forced=node.node_id in self._forced,
            )
            for node in self._nodes
        ]
