from __future__ import annotations

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)

# In-memory store of dispatched emails for testing and development auditing
dispatched_verification_emails: list[dict[str, str]] = []


def clear_dispatched_emails() -> None:
    """Clear recorded verification emails (used primarily in test suites)."""
    dispatched_verification_emails.clear()


def get_dispatched_emails() -> list[dict[str, str]]:
    """Return a copy of all dispatched verification emails."""
    return list(dispatched_verification_emails)


def send_verification_email(email: str, token: str) -> bool:
    """Send an account verification email containing the verification token and activation link."""
    app_url = os.environ.get("FRONTEND_URL", "http://localhost:8081").rstrip("/")
    verification_link = f"{app_url}/verify-email?token={token}"

    subject = "Confirma tu cuenta de correo - VoxDaily"
    body_text = (
        "¡Hola!\n\n"
        "Gracias por registrarte en VoxDaily.\n"
        "Para activar tu cuenta y poder iniciar sesión, por favor verifica tu correo usando el siguiente enlace:\n"
        f"{verification_link}\n\n"
        "O introduce este código de verificación en la aplicación:\n"
        f"{token}\n\n"
        "Este enlace caducará en 24 horas.\n"
        "Si no creaste esta cuenta, puedes ignorar este mensaje.\n"
    )

    body_html = f"""
    <html>
      <body style="font-family: sans-serif; color: #1e293b; background-color: #f8fafc; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 28px; border: 1px solid #e2e8f0;">
          <h2 style="color: #0284c7; margin-top: 0;">Activa tu cuenta en VoxDaily</h2>
          <p>Gracias por registrarte. Para comenzar a usar tu diario y calendario privados, confirma tu dirección de correo electrónico:</p>
          <div style="margin: 24px 0; text-align: center;">
            <a href="{verification_link}" style="display: inline-block; background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Verificar mi correo
            </a>
          </div>
          <p style="font-size: 13px; color: #64748b;">
            O utiliza este código/token de verificación en la app:<br>
            <code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px; font-size: 12px; word-break: break-all;">{token}</code>
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #94a3b8;">Si no solicitaste este registro, puedes ignorar este mensaje con seguridad.</p>
        </div>
      </body>
    </html>
    """

    record = {
        "to": email,
        "token": token,
        "link": verification_link,
        "subject": subject,
        "body": body_text,
    }
    dispatched_verification_emails.append(record)

    smtp_host = os.environ.get("SMTP_HOST")
    if not smtp_host:
        logger.info(
            "[EmailService: Dev Mode] Email to %s; Token: %s; Link: %s",
            email,
            token,
            verification_link,
        )
        return True

    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER")
    smtp_password = os.environ.get("SMTP_PASSWORD")
    from_email = os.environ.get("SMTP_FROM_EMAIL", smtp_user or "noreply@voxdaily.app")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = email
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
            if os.environ.get("SMTP_USE_TLS", "true").lower() in ("true", "1"):
                server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(from_email, [email], msg.as_string())
        logger.info("[EmailService] Successfully sent verification email to %s", email)
        return True
    except Exception as exc:
        logger.error(
            "[EmailService] Failed to send email to %s via SMTP: %s", email, exc
        )
        return False
