from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import filetype
import shutil
import os

app = FastAPI(
    title="The Data Refinery API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED_MIMETYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png"
]

UPLOAD_DIR = "uploads"

# upewniamy sie ze folder na pliki istnieje zanim cos do niego wrzucimy
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    header = await file.read(2048)
    await file.seek(0)
    
    kind = filetype.guess(header)
    
    if kind is None:
        if file.filename.lower().endswith('.svg'):
            content = await file.read()
            await file.seek(0)
            text_content = content.decode('utf-8', errors='ignore').lower()
            if "<script" in text_content or "javascript:" in text_content:
                raise HTTPException(status_code=415, detail="Wykryto zlosliwy kod (XSS) w pliku SVG")
            actual_mime = "image/svg+xml"
        elif not file.filename.lower().endswith(('.txt', '.csv', '.md')):
            raise HTTPException(status_code=415, detail="Nieobslugiwany format pliku")
        else:
            actual_mime = "text/plain"
    else:
        actual_mime = kind.mime
        if actual_mime not in ALLOWED_MIMETYPES:
            raise HTTPException(status_code=415, detail="Wykryto nieprawidlowy typ pliku")

    # ZAPISYWANIE PLIKU NA DYSK
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "status": "success",
        "filename": file.filename,
        "saved_path": file_path,
        "detected_type": actual_mime
    }