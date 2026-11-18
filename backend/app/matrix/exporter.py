"""Write rules as a legacy-style multi-header Cause & Effect workbook."""

from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO, Iterable

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from ..models import CauseEffectRule
from .layout import (
    FIRST_DATA_ROW,
    GROUP_ROW,
    HEADER_ROW,
    MATRIX_LAYOUT,
    SHEET_NAME,
    TITLE_ROW,
    WIDE_FIELDS,
)

_THIN = Side(style="thin", color="6B7280")
_BORDER = Border(left=_THIN, right=_THIN, top=_THIN, bottom=_THIN)


def _write_title(sheet: Worksheet, facility: str, total_columns: int) -> None:
    title = "CAUSE & EFFECT MATRIX"
    if facility:
        title = f"{title} — {facility}"
    sheet.merge_cells(
        start_row=TITLE_ROW, start_column=1, end_row=TITLE_ROW, end_column=total_columns
    )
    cell = sheet.cell(row=TITLE_ROW, column=1, value=f"{title} (synthetic sample data)")
    cell.font = Font(bold=True, size=14)
    cell.alignment = Alignment(horizontal="left", vertical="center")
    sheet.row_dimensions[TITLE_ROW].height = 26


def _write_headers(sheet: Worksheet) -> list[str]:
    """Write the merged group row and the column header row; return field order."""
    fields: list[str] = []
    column = 1
    for group, columns in MATRIX_LAYOUT:
        last = column + len(columns) - 1
        if last > column:
            sheet.merge_cells(
                start_row=GROUP_ROW, start_column=column, end_row=GROUP_ROW, end_column=last
            )
        group_cell = sheet.cell(row=GROUP_ROW, column=column, value=group)
        group_cell.font = Font(bold=True, color="FFFFFF")
        group_cell.fill = PatternFill("solid", fgColor="1F2937")
        group_cell.alignment = Alignment(horizontal="center")
        for offset, (header, field) in enumerate(columns):
            cell = sheet.cell(row=HEADER_ROW, column=column + offset, value=header)
            cell.font = Font(bold=True)
            cell.fill = PatternFill("solid", fgColor="D1D5DB")
            cell.alignment = Alignment(horizontal="center", wrap_text=True)
            cell.border = _BORDER
            letter = get_column_letter(column + offset)
            sheet.column_dimensions[letter].width = 46 if field in WIDE_FIELDS else 18
            fields.append(field)
        column = last + 1
    return fields


def export_rules_to_excel(
    rules: Iterable[CauseEffectRule],
    path: str | Path | BinaryIO,
    *,
    facility: str = "",
) -> None:
    """Write ``rules`` to ``path`` (a file path or a binary file object).

    Layout: row 1 title block (merged), row 2 group headers (merged per group),
    row 3 column headers, row 4 onwards one alarm per row.
    """
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_NAME

    total_columns = sum(len(columns) for _, columns in MATRIX_LAYOUT)
    _write_title(sheet, facility, total_columns)
    fields = _write_headers(sheet)

    for row_index, rule in enumerate(rules, start=FIRST_DATA_ROW):
        data = rule.model_dump(mode="json")
        for column_index, field in enumerate(fields, start=1):
            cell = sheet.cell(row=row_index, column=column_index, value=data[field])
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = _BORDER

    sheet.freeze_panes = f"B{FIRST_DATA_ROW}"
    workbook.save(path)


def rules_to_excel_bytes(rules: Iterable[CauseEffectRule], *, facility: str = "") -> bytes:
    """Return the generated workbook as bytes (used by the download endpoint)."""
    buffer = io.BytesIO()
    export_rules_to_excel(rules, buffer, facility=facility)
    return buffer.getvalue()
