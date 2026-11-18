"""Validated upload of a custom Cause & Effect workbook."""

from __future__ import annotations

import io
import zipfile

import pytest
from openpyxl import load_workbook

from app.matrix.upload import MAX_UPLOAD_BYTES
from app.matrix_parser import rules_to_excel_bytes
from app.mock_data import CAUSE_EFFECT_RULES

from .conftest import API

UPLOAD = f"{API}/matrix/upload"


def _workbook(edit=None, rules=CAUSE_EFFECT_RULES) -> bytes:
    """Sample workbook bytes, optionally changed by ``edit(sheet)``."""
    workbook = load_workbook(io.BytesIO(rules_to_excel_bytes(rules)))
    if edit:
        edit(workbook.active)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def _upload(client, data: bytes, filename: str = "matrix.xlsx"):
    return client.post(UPLOAD, params={"filename": filename}, content=data)


def test_edited_sample_is_applied_live(client):
    data = _workbook(lambda sheet: sheet.cell(row=4, column=5, value="Release Agent Tank Empty"))

    response = _upload(client, data, "my matrix v2.xlsx")

    assert response.status_code == 200
    body = response.json()
    assert body["rule_count"] == 12 and body["revision"] == 1
    assert body["source"] == "Uploaded workbook: my matrix v2.xlsx"
    rule = client.get(f"{API}/matrix", params={"q": "ALM-201"}).json()["rules"][0]
    assert rule["title"] == "Release Agent Tank Empty"
    state = client.get(f"{API}/state").json()
    assert state["matrix_revision"] == 1
    assert state["event_log"][0]["kind"] == "MATRIX"
    triggered = client.post(f"{API}/simulate/trigger/ALM-201").json()
    assert triggered["alarm"]["rule"]["title"] == "Release Agent Tank Empty"


def test_upload_clears_active_alarms_into_history(client):
    client.post(f"{API}/simulate/trigger/ALM-207")

    body = _upload(client, _workbook(rules=CAUSE_EFFECT_RULES[:3])).json()

    assert body["alarms_cleared"] == ["ALM-207"] and body["rule_count"] == 3
    state = client.get(f"{API}/state").json()
    assert state["active_alarms"] == []
    assert [entry["alarm_code"] for entry in state["alarm_history"]] == ["ALM-207"]
    assert client.post(f"{API}/simulate/trigger/ALM-207").status_code == 404


def test_station_name_comes_from_station_table(client):
    data = _workbook(lambda sheet: sheet.cell(row=4, column=3, value="Renamed By Hand"))

    assert _upload(client, data).status_code == 200
    rule = client.get(f"{API}/matrix", params={"q": "ALM-201"}).json()["rules"][0]
    assert rule["station_name"] == "Mould Preparation"


def test_restore_default_brings_back_the_sample_matrix(client):
    _upload(client, _workbook(rules=CAUSE_EFFECT_RULES[:3]))

    body = client.post(f"{API}/matrix/restore-default").json()

    assert body["rule_count"] == 12 and body["revision"] == 2
    assert body["source"] == "Built-in sample matrix"
    assert client.get(f"{API}/matrix").json()["count"] == 12


@pytest.mark.parametrize("filename", ["matrix.xls", "matrix.xlsx.exe", "matrix", ".xlsx", "a.csv"])
def test_rejects_wrong_extension(client, filename):
    response = _upload(client, _workbook(), filename)

    assert response.status_code == 415
    assert client.get(f"{API}/state").json()["matrix_revision"] == 0


def test_filename_is_only_a_label(client):
    body = _upload(client, _workbook(), "..\\..\\secret/evil.xlsx").json()

    assert body["source"] == "Uploaded workbook: evil.xlsx"


def test_rejects_file_over_the_size_limit(client):
    response = _upload(client, b"PK" + b"\0" * MAX_UPLOAD_BYTES)

    assert response.status_code == 413
    assert "2 MB" in response.json()["detail"]


@pytest.mark.parametrize("data", [b"", b"not a workbook at all", b"PK\x03\x04 truncated"])
def test_rejects_content_that_is_not_a_workbook(client, data):
    assert _upload(client, data).status_code == 415


def test_rejects_zip_that_is_not_a_workbook(client):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("readme.txt", "hello")

    assert _upload(client, buffer.getvalue()).status_code == 415


def test_rejects_archive_that_expands_beyond_the_limit(client):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("xl/workbook.xml", "<workbook/>")
        archive.writestr("xl/worksheets/sheet1.xml", b"0" * (30 * 1024 * 1024))
    data = buffer.getvalue()
    assert len(data) < MAX_UPLOAD_BYTES  # small on the wire, large once opened

    response = _upload(client, data)

    assert response.status_code == 413
    assert "expands" in response.json()["detail"]


@pytest.mark.parametrize(
    ("edit", "message"),
    [
        (lambda s: s.cell(row=4, column=2, value="STN-99"), "Unknown station ID(s): STN-99"),
        (lambda s: s.cell(row=4, column=4, value="URGENT"), "IDENTIFICATION / Severity"),
        (lambda s: s.cell(row=5, column=1, value="ALM-201"), "Duplicate alarm code"),
        (lambda s: s.delete_cols(8), "missing required columns: device_tag"),
    ],
)
def test_invalid_matrix_is_rejected_and_nothing_changes(client, edit, message):
    client.post(f"{API}/simulate/trigger/ALM-207")

    response = _upload(client, _workbook(edit))

    assert response.status_code == 422
    assert message in response.json()["detail"]
    state = client.get(f"{API}/state").json()
    assert state["matrix_revision"] == 0
    assert [a["rule"]["alarm_code"] for a in state["active_alarms"]] == ["ALM-207"]
    assert client.get(f"{API}/matrix").json()["count"] == 12


def test_upload_requires_filename(client):
    assert client.post(UPLOAD, content=_workbook()).status_code == 422
