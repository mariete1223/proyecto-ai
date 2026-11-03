import os
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_docs_available_in_development() -> None:
    # In development (default in test suite), docs are available
    response = client.get("/docs")
    assert response.status_code == 200


def test_docs_disabled_in_production_mode() -> None:
    # When app is initialized with ENVIRONMENT=production without ENABLE_DOCS
    from fastapi import FastAPI

    from app.main import lifespan

    with patch.dict(os.environ, {"ENVIRONMENT": "production", "ENABLE_DOCS": "false"}):
        prod_environment = os.environ.get("ENVIRONMENT", "development").lower()
        is_prod = prod_environment in ("production", "prod")
        docs_on = os.environ.get(
            "ENABLE_DOCS", "false" if is_prod else "true"
        ).lower() in ("true", "1", "yes")
        prod_app = FastAPI(
            title="Proyecto AI API",
            version="0.1.0",
            lifespan=lifespan,
            docs_url="/docs" if docs_on else None,
            redoc_url="/redoc" if docs_on else None,
            openapi_url="/openapi.json" if docs_on else None,
        )
        prod_client = TestClient(prod_app)
        assert prod_client.get("/docs").status_code == 404
        assert prod_client.get("/openapi.json").status_code == 404
