---
fingerprint: push-notification-failing-when-app-closed
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/94
first_seen: 2026-10-19
last_seen: 2026-10-19
---

# Defect: Las notificaciones Web Push siguen sin entregarse o sonar con la app cerrada en iOS

## Observed behaviour

Las notificaciones y alarmas funcionan y suenan correctamente cuando la aplicación está abierta y en primer plano en el dispositivo móvil (iPhone), pero no se muestran en la pantalla de bloqueo ni suena la alarma cuando la aplicación está completamente cerrada o el dispositivo bloqueado.

## Expected behaviour

Al cumplirse la hora de una entrada o alerta configurada, el dispositivo debe recibir la notificación push en segundo plano a través de los servidores de Apple (APNs), iluminar la pantalla de bloqueo y sonar incluso cuando la app PWA está completamente cerrada.

## Reproduction

1. En el iPhone (PWA Standalone), acceder con la sesión activa.
2. Crear una alerta o entrada con recordatorio programado a corto plazo (ej. a 2 minutos).
3. Cerrar por completo la aplicación (swipe up) o bloquear la pantalla del teléfono.
4. Esperar a que se cumpla la hora programada.
5. Observar que no aparece la notificación en la pantalla de bloqueo ni suena el aviso mientras está cerrada (aunque si se reabre la app, el temporizador local o en primer plano sí se activa).

Frequency: 100% reproducible al cerrar la aplicación inmediatamente tras guardar una entrada con recordatorio.

## Environment

- Dispositivo: iPhone (iOS 16.4+ / iOS 17 / iOS 18)
- Cliente: Standalone PWA instalada en pantalla de inicio
- Conexión: Túnel ngrok (`https://raging-degraded-reptile.ngrok-free.dev`)
- Backend: FastAPI en puerto 8000 con `push_worker.py` y VAPID activo

## Evidence

- Mensaje del usuario: "las notificaciones con la app abierta me van, sigue fallando cuando esta cerrada".
- Confirmación adicional del usuario: "El test del web push si funciona porque me esta llegando". Esto confirma que la infraestructura de Web Push hacia Apple APNs y el Service Worker en iOS funcionan perfectamente y pueden despertar el teléfono y la pantalla de bloqueo.
- Base de datos `backend/app.db`: `SELECT id, title, reminder_enabled, reminder_time FROM entries WHERE reminder_enabled = 1` devuelve lista vacía `[]`.
- Las entradas creadas en la PWA se guardan en el almacenamiento local, pero la sincronización HTTP (`POST /api/v1/sync/push`) se lanza de forma asíncrona desasociada al guardar. Al cerrar la app de inmediato, iOS suspende la ejecución JavaScript de WebKit antes de que la entrada sea persistida en `backend/app.db`, impidiendo que `push_worker.py` la detecte para despacharla a APNs.
- Adicionalmente, en `EntryForm.tsx:161`, la condición `if (reminderEnabled)` omite `notificationService.scheduleForEntry` si la categoría es Alerta pero el estado local booleano `reminderEnabled` no fue conmutado explícitamente.

## Triage

- Classification: confirmed
- Impact: high
- Facts:
  1. `send_web_push_detail` contra la suscripción de Apple APNs registrada responde `success=True`.
  2. En primer plano las notificaciones locales se disparan correctamente.
  3. En segundo plano / app cerrada, `backend/app.db` no contiene entradas con `reminder_enabled = 1`, por lo que `push_worker.py` no tiene recordatorios pendientes que enviar.
- Hypotheses: La sincronización no se espera (await) antes de cerrar o dar por completado el guardado en el cliente; y en iOS, Web Push en SW requiere opciones de sonido para emitir tono en bloqueo.
- Missing information: ninguna.
- Possible duplicates checked: Issue #84 (ngrok block), Issue #90 (duplicate on resume), Issue #93 (UUID worker crash).

## Publication history

- 2026-10-19: Intake registrado y publicado en GitHub como Issue #94.
