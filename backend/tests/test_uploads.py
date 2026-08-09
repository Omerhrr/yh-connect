import io

from tests.conftest import auth_headers


def test_upload_rejects_content_extension_mismatch(client, client_user):
    fake_png = io.BytesIO(b"<html>not really a png</html>")
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("evil.png", fake_png, "image/png")},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400


def test_upload_accepts_real_png(client, client_user):
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("photo.png", io.BytesIO(png_bytes), "image/png")},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["url"].endswith(".png")


def test_upload_rejects_disallowed_extension(client, client_user):
    resp = client.post(
        "/api/v1/uploads",
        files={"file": ("script.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        headers=auth_headers(client_user["access_token"]),
    )
    assert resp.status_code == 400
