from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat
from py_vapid import Vapid, b64urlencode  # type: ignore[import-untyped]
from pywebpush import WebPushException, webpush  # type: ignore[import-untyped]

logger = logging.getLogger(__name__)

_VAPID_INSTANCE: Vapid | None = None
_VAPID_PUB_B64: str | None = None

DEFAULT_KEY_FILE = Path(__file__).resolve().parent.parent.parent / "vapid_private.pem"


def get_vapid() -> Vapid:
    global _VAPID_INSTANCE, _VAPID_PUB_B64
    if _VAPID_INSTANCE is not None:
        return _VAPID_INSTANCE

    key_path_str = os.getenv("VAPID_PRIVATE_KEY_PATH")
    key_path = Path(key_path_str) if key_path_str else DEFAULT_KEY_FILE

    if key_path.exists():
        try:
            v = Vapid.from_file(str(key_path))
            _VAPID_INSTANCE = v
            raw = v.public_key.public_bytes(
                Encoding.X962, PublicFormat.UncompressedPoint
            )
            _VAPID_PUB_B64 = b64urlencode(raw)
            return v
        except Exception as exc:
            logger.warning(
                "No se pudo cargar la clave VAPID existente: %s. Regenerando...", exc
            )

    # Generate new VAPID key pair
    v = Vapid()
    v.generate_keys()
    try:
        key_path.parent.mkdir(parents=True, exist_ok=True)
        key_path.write_bytes(v.private_pem())
    except Exception as exc:
        logger.warning("No se pudo guardar la clave VAPID en disco: %s", exc)

    _VAPID_INSTANCE = v
    raw = v.public_key.public_bytes(Encoding.X962, PublicFormat.UncompressedPoint)
    _VAPID_PUB_B64 = b64urlencode(raw)
    return v


def get_vapid_public_key() -> str:
    global _VAPID_PUB_B64
    if _VAPID_PUB_B64 is None:
        get_vapid()
    return _VAPID_PUB_B64 or ""


def send_web_push_detail(
    subscription_info: dict[str, Any],
    data: dict[str, Any],
    subject: str = "mailto:soporte@proyecto-ai.com",
    ttl: int = 86400,
) -> tuple[bool, bool]:
    """
    Send a Web Push notification to a browser push endpoint (APNs / FCM).
    Returns (success: bool, is_expired: bool).
    is_expired is True ONLY if the push service returned 404 Not Found or 410 Gone.
    """
    v = get_vapid()
    key_path_str = os.getenv("VAPID_PRIVATE_KEY_PATH")
    key_path = Path(key_path_str) if key_path_str else DEFAULT_KEY_FILE

    # Ensure key file exists on disk for pywebpush
    if not key_path.exists():
        try:
            key_path.parent.mkdir(parents=True, exist_ok=True)
            key_path.write_bytes(v.private_pem())
        except Exception as exc:
            logger.warning("No se pudo escribir la clave VAPID en disco: %s", exc)

    payload_str = json.dumps(data, default=str)
    claims: dict[str, Any] = {
        "sub": subject,
    }

    extra_headers = {
        "Urgency": "high",
        "apns-priority": "10",
        "apns-push-type": "alert",
    }

    try:
        resp = webpush(
            subscription_info=subscription_info,
            data=payload_str,
            vapid_private_key=str(key_path),
            vapid_claims=claims,
            ttl=ttl,
            headers=extra_headers,
        )
        status_code = getattr(resp, "status_code", 200)
        logger.info(
            "Web Push enviado con éxito a %s (HTTP %s)",
            subscription_info.get("endpoint", "")[:40],
            status_code,
        )
        return True, False
    except WebPushException as exc:
        is_expired = False
        if exc.response is not None and exc.response.status_code in (404, 410):
            is_expired = True
            logger.info(
                "Suscripción Push caducada o desregistrada (HTTP %s): %s",
                exc.response.status_code,
                exc,
            )
        else:
            logger.warning(
                "Fallo al enviar Web Push: %s (status=%s)",
                exc,
                getattr(exc.response, "status_code", "N/A"),
            )
        return False, is_expired
    except Exception as exc:
        logger.warning("Error inesperado en Web Push: %s", exc)
        return False, False


def send_web_push(
    subscription_info: dict[str, Any],
    data: dict[str, Any],
    subject: str = "mailto:soporte@proyecto-ai.com",
) -> bool:
    """Send a Web Push notification to a browser push endpoint. Returns True on success."""
    success, _ = send_web_push_detail(subscription_info, data, subject)
    return success
