"""Write a valid Cause & Effect workbook just under the upload limit to stdout.

Used by the CI smoke test to check that the composed stack accepts the largest
upload it promises to accept, with its capped temporary storage. It runs inside
the backend container, which has the application and its spreadsheet library:

    docker compose exec -T backend python - < scripts/make_large_workbook.py > big.xlsx

The workbook is the built-in matrix plus a second sheet of incompressible text.
It is reproducible: the padding comes from a seeded generator and the archive is
written with fixed timestamps, so the same code always produces the same bytes.

The size is checked here, against the limit the backend enforces, so the limit
lives in one place: if it changes, this script fails with a clear message
instead of a CI step failing on a number copied somewhere else.
"""

from __future__ import annotations

import base64
import io
import random
import re
import sys
import zipfile
from datetime import datetime

from openpyxl import load_workbook

from app.matrix.upload import MAX_UPLOAD_BYTES
from app.matrix_parser import rules_to_excel_bytes
from app.mock_data import CAUSE_EFFECT_RULES

SEED = 20260118
#: Rows of pseudo-random text in the padding sheet. Tune this if the limit changes.
PADDING_ROWS = 2100
BYTES_PER_ROW = 900
#: The result must use at least this share of the limit to be a meaningful test.
MIN_SHARE_OF_LIMIT = 0.85

_FIXED_TIME = datetime(2026, 1, 1)
_FIXED_ZIP_TIME = (2026, 1, 1, 0, 0, 0)
FIXED_TIMESTAMP = b"2026-01-01T00:00:00Z"
PROPERTIES_PART = "docProps/core.xml"
#: Timestamps inside the document properties, e.g. <dcterms:modified ...>2026-...Z<
_XML_TIMESTAMP = re.compile(rb">\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z<")


def _with_fixed_timestamps(data: bytes) -> bytes:
    """Rewrite the archive so that nothing in it depends on the clock.

    Two things carry the current time: every archive entry, and the document
    properties, where the spreadsheet library stamps "modified" when it saves.
    """
    output = io.BytesIO()
    with zipfile.ZipFile(io.BytesIO(data)) as source:
        with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED) as target:
            for name in source.namelist():
                content = source.read(name)
                if name == PROPERTIES_PART:
                    content = _XML_TIMESTAMP.sub(b">" + FIXED_TIMESTAMP + b"<", content)
                entry = zipfile.ZipInfo(name, date_time=_FIXED_ZIP_TIME)
                entry.compress_type = zipfile.ZIP_DEFLATED
                target.writestr(entry, content)
    return output.getvalue()


def build() -> bytes:
    """Return the workbook bytes; raise ValueError if they miss the size window."""
    generator = random.Random(SEED)
    workbook = load_workbook(io.BytesIO(rules_to_excel_bytes(CAUSE_EFFECT_RULES)))
    workbook.properties.created = _FIXED_TIME
    workbook.properties.modified = _FIXED_TIME
    padding = workbook.create_sheet("Padding")
    for _ in range(PADDING_ROWS):
        padding.append([base64.b64encode(generator.randbytes(BYTES_PER_ROW)).decode()])
    buffer = io.BytesIO()
    workbook.save(buffer)
    data = _with_fixed_timestamps(buffer.getvalue())

    smallest = int(MAX_UPLOAD_BYTES * MIN_SHARE_OF_LIMIT)
    if not smallest <= len(data) < MAX_UPLOAD_BYTES:
        raise ValueError(
            f"The generated workbook is {len(data)} bytes; it must be between {smallest} "
            f"and {MAX_UPLOAD_BYTES} (the upload limit). Adjust PADDING_ROWS."
        )
    return data


def main() -> int:
    try:
        data = build()
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    print(f"generated workbook: {len(data)} of {MAX_UPLOAD_BYTES} bytes allowed", file=sys.stderr)
    sys.stdout.buffer.write(data)
    return 0


if __name__ == "__main__":
    sys.exit(main())
