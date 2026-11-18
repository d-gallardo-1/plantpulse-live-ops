"""Shared fixtures. The background loop is disabled so tests are deterministic."""

from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.engine import PlantEngine
from app.main import build_engine, create_app

API = "/api/v1"


@pytest.fixture()
def engine() -> PlantEngine:
    return build_engine(auto_cycle=False, seed=7)


@pytest.fixture()
def client(engine: PlantEngine):
    with TestClient(create_app(engine, start_background=False)) as test_client:
        yield test_client


def parse_sse(frame: str) -> tuple[str, dict]:
    """Split one SSE frame into ``(event name, decoded data)``."""
    fields = dict(line.split(": ", 1) for line in frame.strip().splitlines())
    return fields["event"], json.loads(fields["data"])
