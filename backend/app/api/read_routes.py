"""Read side: health, state snapshot and the SSE stream."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from .. import __version__
from ..engine import PlantEngine
from ..models import PlantSnapshot
from ..sse import event_stream


def build_read_router(engine: PlantEngine) -> APIRouter:
    router = APIRouter(tags=["read"])

    @router.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "version": __version__,
            "simulated": True,
            "subscribers": engine.subscriber_count,
        }

    @router.get("/state", response_model=PlantSnapshot)
    async def state() -> PlantSnapshot:
        return engine.snapshot()

    @router.get("/stream")
    async def stream(
        max_events: Annotated[
            int | None,
            Query(ge=1, le=1000, description="Close the stream after N events (useful with curl)."),
        ] = None,
    ) -> StreamingResponse:
        return StreamingResponse(
            event_stream(engine, max_events=max_events),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                # Tells Nginx not to buffer this response.
                "X-Accel-Buffering": "no",
            },
        )

    return router
