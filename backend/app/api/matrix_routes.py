"""Cause & Effect matrix: search, sample download, validated upload and restore."""

from __future__ import annotations

from typing import Annotated

import anyio
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response

from ..engine import PlantEngine
from ..matrix.upload import (
    MAX_UPLOAD_BYTES,
    UploadRejected,
    clean_filename,
    parse_uploaded_matrix,
)
from ..matrix_parser import rules_to_excel_bytes
from .schemas import MatrixReplacedResponse, MatrixResponse

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


async def _read_limited(request: Request, limit: int) -> bytes:
    """Read the request body, refusing it as soon as it exceeds ``limit`` bytes."""
    declared = request.headers.get("content-length", "")
    if declared.isdigit() and int(declared) > limit:
        raise HTTPException(status_code=413, detail="The file is larger than the 2 MB limit.")
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > limit:
            raise HTTPException(status_code=413, detail="The file is larger than the 2 MB limit.")
        chunks.append(chunk)
    return b"".join(chunks)


def build_matrix_router(engine: PlantEngine) -> APIRouter:
    router = APIRouter(prefix="/matrix", tags=["matrix"])

    def replaced(cleared: list[str]) -> MatrixReplacedResponse:
        snapshot = engine.publish()
        return MatrixReplacedResponse(
            source=snapshot.matrix_source,
            revision=snapshot.matrix_revision,
            rule_count=len(engine.rules),
            alarms_cleared=cleared,
        )

    @router.get("/export-sample")
    async def export_sample() -> Response:
        payload = rules_to_excel_bytes(engine.rules, facility=engine.facility)
        filename = "cause_effect_matrix_sample.xlsx"
        return Response(
            content=payload,
            media_type=XLSX_MEDIA_TYPE,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @router.post("/upload", response_model=MatrixReplacedResponse)
    async def upload(
        request: Request,
        filename: Annotated[str, Query(min_length=1, max_length=255)],
    ) -> MatrixReplacedResponse:
        """Replace the matrix with an uploaded workbook (raw ``.xlsx`` request body)."""
        try:
            label = clean_filename(filename)
            data = await _read_limited(request, MAX_UPLOAD_BYTES)
            # Parsing is CPU work: keep it off the event loop that feeds the stream.
            rules = await anyio.to_thread.run_sync(parse_uploaded_matrix, data, engine.stations)
        except UploadRejected as exc:
            raise HTTPException(status_code=exc.status_code, detail=exc.detail) from None
        return replaced(engine.replace_rules(rules, f"Uploaded workbook: {label}"))

    @router.post("/restore-default", response_model=MatrixReplacedResponse)
    async def restore_default() -> MatrixReplacedResponse:
        return replaced(engine.restore_default_rules())

    @router.get("", response_model=MatrixResponse)
    async def matrix(
        q: Annotated[str, Query(max_length=80)] = "",
        station: Annotated[str | None, Query(pattern=r"^STN-\d{2}$")] = None,
    ) -> MatrixResponse:
        rules = engine.search_rules(q, station)
        return MatrixResponse(query=q, station_id=station, count=len(rules), rules=rules)

    return router
