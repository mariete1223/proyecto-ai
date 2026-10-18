---
fingerprint: notifications-alert-did-not-ring
status: needs-triage
github_issue: null
first_seen: 2026-10-18
last_seen: 2026-10-18
---

# Defect: Alerta programada a las 18:30 no suena en segundo plano ni al abrir la app

## Observed behaviour

Se configuró una entrada en la categoría "Alerta" para las 18:30. Al llegar la hora, la alerta no sonó en el dispositivo móvil ni se mostró notificación. Al abrir la aplicación poco después de las 18:30 tampoco sonó ningún timbre ni aviso.

## Expected behaviour

Al llegar la hora establecida (18:30), el dispositivo debe emitir el timbre sonoro y mostrar la notificación (en segundo plano vía Web Push si está cerrado/bloqueado, o notificación local si la app está en primer plano). Si la app se abre después de la hora habiendo una alerta pendiente no atendida, debe alertarse al usuario.

## Reproduction

1. Crear una entrada de tipo "Alerta" programada para una hora determinada (ej. 18:30).
2. Dejar el dispositivo móvil bloqueado o con la aplicación cerrada.
3. Esperar a la hora programada (18:30).
4. Observar que no suena ni vibra la alerta.
5. Abrir la aplicación y verificar que tampoco suena ningún timbre ni aviso.

Frequency: unknown (reportado por el usuario en primera prueba a las 18:30)

## Environment

- Client: Web / PWA móvil
- Device or browser: iPhone Safari / iOS PWA (subscripción push activa registrada en backend con user_agent `Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15`)
- Backend or build: Producción / local backend con push_worker activo; entrada persistida en DB (`id: 316b192a-a25a-4761-a659-08677fa3ba6c`, `occurred_at: 2026-10-18 16:30:00 UTC`, `reminder_enabled: 0`, `updated_at: 2026-10-18 16:29:35 UTC`).

## Evidence

- Mensaje del usuario: "he puesto una alerta a las 18:30 y no ha sonado, ni siquiera abriendo la app, no se si es problema de las alertas ahora probare notificacions puestas por mi"
- Inspección de BD: La entrada `316b192a-a25a-4761-a659-08677fa3ba6c` ("tengo que ir a comprar choco Flex") fue procesada por el worker de push a las 16:29:35 UTC (18:29:35 CEST, dentro de la ventana de 30s de antelación), se envió llamada a `web.push.apple.com` y se puso `reminder_enabled = False`.
- Inspección de código: En `frontend/services/notificationService.ts`, cuando la app se abre y `diffMs <= 0` (o `reminder_enabled == false`), se descarta la notificación local para evitar duplicados con el push de fondo, por lo que no suena nada al abrir la app.

## Triage

- Classification: needs-triage
- Impact: high (el usuario depende de los avisos y alertas para recordar tareas a horas exactas)
- Facts:
  - La entrada de categoría "Alerta" se creó correctamente con fecha/hora 16:30:00 UTC (18:30 hora local).
  - El backend `push_worker` evaluó la entrada a las 16:29:35 UTC (18:29:35) y envió la solicitud Web Push a los endpoints de Apple APNs (`web.push.apple.com`), devolviendo éxito HTTP hacia Apple, y puso `reminder_enabled = False` en base de datos.
  - Al abrir la app a las 18:30+, `notificationService` no emite ningún sonido ni notificación en primer plano porque `diffMs <= 0` y `reminder_enabled` ya fue desactivado en backend.
- Hypotheses:
  - En iOS, Web Push en segundo plano requiere estrictamente que la aplicación esté instalada como PWA en la Pantalla de Inicio (Add to Home Screen) y con permisos concedidos explícitamente en el perfil PWA independiente; si se abrió desde Safari normal, iOS bloquea la recepción en background.
  - El dispositivo podría estar en modo silencio, no molestar o concentración, lo que suprime el sonido en iOS.
  - Si la entrega en segundo plano por parte de APNs falla o se retrasa, el frontend al abrirse no tiene un mecanismo de rescate ("missed alert") porque asume que Web Push ya lo entregó.
- Missing information:
  - ¿La prueba se realizó desde la app anclada en la pantalla de inicio (PWA) o desde la ventana del navegador Safari?
  - ¿Están concedidos los permisos de notificaciones para VoxDaily en los ajustes del teléfono (Ajustes > Notificaciones)?
  - ¿Estaba el teléfono en modo silencio, vibración o con algún modo de concentración (No molestar)?
  - ¿Qué ocurrió con la prueba posterior de notificaciones manuales que el usuario iba a realizar?
- Possible duplicates checked:
  - Issue #60: Web Push PWA support (Closed)
  - Issue #61: Scheduled notifications background (Closed)
  - Issue #62: iOS lock screen push notifications (Closed)
  - Issue #70: Canonical category 'Alerta' (Closed)

## Publication history

- 2026-10-18: Intake registrado como borrador local `needs-triage` a la espera de confirmación del entorno móvil y pruebas de notificaciones manuales del usuario.
