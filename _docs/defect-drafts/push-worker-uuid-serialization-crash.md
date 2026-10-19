---
fingerprint: push-worker-uuid-serialization-crash
status: confirmed
github_issue: 93
first_seen: 2026-10-19
last_seen: 2026-10-19
---

# Defect: Las notificaciones en segundo plano no se envían por fallo de serialización UUID en push_worker

## Observed behaviour

Las notificaciones de recordatorios y alertas únicamente suenan o se muestran cuando la aplicación está en ejecución y en primer plano (manejadas por los temporizadores JavaScript del frontend). Cuando la aplicación está cerrada o en segundo plano, la notificación nunca llega, no despierta la pantalla de bloqueo ni suena la alarma.

## Expected behaviour

Al alcanzarse la fecha y hora de un recordatorio con la aplicación cerrada o en segundo plano, el servicio en segundo plano del backend (`push_worker`) debe despachar correctamente la notificación Web Push a través de los servidores de Apple/Google hacia el dispositivo, mostrando el aviso nativo en pantalla de bloqueo y emitiendo sonido.

## Reproduction

1. Con la aplicación PWA instalada o abierta en el móvil (iPhone/Safari), crear una alerta o recordatorio programado a corto plazo (ej. 1 o 2 minutos en el futuro).
2. Cerrar la aplicación y bloquear la pantalla del teléfono.
3. Esperar a que se cumpla la hora programada.
4. Observar que el móvil no emite ningún sonido ni muestra ninguna notificación en la pantalla de bloqueo.
5. Al abrir la aplicación, el aviso previo nunca llegó ni fue despachado.

Frequency: 100% reproducible

## Environment

- Client: PWA en iPhone / Navegador Web
- Backend: FastAPI en puerto 8000
- Componente afectado: `backend/app/services/push_worker.py`

## Evidence

- Reporte del usuario: *"Vale tema notificaciones, ahora solo funciona cuando la app esta en ejecucion, sino no suena ni aparece nunca"*.
- Logs en tiempo real del proceso del backend (`task-14643`):
  ```
  Error en el ciclo del worker de Web Push: Object of type UUID is not JSON serializable
  ```
  El error se repite en cada ciclo de 30 segundos en el backend cuando hay recordatorios vencidos o por enviar.
- Código fuente en `backend/app/services/push_worker.py:128-137`:
  ```python
  success, is_expired = send_web_push_detail(
      sub_info,
      {
          "title": notif_title,
          "body": notif_body,
          "tag": f"entry-reminder-{entry.id}",
          "entry_id": entry.id,  # <-- entry.id es un objeto uuid.UUID, no serializable por json.dumps()
          "url": "/",
      },
  )
  ```
  Al invocar `send_web_push_detail()`, `json.dumps(payload)` arroja `TypeError: Object of type UUID is not JSON serializable`, abortando inmediatamente el envío de la notificación Web Push antes de contactar con el servicio APNs/FCM.
- Adicionalmente en `backend/app/api/v1/push.py:75-102`, llamadas concurrentes a `subscribe` pueden generar colisión de unicidad `UNIQUE constraint failed: push_subscriptions.user_id, push_subscriptions.endpoint`.

## Triage

- Classification: confirmed
- Impact: Alto (Los avisos y alertas con la aplicación cerrada quedan completamente inoperativos; solo funcionan avisos en primer plano mediante el timer de React).
- Facts:
  - En `push_worker.py`, `entry.id` es de tipo `uuid.UUID` (mapeado por SQLAlchemy).
  - `send_web_push_detail` serializa el payload a JSON usando `json.dumps`, que rechaza instancias `UUID` sin un serializador personalizado o conversión previa a `str(entry.id)`.
  - La excepción es atrapada por el bloque `except Exception as exc` del ciclo del worker, impidiendo que el push sea enviado a cualquier dispositivo suscrito.
- Hypotheses: Convertir `str(entry.id)` al armar el payload de Web Push o utilizar un serializador JSON que contemple UUIDs, y proteger la inserción de suscripciones push con `upsert` o manejo de `IntegrityError`.
- Missing information: ninguna. Causa raíz comprobada empíricamente en logs y código.
- Duplicates checked: Issue #84 (trató expiración de tokens y TTL en ngrok) e Issue #90 (trató notificaciones duplicadas en reanudación). Este es un defecto nuevo derivado del campo `entry_id` agregado recientemente al payload.

## Publication history

- 2026-10-19: Intake registrado como `confirmed` en la recámara de defectos.
