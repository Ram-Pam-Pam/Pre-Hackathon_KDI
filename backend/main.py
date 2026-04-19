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

# --- OPENCV: INTELIGENTNE ZAMAZYWANIE TWARZY (ZOPTYMALIZOWANE) ---

# Wczytujemy dwa najbardziej stabilne modele
cascade_frontal = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
cascade_alt = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_alt2.xml')

@app.post("/api/redact-face")
async def redact_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            raise HTTPException(status_code=400, detail="Nie udało się zdekodować obrazu. Upewnij się, że to poprawny plik JPG/PNG.")
            
        # Zapisujemy oryginał do późniejszego rysowania w pełnej rozdzielczości
        original_img = img.copy()
        
        # OPTYMALIZACJA: Zmniejszamy obraz wirtualnie TYLKO na potrzeby detekcji. 
        # Chroni to darmowy serwer Render przed błędem "Out of Memory" (502 Bad Gateway)
        max_width = 800
        scale_ratio = 1.0
        
        if img.shape[1] > max_width:
            scale_ratio = max_width / img.shape[1]
            new_width = max_width
            new_height = int(img.shape[0] * scale_ratio)
            detect_img = cv2.resize(img, (new_width, new_height))
        else:
            detect_img = img
            
        gray = cv2.cvtColor(detect_img, cv2.COLOR_BGR2GRAY)
        
        # Szukamy twarzy za pomocą 2 modeli ze stabilnym scaleFactor=1.1
        faces_frontal = cascade_frontal.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(20, 20))
        faces_alt = cascade_alt.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(20, 20))
        
        all_faces = []
        if len(faces_frontal) > 0: all_faces.extend(faces_frontal)
        if len(faces_alt) > 0: all_faces.extend(faces_alt)
        
        # Rysujemy na ORYGINALNYM, DUŻYM obrazie
        for (x, y, w, h) in all_faces:
            # Przeliczamy wirtualne koordynaty z powrotem na prawdziwy rozmiar zdjęcia
            orig_x = int(x / scale_ratio)
            orig_y = int(y / scale_ratio)
            orig_w = int(w / scale_ratio)
            orig_h = int(h / scale_ratio)
            
            # Dodajemy bezpieczny margines (15%)
            margin_x = int(orig_w * 0.15)
            margin_y = int(orig_h * 0.15)
            
            x1 = max(0, orig_x - margin_x)
            y1 = max(0, orig_y - margin_y)
            x2 = min(original_img.shape[1], orig_x + orig_w + margin_x)
            y2 = min(original_img.shape[0], orig_y + orig_h + margin_y)
            
            cv2.rectangle(original_img, (x1, y1), (x2, y2), (0, 0, 0), -1)
            
        ext = file.filename.split('.')[-1].lower() if '.' in file.filename else 'jpg'
        encode_ext = f'.{ext}' if ext in ['png', 'jpg', 'jpeg'] else '.jpg'
        
        success, encoded_img = cv2.imencode(encode_ext, original_img)
        if not success:
            raise HTTPException(status_code=500, detail="Błąd przy kodowaniu zamazanego obrazu.")
            
        media_type = f"image/{'png' if encode_ext == '.png' else 'jpeg'}"
        
        from fastapi import Response 
        return Response(content=encoded_img.tobytes(), media_type=media_type)

    except Exception as e:
        print(f"AI Redact Error: {e}")
        # Jeśli coś pójdzie nie tak, zwracamy ładny błąd zamiast wywalać serwer (502)
        raise HTTPException(status_code=500, detail=str(e))