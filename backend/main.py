from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from PIL import Image
import filetype
import shutil
import os
import re
import base64

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
    header = await file.read(2048)
    await file.seek(0)
    
    kind = filetype.guess(header)
    actual_mime = None
    
    if kind is None:
        if file.filename.lower().endswith('.svg'):
            content = await file.read()
            await file.seek(0)
            text_content = content.decode('utf-8', errors='ignore').lower()
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

    file_path = os.path.join(UPLOAD_DIR, file.filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    if actual_mime == "text/plain" or file.filename.lower().endswith(('.txt', '.csv', '.md')):
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            cleaned_content = redact_pii(content)
            
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(cleaned_content)
        except Exception as e:
            print(f"Blad przetwarzania tekstu: {e}")

    elif actual_mime.startswith("image/") and actual_mime != "image/svg+xml":
        try:
            with Image.open(file_path) as img:
                clean_img = img.convert("RGB")
                
                new_filename = file.filename.rsplit('.', 1)[0] + '.jpg'
                new_file_path = os.path.join(UPLOAD_DIR, new_filename)
                
                clean_img.save(new_file_path, "JPEG", quality=85)
                
                if new_filename != file.filename:
                    os.remove(file_path)
                    file.filename = new_filename
                
                actual_mime = "image/jpeg"
        except Exception as e:
            print(f"Blad Pillow: {e}")
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