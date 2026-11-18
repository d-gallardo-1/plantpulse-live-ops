"""Operator actions on active alarms."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, HTTPException, Path

from ..engine import AlarmNotActiveError, PlantEngine, UnknownAlarmError
from .schemas import AcknowledgeResponse

AlarmCode = Annotated[str, Path(pattern=r"^[A-Za-z]{3}-\d{3}$", max_length=7)]


def build_alarm_router(engine: PlantEngine) -> APIRouter:
    router = APIRouter(prefix="/alarms", tags=["alarms"])

    @router.post("/{alarm_code}/acknowledge", response_model=AcknowledgeResponse)
    async def acknowledge(alarm_code: AlarmCode) -> AcknowledgeResponse:
        """Mark an active alarm as seen. It stays active until it is cleared."""
        try:
            alarm, already = engine.acknowledge(alarm_code.upper())
        except UnknownAlarmError:
            raise HTTPException(status_code=404, detail="Unknown alarm code") from None
        except AlarmNotActiveError:
            raise HTTPException(status_code=409, detail="Alarm is not active") from None
        if not already:
            engine.publish()
        return AcknowledgeResponse(alarm=alarm, already_acknowledged=already)

    return router
