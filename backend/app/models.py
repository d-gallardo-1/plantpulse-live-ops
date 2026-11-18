"""Pydantic schemas shared by the API, the SSE stream and the Excel matrix parser."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints

#: Required text: surrounding whitespace is stripped and blank values are rejected,
#: so an empty spreadsheet cell can never become a silently incomplete rule.
Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
AlarmCodeStr = Annotated[str, StringConstraints(pattern=r"^[A-Z]{3}-\d{3}$")]
StationIdStr = Annotated[str, StringConstraints(pattern=r"^STN-\d{2}$")]


class Severity(str, Enum):
    WARNING = "WARNING"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


#: Ordering used to compute the worst active severity of a station.
SEVERITY_RANK: dict[Severity, int] = {
    Severity.WARNING: 1,
    Severity.HIGH: 2,
    Severity.CRITICAL: 3,
}


class StationStatus(str, Enum):
    NOMINAL = "NOMINAL"
    WARNING = "WARNING"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class NodeStatus(str, Enum):
    ONLINE = "ONLINE"
    DEGRADED = "DEGRADED"
    OFFLINE = "OFFLINE"


class AlarmSource(str, Enum):
    MANUAL = "MANUAL"
    AUTO = "AUTO"


class EventKind(str, Enum):
    RAISED = "RAISED"
    ACKNOWLEDGED = "ACKNOWLEDGED"
    CLEARED = "CLEARED"
    RESET = "RESET"
    AUTO_CYCLE = "AUTO_CYCLE"
    NETWORK = "NETWORK"
    MATRIX = "MATRIX"


class Station(BaseModel):
    """Static definition of a manufacturing station on the line."""

    model_config = ConfigDict(frozen=True)

    station_id: str
    name: str
    sequence: int
    description: str


class CauseEffectRule(BaseModel):
    """One row of the Cause & Effect matrix: an alarm and its full hardware trace."""

    model_config = ConfigDict(frozen=True)

    alarm_code: AlarmCodeStr
    station_id: StationIdStr
    station_name: Text
    severity: Severity
    title: Text
    root_cause: Text
    trip_condition: Text
    device_tag: Text
    device_description: Text
    plc_input: Text
    cabinet: Text
    junction_box: Text
    interlock_effect: Text
    affected_output: Text
    affected_output_description: Text
    recommended_action: Text


class NetworkNodeDefinition(BaseModel):
    """Static definition of a monitored network or edge node."""

    model_config = ConfigDict(frozen=True)

    node_id: str
    description: str
    kind: str
    ip_address: str
    baseline_latency_ms: float


class ActiveAlarm(BaseModel):
    """A rule that is currently tripped."""

    event_id: str
    raised_at: datetime
    source: AlarmSource
    rule: CauseEffectRule
    #: Set when an operator acknowledges the alarm; it stays active until cleared.
    acknowledged_at: datetime | None = None


class AlarmHistoryEntry(BaseModel):
    """A cleared alarm with its full lifecycle: raised -> acknowledged -> cleared."""

    event_id: str
    alarm_code: str
    title: str
    station_id: str
    severity: Severity
    source: AlarmSource
    raised_at: datetime
    acknowledged_at: datetime | None
    cleared_at: datetime


class StationState(BaseModel):
    station_id: str
    name: str
    sequence: int
    description: str
    status: StationStatus
    active_alarm_codes: list[str]


class NetworkNodeState(BaseModel):
    node_id: str
    description: str
    kind: str
    ip_address: str
    status: NodeStatus
    latency_ms: float | None
    packet_loss_pct: float
    forced: bool


class Kpis(BaseModel):
    oee_pct: float
    cycle_output: int
    shift_target: int
    active_interlocks: int
    gateway_latency_ms: float | None


class PlantEvent(BaseModel):
    """Entry of the rolling event log shown in the live ticker."""

    event_id: str
    timestamp: datetime
    kind: EventKind
    message: str
    alarm_code: str | None = None
    station_id: str | None = None
    severity: Severity | None = None
    source: AlarmSource | None = None


class PlantSnapshot(BaseModel):
    """Complete plant state. Every SSE event carries one full snapshot."""

    facility: str
    simulated: bool = True
    sequence: int
    timestamp: datetime
    auto_cycle: bool
    stations: list[StationState]
    active_alarms: list[ActiveAlarm]
    network_nodes: list[NetworkNodeState]
    kpis: Kpis
    event_log: list[PlantEvent]
    alarm_history: list[AlarmHistoryEntry]
    #: Incremented each time the Cause & Effect matrix is replaced.
    matrix_revision: int
    matrix_source: str
