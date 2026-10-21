### Descripción de la funcionalidad
Requerir la verificación de la dirección de correo electrónico mediante el envío de un email con un enlace o token de confirmación al registrar una nueva cuenta. Mientras el correo no haya sido confirmado (`is_verified = False`), el usuario no podrá iniciar sesión ni utilizar la cuenta creada.

### Comportamiento esperado
1. **Registro de usuario**:
   - Al registrarse un nuevo usuario (`POST /api/v1/auth/register`), la cuenta se crea con estado no verificado (`is_verified = False`).
   - Se genera un token seguro de verificación de email y se envía un correo de confirmación (vía servicio de email con soporte SMTP / modo desarrollo en consola o logs para testing local).
   - El endpoint de registro informa al usuario que debe revisar su bandeja de entrada para activar su cuenta antes de poder iniciar sesión (no entrega un token de acceso activo inmediato).
2. **Control de acceso e inicio de sesión**:
   - Al intentar iniciar sesión (`POST /api/v1/auth/login`) con credenciales correctas pero con la cuenta sin verificar, el servidor responde con un error HTTP 403 Forbidden indicando claramente que el correo no ha sido verificado.
   - Las rutas protegidas (`get_current_user`) rechazan accesos de usuarios no verificados.
3. **Endpoint de verificación y reenvío**:
   - Se provee un endpoint para confirmar la cuenta (`POST /api/v1/auth/verify-email` o `GET /api/v1/auth/verify-email?token=...`) que valida el token y marca `is_verified = True`.
   - Se provee un endpoint para reenviar el email de confirmación (`POST /api/v1/auth/resend-verification`) si el token ha expirado o el usuario no lo recibió.
4. **Experiencia en Frontend**:
   - En la pantalla de registro (`AuthScreen` / `AuthModal`), tras registrarse se muestra un mensaje informativo indicando que se ha enviado un correo de confirmación y que debe validarse antes de acceder.
   - En el formulario de inicio de sesión, si el backend retorna que la cuenta no está verificada, se muestra el aviso y un enlace/botón para "Reenviar correo de confirmación".
   - Soporte para procesar el token de verificación (por ejemplo desde URL o campo de confirmación) y notificar éxito al usuario para permitirle acceder.
5. **Compatibilidad y retrocompatibilidad**:
   - Usuarios demo o existentes en fixtures de test se mantienen como verificados para no romper los flujos existentes.
   - Sin dependencias de terceros no autorizadas (utiliza la librería estándar de Python `smtplib`, `email.mime`, `secrets`).

### Entorno
- Backend: `backend/app/models/domain.py`, `backend/app/api/v1/auth.py`, `backend/app/services/user_service.py`, `backend/app/api/deps.py`, nuevo servicio de email/tokens.
- Frontend: `frontend/services/authService.ts`, `frontend/components/AuthScreen.tsx`, `frontend/components/AuthModal.tsx`.

### Evidencia
Solicitud directa del usuario: "A parte tambien me gustaria que hubiera que verificar la cuenta de correo a traves del envio de un mail de comfirmacion, sin esta confirmacion no puede usarse la cuenta creada"

### Triage inicial
- Clasificación: `confirmed`
- Tipo: `feature` / `enhancement`
- Huella de deduplicación: `auth-email-verification-on-signup`
