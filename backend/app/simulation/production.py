"""Simulated production counters and KPI calculation."""

from __future__ import annotations

import random

from ..models import ActiveAlarm, Kpis, Severity

#: OEE points lost per active alarm, by severity.
OEE_PENALTY = {Severity.WARNING: 3.0, Severity.HIGH: 9.0, Severity.CRITICAL: 22.0}

_BASELINE_OEE = 86.5
_TICKS_PER_SEGMENT = 8
_STARTING_OUTPUT = 41


class ProductionSimulator:
    def __init__(self, rng: random.Random, *, shift_target: int) -> None:
        self._rng = rng
        self._shift_target = shift_target
        self._cycle_output = min(_STARTING_OUTPUT, shift_target)
        self._ticks_since_segment = 0
        self._oee_noise = 0.0

    def tick(self, *, line_stopped: bool) -> None:
        """Advance one step. The segment counter freezes while the line is stopped."""
        self._oee_noise = self._rng.uniform(-0.8, 0.8)
        if line_stopped or self._cycle_output >= self._shift_target:
            return
        self._ticks_since_segment += 1
        if self._ticks_since_segment >= _TICKS_PER_SEGMENT:
            self._ticks_since_segment = 0
            self._cycle_output += 1

    def kpis(self, active: list[ActiveAlarm], gateway_latency_ms: float | None) -> Kpis:
        penalty = sum(OEE_PENALTY[alarm.rule.severity] for alarm in active)
        oee = max(0.0, min(100.0, _BASELINE_OEE + self._oee_noise - penalty))
        return Kpis(
            oee_pct=round(oee, 1),
            cycle_output=self._cycle_output,
            shift_target=self._shift_target,
            active_interlocks=len(active),
            gateway_latency_ms=gateway_latency_ms,
        )
