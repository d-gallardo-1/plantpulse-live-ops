"""Synthetic network and edge nodes monitored by the watchdog view."""

from __future__ import annotations

from ..models import NetworkNodeDefinition

#: Node whose latency is reported as "gateway latency" in the KPI ribbon.
GATEWAY_NODE_ID = "GW-EDGE-01"


def _node(node_id: str, description: str, kind: str, ip: str, latency: float) -> NetworkNodeDefinition:
    return NetworkNodeDefinition(
        node_id=node_id,
        description=description,
        kind=kind,
        ip_address=ip,
        baseline_latency_ms=latency,
    )


NETWORK_NODES: list[NetworkNodeDefinition] = [
    _node("PLC-LINE-01", "Main line PLC controller", "PLC", "10.40.1.10", 1.8),
    _node("PLC-SAFETY-01", "Safety PLC controller", "Safety PLC", "10.40.1.11", 2.1),
    _node("RIO-CAST-03", "Remote I/O station, casting area", "Remote I/O", "10.40.2.31", 3.4),
    _node("DRV-CAROUSEL-01", "Carousel main drive", "Drive", "10.40.2.41", 4.2),
    _node("HMI-CTRL-01", "Control room operator console", "HMI", "10.40.3.15", 5.6),
    _node("SW-CORE-01", "Core industrial Ethernet switch", "Switch", "10.40.0.2", 0.9),
    _node(GATEWAY_NODE_ID, "On-premises edge telemetry gateway", "Gateway", "10.40.0.1", 7.5),
]
