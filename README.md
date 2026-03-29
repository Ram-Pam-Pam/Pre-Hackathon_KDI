# The Data Refinery - Secure Unstructured Data Gateway

*[Polish version below / Polska wersja ponizej]*

## Overview
The Data Refinery is a high-performance, secure gateway designed to intercept, analyze, and sanitize unstructured data (documents, images, text) before it enters an organization's internal network or database. 

Built with security-first architecture, it provides Deep File Inspection, prevents malicious payload execution, and empowers human operators with advanced visual redaction tools.

## Key Features

### Zero-Trust Security & Validation
* **Deep File Inspection (Magic Bytes):** We do not trust file extensions. The backend strictly analyzes binary signatures to detect spoofed files (e.g., a .txt file disguised as a .jpg).
* **XSS & Payload Prevention:** Blocks malicious scripts embedded in scalable vectors (SVG) and other formats.
* **Whitelist Execution:** Strictly limits allowed formats to prevent executable (.exe, .sh) infiltration.

### Operator Vault & Visual Redaction
* **Canvas-based Redaction:** Operators can visually mask sensitive PII on images using a dynamic brush/rectangle tool directly in the browser.
* **Text Sanitization:** Built-in text editor to review and redact sensitive strings before approval.
* **Batch Operations:** "Approve All" and bulk "Download ZIP" for rapid workflow execution.
* **JSON Schema Export:** Exports a structured payload vault containing metadata, operator notes, and relationship links (batch mapping) ready for secure database ingestion.

### Easter Egg: Kaiju Mode
Because even enterprise security tools can have a soul. Toggle "INIT KAIJU MODE" for a custom, Godzilla-themed UI with dynamic CSS animations.

---

## Tech Stack
* **Frontend:** React + Vite, Axios (Custom responsive UI, HTML5 Canvas)
* **Backend:** Python + FastAPI, Uvicorn (Async high-performance API)
* **Validation:** filetype (Magic bytes checking), standard Python validation libraries.
* **Infrastructure:** Fully Dockerized (Docker Compose) for guaranteed cross-platform execution.

---

## Quick Start (How to run)

You do not need Python or Node.js installed. The entire environment is containerized.

### Prerequisites
* Docker Desktop installed and running on your machine.

### Execution
1. Clone the repository and navigate to the project root.
2. Open your terminal and run the following command:
   docker-compose up --build
3. Once the containers are running, open your browser and navigate to:
   http://localhost:5173

To stop the application, press Ctrl + C in the terminal and run:
docker-compose down

---

## Security Testing Guide (For the Jury)

Want to see the gateway in action? Try these tests:
1. **The Extension Spoof:** Rename a .txt file to .jpg and try to upload it. The system will reject it with an unsupported format error (Magic Bytes validation).
2. **The XSS Attack:** Create an .svg file containing a <script>alert(1)</script> tag. The gateway will intercept and block the payload.
3. **The PII Redaction:** Upload an image, click "Details", use the "Edit Image (Redact)" tool to draw over sensitive data, and click "Save Changes".
4. **The Batch Export:** Approve multiple files and click "Download ZIP" or "Export JSON" to see the structured output.

---

## Testing & Quality Assurance

The Data Refinery includes a comprehensive suite of **over 120 automated tests** (Unit & Integration) using `pytest`. This ensure the gateway remains secure and functional under various attack vectors and edge cases.

### Test Coverage:
* **PII Redaction (6 tests):** Validates the logic for masking Emails, Phones, PESEL numbers, and Credit Cards.
* **Supported Formats (70 tests):** Comprehensive "Happy Path" testing for all required extensions: `PDF, TXT, MD, CSV, SVG, JPG, PNG`.
* **Spoofing Detection (30 tests):** Advanced **Magic Bytes** verification. The system is tested against various spoofing attempts (e.g., EXE files renamed to JPG).
* **Security & XSS (10 tests):** Interception of malicious payloads in SVG files (script tags, `onload` attributes).
* **API & Lifecycle (10 tests):** Verification of the full data flow: Upload -> List -> Delete -> Batch Export.

### Running Tests
To execute the test suite within the containerized environment, run:
```bash
docker-compose exec backend pytest test_main.py -v
```
---
---

# The Data Refinery - Bezpieczna Brama Danych Nieustrukturyzowanych (Wersja Polska)

## Opis Projektu
The Data Refinery to wysokowydajna, bezpieczna brama (gateway) zaprojektowana do przechwytywania, analizy i sanityzacji danych nieustrukturyzowanych (dokumenty, obrazy, tekst), zanim trafia one do wewnetrznej sieci lub bazy danych organizacji. 

Zbudowana w oparciu o architekture "security-first", zapewnia gleboka inspekcje plikow (Deep File Inspection), zapobiega wykonywaniu zlosliwych ladunkow i dostarcza operatorom zaawansowane narzedzia do wizualnej redakcji danych wrazliwych.

## Glowne Funkcje

### Bezpieczenstwo Zero-Trust i Walidacja
* **Gleboka Inspekcja Plikow (Magic Bytes):** Nie ufamy rozszerzeniom plikow. Backend rygorystycznie analizuje sygnatury binarne, aby wykryc sfalszowane pliki (np. plik .txt udajacy .jpg).
* **Zapobieganie XSS:** System blokuje zlosliwe skrypty osadzone w plikach takich jak wektory SVG.
* **Biala Lista (Whitelist):** Rygorystyczne ograniczanie dozwolonych formatow, zapobiegajace infiltracji przez pliki wykonywalne (.exe, .sh).

### Krypta Operatora i Wizualna Redakcja (PII)
* **Redakcja w oparciu o Canvas:** Operatorzy moga wizualnie zamazywac poufne dane osobowe na obrazach za pomoca dynamicznego pedzla lub prostokata bezposrednio w przegladarce.
* **Sanityzacja Tekstu:** Wbudowany edytor tekstu do przegladania i redagowania wrazliwych ciagow znakow przed ich zatwierdzeniem.
* **Operacje Masowe:** Funkcje "Approve All" oraz "Download ZIP" dla przyspieszenia pracy.
* **Eksport JSON:** Generowanie ustrukturyzowanej paczki danych zawierajacej metadane, notatki operatora i powiazania plikow, gotowej do bezpiecznego wprowadzenia do bazy.

### Easter Egg: Tryb Kaiju
Nawet korporacyjne narzedzia bezpieczenstwa moga miec dusze. Uzyj przycisku "INIT KAIJU MODE", aby wlaczyc niestandardowy, mroczny interfejs z dynamicznymi animacjami CSS w motywie Godzilli.

---

## Technologie
* **Frontend:** React + Vite, Axios (Responsywny interfejs, HTML5 Canvas)
* **Backend:** Python + FastAPI, Uvicorn (Asynchroniczne i wydajne API)
* **Walidacja:** filetype (weryfikacja Magic Bytes).
* **Infrastruktura:** Pelna konteneryzacja (Docker Compose) gwarantujaca bezproblemowe uruchomienie na kazdym systemie.

---

## Szybki Start (Instrukcja uruchomienia)

Nie musisz instalowac Pythona ani Node.js. Cale srodowisko jest zamkniete w kontenerach.

### Wymagania
* Zainstalowany i uruchomiony Docker Desktop.

### Uruchomienie
1. Pobierz repozytorium i przejdz do glownego folderu projektu.
2. Otwarz terminal i wpisz ponizsza komende:
   docker-compose up --build
3. Kiedy kontenery wystartuja, otworz przegladarke i wejdz na adres:
   http://localhost:5173

Aby zatrzymac aplikacje, wcisnij Ctrl + C w terminalu i wpisz:
docker-compose down

---

## Przewodnik Testowania Bezpieczenstwa (Dla Jury)

Chcesz sprawdzic bramke w akcji? Wykonaj te testy:
1. **Oszustwo Rozszerzenia:** Zmien nazwe pliku .txt na .jpg i sprobuj go wgrac. System odrzuci go z bledem formatu (weryfikacja Magic Bytes).
2. **Atak XSS:** Stworz plik .svg zawierajacy tag <script>alert(1)</script>. Bramka przechwyci i zablokuje ten plik.
3. **Redakcja Danych PII:** Wgraj obraz, kliknij "Details", uzyj narzedzia "Edit Image (Redact)", aby zamazac dane wrazliwe, a nastepnie kliknij "Save Changes".
4. **Masowy Eksport:** Zatwierdz kilka plikow i kliknij "Download ZIP" lub "Export JSON", aby zobaczyc ustrukturyzowany i spakowany wynik pracy.

---

## Testy i Zapewnienie Jakości

Projekt zawiera rozbudowany zestaw **ponad 120 testów automatycznych** (Unit i Integracyjnych) napisanych w `pytest`. Gwarantują one stabilność bramki oraz odporność na różnorodne wektory ataków.

### Zakres testów:
* **Logika PII (6 testów):** Weryfikacja skuteczności maskowania adresów Email, telefonów, numerów PESEL oraz kart kredytowych.
* **Obsługiwane Formaty (70 testów):** Pełne testy "Happy Path" dla wszystkich wymaganych rozszerzeń: `PDF, TXT, MD, CSV, SVG, JPG, PNG`.
* **Wykrywanie Spoofingu (30 testów):** Zaawansowana weryfikacja na podstawie **Magic Bytes**. System blokuje próby oszustwa (np. pliki EXE ze zmienionym rozszerzeniem na JPG).
* **Bezpieczeństwo i XSS (10 testów):** Przechwytywanie złośliwych ładunków w plikach SVG (tagi script, atrybuty `onload`).
* **API i Cykl życia (10 testów):** Weryfikacja pełnego obiegu danych: Upload -> Lista -> Usunięcie -> Eksport masowy.

### Uruchamianie testów
Aby uruchomić pakiet testowy wewnątrz środowiska Docker, użyj komendy:
```bash
docker-compose exec backend pytest test_main.py -v
```