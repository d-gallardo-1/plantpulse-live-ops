"""Synthetic engineering dataset for the PlantPulse reference demo (orchestrator).

Everything assembled here is invented for demonstration purposes: the facility,
the stations, the tag codes, the I/O addresses, the thresholds and the network
addresses. It does not describe any real plant and is not connected to hardware.

Tag conventions used by the synthetic dataset
---------------------------------------------
* PLC addresses: ``R<rack>.S<slot>.<DI|DO|AI><channel>``; safety I/O is prefixed
  with ``F-``.
* Cabinets: ``CP-0x`` (one control panel per station) and ``SCP-01`` (safety panel).
* Junction boxes: ``JB-<nnn>``, in the same numeric area as the device tag.

The data itself lives in ``app/data``: one module per area of the line.
"""

from __future__ import annotations

from .data import rules_casting, rules_curing_handling, rules_preparation
from .data.network_nodes import GATEWAY_NODE_ID, NETWORK_NODES
from .data.stations import FACILITY_NAME, SHIFT_TARGET, STATIONS
from .models import CauseEffectRule

CAUSE_EFFECT_RULES: list[CauseEffectRule] = [
    *rules_preparation.RULES,
    *rules_casting.RULES,
    *rules_curing_handling.RULES,
]

__all__ = [
    "CAUSE_EFFECT_RULES",
    "FACILITY_NAME",
    "GATEWAY_NODE_ID",
    "NETWORK_NODES",
    "SHIFT_TARGET",
    "STATIONS",
]
