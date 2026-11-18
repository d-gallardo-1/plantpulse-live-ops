"""The dataset copy used by the browser demo (scripts/export_demo_dataset.py)."""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "export_demo_dataset.py"

# The script and the frontend live outside the backend folder. Where only the
# backend is present (inside its container image, for example) this is skipped.
pytestmark = pytest.mark.skipif(
    not SCRIPT.is_file(), reason="scripts/export_demo_dataset.py is not part of this checkout"
)


@pytest.fixture(scope="module")
def exporter():
    spec = importlib.util.spec_from_file_location("export_demo_dataset", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_saved_dataset_matches_the_backend_data(exporter):
    saved = exporter.TARGET.read_text(encoding="utf-8")

    assert saved == exporter.build(), (
        "frontend/src/demo/dataset.json is out of date. "
        "Run: python scripts/export_demo_dataset.py --write"
    )
