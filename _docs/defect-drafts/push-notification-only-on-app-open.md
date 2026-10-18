---
fingerprint: push-notification-only-on-app-open
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/84
first_seen: 2026-10-18
last_seen: 2026-10-18
---

# Defect: La notificación programada no aparece en segundo plano y solo salta al abrir la app

## Observed behaviour

Al cumplirse la hora de un recordatorio configurado en el dispositivo móvil (iPhone), el aviso no despierta la pantalla ni se muestra en la pantalla de bloqueo mientras el teléfono está bloqueado o con la aplicación en segundo plano. La notificación salta únicamente cuando el usuario desbloquea el teléfono y vuelve a entrar en la aplicación.

## Expected behaviour

Al alcanzarse la hora fijada para el recordatorio, el backend debe despachar una notificación Web Push a través de los servidores de Apple (APNs) que ilumine la pantalla de bloqueo y muestre el aviso nativo en el iPhone, incluso con la aplicación cerrada.

## Reproduction

1. En el iPhone, abrir la PWA anclada en la pantalla de inicio.
2. Crear una entrada con recordatorio programado a corto plazo (ej. 1 minuto).
3. Salir de la app o bloquear la pantalla del teléfono.
4. Si la entrada no llega a sincronizarse con el backend o la conexión de red con el servidor local/túnel falla, el worker del backend no despacha el Web Push a Apple APNs.
5. Al cumplirse la hora con el móvil bloqueado, iOS congela los temporizadores JavaScript locales (`setTimeout`).
6. Al desbloquear y abrir la app, el hilo de JavaScript se reanuda y dispara inmediatamente la alerta en primer plano.

Frequency: reproducible cuando el recordatorio no se sincroniza en tiempo real con el servidor o cuando iOS suprime las tiras en la pantalla de bloqueo por modo de concentración.

## Environment

- Client: PWA móvil anclada a pantalla de inicio (Standalone PWA iOS 16.4+)
- Device: iPhone (con modo silencio `🔕` activo en barra de estado)
- Backend: FastAPI en puerto 8000 con `push_worker` y VAPID activo

## Evidence

- Mensaje del usuario: "La abro desde la app anclada al inicio, si aparece conectado al servido, supuestamente tiene las notificaciones pero reviso".
- Prueba directa contra Apple APNs realizada con la suscripción del usuario (`https://web.push.apple.com/...`): `Result: success=True, is_expired=False`.
- Análisis de `backend/app.db`: la entrada creada en el teléfono no llegó a persistirse en la base de datos remota del servidor antes del vencimiento, por lo que el `push_worker` no tuvo constancia del recordatorio para emitirlo en segundo plano.

## Triage

- Classification: confirmed
- Impact: high
- Facts:
  - La suscripción Web Push del usuario con Apple APNs está correctamente registrada en `backend/app.db` y Apple la acepta con `HTTP 201 (success=True)`.
  - La entrega en segundo plano con pantalla bloqueada en iOS requiere obligatoriamente que la entrada esté sincronizada en el backend para que `push_worker.py` invoque `send_web_push_detail()`.
  - Si una entrada con recordatorio se crea localmente y la sincronización con el backend se retrasa o falla (por túnel inactivo o latencia), el backend no puede despachar el push a Apple a la hora prevista.
  - Al abrir la app, `scheduleForEntry()` reanuda el `setTimeout` local en primer plano.
- Missing information:
  - Comprobación del usuario en "Ajustes > VoxDaily > Notificaciones" (verificando que "Pantalla bloqueada" y "Tiras" estén marcadas y que el modo Concentración/No molestar no silencie las alertas de la PWA).

## Publication history

- 2026-10-18: Intake registrado como `needs-triage`.
- 2026-10-18: Clasificado como `confirmed` tras validar la suscripción activa con Apple APNs y aislar la causa raíz en la sincronización inmediata de recordatorios hacia el backend.
