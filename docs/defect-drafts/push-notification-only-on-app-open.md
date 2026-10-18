---
fingerprint: push-notification-only-on-app-open
status: closed
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

1. En el iPhone, abrir la PWA anclada en la pantalla de inicio conectada a través del túnel ngrok (`https://raging-degraded-reptile.ngrok-free.dev`).
2. Crear una entrada con recordatorio programado a corto plazo (ej. 1 minuto).
3. Salir de la app o bloquear la pantalla del teléfono.
4. Las llamadas de sincronización (`/api/v1/sync/push` y `/api/v1/push/*`) son interceptadas por la página de advertencia de ngrok (`ERR_NGROK_6024`), impidiendo que el backend reciba la entrada.
5. Al cumplirse la hora con el móvil bloqueado, iOS congela los temporizadores JavaScript locales (`setTimeout`).
6. Al desbloquear y abrir la app, el hilo de JavaScript se reanuda y dispara inmediatamente la alerta en primer plano.

Frequency: 100% reproducible cuando la app móvil se conecta vía túnel ngrok sin cabecera de bypass.

## Environment

- Client: PWA móvil anclada a pantalla de inicio (Standalone PWA iOS 16.4+)
- Device: iPhone
- Tunnel: ngrok (`https://raging-degraded-reptile.ngrok-free.dev`)
- Backend: FastAPI en puerto 8000 con `push_worker` y VAPID activo

## Evidence

- Mensaje del usuario: "Pasa lo mismo solo cuando abro la app".
- Prueba con User-Agent de iPhone Safari contra `https://raging-degraded-reptile.ngrok-free.dev/api/v1/push/vapid-public-key`:
  `HTTP 200 text/plain: You are about to visit raging-degraded-reptile.ngrok-free.dev ... ERR_NGROK_6024`.
  Al no enviar la cabecera `ngrok-skip-browser-warning: true`, ngrok no entrega la petición a FastAPI y devuelve texto de advertencia, provocando que `fetch().json()` falle en la PWA móvil y no se sincronice nada.
- Prueba con cabecera `ngrok-skip-browser-warning: true`:
  `HTTP 200 application/json: {"public_key": "..."}`.
- Proceso local uvicorn (PID 43688): iniciado el 15/10/2026 sin `--reload`, por lo que ejecutaba el código de push worker previo a las mejoras de TTL y ventana de 30 minutos.

## Triage

- Classification: confirmed
- Impact: high
- Facts:
  - El túnel gratuito de ngrok intercepta las peticiones procedentes de navegadores y devuelve una página intermedia HTML (`ERR_NGROK_6024`) a menos que las peticiones HTTP del cliente incluyan la cabecera `ngrok-skip-browser-warning: true`.
  - Debido a este bloqueo, la PWA en el iPhone opera en modo desconectado (offline en SQLite local), sin poder subir las entradas ni renovar la suscripción Web Push en el servidor.
  - El servidor local uvicorn debe reiniciarse para ejecutar el nuevo código de `push_worker.py` y `vapid.py`.
- Missing information: ninguna. Causa raíz demostrada empíricamente.

## Publication history

- 2026-10-18: Intake registrado como `needs-triage`.
- 2026-10-18: Clasificado como `confirmed` tras validar la suscripción activa con Apple APNs.
- 2026-10-18: Reabierto y actualizado tras identificar la intercepción por `ERR_NGROK_6024` de ngrok en dispositivos móviles y el proceso backend desactualizado.
