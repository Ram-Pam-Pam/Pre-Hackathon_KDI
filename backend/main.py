from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image
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

# rozszerzona lista typow
ALLOWED_MIMETYPES = [
    "application/pdf",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp"
]

UPLOAD_DIR = "uploads"
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
                raise HTTPException(status_code=415, detail="Wykryto zlosliwy kod (XSS) in SVG")
            actual_mime = "image/svg+xml"
        elif not file.filename.lower().endswith(('.txt', '.csv', '.md')):
            raise HTTPException(status_code=415, detail="Nieobslugiwany format pliku")
        else:
            actual_mime = "text/plain"
    else:
        actual_mime = kind.mime
        # wypisuje w konsoli co serwer wykryl
        print(f"DEBUG: Wykryto typ: {actual_mime} dla pliku {file.filename}")
        
        if actual_mime not in ALLOWED_MIMETYPES:
            raise HTTPException(status_code=415, detail=f"Nieprawidlowy typ pliku: {actual_mime}")

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # czyszczenie grafiki
    if actual_mime.startswith("image/") and actual_mime != "image/svg+xml":
        try:
            with Image.open(file_path) as img:
                clean_img = img.convert("RGB")
                clean_img.save(file_path, "JPEG", quality=85)
                actual_mime = "image/jpeg"
        except Exception as e:
            print(f"Blad Pillow: {e}")
            # jesli pillow nie umie otworzyc, to moze byc fake jpg
            raise HTTPException(status_code=415, detail="Uszkodzony lub podejrzany plik graficzny")

    return {
        "status": "success",
        "filename": file.filename,
        "detected_type": actual_mime
    }

@app.get("/api/files")
async def list_files():
    files_list = []
    for filename in os.listdir(UPLOAD_DIR):
        path = os.path.join(UPLOAD_DIR, filename)
        if os.path.isfile(path):
            files_list.append({
                "filename": filename,
                "status": "CLEANED",
                "size_kb": round(os.path.getsize(path) / 1024, 2),
                "extension": filename.split('.')[-1].upper()
            })
    return files_list

@app.get("/api/download/{filename}")
async def download_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Not found")
    return FileResponse(path=file_path, filename=filename)