"""Rolling event log and identifier generation."""

from __future__ import annotations

import itertools
from collections import deque
from datetime import datetime, timezone

from ..models import AlarmSource, CauseEffectRule, EventKind, PlantEvent

_LOG_SIZE = 25


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class EventLog:
    """Keeps the most recent plant events, newest first."""

    def __init__(self) -> None:
        self._ids = itertools.count(1)
        self._events: deque[PlantEvent] = deque(maxlen=_LOG_SIZE)

    def next_id(self, prefix: str) -> str:
        return f"{prefix}-{next(self._ids):06d}"

    def add(
        self,
        kind: EventKind,
        message: str,
        *,
        rule: CauseEffectRule | None = None,
        source: AlarmSource | None = None,
    ) -> None:
        self._events.appendleft(
            PlantEvent(
                event_id=self.next_id("LOG"),
                timestamp=utc_now(),
                kind=kind,
                message=message,
                alarm_code=rule.alarm_code if rule else None,
                station_id=rule.station_id if rule else None,
                severity=rule.severity if rule else None,
                source=source,
            )
        )

    def entries(self) -> list[PlantEvent]:
        return list(self._events)
