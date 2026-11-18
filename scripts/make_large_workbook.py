"""Write a valid Cause & Effect workbook just under the 2 MB upload limit to stdout.

Used by the CI smoke test to check that the composed stack accepts the largest
upload it promises to accept, with its capped temporary storage. It runs inside
the backend container, which has the application and its spreadsheet library:

    docker compose exec -T backend python - < scripts/make_large_workbook.py > big.xlsx

The workbook is the built-in matrix plus a second sheet of incompressible text.
"""

from __future__ import annotations

import base64
import io
import os
import sys

from openpyxl import load_workbook

from app.matrix_parser import rules_to_excel_bytes
from app.mock_data import CAUSE_EFFECT_RULES

#: Rows of random text in the padding sheet; about 1.93 MB once saved.
PADDING_ROWS = 2100
BYTES_PER_ROW = 900


def main() -> int:
    workbook = load_workbook(io.BytesIO(rules_to_excel_bytes(CAUSE_EFFECT_RULES)))
    padding = workbook.create_sheet("Padding")
    for _ in range(PADDING_ROWS):
        padding.append([base64.b64encode(os.urandom(BYTES_PER_ROW)).decode()])
    buffer = io.BytesIO()
    workbook.save(buffer)
    sys.stdout.buffer.write(buffer.getvalue())
    return 0


if __name__ == "__main__":
    sys.exit(main())
