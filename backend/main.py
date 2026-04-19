from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from PIL import Image
import filetype
import shutil
import os
import re
import base64
import zipfile
import io
from fastapi.responses import StreamingResponse

import cv2
import numpy as np
from fastapi import Response

app = FastAPI(
    title="The Data Refinery API",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

class FileContent(BaseModel):
    content: str

def redact_pii(text: str) -> str:
    text = re.sub(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', '[REDACTED EMAIL]', text)
    text = re.sub(r'\b\d{11}\b', '[REDACTED PESEL]', text)
    text = re.sub(r'\b(?:\d[ -]*?){13,16}\b', '[REDACTED CC]', text)
    text = re.sub(r'(?i)(?:\+48|0048)? ?[1-9]\d{2} ?\d{3} ?\d{3}', '[REDACTED PHONE]', text)
    return text

@app.get("/")
def read_root():
    return {"status": "ok"}

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    # 1. Czytanie pliku do pamięci
    content_bytes = await file.read()
    header = content_bytes[:2048]
    
    kind = filetype.guess(header)
    actual_mime = None
    
    if kind is None:
        if file.filename.lower().endswith('.svg'):
            text_content = content_bytes.decode('utf-8', errors='ignore').lower()
            if "<script" in text_content or "javascript:" in text_content:
                raise HTTPException(status_code=415, detail="Wykryto zlosliwy kod (XSS) w SVG")
            actual_mime = "image/svg+xml"
        elif file.filename.lower().endswith(('.txt', '.csv', '.md')):
            actual_mime = "text/plain"
        else:
            raise HTTPException(status_code=415, detail="Nieobslugiwany format pliku")
    else:
        actual_mime = kind.mime
        print(f"DEBUG: Wykryto typ: {actual_mime} dla pliku {file.filename}")
        if actual_mime not in ALLOWED_MIMETYPES and not actual_mime.startswith('text/'):
            raise HTTPException(status_code=415, detail=f"Nieprawidlowy typ pliku: {actual_mime}")

    # 2. Czyszczenie i odsyłanie BEZ zapisu na dysk
    if actual_mime == "text/plain" or file.filename.lower().endswith(('.txt', '.csv', '.md')):
        try:
            text_str = content_bytes.decode('utf-8')
            cleaned_content = redact_pii(text_str)
            return Response(content=cleaned_content.encode('utf-8'), media_type="text/plain")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Blad przetwarzania tekstu: {e}")

    elif actual_mime.startswith("image/") and actual_mime != "image/svg+xml":
        try:
            img = Image.open(io.BytesIO(content_bytes))
            clean_img = img.convert("RGB")
            
            img_byte_arr = io.BytesIO()
            clean_img.save(img_byte_arr, format='JPEG', quality=85)
            img_bytes = img_byte_arr.getvalue()
            
            return Response(content=img_bytes, media_type="image/jpeg")
        except Exception as e:
            raise HTTPException(status_code=415, detail="Uszkodzony lub podejrzany plik graficzny")
            
    # Dla np. PDF odsyłamy to samo co przyszło (jeszcze nie mamy filtru PDF)
    return Response(content=content_bytes, media_type=actual_mime)

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

@app.put("/api/files/{filename}")
async def update_file(filename: str, file_data: FileContent):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Not found")
    try:
        if file_data.content.startswith("data:image"):
            header, encoded = file_data.content.split(",", 1)
            data = base64.b64decode(encoded)
            with open(file_path, "wb") as f:
                f.write(data)
        else:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(file_data.content)
        return {"status": "success", "message": "File updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/files/{filename}")
async def delete_file(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    try:
        os.remove(file_path)
        return {"status": "success", "message": f"File {filename} deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class BatchDownloadRequest(BaseModel):
    filenames: list[str]

@app.post("/api/download-batch")
async def download_batch(request: BatchDownloadRequest):
    zip_io = io.BytesIO()
    
    with zipfile.ZipFile(zip_io, mode='w', compression=zipfile.ZIP_DEFLATED) as zip_file:
        for filename in request.filenames:
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.exists(file_path):
                zip_file.write(file_path, arcname=filename)
    
    zip_io.seek(0)
    return StreamingResponse(
        zip_io, 
        media_type="application/zip", 
        headers={"Content-Disposition": "attachment; filename=secured_vault.zip"}
    )

# --- OPENCV: AUTOMATYCZNE ZAMAZYWANIE TWARZY ---

# Wczytujemy darmowy, wbudowany model Haar Cascade do detekcji twarzy od przodu
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

@app.post("/api/redact-face")
async def redact_face(file: UploadFile = File(...)):
    # 1. Wczytanie pliku jako strumień bajtów
    contents = await file.read()
    
    # 2. Zamiana bajtów na tablicę matematyczną zrozumiałą dla OpenCV (Numpy)
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Nie udało się zdekodować obrazu. Upewnij się, że to poprawny plik JPG/PNG.")
        
    # 3. Model lepiej i szybciej radzi sobie na obrazach czarno-białych, więc robimy wirtualną kopię
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 4. Magia AI: Wykrywanie twarzy
    # scaleFactor i minNeighbors to parametry czułości - możesz je dostroić!
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    # 5. Rysujemy czarne prostokąty (0, 0, 0) o współrzędnych twarzy na oryginalnym, kolorowym zdjęciu
    # -1 oznacza "wypełnij figurę całkowicie"
    for (x, y, w, h) in faces:
        cv2.rectangle(img, (x, y), (x+w, y+h), (0, 0, 0), -1)
        
    # 6. Kodowanie obrazka z powrotem do formatu przesyłanego w internecie
    ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
    encode_ext = f'.{ext}' if ext in ['png', 'jpg', 'jpeg'] else '.jpg'
    
    success, encoded_img = cv2.imencode(encode_ext, img)
    if not success:
        raise HTTPException(status_code=500, detail="Błąd przy kodowaniu zamazanego obrazu.")
        
    media_type = f"image/{'png' if encode_ext == '.png' else 'jpeg'}"
    
    # 7. Odpowiedź (Zwracamy surowy, zamazany plik wprost do frontendu)
    return Response(content=encoded_img.tobytes(), media_type=media_type)