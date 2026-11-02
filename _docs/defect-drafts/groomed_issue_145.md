## Goal
Garantizar que la aplicación gestione la expiración y renovación del token JWT de forma robusta e industrial: renovando automáticamente el token mediante endpoint `/refresh` en el backend antes o cuando devuelva HTTP 401; notificando de forma explícita al usuario si la sesión ha expirado y no se puede renovar en vez de simular un estado «Online»; y garantizando que el servicio de notificaciones locales nunca silencie las alertas sin una suscripción y entrega Web Push verificadas.

## Acceptance criteria
- [ ] En el backend (`backend/app/api/v1/auth.py`), se añade un endpoint `POST /api/v1/auth/refresh` que permite a un usuario autenticado (o con token de acceso válido) renovar su JWT access token obteniendo un nuevo token de acceso sin tener que volver a ingresar sus credenciales.
- [ ] En el frontend (`frontend/services/authService.ts` y `frontend/services/syncEngine.ts`), si una llamada protegida (`/api/v1/sync/push`, `/api/v1/push/subscribe`, etc.) recibe `HTTP 401 Unauthorized`:
  - Intenta renovar automáticamente el token mediante `/api/v1/auth/refresh`. Si la renovación tiene éxito, reintenta la operación pendiente con el nuevo token de forma transparente.
  - Si la renovación falla o el token es completamente inválido, notifica la expiración de la sesión para actualizar el estado del cliente.
- [ ] En la interfaz (`frontend/App.tsx`), cuando la sesión del usuario haya caducado y no sea renovable:
  - Se muestra un aviso/banner accesible y claro: *"Tu sesión ha caducado. Vuelve a iniciar sesión para sincronizar y activar alertas."*, permitiendo abrir el modal de autenticación.
  - No se muestra el estado como sincronizado ni conectado falsamente.
- [ ] En `frontend/services/notificationService.ts`:
  - `canRelyOnRemotePush()` no debe devolver `true` basándose solo en variables no nulas en memoria: debe requerir que la suscripción Web Push haya sido confirmada exitosamente con el backend y que el token no esté marcado como caducado/401.
  - Si no existe confirmación de entrega remota (`PUSH_DELIVERED` en `notifiedEntryIds`), la alerta local se ejecuta y reproduce su sonido y notificación tanto en tiempo exacto como al despertar la pestaña con retraso, impidiendo el silenciamiento accidental.
- [ ] Se añaden pruebas de regresión en backend (`backend/tests/test_auth_refresh.py` o similar) y frontend (`notificationService.test.ts`, `authService.test.ts`) cubriendo la renovación de token y la no supresión de alertas locales ante 401.
- [ ] Las suites completas de pruebas (`uv run pytest` y `npm run check`) pasan al 100%.

## Out of scope
- Autenticación mediante proveedores OAuth externos (Google/Apple Sign-In) o biometría móvil nativa.

## Constraints
- Estándares de calidad y robustez de `AGENTS.md`. No hacks temporales.
- Preservar completamente la experiencia offline-first.
