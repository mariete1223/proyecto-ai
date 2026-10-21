## QA: PASS

- [x] El modelo `User` en backend incluye el campo `is_verified: bool` con valor por defecto `False` (y migración correspondiente en base de datos) - PASS
- [x] El usuario demo (`demo@example.com`) en `deps.py` y las fixtures de prueba se configuran con `is_verified = True` para mantener intactos los flujos de prueba y entorno demo - PASS
- [x] Al registrar un usuario en `POST /api/v1/auth/register`, el usuario se crea con `is_verified = False`, se genera un token de verificación seguro con tiempo de expiración (24h) y se despacha el correo de confirmación (usando `smtplib` estándar o mock/logger en modo desarrollo) - PASS
- [x] La respuesta de `POST /api/v1/auth/register` devuelve código HTTP 201 y un mensaje indicando que debe verificarse el correo antes de iniciar sesión, sin emitir un token de sesión de acceso directo - PASS
- [x] Al intentar iniciar sesión mediante `POST /api/v1/auth/login` con credenciales válidas pero con `is_verified == False`, el backend responde con HTTP 403 Forbidden y un mensaje indicando que el correo no ha sido verificado - PASS
- [x] Se implementa el endpoint `POST /api/v1/auth/verify-email` (o `GET /api/v1/auth/verify-email?token=...`) que valida el token y actualiza `user.is_verified = True` en la base de datos, retornando HTTP 200 con mensaje de éxito - PASS
- [x] Si se proporciona un token de verificación inválido, manipulado o expirado a `verify-email`, el endpoint responde con HTTP 400 Bad Request - PASS
- [x] Se implementa el endpoint `POST /api/v1/auth/resend-verification` que permite solicitar un nuevo correo de confirmación para una cuenta no verificada - PASS
- [x] La dependencia `get_current_user` en `backend/app/api/deps.py` valida que `user.is_verified` sea `True`; si no lo es, rechaza la petición con HTTP 403 Forbidden - PASS
- [x] En el frontend (`authService.ts`, `AuthScreen.tsx`, `AuthModal.tsx`), el registro muestra feedback claro instruyendo al usuario a revisar su bandeja de entrada para activar su cuenta - PASS
- [x] En el frontend, si el inicio de sesión falla por cuenta no verificada (HTTP 403), se muestra un aviso específico con la opción interactiva de "Reenviar correo de confirmación" - PASS
- [x] En el frontend, se provee soporte para verificar el token (bien por parámetro de URL o mediante formulario de ingreso de código/token de confirmación) informando al usuario del resultado - PASS
- [x] No se agregan nuevas dependencias a `pyproject.toml` ni a `package.json` (se utilizan librerías nativas estándar de Python: `secrets`, `smtplib`, `email.mime`, `hashlib`) - PASS
- [x] Todos los tests del backend (`uv run pytest`) y del frontend (`npm run check`) pasan satisfactoriamente, incorporando tests para los nuevos flujos de verificación, rechazo de login y reenvío - PASS

### Verificación de pruebas
- Backend:
  - Comando: `uv run --directory backend python scripts/check.py`
  - Resultado: Ruff format (68 archivos), Ruff check (todos los checks pasados), Mypy (éxito en 68 archivos), Pytest (131 pasados, 5 omitidos de integración PG opcional, 0 fallidos).
- Frontend:
  - Comando: `npm run check` en `frontend/`
  - Resultado: Prettier format check (aprobado), ESLint (aprobado), TypeScript compile check (aprobado), Jest (39 suites pasadas, 318 tests pasados, 0 fallidos).
