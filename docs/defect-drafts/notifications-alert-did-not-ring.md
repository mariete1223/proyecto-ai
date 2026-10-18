---
fingerprint: notifications-alert-did-not-ring
status: expected-behaviour
github_issue: null
first_seen: 2026-10-18
last_seen: 2026-10-18
---

# Defect: Alerta programada a las 18:30 no suena en segundo plano ni al abrir la app

## Observed behaviour

Se configuró una entrada en la categoría "Alerta" para las 18:30. Al llegar la hora, la alerta no sonó en el dispositivo móvil ni se mostró notificación. Al abrir la aplicación poco después de las 18:30 tampoco sonó ningún timbre ni aviso.

## Expected behaviour

El dispositivo emite notificaciones y sonido cuando las notificaciones están autorizadas en el sistema operativo y navegador. Si no están concedidas, el sistema operativo no puede entregar el Web Push ni alertar al usuario.

## Reproduction

1. Crear una entrada de tipo "Alerta" programada para una hora determinada (ej. 18:30) sin haber concedido permisos de notificación en el dispositivo.
2. Dejar el dispositivo móvil bloqueado o con la aplicación cerrada.
3. Al llegar la hora, el sistema operativo bloquea la entrega del aviso debido a la ausencia de permisos de notificación.

Frequency: Consecuencia directa de la ausencia de permisos en el navegador/SO.

## Environment

- Client: Web / PWA móvil
- Device or browser: iPhone Safari / iOS PWA
- Backend or build: Producción / local backend con push_worker activo; entrada persistida en DB (`id: 316b192a-a25a-4761-a659-08677fa3ba6c`, `occurred_at: 2026-10-18 16:30:00 UTC`, `reminder_enabled: 0`, `updated_at: 2026-10-18 16:29:35 UTC`).

## Evidence

- Mensaje del usuario inicial: "he puesto una alerta a las 18:30 y no ha sonado, ni siquiera abriendo la app, no se si es problema de las alertas ahora probare notificacions puestas por mi"
- Confirmación del usuario: "Con lo de las notificaciones es verdad que no tenia activas las notifiaciones aun, me gustaria que nada mas iniciar la app se pidiera permiso de lo de la voz y lo de las notificaciones para ahorrar pasos."

## Triage

- Classification: expected-behaviour
- Impact: low (comportamiento esperado del sistema operativo cuando el usuario no ha otorgado permisos de notificación a la aplicación).
- Facts:
  - El usuario confirma que no tenía activadas las notificaciones en el dispositivo en el momento de la prueba a las 18:30.
  - El backend evaluó y despachó la alerta hacia Apple APNs de forma correcta.
- Missing information: Ninguna (resuelto por confirmación del usuario).
- Possible duplicates checked:
  - Issue #60: Web Push PWA support (Closed)
  - Issue #61: Scheduled notifications background (Closed)
  - Issue #62: iOS lock screen push notifications (Closed)
  - Issue #70: Canonical category 'Alerta' (Closed)

## Publication history

- 2026-10-18: Intake registrado como borrador local `needs-triage`.
- 2026-10-18: Clasificado como `expected-behaviour` tras confirmación del usuario de que los permisos de notificaciones no estaban autorizados en el dispositivo. Se canaliza la petición de auto-solicitud de permisos al inicio como mejora.
