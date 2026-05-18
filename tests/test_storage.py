"""
Tests for the storage service (upload_image_to_supabase).

These tests do NOT require a database or live Supabase.
They mock `requests.put` to verify the function logic.

Run with:
    pytest tests/test_storage.py -v
"""

import base64
import os
import uuid
from unittest.mock import patch, MagicMock

import pytest

import app.core.config as cfg
from app.core.config import settings

_REAL_SUPABASE_SETTINGS = {
    "SUPABASE_URL": settings.SUPABASE_URL,
    "SUPABASE_SERVICE_KEY": settings.SUPABASE_SERVICE_KEY,
    "SUPABASE_STORAGE_BUCKET": settings.SUPABASE_STORAGE_BUCKET,
}

@pytest.fixture(autouse=True)
def mock_supabase_settings(monkeypatch):
    monkeypatch.setattr(settings, "SUPABASE_URL", "https://test-mock.supabase.co")
    monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", "mock-bucket")
    monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", "mock-service-key")

from app.services.storage_service import (
    _detect_content_type,
    _decode_image,
    upload_image_to_supabase,
)


# ── Helper: minimal 1x1 red PNG ─────────────────────────────────────────

def _create_png() -> bytes:
    import struct, zlib
    raw = b"\x00\xff\x00\x00"
    compressed = zlib.compress(raw)
    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")


# ── _detect_content_type ────────────────────────────────────────────────

class TestDetectContentType:
    def test_png_bytes(self):
        assert _detect_content_type(b"\x89PNG...") == "image/png"

    def test_jpeg_bytes(self):
        assert _detect_content_type(b"\xff\xd8\xff\xe0...") == "image/jpeg"

    def test_gif_bytes(self):
        assert _detect_content_type(b"GIF89a...") == "image/gif"

    def test_webp_bytes(self):
        assert _detect_content_type(b"RIFF\x00\x00\x00\x00WEBP") == "image/webp"

    def test_unknown_bytes_defaults_to_png(self):
        assert _detect_content_type(b"\x00\x01\x02\x03") == "image/png"

    def test_base64_string_defaults_to_png(self):
        assert _detect_content_type("abc123") == "image/png"

    def test_data_uri_extracts_mime(self):
        assert _detect_content_type("data:image/jpeg;base64,/9j/") == "image/jpeg"


# ── _decode_image ──────────────────────────────────────────────────────

class TestDecodeImage:
    def test_bytes_passthrough(self):
        data = b"hello"
        decoded, ct = _decode_image(data)
        assert decoded == data
        assert ct == "image/png"

    def test_base64_decodes(self):
        original = b"hello world"
        encoded = base64.b64encode(original).decode()
        decoded, ct = _decode_image(encoded)
        assert decoded == original

    def test_data_uri_decodes(self):
        original = b"test data"
        b64 = base64.b64encode(original).decode()
        decoded, _ = _decode_image(f"data:image/png;base64,{b64}")
        assert decoded == original

    def test_invalid_base64_raises(self):
        with pytest.raises(Exception):
            _decode_image("not-valid-base64!!")


# ── upload_image_to_supabase (mocked) ──────────────────────────────────

_MOCK_URL_PREFIX = "https://test-mock.supabase.co/storage/v1/object/public/mock-bucket"


class TestUploadImageToSupabase:
    @patch("app.services.storage_service.requests.put")
    def test_upload_bytes_success(self, mock_put):
        """Upload raw bytes returns a valid public URL."""
        mock_put.return_value = MagicMock(status_code=200)
        url = upload_image_to_supabase(_create_png(), "test/my_image")
        assert url.startswith(_MOCK_URL_PREFIX + "/test/")
        assert url.endswith(".png")
        mock_put.assert_called_once()

    @patch("app.services.storage_service.requests.put")
    def test_upload_base64_success(self, mock_put):
        """Upload base64-encoded string returns a public URL."""
        mock_put.return_value = MagicMock(status_code=200)
        b64 = base64.b64encode(_create_png()).decode()
        url = upload_image_to_supabase(b64, "test/my_image")
        assert url.startswith(_MOCK_URL_PREFIX)
        mock_put.assert_called_once()

    @patch("app.services.storage_service.requests.put")
    def test_upload_data_uri_success(self, mock_put):
        """Upload data URI string returns a public URL."""
        mock_put.return_value = MagicMock(status_code=200)
        uri = f"data:image/png;base64,{base64.b64encode(_create_png()).decode()}"
        url = upload_image_to_supabase(uri, "test/my_image")
        assert url.startswith(_MOCK_URL_PREFIX)
        mock_put.assert_called_once()

    @patch("app.services.storage_service.requests.put")
    def test_upload_auto_appends_extension(self, mock_put):
        mock_put.return_value = MagicMock(status_code=200)
        url = upload_image_to_supabase(_create_png(), "no_ext")
        assert url.endswith(".png")

    @patch("app.services.storage_service.requests.put")
    def test_upload_keeps_existing_extension(self, mock_put):
        mock_put.return_value = MagicMock(status_code=200)
        url = upload_image_to_supabase(_create_png(), "image.jpg")
        assert ".jpg" in url
        assert ".png" not in url

    @patch("app.services.storage_service.requests.put")
    def test_upload_adds_unique_id_to_prevent_collision(self, mock_put):
        mock_put.return_value = MagicMock(status_code=200)
        url1 = upload_image_to_supabase(_create_png(), "images/hello.png")
        url2 = upload_image_to_supabase(_create_png(), "images/hello.png")
        assert url1 != url2

    @patch("app.services.storage_service.requests.put")
    def test_upload_failure_falls_back_to_local_storage(self, mock_put):
        mock_put.return_value = MagicMock(status_code=400, text="Bad Request")
        url = upload_image_to_supabase(_create_png(), "fail.png")
        assert url.startswith("file://")
        mock_put.assert_called_once()

    @patch("app.services.storage_service.requests.put")
    def test_upload_preserves_folder_structure(self, mock_put):
        mock_put.return_value = MagicMock(status_code=200)
        url = upload_image_to_supabase(_create_png(), "designs/user_123/variant_1.png")
        assert "designs/user_123/" in url

    def test_real_supabase_upload_if_configured(self, monkeypatch):
        if not _REAL_SUPABASE_SETTINGS["SUPABASE_URL"] or not _REAL_SUPABASE_SETTINGS["SUPABASE_SERVICE_KEY"]:
            pytest.skip("Real Supabase config is not set in .env")

        monkeypatch.setattr(settings, "SUPABASE_URL", _REAL_SUPABASE_SETTINGS["SUPABASE_URL"])
        monkeypatch.setattr(settings, "SUPABASE_SERVICE_KEY", _REAL_SUPABASE_SETTINGS["SUPABASE_SERVICE_KEY"])
        monkeypatch.setattr(settings, "SUPABASE_STORAGE_BUCKET", _REAL_SUPABASE_SETTINGS["SUPABASE_STORAGE_BUCKET"])

        path = f"tests/integration/{uuid.uuid4().hex}"
        url = upload_image_to_supabase(_create_png(), path)

        assert url.startswith(_REAL_SUPABASE_SETTINGS["SUPABASE_URL"])
        assert "storage/v1/object/public" in url
