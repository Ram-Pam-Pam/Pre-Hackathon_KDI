from fastapi import FastAPI, UploadFile, File, HTTPException
import filetype

app = FastAPI(
    title="The Data Refinery API",
    version="0.1.0"
)

# dozwolone formaty binarne
ALLOWED_MIMETYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png"
]

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    header = await file.read(2048)
    await file.seek(0)
    
    kind = filetype.guess(header)
    
    if kind is None:
        # weryfikacja plikow tekstowych/xml pod katem xss
        if file.filename.lower().endswith('.svg'):
            content = await file.read()
            await file.seek(0)
            
            # dekodujemy do tekstu zeby poszukac zlosliwych tagow
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

    return {
        "status": "success",
        "filename": file.filename,
        "detected_type": actual_mime
    }