from __future__ import annotations

import os
import threading
import time
from collections import defaultdict
from typing import ClassVar

from fastapi import HTTPException, Request, status


class RateLimiter:
    """In-memory sliding window rate limiter dependency for FastAPI endpoints."""

    _storage: ClassVar[dict[str, list[float]]] = defaultdict(list)
    _lock: ClassVar[threading.Lock] = threading.Lock()

    def __init__(
        self,
        max_requests: int = 5,
        window_seconds: int = 60,
        scope: str = "default",
    ) -> None:
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.scope = scope

    @classmethod
    def reset_all(cls) -> None:
        """Clear all rate limit storage (useful in tests and dev resets)."""
        with cls._lock:
            cls._storage.clear()

    @staticmethod
    def is_enabled() -> bool:
        """Check if rate limiting is enabled via environment variables."""
        return os.environ.get("RATE_LIMIT_ENABLED", "true").lower() not in (
            "false",
            "0",
            "no",
            "off",
        )

    @staticmethod
    def get_client_ip(request: Request) -> str:
        """Extract the client IP from X-Forwarded-For or request.client."""
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # First IP in X-Forwarded-For is the client IP (behind reverse proxy or tunnel)
            client_ip = forwarded_for.split(",")[0].strip()
            if client_ip:
                return client_ip
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    def __call__(self, request: Request) -> None:
        if not self.is_enabled():
            return

        client_ip = self.get_client_ip(request)
        key = f"{self.scope}:{client_ip}"
        now = time.monotonic()
        cutoff = now - self.window_seconds

        with self._lock:
            timestamps = self._storage[key]
            # Retain only timestamps within the sliding window
            self._storage[key] = [t for t in timestamps if t > cutoff]
            current_count = len(self._storage[key])

            if current_count >= self.max_requests:
                oldest_in_window = self._storage[key][0]
                retry_after = max(
                    1, int(self.window_seconds - (now - oldest_in_window)) + 1
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please try again later.",
                    headers={"Retry-After": str(retry_after)},
                )

            self._storage[key].append(now)

            # Housekeeping: periodically purge empty keys if storage grows large
            if len(self._storage) > 1000:
                empty_keys = [
                    k for k, v in self._storage.items() if not v or v[-1] <= cutoff
                ]
                for k in empty_keys:
                    self._storage.pop(k, None)
