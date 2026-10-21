### Software Engineer Implementation Summary

Se ha implementado el soporte integral de verificación de cuenta de usuario mediante correo electrónico de confirmación, cubriendo tanto el backend como el frontend sin añadir ninguna dependencia externa a `pyproject.toml` ni `package.json`.

#### Cambios en Backend
1. **Modelo de datos y migración**:
   - `backend/app/models/domain.py`: Agregado campo `is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default=sa.false())` al modelo `User`.
   - `backend/migrations/versions/0004_add_user_is_verified.py`: Migración Alembic para agregar la columna `is_verified` con valor por defecto `False`.
2. **Generación y validación de tokens de verificación**:
   - `backend/app/core/auth.py`: Funciones criptográficas `create_verification_token` y `decode_verification_token` usando HMAC-SHA256 con expiración de 24 horas y timestamp codificado en URL-safe base64.
3. **Servicio de envío de correo**:
   - `backend/app/services/email_service.py`: Utiliza la librería estándar de Python (`smtplib`, `email.mime`) con fallback automático a consola/cola en memoria para testing y modo desarrollo local sin servidor SMTP externo configurado.
4. **Esquemas y Servicios**:
   - `backend/app/schemas/auth.py`: Nuevos esquemas `RegisterResponse`, `VerifyEmailRequest`, `VerifyEmailResponse`, `ResendVerificationRequest`.
   - `backend/app/services/user_service.py`: `create_user` respeta el flag `is_verified` (por defecto `True` para fixtures y demo, y `False` explícito en el endpoint de registro). Métodos `verify_user_email` y `is_user_verified`.
5. **Endpoints de Autenticación**:
   - `backend/app/api/v1/auth.py`:
     - `POST /register`: Crea el usuario con `is_verified=False`, despacha el correo con el token y retorna HTTP 201 con mensaje descriptivo y sin token de sesión.
     - `POST /login`: Valida credenciales; si las credenciales son válidas pero `is_verified=False`, devuelve HTTP 403 Forbidden con detalle `Email address is not verified. Please check your email to activate your account.`.
     - `POST /verify-email` y `GET /verify-email`: Validan el token, activan la cuenta (`is_verified=True`) y retornan HTTP 200. Si el token es inválido o ha expirado, retornan HTTP 400 Bad Request.
     - `POST /resend-verification`: Reenvía el correo de activación si la cuenta existe y aún no está verificada (retorna HTTP 400 si ya estaba verificada o 404 si el usuario no existe).
6. **Seguridad y Rutas Protegidas**:
   - `backend/app/api/deps.py`: El usuario demo se configura con `is_verified=True`. `get_current_user` valida `if not user.is_verified: raise HTTPException(status_code=403, detail="Account is not verified.")`.

#### Cambios en Frontend
1. **Servicio de Autenticación (`frontend/services/authService.ts`)**:
   - Actualizado `loginUser` para detectar `403` y retornar `isUnverified: true`.
   - `registerUser` adaptado para manejar respuestas sin token y con mensaje de activación.
   - Implementadas funciones `verifyEmail` y `resendVerification`.
2. **Componentes UI (`AuthScreen.tsx` y `AuthModal.tsx`)**:
   - Mensaje de retroalimentación tras registro exitoso indicando revisar la bandeja de entrada.
   - Detección de error HTTP 403 de cuenta no verificada con banner dedicado y botón interactivo `📩 Reenviar correo de confirmación`.
   - Pestaña interactiva "Verificar" para validar tokens manualmente o automáticamente desde el parámetro de URL `?token=...`.

#### Pruebas y Validación
- Backend:
  - `backend/tests/test_auth.py`: Pruebas de generación y validación de tokens (válidos, expirados, manipulados).
  - `backend/tests/test_auth_api.py`: Pruebas de registro, bloqueo de login no verificado (403), verificación exitosa (POST y GET), tokens inválidos (400), reenvío (éxito, usuario inexistente, usuario ya verificado), y control de acceso a rutas protegidas.
  - Validación completa: `python scripts/check.py` (Ruff format, Ruff lint, Mypy en 68 archivos, y 131 tests unitarios/integración en Pytest pasando).
- Frontend:
  - Pruebas unitarias actualizadas en `authService.test.ts`, `AuthScreen.test.tsx`, `AuthModal.test.tsx`.
  - Validación completa: `npm run check` (Prettier, ESLint, TypeScript `tsc --noEmit`, y 39 suites de Jest con 318 tests pasando).
