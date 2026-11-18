"""Validation of an uploaded Cause & Effect workbook before it reaches the parser.

An ``.xlsx`` file is a ZIP archive of XML parts. A small upload can therefore
expand to a very large one, so the archive is inspected before it is opened.
"""

from __future__ import annotations

import io
import zipfile
from typing import Iterable

from ..models import CauseEffectRule, Station
from .parser import MatrixParseError, parse_excel_matrix

MAX_UPLOAD_BYTES = 2 * 1024 * 1024
MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024
MAX_ARCHIVE_MEMBERS = 200
MAX_RULES = 500
_FILENAME_MAX = 120


class UploadRejected(ValueError):
    """The upload was refused. ``status_code`` is the HTTP status to answer with."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def clean_filename(filename: str) -> str:
    """Reduce a client-supplied name to a short display label (it is never used as a path)."""
    name = filename.replace("\\", "/").rsplit("/", 1)[-1].strip()
    name = "".join(ch for ch in name if ch.isprintable())[:_FILENAME_MAX]
    if not name.lower().endswith(".xlsx") or len(name) <= len(".xlsx"):
        raise UploadRejected(415, "Only .xlsx workbooks are accepted.")
    return name


def _check_archive(data: bytes) -> None:
    if len(data) > MAX_UPLOAD_BYTES:
        raise UploadRejected(413, "The file is larger than the 2 MB limit.")
    if not data.startswith(b"PK"):
        raise UploadRejected(415, "The file is not a valid .xlsx workbook.")
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            members = archive.infolist()
    except zipfile.BadZipFile:
        raise UploadRejected(415, "The file is not a valid .xlsx workbook.") from None
    if len(members) > MAX_ARCHIVE_MEMBERS:
        raise UploadRejected(413, "The workbook contains too many internal parts.")
    if sum(member.file_size for member in members) > MAX_UNCOMPRESSED_BYTES:
        raise UploadRejected(413, "The workbook expands to more than the allowed size.")
    if "xl/workbook.xml" not in {member.filename for member in members}:
        raise UploadRejected(415, "The file is not a valid .xlsx workbook.")


def parse_uploaded_matrix(data: bytes, stations: Iterable[Station]) -> list[CauseEffectRule]:
    """Validate and parse an uploaded workbook into rules for the known stations.

    The station name of each rule is taken from the station table, so an edited
    spreadsheet cannot make one station appear under two names.
    """
    _check_archive(data)
    try:
        rules = parse_excel_matrix(io.BytesIO(data))
    except MatrixParseError as exc:
        raise UploadRejected(422, str(exc)) from exc
    except Exception:
        # Anything else means the workbook is damaged in a way the checks missed.
        raise UploadRejected(422, "The workbook could not be read.") from None

    if len(rules) > MAX_RULES:
        raise UploadRejected(422, f"The matrix has more than {MAX_RULES} rules.")
    names = {station.station_id: station.name for station in stations}
    unknown = sorted({rule.station_id for rule in rules} - set(names))
    if unknown:
        raise UploadRejected(
            422,
            "Unknown station ID(s): " + ", ".join(unknown) + ". Known: " + ", ".join(sorted(names)),
        )
    return [rule.model_copy(update={"station_name": names[rule.station_id]}) for rule in rules]
