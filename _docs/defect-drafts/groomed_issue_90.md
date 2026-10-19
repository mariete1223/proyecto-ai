# Groomed Task: Issue #90 - Eliminación de notificación duplicada al reabrir la app tras entrega en segundo plano

## Goal

Evitar que se muestre una notificación duplicada (con sonido y alerta visual) en primer plano al abrir o desbloquear la aplicación tras haber recibido la notificación correspondiente en segundo plano vía Web Push o haber vencido el temporizador local durante la suspensión del sistema.

## Acceptance criteria

- [ ] **Descarte de temporizadores locales vencidos por suspensión en segundo plano**:
  - En `NotificationService.ts` (`scheduleForEntry`): Al ejecutarse el callback de `window.setTimeout`, se calcula `Date.now() - targetDate.getTime()`.
  - Si el temporizador se ejecuta con un retardo superior al umbral de tolerancia de primer plano (e.g. `> 5000 ms`), se determina que venció mientras la app estuvo suspendida/en segundo plano (donde el backend `push_worker.py` ya se encargó de la entrega remota).
  - En ese caso, la notificación local NO se envía (`sendNotification` no se invoca, no suena el timbre), se registra la clave en `notifiedEntryIds` y se reprograma la siguiente recurrencia si aplica.
- [ ] **Coherencia de etiquetas de notificación (`tag`)**:
  - En `NotificationService.ts` (`sendNotification`): El método acepta un parámetro opcional `tag?: string`.
  - Cuando se envía desde `scheduleForEntry`, se utiliza la etiqueta `entry-reminder-${entry.id}`, coincidiendo exactamente con la etiqueta enviada por el backend en `push_worker.py`.
  - Esto garantiza que a nivel del sistema operativo y Service Worker, si existiera coincidencia, el centro de notificaciones unifique y colapse la notificación en lugar de apilar alertas duplicadas.
- [ ] **Persistencia y sincronización de avisos ya notificados**:
  - `notifiedEntryIds` se persiste en `localStorage` (bajo la clave `agenda_notified_reminders`) para mantener constancia entre recargas y aperturas de la app.
  - El Service Worker escucha eventos de push y comunica vía `postMessage` a los clientes activos el `tag` y `entryId` notificados para sincronizar de inmediato `notifiedEntryIds`.
- [ ] **Tests y Calidad**:
  - Añadir pruebas unitarias exhaustivas en `frontend/services/notificationService.test.ts` verificando:
    - Un temporizador que dispara a tiempo (`delay <= 5000 ms`) sí envía la notificación.
    - Un temporizador retrasado por suspensión (`delay > 5000 ms`) NO envía la notificación local duplicada.
    - El `tag` enviado coincide con `entry-reminder-${entry.id}`.
    - La persistencia en `localStorage` evita renotificaciones tras reinicio o recarga.
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).
  - Backend `pytest` pasa al 100%.

## Out of scope

- Modificar la frecuencia de escaneo del cron del backend `push_worker.py`.
- Modificar los certificados VAPID.

## Constraints

- Cambios concentrados en `frontend/services/notificationService.ts`, `frontend/public/sw.js`, `backend/app/services/push_worker.py` y tests.
- No alterar dependencias en `package.json` ni `pyproject.toml`.
