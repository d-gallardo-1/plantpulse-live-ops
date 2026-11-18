"""FastAPI application (orchestrator): wires the engine, routers and background loop.

Run with a single worker so the in-memory state is shared by every client::

    uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 1
"""

from __future__ import annotations

import asyncio
import contextlib
from typing import AsyncIterator

from fastapi import FastAPI

from . import __version__
from .api.alarm_routes import build_alarm_router
from .api.matrix_routes import build_matrix_router
from .api.read_routes import build_read_router
from .api.simulation_routes import build_simulation_router
from .config import API_PREFIX, Settings, load_settings
from .engine import PlantEngine
from .matrix_parser import load_rules_via_excel
from .mock_data import CAUSE_EFFECT_RULES, FACILITY_NAME, NETWORK_NODES, STATIONS


def build_engine(*, auto_cycle: bool = True, seed: int | None = None) -> PlantEngine:
    """Create an engine whose matrix was ingested through the Excel round trip."""
    return PlantEngine(
        facility=FACILITY_NAME,
        stations=STATIONS,
        rules=load_rules_via_excel(CAUSE_EFFECT_RULES, facility=FACILITY_NAME),
        nodes=NETWORK_NODES,
        auto_cycle=auto_cycle,
        seed=seed,
    )


def create_app(
    engine: PlantEngine | None = None,
    *,
    settings: Settings | None = None,
    start_background: bool = True,
) -> FastAPI:
    settings = settings or load_settings()
    engine = engine or build_engine(auto_cycle=settings.auto_cycle)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        task: asyncio.Task[None] | None = None
        if start_background:
            task = asyncio.create_task(
                engine.run(
                    tick_seconds=settings.tick_seconds,
                    auto_event_every_ticks=settings.auto_event_every_ticks,
                )
            )
        try:
            yield
        finally:
            if task is not None:
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task

    app = FastAPI(
        title="PlantPulse Live-Ops API",
        version=__version__,
        description=(
            "Reference demo. All telemetry is simulated and every tag is synthetic; "
            "the service is not connected to plant hardware."
        ),
        lifespan=lifespan,
        # The interactive docs page loads its assets from a public CDN, which
        # would break the offline, on-premises promise. The schema stays available.
        docs_url=None,
        openapi_url=f"{API_PREFIX}/openapi.json",
        redoc_url=None,
    )
    app.state.engine = engine
    app.include_router(build_read_router(engine), prefix=API_PREFIX)
    app.include_router(build_matrix_router(engine), prefix=API_PREFIX)
    app.include_router(build_alarm_router(engine), prefix=API_PREFIX)
    app.include_router(build_simulation_router(engine), prefix=API_PREFIX)
    return app


app = create_app()
