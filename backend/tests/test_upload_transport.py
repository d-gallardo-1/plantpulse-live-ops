"""Upload size limit when the client does not announce the body size."""

from __future__ import annotations

from app.matrix.upload import MAX_UPLOAD_BYTES

from .conftest import API

UPLOAD = f"{API}/matrix/upload"


def _chunks(total: int, size: int = 256 * 1024):
    """A body sent in pieces: a ZIP-like prefix followed by zero bytes."""
    yield b"PK"
    sent = 2
    while sent < total:
        yield bytes(size)
        sent += size


def test_streamed_body_over_the_limit_is_cut_off_without_a_content_length(client):
    """A chunked upload has no Content-Length, so the limit must hold while reading."""
    response = client.post(
        UPLOAD, params={"filename": "matrix.xlsx"}, content=_chunks(MAX_UPLOAD_BYTES + 1)
    )

    assert "content-length" not in response.request.headers
    assert response.status_code == 413
    assert "2 MB" in response.json()["detail"]
    assert client.get(f"{API}/state").json()["matrix_revision"] == 0


def test_streamed_body_under_the_limit_is_read_and_then_validated(client):
    response = client.post(UPLOAD, params={"filename": "matrix.xlsx"}, content=_chunks(1024, 256))

    assert "content-length" not in response.request.headers
    assert response.status_code == 415  # read in full, then refused as not a workbook
