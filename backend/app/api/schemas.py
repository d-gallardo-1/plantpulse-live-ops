"""Request and response bodies used only by the HTTP layer."""

from __future__ import annotations

from pydantic import BaseModel, Field

from ..models import ActiveAlarm, CauseEffectRule, NodeStatus


class AutoCycleRequest(BaseModel):
    enabled: bool


class NetworkOverrideRequest(BaseModel):
    status: NodeStatus


class TriggerResponse(BaseModel):
    alarm: ActiveAlarm
    already_active: bool


class ClearResponse(BaseModel):
    alarm_code: str
    cleared: bool


class MatrixResponse(BaseModel):
    query: str = Field(default="")
    station_id: str | None = None
    count: int
    rules: list[CauseEffectRule]


class AcknowledgeResponse(BaseModel):
    alarm: ActiveAlarm
    already_acknowledged: bool


class MatrixReplacedResponse(BaseModel):
    source: str
    revision: int
    rule_count: int
    alarms_cleared: list[str]
