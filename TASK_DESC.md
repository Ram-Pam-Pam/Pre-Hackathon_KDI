# 🛠️ Zadanie Pre-eliminacyjne: Hackathon 2026  

## 🚀 Projekt: **The Data Refinery**

## 🎯 1. Cel projektu  
Zbuduj prototyp systemu **The Data Refinery** – bezpiecznego i inteligentnego gatewaya, który przekształca surowe, nieustrukturyzowane dane (📄 dokumenty + 🖼️ grafiki) w ustandaryzowaną, czystą paczkę danych gotową do dalszego wykorzystania.

## ⚙️ 2. Wyzwania techniczne  

Zespoły muszą zaprojektować i zaimplementować rozwiązanie odpowiadające na poniższe wyzwania:

### 🔍 Weryfikacja i selekcja  
- Obsługiwane formaty: **PDF, TXT, MD, CSV** oraz **SVG, JPG, PNG**  
- 🔐 **Bezpieczeństwo wejścia:**  
  - wykrywanie fałszywych rozszerzeń plików  
  - odporność na złośliwe payloady (np. skrypty, XSS)  
  - walidacja rzeczywistego typu pliku  

---

### 🧼 Transformacja i higiena danych  

#### 📝 Moduł tekstowy  
- Automatyczna ekstrakcja treści  
- Usuwanie szumu informacyjnego  
- Redakcja danych wrażliwych (PII / sekrety)

#### 🖼️ Moduł graficzny  
- Normalizacja parametrów (format, rozmiar, jakość)  
- Usuwanie ukrytych metadanych (EXIF itp.)

#### 🧠 Kontekst  
- Wzbogacenie danych o warstwę opisową (metadata enrichment) generowaną przez operatora  

---

### 🧩 Agregacja (Data Schema)  
- Konsolidacja danych do jednego spójnego formatu **JSON**  
- Zachowanie:
  - identyfikowalności źródeł  
  - relacji między obiektami  

---

### 🖥️ Panel kontrolny (UI)  
- Interfejs umożliwiający:  
  - 🔎 inspekcję wyników  
  - ✏️ edycję danych  
  - ✅ zatwierdzenie przed eksportem  

## 🏆 3. Kryteria oceny  

- 🔐 **Bezpieczeństwo i walidacja**  
  - skuteczność wykrywania manipulacji  
  - odporność na ataki (np. XSS, payloady w plikach)

- 🧼 **Jakość transformacji**  
  - czy dane wyjściowe są faktycznie „czyste” i użyteczne  

- 🏗️ **Architektura rozwiązania**  
  - czytelność kodu  
  - obsługa błędów  
  - jakość integracji API  

## 📦 4. Wymagane elementy zgłoszenia  

Projekt zostanie uznany za kompletny wyłącznie po dostarczeniu wszystkich poniższych elementów:

### 🎥 I. Film demonstracyjny (Screencast)  
- ⏱️ Maksymalnie **10 minut**  

**Powinien zawierać:**  
- 🔄 **Pełny flow:** od uploadu pliku do finalnego JSON-a  
- 🔍 **Before / After:** pokazanie transformacji danych  
- 🛡️ **Test odporności:**  
  - próba uploadu fałszywego pliku (np. `.exe` jako `.jpg`)  
  - reakcja systemu na złośliwy content  
- 🧩 **Omówienie JSON:** struktura i powiązania  

---

### 📄 II. Dokumentacja API (OpenAPI)  
- Pełna specyfikacja w standardzie **OpenAPI / Swagger**  

---

### 🧪 III. Dokumentacja techniczna i testy  
- Architektura systemu  
- Testy jednostkowe  
- README z instrukcją  

## 🐳 5. Nice to have: Konteneryzacja  
```bash
docker-compose up
```

## 📌 6. Zasady oceny repozytorium (ważne!)

- 📂 **Ocenie podlega wyłącznie gałąź `master`**
- 🕒 **Wymagany jest widoczny postęp prac w commitach**
  - commity powinny być dodawane na bieżąco w trakcie pracy
  - unikać wrzucania całego projektu „na raz” tuż przed końcem
- 🔍 Historia repozytorium będzie brana pod uwagę przy ocenie

---

**Powodzenia! 🚀🔥**



# 🇬🇧 English version

# 🛠️ Pre-qualification Task: Hackathon 2026  

## 🚀 Project: **The Data Refinery**

## 🎯 1. Project Goal  
Build a prototype of **The Data Refinery** – a secure and intelligent gateway that transforms raw, unstructured data (📄 documents + 🖼️ images) into a clean, standardized data package ready for further processing.

## ⚙️ 2. Technical Challenges  

Teams must design and implement a solution addressing the following:

### 🔍 Validation & Selection  
- Supported formats: **PDF, TXT, MD, CSV** and **SVG, JPG, PNG**  
- 🔐 **Input security:**  
  - detect fake file extensions  
  - prevent malicious payloads (e.g. scripts, XSS)  
  - validate actual file types  

---

### 🧼 Data Transformation & Hygiene  

#### 📝 Text Module  
- Automatic content extraction  
- Noise removal  
- Sensitive data redaction (PII / secrets)

#### 🖼️ Image Module  
- Format normalization  
- Metadata removal  

#### 🧠 Context Layer  
- Enrich data with descriptive metadata  

---

### 🧩 Aggregation (Data Schema)  
- Consolidate all processed data into a unified **JSON** format  

---

### 🖥️ Control Panel (UI)  
- Review, edit, and approve results before export  

## 🏆 3. Evaluation Criteria  
- Security & validation  
- Transformation quality  
- Architecture  

## 📦 4. Submission Requirements  

### 🎥 Demo Video  
- Max 10 minutes  
- Full flow + before/after + security test  

---

### 📄 API Documentation  
- OpenAPI / Swagger  

---

### 🧪 Technical Docs & Tests  
- Architecture  
- Unit tests  
- README  

## 🐳 5. Nice to Have  
```bash
docker-compose up
```

## 📌 6. Repository Evaluation Rules (Important!)

- 📂 **Only the `master` branch will be evaluated**
- 🕒 **Visible progress in commits is required**
  - commits should be pushed regularly during development
  - avoid submitting the entire project at the last minute
- 🔍 Repository history will be taken into account during evaluation

---

**Good luck! 🚀🔥**


Aktualizacja struktury z backendem