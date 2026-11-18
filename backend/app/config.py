"""Runtime settings read from environment variables."""

from __future__ import annotations

import math
import os
from dataclasses import dataclass

API_PREFIX = "/api/v1"


@dataclass(frozen=True)
class Settings:
    auto_cycle: bool
    tick_seconds: float
    auto_event_every_ticks: int


def _flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _number(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, default))
    except ValueError:
        return default
    # "inf" and "nan" parse as floats but are not usable settings.
    return value if math.isfinite(value) else default


def load_settings() -> Settings:
    """Read settings; invalid values fall back to the defaults.

    * ``PLANTPULSE_AUTO_CYCLE``              start with the event generator on (true)
    * ``PLANTPULSE_TICK_SECONDS``            telemetry period in seconds (2.0)
    * ``PLANTPULSE_AUTO_EVENT_EVERY_TICKS``  ticks between simulated events (6)
    """
    return Settings(
        auto_cycle=_flag("PLANTPULSE_AUTO_CYCLE", True),
        tick_seconds=max(0.2, _number("PLANTPULSE_TICK_SECONDS", 2.0)),
        auto_event_every_ticks=max(1, int(_number("PLANTPULSE_AUTO_EVENT_EVERY_TICKS", 6))),
    )
