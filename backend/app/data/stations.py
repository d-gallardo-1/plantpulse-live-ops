"""Synthetic facility and station definitions (invented for the demo)."""

from __future__ import annotations

from ..models import CauseEffectRule, Station

FACILITY_NAME = "Norvale Segment Works — Automated Line 04"

#: Segments the simulated shift is expected to produce.
SHIFT_TARGET = 96

STATIONS: list[Station] = [
    Station(
        station_id="STN-01",
        name="Mould Preparation",
        sequence=1,
        description="Mould cleaning and release agent spraying.",
    ),
    Station(
        station_id="STN-02",
        name="Reinforcement Cage Loading",
        sequence=2,
        description="Manipulator cell placing the reinforcement cage into the mould.",
    ),
    Station(
        station_id="STN-03",
        name="Concrete Casting & Vibration",
        sequence=3,
        description="Hopper discharge and mould vibration.",
    ),
    Station(
        station_id="STN-04",
        name="Surface Finishing",
        sequence=4,
        description="Manual finishing platform for the extrados surface.",
    ),
    Station(
        station_id="STN-05",
        name="Curing Tunnel",
        sequence=5,
        description="Steam and humidity controlled curing zones.",
    ),
    Station(
        station_id="STN-06",
        name="Demoulding & Lift-Out",
        sequence=6,
        description="Vacuum lifter removing the cured segment from the mould.",
    ),
    Station(
        station_id="STN-07",
        name="Segment Turning & Stacking",
        sequence=7,
        description="Turning device and stacking crane handover.",
    ),
]

_STATION_NAMES = {station.station_id: station.name for station in STATIONS}


def make_rule(station_id: str, **fields: object) -> CauseEffectRule:
    """Build a rule, filling the station name from the station table."""
    return CauseEffectRule(
        station_id=station_id, station_name=_STATION_NAMES[station_id], **fields
    )
