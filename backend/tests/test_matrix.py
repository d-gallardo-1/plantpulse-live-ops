"""Synthetic dataset consistency and the Excel Cause & Effect round trip."""

from __future__ import annotations

import io

import pytest
from openpyxl import Workbook, load_workbook

from app.matrix_parser import (
    MatrixParseError,
    export_rules_to_excel,
    load_rules_via_excel,
    parse_excel_matrix,
)
from app.mock_data import CAUSE_EFFECT_RULES, NETWORK_NODES, STATIONS

from .conftest import API


def test_dataset_is_internally_consistent():
    station_ids = {station.station_id for station in STATIONS}
    codes = [rule.alarm_code for rule in CAUSE_EFFECT_RULES]

    assert len(STATIONS) == 7
    assert len(codes) == 12 and len(set(codes)) == 12
    assert len(NETWORK_NODES) == 7
    assert {rule.station_id for rule in CAUSE_EFFECT_RULES} == station_ids
    for rule in CAUSE_EFFECT_RULES:
        assert all(str(value).strip() for value in rule.model_dump().values()), rule.alarm_code


def test_hardware_tags_are_unique_per_alarm():
    for field in ("device_tag", "plc_input", "affected_output"):
        values = [getattr(rule, field) for rule in CAUSE_EFFECT_RULES]
        assert len(values) == len(set(values)), field


def test_excel_round_trip_matches_source_rules(tmp_path):
    path = tmp_path / "matrix.xlsx"
    export_rules_to_excel(CAUSE_EFFECT_RULES, path, facility="Test Facility")

    assert parse_excel_matrix(path) == CAUSE_EFFECT_RULES
    assert load_rules_via_excel(CAUSE_EFFECT_RULES) == CAUSE_EFFECT_RULES


def test_generated_workbook_has_legacy_multi_header_layout(tmp_path):
    path = tmp_path / "matrix.xlsx"
    export_rules_to_excel(CAUSE_EFFECT_RULES, path)
    sheet = load_workbook(path).active

    assert "CAUSE & EFFECT MATRIX" in sheet.cell(row=1, column=1).value
    assert sheet.cell(row=2, column=1).value == "IDENTIFICATION"
    assert sheet.cell(row=3, column=1).value == "Alarm Code"
    assert sheet.cell(row=4, column=1).value == "ALM-201"
    assert any(str(merged).startswith("A2:") for merged in sheet.merged_cells.ranges)


def test_parser_tolerates_extra_title_rows_and_unknown_columns(tmp_path):
    source = tmp_path / "matrix.xlsx"
    export_rules_to_excel(CAUSE_EFFECT_RULES, source)
    workbook = load_workbook(source)
    sheet = workbook.active
    sheet.insert_rows(1, amount=3)  # taller title block
    sheet.insert_cols(1)  # leading revision column the parser does not know
    sheet.cell(row=6, column=1, value="Rev")
    target = tmp_path / "shifted.xlsx"
    workbook.save(target)

    assert parse_excel_matrix(target) == CAUSE_EFFECT_RULES


def test_parser_rejects_workbook_without_matrix_headers(tmp_path):
    path = tmp_path / "other.xlsx"
    workbook = Workbook()
    workbook.active.append(["Name", "Quantity"])
    workbook.save(path)

    with pytest.raises(MatrixParseError, match="header row"):
        parse_excel_matrix(path)


def test_parser_reports_missing_columns(tmp_path):
    path = tmp_path / "partial.xlsx"
    workbook = Workbook()
    workbook.active.append(["Alarm Code", "Severity"])
    workbook.active.append(["ALM-900", "HIGH"])
    workbook.save(path)

    with pytest.raises(MatrixParseError, match="missing required columns"):
        parse_excel_matrix(path)


def test_parser_rejects_duplicate_codes_and_invalid_severity(tmp_path):
    duplicated = tmp_path / "duplicated.xlsx"
    export_rules_to_excel([CAUSE_EFFECT_RULES[0], CAUSE_EFFECT_RULES[0]], duplicated)
    with pytest.raises(MatrixParseError, match="Duplicate alarm code"):
        parse_excel_matrix(duplicated)

    invalid = tmp_path / "invalid.xlsx"
    export_rules_to_excel(CAUSE_EFFECT_RULES[:1], invalid)
    workbook = load_workbook(invalid)
    workbook.active.cell(row=4, column=4, value="URGENT")
    workbook.save(invalid)
    with pytest.raises(MatrixParseError, match="IDENTIFICATION / Severity"):
        parse_excel_matrix(invalid)


def _edited_copy(tmp_path, edit):
    """Export the first two rules, apply ``edit(sheet)`` and return the new path."""
    path = tmp_path / "edited.xlsx"
    export_rules_to_excel(CAUSE_EFFECT_RULES[:2], path)
    workbook = load_workbook(path)
    edit(workbook.active)
    workbook.save(path)
    return path


def _blank(sheet, *, row, column):
    # openpyxl ignores value=None in sheet.cell(), so the cell is cleared explicitly.
    sheet.cell(row=row, column=column).value = None


def test_parser_rejects_blank_required_cells(tmp_path):
    path = _edited_copy(tmp_path, lambda sheet: _blank(sheet, row=4, column=8))

    with pytest.raises(MatrixParseError, match="FIELD HARDWARE / Device Tag"):
        parse_excel_matrix(path)


def test_parser_rejects_data_rows_without_alarm_code(tmp_path):
    path = _edited_copy(tmp_path, lambda sheet: _blank(sheet, row=5, column=1))

    with pytest.raises(MatrixParseError, match="Row 5 has data but no alarm code"):
        parse_excel_matrix(path)


def test_parser_normalises_code_case_and_rejects_unknown_station_format(tmp_path):
    lowered = _edited_copy(tmp_path, lambda sheet: sheet.cell(row=4, column=1, value="alm-201"))
    assert parse_excel_matrix(lowered)[0].alarm_code == "ALM-201"

    bad_station = _edited_copy(tmp_path, lambda sheet: sheet.cell(row=4, column=2, value="Mould Prep"))
    with pytest.raises(MatrixParseError, match="IDENTIFICATION / Station ID"):
        parse_excel_matrix(bad_station)


def test_parser_skips_blank_rows_between_alarms(tmp_path):
    path = _edited_copy(tmp_path, lambda sheet: sheet.insert_rows(5, amount=2))

    assert parse_excel_matrix(path) == CAUSE_EFFECT_RULES[:2]


def test_export_sample_endpoint_returns_parseable_workbook(client):
    response = client.get(f"{API}/matrix/export-sample")

    assert response.status_code == 200
    assert "spreadsheetml" in response.headers["content-type"]
    assert "attachment" in response.headers["content-disposition"]
    assert parse_excel_matrix(io.BytesIO(response.content)) == CAUSE_EFFECT_RULES
