"""Cause & Effect matrix ingestion (orchestrator and command line entry point).

Legacy engineering matrices are usually spreadsheets with a title block, a row of
merged group headers and a row of column headers. This package shows how such a
workbook is turned into structured rules:

* ``app/matrix/layout.py``    the shared description of the workbook layout
* ``app/matrix/exporter.py``  :func:`export_rules_to_excel` writes that layout
* ``app/matrix/parser.py``    :func:`parse_excel_matrix` reads it back

The running application loads its matrix through this round trip, so the rules
served by the API are the parsed spreadsheet, not a shortcut around it.

Run ``python -m app.matrix_parser sample.xlsx`` to generate a sample workbook and
print the parsed JSON.
"""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path
from typing import Iterable

from .matrix.exporter import export_rules_to_excel, rules_to_excel_bytes
from .matrix.parser import MatrixParseError, parse_excel_matrix
from .models import CauseEffectRule

__all__ = [
    "MatrixParseError",
    "export_rules_to_excel",
    "load_rules_via_excel",
    "parse_excel_matrix",
    "rules_to_excel_bytes",
    "rules_to_json",
]


def load_rules_via_excel(
    rules: Iterable[CauseEffectRule], *, facility: str = ""
) -> list[CauseEffectRule]:
    """Round-trip rules through the workbook format, as the application does at startup."""
    return parse_excel_matrix(io.BytesIO(rules_to_excel_bytes(rules, facility=facility)))


def rules_to_json(rules: Iterable[CauseEffectRule]) -> str:
    return json.dumps([rule.model_dump(mode="json") for rule in rules], indent=2)


def main(argv: list[str] | None = None) -> int:
    from .mock_data import CAUSE_EFFECT_RULES, FACILITY_NAME

    args = sys.argv[1:] if argv is None else argv
    target = Path(args[0]) if args else Path("sample_cause_effect_matrix.xlsx")
    export_rules_to_excel(CAUSE_EFFECT_RULES, target, facility=FACILITY_NAME)
    parsed = parse_excel_matrix(target)
    print(rules_to_json(parsed))
    print(f"Wrote {target} and parsed {len(parsed)} rules back.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
