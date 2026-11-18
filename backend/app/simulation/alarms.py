"""Alarm lifecycle (raised -> acknowledged -> cleared) and the event generator."""

from __future__ import annotations

import random
from collections import deque
from typing import Iterable

from ..models import (
    ActiveAlarm,
    AlarmHistoryEntry,
    AlarmSource,
    CauseEffectRule,
    EventKind,
    Severity,
)
from .events import EventLog, utc_now

#: Maximum number of alarms the background generator keeps active at once.
MAX_AUTO_ALARMS = 2

_HISTORY_SIZE = 20


class UnknownAlarmError(KeyError):
    pass


class AlarmNotActiveError(KeyError):
    pass


class AlarmBook:
    def __init__(self, rules: Iterable[CauseEffectRule], log: EventLog) -> None:
        self._rules = {rule.alarm_code: rule for rule in rules}
        self._log = log
        self._active: dict[str, ActiveAlarm] = {}
        self._history: deque[AlarmHistoryEntry] = deque(maxlen=_HISTORY_SIZE)

    @property
    def rules(self) -> list[CauseEffectRule]:
        return list(self._rules.values())

    def active(self) -> list[ActiveAlarm]:
        """Active alarms, most recent first."""
        return sorted(self._active.values(), key=lambda alarm: alarm.raised_at, reverse=True)

    def history(self) -> list[AlarmHistoryEntry]:
        """Cleared alarms, most recently cleared first."""
        return list(self._history)

    def line_stopped(self) -> bool:
        return any(a.rule.severity is Severity.CRITICAL for a in self._active.values())

    def trigger(self, alarm_code: str, source: AlarmSource) -> tuple[ActiveAlarm, bool]:
        """Trip an alarm. Returns ``(alarm, already_active)``; tripping twice is a no-op."""
        rule = self._rules.get(alarm_code)
        if rule is None:
            raise UnknownAlarmError(alarm_code)
        existing = self._active.get(alarm_code)
        if existing is not None:
            if source is AlarmSource.MANUAL and existing.source is AlarmSource.AUTO:
                # A manual trigger takes ownership, so the background generator
                # can no longer clear this alarm on its own.
                existing = existing.model_copy(update={"source": AlarmSource.MANUAL})
                self._active[alarm_code] = existing
            return existing, True
        alarm = ActiveAlarm(
            event_id=self._log.next_id("EVT"), raised_at=utc_now(), source=source, rule=rule
        )
        self._active[alarm_code] = alarm
        self._log.add(
            EventKind.RAISED,
            f"{rule.alarm_code} raised at {rule.station_id}: {rule.title}",
            rule=rule,
            source=source,
        )
        return alarm, False

    def acknowledge(self, alarm_code: str) -> tuple[ActiveAlarm, bool]:
        """Mark an active alarm as seen. Returns ``(alarm, already_acknowledged)``.

        Acknowledging does not clear the alarm or lift its interlock.
        """
        if alarm_code not in self._rules:
            raise UnknownAlarmError(alarm_code)
        alarm = self._active.get(alarm_code)
        if alarm is None:
            raise AlarmNotActiveError(alarm_code)
        if alarm.acknowledged_at is not None:
            return alarm, True
        alarm = alarm.model_copy(update={"acknowledged_at": utc_now()})
        self._active[alarm_code] = alarm
        self._log.add(
            EventKind.ACKNOWLEDGED,
            f"{alarm_code} acknowledged at {alarm.rule.station_id}",
            rule=alarm.rule,
            source=alarm.source,
        )
        return alarm, False

    def clear(self, alarm_code: str) -> bool:
        """Clear one alarm into the history. Returns False when it was not active."""
        if alarm_code not in self._rules:
            raise UnknownAlarmError(alarm_code)
        alarm = self._active.pop(alarm_code, None)
        if alarm is None:
            return False
        self._archive(alarm)
        self._log.add(
            EventKind.CLEARED,
            f"{alarm.rule.alarm_code} cleared at {alarm.rule.station_id}",
            rule=alarm.rule,
            source=alarm.source,
        )
        return True

    def clear_all(self) -> int:
        cleared = self.active()
        for alarm in reversed(cleared):  # oldest first, so history keeps its order
            self._archive(alarm)
        self._active.clear()
        return len(cleared)

    def replace_rules(self, rules: Iterable[CauseEffectRule]) -> list[str]:
        """Swap the matrix. Active alarms are cleared, because their trace may have changed.

        Returns the alarm codes that were cleared.
        """
        cleared = sorted(self._active)
        self.clear_all()
        self._rules = {rule.alarm_code: rule for rule in rules}
        return cleared

    def auto_step(self, rng: random.Random) -> None:
        """Raise or clear one simulated alarm. Manually injected alarms are never touched."""
        auto = [a for a in self._active.values() if a.source is AlarmSource.AUTO]
        if auto and (len(auto) >= MAX_AUTO_ALARMS or rng.random() < 0.5):
            oldest = min(auto, key=lambda alarm: alarm.raised_at)
            self.clear(oldest.rule.alarm_code)
            return
        candidates = [code for code in self._rules if code not in self._active]
        if candidates:
            self.trigger(rng.choice(candidates), AlarmSource.AUTO)

    def _archive(self, alarm: ActiveAlarm) -> None:
        self._history.appendleft(
            AlarmHistoryEntry(
                event_id=alarm.event_id,
                alarm_code=alarm.rule.alarm_code,
                title=alarm.rule.title,
                station_id=alarm.rule.station_id,
                severity=alarm.rule.severity,
                source=alarm.source,
                raised_at=alarm.raised_at,
                acknowledged_at=alarm.acknowledged_at,
                cleared_at=utc_now(),
            )
        )
