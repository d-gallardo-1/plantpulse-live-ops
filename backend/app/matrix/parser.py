"""Read a multi-header Cause & Effect workbook back into structured rules."""

from __future__ import annotations

from pathlib import Path
from typing import BinaryIO

from openpyxl import load_workbook
from openpyxl.worksheet.worksheet import Worksheet
from pydantic import ValidationError

from ..models import CauseEffectRule
from .layout import HEADER_ALIASES, REQUIRED_FIELDS, SHEET_NAME, normalise_header

#: How many leading rows are searched for the column header row.
_HEADER_SEARCH_ROWS = 30

#: Largest sheet the parser will walk. A workbook's size on disk says nothing
#: about its dimensions: one stray cell on the last row of a tiny file would
#: otherwise make the parser visit, and allocate, more than a million rows.
MAX_SHEET_ROWS = 5000
MAX_SHEET_COLUMNS = 100


class MatrixParseError(ValueError):
    """Raised when a workbook does not look like a Cause & Effect matrix."""


def _cell_text(value: object) -> str:
    """Cell value as stripped text. ``None`` is blank; a numeric ``0`` is kept as "0"."""
    return "" if value is None else str(value).strip()


def _find_header_row(sheet: Worksheet) -> int:
    for row in sheet.iter_rows(min_row=1, max_row=min(sheet.max_row, _HEADER_SEARCH_ROWS)):
        for cell in row:
            if HEADER_ALIASES.get(normalise_header(cell.value)) == "alarm_code":
                return cell.row
    raise MatrixParseError(
        f"Could not find a header row: no 'Alarm Code' column in the first "
        f"{_HEADER_SEARCH_ROWS} rows."
    )


def _group_headers(sheet: Worksheet, header_row: int) -> dict[int, str]:
    """Forward-fill the merged group header row above the column headers."""
    groups: dict[int, str] = {}
    if header_row < 2:
        return groups
    current = ""
    for column in range(1, sheet.max_column + 1):
        value = sheet.cell(row=header_row - 1, column=column).value
        if value not in (None, ""):
            current = str(value).strip()
        groups[column] = current
    return groups


def _map_columns(sheet: Worksheet, header_row: int) -> dict[int, str]:
    """Match columns to rule fields by header text; unknown columns are ignored."""
    column_fields: dict[int, str] = {}
    for column in range(1, sheet.max_column + 1):
        header = sheet.cell(row=header_row, column=column).value
        field = HEADER_ALIASES.get(normalise_header(header))
        if field and field not in column_fields.values():
            column_fields[column] = field
    missing = REQUIRED_FIELDS - set(column_fields.values())
    if missing:
        raise MatrixParseError(
            "Matrix is missing required columns: " + ", ".join(sorted(missing))
        )
    return column_fields


def parse_excel_matrix(path: str | Path | BinaryIO) -> list[CauseEffectRule]:
    """Parse a multi-header Cause & Effect workbook into structured rules.

    The header row is located by searching for the alarm code column, so title
    blocks of any height above it are tolerated. Column order is free.
    """
    workbook = load_workbook(path, data_only=True)
    sheet = workbook[SHEET_NAME] if SHEET_NAME in workbook.sheetnames else workbook.active

    if sheet.max_row > MAX_SHEET_ROWS or sheet.max_column > MAX_SHEET_COLUMNS:
        raise MatrixParseError(
            f"The sheet spans {sheet.max_row} rows and {sheet.max_column} columns; the "
            f"limit is {MAX_SHEET_ROWS} rows and {MAX_SHEET_COLUMNS} columns. Remove "
            "stray cells or formatting below and to the right of the matrix."
        )

    header_row = _find_header_row(sheet)
    groups = _group_headers(sheet, header_row)
    column_fields = _map_columns(sheet, header_row)
    code_column = next(c for c, f in column_fields.items() if f == "alarm_code")

    rules: list[CauseEffectRule] = []
    seen: set[str] = set()
    for row in range(header_row + 1, sheet.max_row + 1):
        record = {
            field: _cell_text(sheet.cell(row=row, column=column).value)
            for column, field in column_fields.items()
        }
        if not any(record.values()):
            continue  # fully blank row
        if not record["alarm_code"]:
            # Dropping this row silently would lose an alarm without anyone noticing.
            raise MatrixParseError(f"Row {row} has data but no alarm code.")
        record["alarm_code"] = record["alarm_code"].upper()
        record["station_id"] = record["station_id"].upper()
        code = record["alarm_code"]
        if code in seen:
            raise MatrixParseError(f"Duplicate alarm code on row {row}: {code}")
        seen.add(code)
        try:
            rules.append(CauseEffectRule(**record))
        except ValidationError as exc:
            bad_fields = {str(part) for error in exc.errors() for part in error["loc"]}
            location = ", ".join(
                f"{groups.get(column, '')} / {sheet.cell(row=header_row, column=column).value}"
                for column, field in column_fields.items()
                if field in bad_fields
            )
            raise MatrixParseError(f"Invalid value on row {row} ({location})") from exc

    if not rules:
        raise MatrixParseError("Matrix contains a header row but no alarm rows.")
    return rules
