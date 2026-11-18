"""Read-only projections: station status and matrix search."""

from __future__ import annotations

import re
from typing import Iterable

from ..models import (
    SEVERITY_RANK,
    ActiveAlarm,
    CauseEffectRule,
    Station,
    StationState,
    StationStatus,
)


def build_station_states(
    stations: Iterable[Station], active: list[ActiveAlarm]
) -> list[StationState]:
    """A station reports the worst severity among its active alarms."""
    states = []
    for station in stations:
        alarms = [a for a in active if a.rule.station_id == station.station_id]
        status = StationStatus.NOMINAL
        if alarms:
            worst = max(alarms, key=lambda alarm: SEVERITY_RANK[alarm.rule.severity])
            status = StationStatus(worst.rule.severity.value)
        states.append(
            StationState(
                **station.model_dump(),
                status=status,
                active_alarm_codes=sorted(a.rule.alarm_code for a in alarms),
            )
        )
    return states


def search_key(value: str) -> str:
    """Lower-case and drop punctuation, so ``alm203`` matches ``ALM-203``."""
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def field_candidates(value: str) -> list[str]:
    """Every suffix of a field that starts on a word boundary, punctuation removed.

    ``"SCP-01"`` gives ``["scp01", "01"]``. A token matches a field when one
    candidate starts with it, so ``cp-01`` finds ``CP-01`` but not ``SCP-01``,
    while ``jb-5`` still finds ``JB-512`` and ``di07`` finds ``R2.S2.DI07``.
    """
    words = re.findall(r"[a-z0-9]+", value.lower())
    return ["".join(words[index:]) for index in range(len(words))]


def search_rules(
    rules: Iterable[CauseEffectRule], query: str = "", station_id: str | None = None
) -> list[CauseEffectRule]:
    """Token search across every traceability field; all tokens must match."""
    tokens = [token for token in (search_key(part) for part in query.split()) if token]
    results = []
    for rule in rules:
        if station_id and rule.station_id != station_id:
            continue
        candidates = [
            candidate
            for value in rule.model_dump(mode="json").values()
            for candidate in field_candidates(str(value))
        ]
        if all(any(c.startswith(token) for c in candidates) for token in tokens):
            results.append(rule)
    return results
