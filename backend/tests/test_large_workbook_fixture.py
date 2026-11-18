"""The near-limit workbook that the CI smoke test uploads (scripts/make_large_workbook.py)."""

from __future__ import annotations

import importlib.util
import io
import re
import zipfile
from pathlib import Path

import pytest

from app.matrix.upload import MAX_UPLOAD_BYTES, parse_uploaded_matrix
from app.mock_data import CAUSE_EFFECT_RULES, STATIONS

SCRIPT = Path(__file__).resolve().parents[2] / "scripts" / "make_large_workbook.py"

# The generator lives outside the backend folder. Where only the backend is
# present (inside its container image, for example) these tests are skipped
# with a reason instead of failing on a missing file.
pytestmark = pytest.mark.skipif(
    not SCRIPT.is_file(), reason="scripts/make_large_workbook.py is not part of this checkout"
)


@pytest.fixture(scope="module")
def generator():
    spec = importlib.util.spec_from_file_location("make_large_workbook", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture(scope="module")
def workbook(generator) -> bytes:
    return generator.build()


def test_fixture_is_reproducible_byte_for_byte(generator, workbook):
    assert generator.build() == workbook


def test_fixture_carries_no_clock_time(generator, workbook):
    """Two builds in the same second would match even if the clock leaked in."""
    with zipfile.ZipFile(io.BytesIO(workbook)) as archive:
        entry_times = {entry.date_time for entry in archive.infolist()}
        properties = archive.read(generator.PROPERTIES_PART)

    assert entry_times == {(2026, 1, 1, 0, 0, 0)}
    timestamps = set(re.findall(rb"\d{4}-\d{2}-\d{2}T[0-9:.]+Z", properties))
    assert timestamps == {generator.FIXED_TIMESTAMP}


def test_fixture_is_close_to_the_upload_limit_but_under_it(generator, workbook):
    assert MAX_UPLOAD_BYTES * generator.MIN_SHARE_OF_LIMIT <= len(workbook) < MAX_UPLOAD_BYTES


def test_fixture_is_a_valid_matrix_the_backend_accepts(workbook):
    assert parse_uploaded_matrix(workbook, STATIONS) == CAUSE_EFFECT_RULES


def test_fixture_refuses_to_exceed_the_limit(generator, monkeypatch):
    monkeypatch.setattr(generator, "PADDING_ROWS", generator.PADDING_ROWS * 2)

    with pytest.raises(ValueError, match="too large") as error:
        generator.build()

    assert "Lower PADDING_ROWS" in str(error.value)
    assert "too small" not in str(error.value)


def test_fixture_refuses_to_be_too_small_to_test_anything(generator, monkeypatch):
    monkeypatch.setattr(generator, "PADDING_ROWS", 10)

    with pytest.raises(ValueError, match="too small") as error:
        generator.build()

    assert "Raise PADDING_ROWS" in str(error.value)
    assert "too large" not in str(error.value)
