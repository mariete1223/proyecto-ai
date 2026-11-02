---
fingerprint: android-notifications-delivery-failure
status: resolved
github_issue: https://github.com/mariete1223/proyecto-ai/issues/148
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: Las notificaciones no funcionan correctamente en dispositivos Android

## Observed behaviour

Un usuario nuevo en un dispositivo Android probó las notificaciones de la aplicación con la pantalla del móvil apagada y no recibió el aviso ni el sonido.

## Expected behaviour

Al programarse una entrada con recordatorio, el dispositivo debe recibir la notificación y sonido en pantalla de bloqueo incluso con la pantalla apagada, siempre que se hayan otorgado los permisos y la suscripción Web Push esté registrada en el backend.

## Reproduction

1. Acceder a la aplicación desde un dispositivo Android.
2. Iniciar sesión y guardar una entrada con recordatorio.
3. Bloquear el móvil (pantalla apagada).
4. Esperar a la hora del recordatorio: no llega notificación ni suena el aviso.

Frequency: consistente cuando el dispositivo no tiene suscripción Web Push activa o la entrada no tiene `reminder_time` programado.

## Environment

- Client: Web / PWA móvil en Android
- Device or browser: Dispositivo Android con pantalla apagada
- Backend: FastAPI con `push_worker.py` y Web Push VAPID

## Evidence

- Mensaje del usuario: *"un usuario nuevo probo las notifiaciones y no le fueron bien, es de android eso cambia algo? esta implementado, es igual que en iphone?"*
- Aclaración posterior: *"estaba probablemente con la pantalla apagada"*.
- Comprobación en base de datos (`backend/app.db`):
  - Existen 19 suscripciones push en total, pero el 100% corresponden a endpoints de Apple (`https://web.push.apple.com/...`). Hay 0 suscripciones de Google FCM (`https://fcm.googleapis.com/...`).
  - Las cuentas de los nuevos usuarios no tienen ninguna fila en la tabla `push_subscriptions`.
  - Las entradas registradas por el nuevo usuario tienen `reminder_time = NULL` o `reminder_enabled = 0`, por lo que el `push_worker` del servidor no tenía ningún evento que disparar.

## Triage

- Classification: needs-triage
- Impact: high para usuarios Android que bloquean el teléfono sin haber completado la suscripción Web Push o sin hora de recordatorio válida.
- Facts:
  1. Con la pantalla apagada, los temporizadores JavaScript de la página se suspenden por diseño del sistema operativo. La única vía de entrega es Web Push remoto (servidor -> FCM -> Service Worker).
  2. La base de datos del servidor no tiene ninguna suscripción push registrada para terminales Android.
  3. Sin suscripción push en el backend, el worker de recordatorios no puede enviar notificaciones al dispositivo con la pantalla apagada.
  4. Por defecto en Android, recibir un Web Push emite tono/vibración y coloca la notificación en la pantalla de bloqueo, pero NO enciende la pantalla a menos que el usuario tenga activado «Encender pantalla al recibir notificaciones» en los ajustes del sistema.
- Hypotheses:
  1. El usuario no llegó a pulsar «Activar notificaciones» en el modal inicial o lo descartó.
  2. En Android 13+, el permiso del sistema operativo para Chrome (`POST_NOTIFICATIONS`) no fue concedido.
  3. La entrada se creó sin especificar una hora de recordatorio concreta (`reminder_time` nulo).
- Missing information:
  - ¿El usuario llegó a ver y aceptar el cartel de activar notificaciones?
  - ¿Qué hora programó para la alerta y cómo la dictó/escribió?
- Possible duplicates checked: #94, #145, #138.

## Publication history

- 2026-11-02: Borrador local creado en `_docs/defect-drafts/android-notifications-delivery-failure.md`.
- 2026-11-02: Actualizado con hallazgos de DB (0 suscripciones Android registradas) y comportamiento con pantalla apagada.
