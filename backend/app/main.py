import os

os.environ["DISABLE_SQLALCHEMY_CEXT"] = "1"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_v1_router

app = FastAPI(title="Proyecto AI API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_v1_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
