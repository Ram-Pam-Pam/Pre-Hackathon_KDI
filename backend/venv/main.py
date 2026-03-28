from fastapi import FastAPI

app = FastAPI(
    title="The Data Refinery API",
    description="API for unstructured data transformation and hygiene",
    version="0.1.0"
)

@app.get("/")
def read_root():
    return {"status": "The Data Refinery backend is running!"}