---
fingerprint: render-backend-alerts-silent-push-suppression
status: resolved
github_issue: https://github.com/mariete1223/proyecto-ai/issues/155
first_seen: 2026-11-05
last_seen: 2026-11-05
resolved_at: 2026-11-05
resolution: Eliminada la supresión local especulativa basada en canRelyOnRemotePush() en notificationService.ts. La alarma local suena (playChimeSound) y se notifica puntualmente dentro de una ventana de 2 horas a menos que conste confirmación fehaciente (PUSH_DELIVERED) en notifiedEntryIds. Añadido disparo de alertas vencidas recientes en scheduleForEntry y asegurada la activación y persistencia incondicional de recordatorios (reminder_enabled=true, offset=0) para toda entrada de categoría canónica «Alerta» en entries.ts. Verificado con QA PASS y suite completa de tests de regresión.
---

# Defect: Las alertas no suenan ni se notifican con el backend desplegado en Render

## Observed behaviour

Al crear y programar entradas de tipo "Alerta" o recordatorios vinculados al backend de producción en Render (`https://proyecto-ai-api-oi2n.onrender.com`), las alertas no emiten sonido ni muestran notificación en el dispositivo móvil ni en el navegador cuando llega la hora fijada.

## Expected behaviour

Toda alerta o recordatorio programado debe sonar y presentar su notificación correspondiente puntualmente:
1. Si el backend en la nube no despachó un Web Push (por ejemplo, porque el contenedor de Render estaba en reposo tras 15 minutos de inactividad o falló la entrega remota), el cliente frontend jamás debe silenciar ni descartar la alarma local.
2. Toda entrada perteneciente a la categoría canónica "Alerta" debe programarse con su alarma activa por defecto y disparar el aviso sonoro y visual tanto en primer plano como al reanudar la app tras suspensión.

## Reproduction

1. Iniciar sesión en la aplicación conectada a `https://proyecto-ai-api-oi2n.onrender.com`.
2. Crear una entrada en la categoría "Alerta" o con recordatorio a corto plazo (ej. 5 minutos).
3. Bloquear el dispositivo móvil o cambiar de pestaña.
4. Render entra en reposo tras 15 minutos (o no tiene worker activo mientras duerme).
5. El temporizador local de JavaScript se ejecuta con retraso (`elapsedLateMs > 5000ms`) al reanudar el hilo.
6. En `frontend/services/notificationService.ts` (línea 635):
   `canRelyOnRemotePush()` devuelve `true` simplemente porque el dispositivo tiene conexión y hay un token guardado.
7. El código asume erróneamente que el servidor ya envió el Web Push y ejecuta `return;`, descartando la notificación y silenciando el timbre por completo.

Frequency: 100% reproducible cuando el backend está en reposo o el dispositivo sale de segundo plano tras la hora programada.

## Environment

- Client: Web / PWA móvil (iOS Safari Standalone / Android Chrome)
- Backend: FastAPI en Render (`https://proyecto-ai-api-oi2n.onrender.com`)
- Push Service: Web Push con worker en `lifespan`

## Evidence

- Mensaje del usuario: "luego las alertas con este backend no estan funcionando"
- Inspección de `frontend/services/notificationService.ts` (líneas 163-173 y 633-647):
  ```typescript
  if (elapsedLateMs > 5000) {
    const hasRemotePush = this.canRelyOnRemotePush();
    if (hasRemotePush) {
      return; // Suprime silenciosamente la alerta local
    }
  }
  ```
- Comportamiento de Render Free Tier: El servicio se suspende tras 15 minutos de inactividad, deteniendo el bucle `run_reminder_push_loop(interval_seconds=30)`. Al no haber servidor despierto, el Web Push nunca se genera, y el cliente descarta la alarma local por la falsa asunción de `canRelyOnRemotePush()`.

## Triage

- Classification: confirmed
- Impact: critical (pérdida total de avisos, recordatorios y alarmas para el usuario).
- Facts:
  - Render suspende el proceso backend si no hay peticiones HTTP entrantes, pausando el worker de Web Push.
  - El frontend suprime la alarma local si cree que el backend está disponible (`canRelyOnRemotePush()`), sin comprobar si el usuario realmente recibió la notificación remota (`PUSH_DELIVERED` en service worker).
  - En entradas de categoría "Alerta", si `reminder_enabled` no está explícitamente a `true`, `notificationService.ts` omite la programación en `scheduleForEntry`.
- Hypotheses: Ninguna. La doble condición de supresión local y suspensión del contenedor explica exactamente por qué las alertas quedan mudas.
- Missing information: Ninguna.
- Possible duplicates checked:
  - Issue #145 (`notifications-alarm-silent-token-401-suppression`): abordó tokens 401, pero no la suspensión del backend en Render ni la supresión ciega con Render free tier.

## Publication history

- 2026-11-05: Intake registrado como borrador local confirmado.
