from fastapi import FastAPI

from app.api import api_v1_router

app = FastAPI(title="Proyecto AI API", version="0.1.0")

app.include_router(api_v1_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
