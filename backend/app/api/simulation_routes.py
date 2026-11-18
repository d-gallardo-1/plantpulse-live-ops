"""Simulation controls: fault injection, reset, auto-cycle and network overrides.

Static routes are declared before parameterised ones, so ``reset`` or
``auto-cycle`` can never be captured as a path parameter.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Body, HTTPException, Path

from ..engine import PlantEngine, UnknownAlarmError, UnknownNodeError
from ..models import PlantSnapshot
from .schemas import (
    AutoCycleRequest,
    ClearResponse,
    NetworkOverrideRequest,
    TriggerResponse,
)

AlarmCode = Annotated[str, Path(pattern=r"^[A-Za-z]{3}-\d{3}$", max_length=7)]
NodeId = Annotated[str, Path(pattern=r"^[A-Za-z0-9-]{3,24}$")]


def build_simulation_router(engine: PlantEngine) -> APIRouter:
    router = APIRouter(prefix="/simulate", tags=["simulation"])

    @router.post("/reset", response_model=PlantSnapshot)
    async def reset() -> PlantSnapshot:
        engine.reset()
        return engine.publish()

    @router.post("/auto-cycle", response_model=PlantSnapshot)
    async def auto_cycle(request: Annotated[AutoCycleRequest, Body()]) -> PlantSnapshot:
        engine.set_auto_cycle(request.enabled)
        return engine.publish()

    @router.post("/trigger/{alarm_code}", response_model=TriggerResponse)
    async def trigger(alarm_code: AlarmCode) -> TriggerResponse:
        try:
            alarm, already_active = engine.trigger(alarm_code.upper())
        except UnknownAlarmError:
            raise HTTPException(status_code=404, detail="Unknown alarm code") from None
        # Published even when already active: a manual trigger may have taken
        # ownership of an alarm the background generator raised.
        engine.publish()
        return TriggerResponse(alarm=alarm, already_active=already_active)

    @router.post("/clear/{alarm_code}", response_model=ClearResponse)
    async def clear(alarm_code: AlarmCode) -> ClearResponse:
        code = alarm_code.upper()
        try:
            cleared = engine.clear(code)
        except UnknownAlarmError:
            raise HTTPException(status_code=404, detail="Unknown alarm code") from None
        if cleared:
            engine.publish()
        return ClearResponse(alarm_code=code, cleared=cleared)

    @router.post("/network/{node_id}", response_model=PlantSnapshot)
    async def network(
        node_id: NodeId, request: Annotated[NetworkOverrideRequest, Body()]
    ) -> PlantSnapshot:
        try:
            engine.set_node_status(node_id.upper(), request.status)
        except UnknownNodeError:
            raise HTTPException(status_code=404, detail="Unknown network node") from None
        return engine.publish()

    return router
