## Software Engineer Report - Issue #84 (Reapertura / Bypass ngrok en peticiones Web Push)

### Causa Raíz Diagnosticada

1. **Intercepción de ngrok (`ERR_NGROK_6024`)**:
   - En las conexiones desde dispositivos móviles o navegadores web que acceden a través de un dominio libre de ngrok (`raging-degraded-reptile.ngrok-free.dev`), ngrok interpone por defecto una página intermedia HTML con advertencia de navegación (`ERR_NGROK_6024`) salvo que se suministre la cabecera HTTP `ngrok-skip-browser-warning: true`.
   - Mientras `syncEngine.ts`, `authService.ts` y `webApi.ts` ya incluían dicha cabecera, `notificationService.ts` no la enviaba en las peticiones a `/api/v1/push/vapid-public-key` ni a `/api/v1/push/subscribe`.
   - Como resultado, las peticiones de registro Web Push fallaban silenciosamente al recibir un documento HTML en lugar de JSON, impidiendo que la suscripción de Apple APNs quedara registrada en el backend.

2. **Proceso backend desactualizado en memoria**:
   - El proceso uvicorn en puerto 8000 (PID 43688) había sido iniciado previamente sin el modo `--reload`, por lo que no ejecutaba en memoria las modificaciones del TTL (86400s) ni la ventana de 30 minutos del push worker.

### Cambios Implementados

1. **Cabecera de Bypass en `frontend/services/notificationService.ts`**:
   - Se añadió la cabecera `"ngrok-skip-browser-warning": "true"` tanto en la llamada a `/api/v1/push/vapid-public-key` como en el registro de suscripción `/api/v1/push/subscribe`.
   - Se flexibilizó la condición de plataforma a `(Platform.OS !== "web" && typeof window === "undefined")` para garantizar la compatibilidad tanto en PWA Web, navegadores móviles (iOS Safari / PWA Standalone) y entornos de test Jest.

2. **Test Unitario de Regresión (`frontend/services/notificationService.test.ts`)**:
   - Se añadió el test `"includes ngrok-skip-browser-warning header in subscribeToWebPush fetch calls"` que verifica que ambas llamadas HTTP a VAPID y subscripción incluyen la cabecera requerida.

3. **Reinicio y Actualización del Proceso Backend**:
   - Se terminó el proceso huérfano y se relanzó Uvicorn (`.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`) cargando activamente el nuevo `app/core/vapid.py` y `app/services/push_worker.py`.

### Verificación Automatizada

- **Frontend**: `npm --prefix frontend run check`
  - Prettier: 100% OK
  - ESLint: 0 warnings
  - TypeScript: 0 errores
  - Jest: 37 suites pasadas, 255 tests pasados (100% verde).
- **Backend**: `backend/.venv/Scripts/python.exe scripts/check.py`
  - Ruff format: 67 archivos formateados
  - Ruff check: todos los checks pasados
  - Mypy: 0 errores en 67 archivos
  - Pytest: 117 pasados, 5 omitidos, 0 fallos (100% verde).
