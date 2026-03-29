from fastapi.testclient import TestClient
from main import app, redact_pii
import io

client = TestClient(app)

def test_pii_redaction_logic():
    """Testuje, czy funkcja poprawnie zamazuje dane wrażliwe zdejmując je z tekstu."""
    dirty_text = """
    Zgłaszający: jan.kowalski@tajny-startup.com.pl
    PESEL: 85022312345
    Telefon: +48 500 600 700
    Karta: 4539 1234 5678 9012
    """
    clean_text = redact_pii(dirty_text)
    
    assert "jan.kowalski@tajny-startup.com.pl" not in clean_text
    assert "[REDACTED EMAIL]" in clean_text
    
    assert "85022312345" not in clean_text
    assert "[REDACTED PESEL]" in clean_text
    
    assert "+48 500 600 700" not in clean_text
    assert "[REDACTED PHONE]" in clean_text
    
    assert "4539 1234 5678 9012" not in clean_text
    assert "[REDACTED CC]" in clean_text

def test_upload_xss_malicious_svg():
    """Testuje zabezpieczenie przed atakiem XSS wewnątrz pliku SVG."""
    malicious_svg = b"""
    <svg width="100" height="100">
        <script>alert("Hacked!");</script>
        <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
    </svg>
    """
    response = client.post(
        "/api/upload",
        files={"file": ("hacked.svg", io.BytesIO(malicious_svg), "image/svg+xml")}
    )
    
    assert response.status_code == 415
    assert "XSS" in response.json()["detail"]

def test_upload_fake_extension():
    """Testuje zabezpieczenie weryfikujące rzeczywisty typ pliku (Magic Bytes)."""
    fake_image_content = b"To jest tylko tekst, ale probuje udawac obrazek JPEG."
    
    response = client.post(
        "/api/upload",
        files={"file": ("oszustwo.jpg", io.BytesIO(fake_image_content), "image/jpeg")}
    )
    
    # Serwer na podstawie nagłówków bazy powinien wykryć, że to tekst
    # i zwrócić błąd, ponieważ tekst nie ma prawa nazywać się .jpg
    assert response.status_code == 415
    assert "Nieprawidlowy typ" in response.json()["detail"] or "Nieobslugiwany format" in response.json()["detail"]

def test_upload_unsupported_binary():
    """Testuje zachowanie bramki przy próbie wgrania złośliwego pliku binarnego (np. exe)."""
    # Symulacja nagłówka pliku wykonywalnego Windows (MZ)
    exe_header = b"MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00"
    
    response = client.post(
        "/api/upload",
        files={"file": ("wirus.exe", io.BytesIO(exe_header), "application/x-msdownload")}
    )
    
    assert response.status_code == 415
    assert "Nieprawidlowy typ pliku" in response.json()["detail"] or "Nieobslugiwany format" in response.json()["detail"]

def test_read_root():
    """Podstawowy test sprawdzający, czy serwer żyje."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}