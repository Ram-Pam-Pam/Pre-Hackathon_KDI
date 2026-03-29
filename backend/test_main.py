import io
import pytest
from fastapi.testclient import TestClient
from main import app, redact_pii

client = TestClient(app)

JPG = b"\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xFF\xDB\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \x1c\x1c*7*5;@@@\x1a\x1f\xdb\x00C\x01\t\t\t\x0c\x0b\x0c\x18\r\r\x18\x1d\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\x1a\xff\xc0\x00\x11\x08\x00\x01\x00\x01\x03\x01\x22\x00\x02\x11\x01\x03\x11\x01\xff\xc4\x00\x15\x00\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x08\xff\xc4\x00\x14\x10\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xc4\x00\x15\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xc4\x00\x14\x11\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xff\xda\x00\x0c\x03\x01\x00\x02\x11\x03\x11\x00?\x00\x12\xaf\xff\xd9"
PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\xff\xff?\x00\x05\xfe\x02\xfe\xdc\x44\x74\x8e\x00\x00\x00\x00IHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x00IEND\xaeB`\x82"
PDF = b"%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"
EXE = b"MZ\x90\x00"

@pytest.mark.parametrize("input_text,expected", [
    ("Email: test@test.com", "[REDACTED EMAIL]"),
    ("Tel: 500-600-700", "[REDACTED PHONE]"),
    ("PESEL: 90010112345", "[REDACTED PESEL]"),
    ("Card: 4539 1234 5678 9012", "[REDACTED CC]"),
    ("Multi: a@b.pl i 111222333", "[REDACTED EMAIL] i [REDACTED PHONE]"),
    ("Safe: ID 12345 is OK.", "Safe: ID 12345 is OK."),
])
def test_pii_logic(input_text, expected):
    assert redact_pii(input_text) == expected

valid_files = []
for ext, content in [("txt", b"txt"), ("csv", b"a,b"), ("md", b"# h"), ("pdf", PDF), ("jpg", JPG), ("png", PNG)]:
    for i in range(10):
        valid_files.append((f"test_{i}.{ext}", content, 200))
for i in range(10):
    valid_files.append((f"vector_{i}.svg", b'<svg width="10" height="10"><rect/></svg>', 200))

@pytest.mark.parametrize("filename,content,status", valid_files)
def test_supported_formats(filename, content, status):
    res = client.post("/api/upload", files={"file": (filename, io.BytesIO(content))})
    assert res.status_code == status

spoofs = []
for i in range(15):
    spoofs.append((f"fake_{i}.jpg", b"Plain text spoof", 415))
    spoofs.append((f"virus_{i}.png", EXE, 415))

@pytest.mark.parametrize("filename,content,status", spoofs)
def test_spoofing_detection(filename, content, status):
    res = client.post("/api/upload", files={"file": (filename, io.BytesIO(content))})
    assert res.status_code == status

security_cases = []
for i in range(5):
    security_cases.append((f"h{i}.svg", b'<svg><script>alert(1)</script></svg>', 415))
    security_cases.append((f"o{i}.svg", b'<svg onload="alert(1)"></svg>', 415))

@pytest.mark.parametrize("filename,content,status", security_cases)
def test_security_interception(filename, content, status):
    res = client.post("/api/upload", files={"file": (filename, io.BytesIO(content))})
    assert res.status_code == status

def test_root_status():
    assert client.get("/").status_code == 200

def test_empty_file_upload():
    res = client.post("/api/upload", files={"file": ("empty.txt", io.BytesIO(b""))})
    assert res.status_code in [200, 400, 415]

def test_long_filename():
    name = "a" * 150 + ".txt"
    res = client.post("/api/upload", files={"file": (name, io.BytesIO(b"data"))})
    assert res.status_code == 200

def test_get_files_is_list():
    res = client.get("/api/files")
    assert isinstance(res.json(), list)

def test_delete_lifecycle():
    fname = "lifecycle.txt"
    client.post("/api/upload", files={"file": (fname, io.BytesIO(b"data"))})
    assert client.delete(f"/api/files/{fname}").status_code == 200

def test_batch_zip_creation():
    res = client.post("/api/download-batch", json={"filenames": []})
    assert res.headers["content-type"] == "application/zip"

def test_unsupported_extension_rar():
    res = client.post("/api/upload", files={"file": ("test.rar", io.BytesIO(b"data"))})
    assert res.status_code == 415

def test_unsupported_extension_sh():
    res = client.post("/api/upload", files={"file": ("script.sh", io.BytesIO(b"rm -rf /"))})
    assert res.status_code == 415

def test_no_extension():
    res = client.post("/api/upload", files={"file": ("no_ext", io.BytesIO(b"data"))})
    assert res.status_code == 415