## QA: PASS

- [x] Al crear o modificar una entrada con `reminder_enabled = true` (vía captura de voz, formulario manual o calendario rápido), los cambios locales se sincronizan inmediatamente con el backend sin depender de una acción manual del usuario - PASS
      Verificado el flujo de llamadas a `syncSilentlyInBackground` y `loadDatabaseState(true)` al crear o modificar entradas con recordatorio en `CalendarMonthView`, `EntryDetailView`, `VoiceCaptureFlow` y `EntryForm`.
- [x] En `frontend/App.tsx`, `syncSilentlyInBackground` incluye `userToken` en sus dependencias de `useCallback` para evitar enviar peticiones de sincronización con tokens demo o desactualizados - PASS
      Inspeccionado `frontend/App.tsx`: `useCallback` incluye `[db, userId, userToken, authSession]` y refresca activamente `notificationService.setAuth`.
- [x] En `frontend/services/notificationService.ts`, al programar o actualizar un recordatorio, se asegura que el estado de suscripción Web Push esté sincronizado con el backend si los permisos de notificación están concedidos - PASS
      Comprobado en `notificationService.ts` y verificado mediante test unitario automatizado `triggers subscribeToWebPush when scheduling an enabled reminder if permission is granted`.
- [x] En `backend/app/core/vapid.py`, el `ttl` en la llamada a `webpush()` se configura en 86400 segundos (24 horas) para evitar que Apple APNs descarte los avisos cuando el dispositivo móvil esté en reposo o pantalla bloqueada - PASS
      Comprobado parámetro `ttl: int = 86400` en `send_web_push_detail()` y validado mediante aserción en `test_send_web_push_key_and_claims`.
- [x] En `backend/app/services/push_worker.py`, la ventana de tolerancia hacia el pasado para procesar recordatorios pendientes (`window_past`) se amplía de 5 minutos a 30 minutos para absorber la latencia de sincronización tras la salida del reposo - PASS
      Comprobado `window_past = now - timedelta(minutes=30)` y verificado con test unitario de entrega a los 15 minutos en `test_push_worker_window_past_and_expiration`.
- [x] En `backend/app/services/push_worker.py`, las entradas con recordatorio cuyo tiempo de aviso ya haya expirado por completo y no sean recurrentes se marcan con `reminder_enabled = False`, evitando que permanezcan como activas indefinidamente en la base de datos - PASS
      Comprobado bloque de saneamiento para `trigger_dt < window_past` y verificado que entradas con más de 30 min se desactivan limpiamente incrementando versión.
- [x] La suite completa de tests de frontend (`npm --prefix frontend run check`) y backend (`pytest`) pasa al 100% con tests de regresión que cubren el nuevo TTL y la sincronización de recordatorios - PASS
      Tests ejecutados:
      - Backend: `.venv/Scripts/python.exe -m pytest`, 117 passed, 5 skipped, 0 failed.
      - Frontend: `npm --prefix frontend run check` (prettier, eslint, typecheck, jest), 37 suites pasadas, 254 tests pasados, 0 fallos.

Verdict: PASS
