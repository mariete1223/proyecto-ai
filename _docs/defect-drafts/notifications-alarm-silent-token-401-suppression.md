---
fingerprint: notifications-alarm-silent-token-401-suppression
status: closed
github_issue: https://github.com/mariete1223/proyecto-ai/issues/145
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: Las alertas no suenan ni se notifican cuando el token expira (HTTP 401) debido a falsa asunción de Web Push remoto

## Observed behaviour

El usuario configuró varias entradas con alertas (ej. «limpiar el ordenador de hoy a las 9:45», «preguntar a luis lo de gemini», «anillo») y ninguna emitió sonido ni notificación en el dispositivo, ni dentro ni fuera de la aplicación.

## Expected behaviour

Las alertas programadas deben sonar y mostrar su notificación. Si el dispositivo no tiene una suscripción Web Push confirmada y registrada en el servidor (o el token de sesión ha expirado y devuelve HTTP 401), la aplicación jamás debe descartar silenciosamente la alerta sonora local asumiendo que el servidor ya la entregó.

## Reproduction

1. Iniciar sesión en la aplicación móvil PWA.
2. Dejar transcurrir el tiempo de validez del token JWT (o provocar que el token devuelva HTTP 401 en las llamadas al backend).
3. Crear una entrada con alerta para una hora determinada.
4. Observar que el backend rechaza la sincronización (`/api/v1/sync/push` -> 401) y la suscripción push (`/api/v1/push/subscribe` -> 401). La entrada queda atrapada en el almacenamiento local SQLite/IndexedDB del móvil y el servidor no tiene suscripciones push activas para el usuario.
5. Al cumplirse la hora o reabrir la aplicación con retraso (> 5 segundos tras la hora del evento), la función `canRelyOnRemotePush()` devuelve `true` únicamente porque `lastToken` y `lastApiBaseUrl` no son nulos y el móvil tiene conexión a internet.
6. El callback de `scheduleForEntry` descarta la notificación y el sonido local creyendo erróneamente que el servidor ya envió un Web Push.
7. Resultado: La alerta nunca suena ni en segundo plano ni al abrir la aplicación.

## Environment

- Cliente: Móvil Web / PWA (iPhone iOS Safari / PWA pantalla de inicio)
- Backend: FastAPI / Uvicorn (puerto 8000) a través de túnel ngrok
- Base de datos: SQLite dev (`backend/app.db`)

## Evidence

- Logs en tiempo real del backend (`task-8321.log`): Múltiples peticiones concurrentes `POST /api/v1/sync/push HTTP/1.1 401 Unauthorized` y `POST /api/v1/push/subscribe HTTP/1.1 401 Unauthorized` desde la IP del teléfono (`217.130.58.41`).
- Base de datos del backend: La tabla `push_subscriptions` contiene 0 suscripciones para el usuario activo, y las entradas creadas hoy («limpiar el ordenador», «preguntar a luis») no existen en el servidor debido al rechazo por 401.
- Análisis de `notificationService.ts` (líneas 130-138 y 569-583): `canRelyOnRemotePush()` asume ciegamente que el push remoto funciona sin verificar si el push fue suscrito exitosamente o si el token es válido, y suprime el timbre sonoro.

## Triage inicial

- Clasificación: confirmed
- Impacto: high (las alertas quedan totalmente mudas si la sesión de usuario expiró o se desincronizó del backend).
- Huella de deduplicación: `notifications-alarm-silent-token-401-suppression`

## Duplicados comprobados

- Issue #138 (Cerrado): abordó la pérdida de alertas en offline básico, pero introdujo `canRelyOnRemotePush()` basado en variables de memoria en lugar de confirmación de entrega o estado de suscripción.
- Issue #84 (Cerrado): túnel ngrok.
