---
fingerprint: push-notification-duplicate-on-app-open
status: confirmed
github_issue: https://github.com/mariete1223/proyecto-ai/issues/90
first_seen: 2026-10-19
last_seen: 2026-10-19
---

# Defect: Notificación duplicada al abrir la app tras haber sido entregada en segundo plano

## Observed behaviour

Al cumplirse la hora de un recordatorio con la aplicación cerrada o en segundo plano, la notificación remota Web Push llega correctamente al teléfono y despierta la pantalla. Sin embargo, al desbloquear el teléfono y entrar a la aplicación, se vuelve a disparar y enviar la misma notificación por segunda vez.

## Expected behaviour

Cada recordatorio debe notificarse exactamente una sola vez. Si el aviso ya fue entregado en segundo plano vía Web Push o el tiempo del temporizador local transcurrió mientras la app estuvo suspendida, no debe enviarse una segunda notificación local al reabrir la aplicación.

## Reproduction

1. En el dispositivo (móvil / iPhone PWA), crear una entrada con recordatorio programado a corto plazo (ej. 1-2 minutos).
2. Salir de la aplicación a la pantalla de inicio o bloquear el teléfono.
3. El frontend mantiene un temporizador local (`window.setTimeout`) programado para ese recordatorio, el cual es congelado por el sistema operativo al suspender la PWA en segundo plano.
4. Al vencer la hora, el backend (`push_worker.py`) despacha la notificación remota Web Push (APNs / VAPID), mostrándose en la pantalla de bloqueo.
5. El usuario desbloquea el teléfono y pulsa o abre la aplicación.
6. El motor JavaScript de la app se reanuda e inmediatamente dispara el `setTimeout` local atrasado, invocando `sendNotification()` y mostrando una notificación duplicada en pantalla.

Frequency: 100% reproducible cuando un recordatorio programado vence mientras la app se encuentra en segundo plano o con el teléfono bloqueado.

## Environment

- Client: PWA Móvil Standalone (iOS 16.4+ / Android) y Web
- Device: iPhone / Navegadores móviles
- Backend: FastAPI con `push_worker.py` y Web Push VAPID activo
- Frontend: `notificationService.ts` con Service Worker registrado

## Evidence

- Reporte del usuario: *"Las notificaciones funcionan ahora, lo unico que me ha ocurrido que se han duplicado, me da una notificacion cuando estoy fuera de la app, y cuando entro a la app me la envia de nuevo"*.

## Triage

- Classification: confirmed
- Impact: medium
- Facts:
  - En `notificationService.ts` (`scheduleForEntry`), si `diffMs > 0`, se registra un `window.setTimeout` para disparar `sendNotification()`.
  - Cuando el dispositivo móvil bloquea la pantalla o suspende la aplicación web, los temporizadores JavaScript se pausan y no corren en tiempo real.
  - La entrega en segundo plano se produce con éxito mediante Web Push (`push_worker.py`), mostrando el aviso en el centro de notificaciones nativo con `tag: entry-reminder-{id}`.
  - Al abrir de nuevo la aplicación, WebKit/Blink despierta los timers JavaScript pendientes cuyo tiempo ya expiró y ejecuta de inmediato el callback de `setTimeout`, llamando a `sendNotification()` y generando la segunda alerta.
  - El registro en memoria `notifiedEntryIds` solo se actualiza cuando el timer local dispara, por lo que no tiene constancia de que la notificación remota ya fue entregada por el Service Worker.
- Hypotheses:
  - Cuando el callback de `window.setTimeout` se ejecuta, si `Date.now() - targetDate.getTime() > 10000` (es decir, el temporizador venció sustancialmente mientras la aplicación estaba suspendida en segundo plano y el backend ya envió el push remoto), debe descartarse la emisión local.
  - El Service Worker al recibir el evento `push` puede comunicarse con las ventanas del cliente o registrar en almacenamiento local (`localStorage`/`IndexedDB`) que el recordatorio ya fue mostrado, sincronizando `notifiedEntryIds`.
  - Asegurar que el `tag` de notificación local (`sendNotification`) coincida con el `tag` de Web Push (`entry-reminder-${entry.id}`) en lugar de un tag genérico, evitando avisos apilados redundantes en el centro de notificaciones.
- Missing information: ninguna.
- Possible duplicates checked:
  - Issue #62: Cerrada; abordó la lógica para `diffMs <= 0` al inicializar la app con recordatorios pasados, pero no prevenía el disparo de temporizadores locales previamente programados que se congelaron en segundo plano durante el vencimiento.

## Publication history

- 2026-10-19: Publicado como Issue #90 en GitHub (https://github.com/mariete1223/proyecto-ai/issues/90).
