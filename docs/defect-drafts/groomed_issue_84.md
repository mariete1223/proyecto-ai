## Goal

Garantizar que las notificaciones de recordatorios y alertas se sincronicen de inmediato con el backend al crearse o modificarse en la aplicación (móvil PWA y web), y que el backend despache las alertas Web Push a Apple APNs con un TTL y una ventana de vigencia adecuados para despertar la pantalla de bloqueo en dispositivos iOS / móviles en segundo plano.

## Acceptance criteria

- [ ] Al crear o modificar una entrada con `reminder_enabled = true` (vía captura de voz, formulario manual o calendario rápido), los cambios locales se sincronizan inmediatamente con el backend sin depender de una acción manual del usuario.
- [ ] En `frontend/App.tsx`, `syncSilentlyInBackground` incluye `userToken` en sus dependencias de `useCallback` para evitar enviar peticiones de sincronización con tokens demo o desactualizados.
- [ ] En `frontend/services/notificationService.ts`, al programar o actualizar un recordatorio, se asegura que el estado de suscripción Web Push esté sincronizado con el backend si los permisos de notificación están concedidos.
- [ ] En `backend/app/core/vapid.py`, el `ttl` en la llamada a `webpush()` se configura en 86400 segundos (24 horas) para evitar que Apple APNs descarte los avisos cuando el dispositivo móvil esté en reposo o pantalla bloqueada.
- [ ] En `backend/app/services/push_worker.py`, la ventana de tolerancia hacia el pasado para procesar recordatorios pendientes (`window_past`) se amplía de 5 minutos a 30 minutos para absorber la latencia de sincronización tras la salida del reposo.
- [ ] En `backend/app/services/push_worker.py`, las entradas con recordatorio cuyo tiempo de aviso ya haya expirado por completo y no sean recurrentes se marcan con `reminder_enabled = False`, evitando que permanezcan como activas indefinidamente en la base de datos.
- [ ] La suite completa de tests de frontend (`npm --prefix frontend run check`) y backend (`pytest`) pasa al 100% con tests de regresión que cubren el nuevo TTL y la sincronización de recordatorios.

## Out of scope

- [ ] Rediseño de los controles de selección de hora y antelación en el calendario o detalle (resuelto previamente en #72 y #76).
- [ ] Notificaciones en navegadores legacy sin soporte nativo de Web Push / Service Workers (cubierto por degradación graciosa).

## Constraints

- Cambios limitados a `frontend/App.tsx`, `frontend/services/notificationService.ts`, `frontend/components/CalendarMonthView.tsx`, `backend/app/core/vapid.py`, `backend/app/services/push_worker.py` y archivos de test asociados.
- No modificar dependencias en `pyproject.toml` ni `package.json`.
- Mantener compatibilidad total con iOS 16.4+ Web Push PWA y con las suscripciones push existentes en la base de datos.
