# Groomed Task: Issue #93 - Fallo de serialización UUID en push_worker para notificaciones en segundo plano

## Goal

Corregir la serialización del payload en el worker de Web Push (`push_worker.py`) para que todos los identificadores UUID se serialicen como cadena de texto (`str(entry.id)`), y blindar el endpoint `/api/v1/push/subscribe` frente a colisiones por concurrencia, asegurando que las notificaciones en segundo plano se despachen efectivamente hacia los dispositivos cuando la aplicación está cerrada.

## Acceptance criteria

- [ ] **Serialización segura de Web Push Payload**:
  - En `backend/app/services/push_worker.py`, el payload pasado a `send_web_push_detail` debe enviar `"entry_id": str(entry.id)` en lugar de una instancia directa de `uuid.UUID`.
  - En `backend/app/core/vapid.py`, `send_web_push_detail()` debe utilizar `json.dumps(payload, default=str)` como salvaguarda defensiva, previniendo cualquier fallo de serialización si se incluyen tipos especiales en el futuro.
- [ ] **Ejecución limpia del Push Worker en segundo plano**:
  - El bucle periódico de `push_worker` no arroja excepciones de `TypeError: Object of type UUID is not JSON serializable` al encontrar recordatorios vencidos.
  - Las notificaciones se despachan exitosamente a los endpoints suscritos en la tabla `push_subscriptions`.
- [ ] **Robustez ante concurrencia en `/api/v1/push/subscribe`**:
  - En `backend/app/api/v1/push.py`, si se reciben solicitudes simultáneas con el mismo `endpoint` para el mismo usuario, se gestiona la colisión actualizando el registro existente sin emitir un error `500 Internal Server Error`.
- [ ] **Tests y Calidad**:
  - Añadir pruebas de regresión en `backend/tests/test_push_api.py` que verifiquen:
    - Que `check_and_send_due_reminders` procesa entradas con ID de tipo `uuid.UUID` y despacha el payload con `entry_id` como cadena válida sin fallos de serialización.
    - Que solicitudes concurrentes o consecutivas a `/api/v1/push/subscribe` con el mismo endpoint actualizan la suscripción exitosamente con código `200`.
  - `pytest backend/tests` pasa al 100%.
  - `npm --prefix frontend run check` pasa al 100%.

## Out of scope

- Cambios en el cliente de React Native / frontend (el cliente ya maneja Service Worker y suscripción correctamente).
- Alteraciones en el diseño visual de las notificaciones.

## Constraints

- Cambios concentrados en `backend/app/services/push_worker.py`, `backend/app/core/vapid.py`, `backend/app/api/v1/push.py` y `backend/tests/test_push_api.py`.
- No modificar dependencias en `pyproject.toml` ni `package.json`.
