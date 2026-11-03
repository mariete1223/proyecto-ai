from __future__ import annotations

import os
from unittest.mock import patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.rate_limit import RateLimiter


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> None:
    RateLimiter.reset_all()


def test_rate_limiter_allows_under_limit() -> None:
    app = FastAPI()
    limiter = RateLimiter(max_requests=3, window_seconds=60, scope="test_under")

    @app.get("/test", dependencies=[pytest.importorskip("fastapi").Depends(limiter)])
    def endpoint() -> dict[str, str]:
        return {"status": "ok"}

    client = TestClient(app)
    for _ in range(3):
        response = client.get("/test")
        assert response.status_code == 200


def test_rate_limiter_blocks_over_limit() -> None:
    app = FastAPI()
    limiter = RateLimiter(max_requests=2, window_seconds=60, scope="test_over")

    @app.get("/test", dependencies=[pytest.importorskip("fastapi").Depends(limiter)])
    def endpoint() -> dict[str, str]:
        return {"status": "ok"}

    client = TestClient(app)
    # 1st and 2nd pass
    assert client.get("/test").status_code == 200
    assert client.get("/test").status_code == 200

    # 3rd should be 429 Too Many Requests
    blocked_response = client.get("/test")
    assert blocked_response.status_code == 429
    assert "Too many requests" in blocked_response.json()["detail"]
    assert "retry-after" in blocked_response.headers


def test_rate_limiter_differentiates_by_ip() -> None:
    app = FastAPI()
    limiter = RateLimiter(max_requests=1, window_seconds=60, scope="test_ip")

    @app.get("/test", dependencies=[pytest.importorskip("fastapi").Depends(limiter)])
    def endpoint() -> dict[str, str]:
        return {"status": "ok"}

    client = TestClient(app)

    # IP 1 uses its allowance
    res1 = client.get("/test", headers={"X-Forwarded-For": "198.51.100.1"})
    assert res1.status_code == 200

    # IP 1 is blocked on second try
    res1_blocked = client.get("/test", headers={"X-Forwarded-For": "198.51.100.1"})
    assert res1_blocked.status_code == 429

    # IP 2 is still allowed
    res2 = client.get("/test", headers={"X-Forwarded-For": "198.51.100.2"})
    assert res2.status_code == 200


def test_rate_limiter_can_be_disabled() -> None:
    app = FastAPI()
    limiter = RateLimiter(max_requests=1, window_seconds=60, scope="test_disabled")

    @app.get("/test", dependencies=[pytest.importorskip("fastapi").Depends(limiter)])
    def endpoint() -> dict[str, str]:
        return {"status": "ok"}

    client = TestClient(app)
    with patch.dict(os.environ, {"RATE_LIMIT_ENABLED": "false"}):
        for _ in range(5):
            response = client.get("/test")
            assert response.status_code == 200
