## Software Engineer Report - Issue #84

### Cambios Implementados

1. **Configuración de TTL Web Push en el Backend (`backend/app/core/vapid.py`)**:
   - Se configuró el parámetro `ttl=86400` (24 horas) por defecto en `send_web_push_detail()`.
   - Esto evita que los servidores de Apple (APNs) descarten el paquete Web Push si el iPhone o dispositivo móvil tarda más de 60 segundos en negociar la radio en reposo o modo de bajo consumo.

2. **Ventana de Entrega y Expiración en Push Worker (`backend/app/services/push_worker.py`)**:
   - Se amplió la ventana retrospectiva `window_past` de 5 minutos a 30 minutos (`now - timedelta(minutes=30)`), permitiendo procesar recordatorios cuya sincronización local haya tenido ligera demora.
   - Para recordatorios cuyo tiempo haya vencido completamente (más de 30 minutos en el pasado), se desactiva `reminder_enabled = False` (o se avanza al siguiente ciclo si es recurrente), impidiendo que consultas periódicas continúen procesando recordatorios caducados eternamente.

3. **Sincronización Inmediata con Token Actualizado (`frontend/App.tsx`)**:
   - Se agregaron `userToken` y `authSession` a la lista de dependencias del `useCallback` de `syncSilentlyInBackground`. Esto evita que las sincronizaciones automáticas enviadas tras crear o editar recordatorios fallen con errores 401 debido a tokens de demostración obsoletos.
   - Se actualiza activamente la sesión en `notificationService.setAuth(baseUrl, token)` antes de sincronizar.

4. **Garantía de Suscripción Web Push en Frontend (`frontend/services/notificationService.ts`)**:
   - En `scheduleForEntry()`, al programar cualquier entrada con `reminder_enabled = true`, se verifica si los permisos están concedidos (`granted`) y se asegura la sincronización de la suscripción Web Push hacia el backend vía `subscribeToWebPush()`.

5. **Cobertura de Tests de Regresión**:
   - `backend/tests/test_push_api.py`: Validado el valor `ttl=86400` y añadido `test_push_worker_window_past_and_expiration`.
   - `frontend/services/notificationService.test.ts`: Añadido test para verificar la invocación de `subscribeToWebPush` al programar recordatorios.
   - Verificación ejecutada: Backend (117 tests pasando al 100%), Frontend (37 suites, 254 tests pasando al 100%).
