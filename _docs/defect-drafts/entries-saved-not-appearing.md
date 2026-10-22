---
fingerprint: offline-entries-disappear-after-login
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/114
first_seen: 2026-10-21
last_seen: 2026-10-22
---

# Defect: los elementos guardados previamente no aparecen en la aplicación

## Observed behaviour

El usuario reporta que guardó elementos previamente en la aplicación (concretamente tareas el día 21/10), pero tras los cambios de sincronización y autenticación, solo se han recuperado algunas etiquetas y categorías, mientras que las tareas del 21/10 no aparecen ("Solo se han recuerado alguna etiqueta y caategroia per las tareas que cree el 21/10 no se han recuperado").

## Expected behaviour

Las tareas y notas creadas localmente (incluso en modo sin conexión o previo al inicio de sesión) deben conservarse y ser accesibles tras iniciar sesión o sincronizar, ya sea en el Calendario (si tienen fecha asignada) o en la sección de Tareas Pendientes (si no tienen fecha asignada).

## Reproduction

1. Crear tareas el 21/10 desde el dispositivo móvil mientras el backend o la sesión estaban desconectados.
2. Iniciar sesión con la cuenta verificada `mariete1223@outlook.es` o acceder al panel tras la reconexión.
3. Comprobar que aparecen ciertas categorías y etiquetas, pero las tareas del 21/10 no se visualizan en la vista de calendario.

Frecuencia: Reportado en sesión móvil.

## Environment

- Client: Web móvil anclada (PWA) / Safari / Chrome móvil
- Device: Teléfono móvil iPhone / Android
- Backend: SQLite local (`backend/app.db`) expuesto vía túnel Ngrok permanente

## Evidence

- Declaraciones del usuario:
  - "he guardado antes cosas y no me aparecen en la app porque?"
  - "tenia cosas hoty a dia 21/10 esos me refiero"
  - "Solo se han recuerado alguna etiqueta y caategroia per las tareas que cree el 21/10 no se han recuperado"
  - "offliine lo hice"
- Inspección del backend (`backend/app.db`):
  - La tabla `entries` para `mariete1223@outlook.es` contiene únicamente 2 registros semilla del 13/10.
  - La tabla `entries` para la cuenta demo histórica contiene 8 registros, el último del 13/10.
  - Ninguna entrada con fecha de creación `2026-10-21` llegó a insertarse en el backend `backend/app.db`.
  - Las tareas del 21/10 residen o residieron exclusivamente en el almacenamiento local del navegador (`localStorage: proyecto_ai_local_db`).

## Triage

- Classification: `needs-triage`
- Impact: high (riesgo de pérdida o falta de visibilidad de datos creados por el usuario en local).
- Facts:
  - En `backend/app.db` no existen entradas fechadas el 21/10. Todo lo creado el 21/10 fue en el cliente móvil local sin sincronizar.
  - La clave de base de datos local en frontend es `window.localStorage["proyecto_ai_local_db"]`.
  - El almacenamiento `localStorage` es estrictamente aislado por origen: si el usuario creó tareas en `https://proyecto-ai-ten.vercel.app` y luego abrió `https://raging-degraded-reptile.ngrok-free.dev`, cada origen tiene un `localStorage` independiente.
  - En la vista de Calendario (`CalendarMonthView`), solo se renderizan entradas que tengan `occurred_at` en el mes activo. Si una tarea se creó sin fecha/hora (`occurred_at == null`), únicamente aparece en la pestaña de "Tareas pendientes" (`PendingTasksView`).
- Hypotheses:
  - Hipótesis 1: El usuario creó las tareas en la PWA anclada (origen Vercel) y ahora está navegando desde el túnel Ngrok (u viceversa), por lo que el `localStorage` donde están las tareas está en el otro dominio del navegador móvil.
  - Hipótesis 2: Las tareas se guardaron sin fecha específica y se encuentran en la pestaña de "Tareas pendientes" en lugar del Calendario.
  - Hipótesis 3: La migración automática (`UPDATE entries SET user_id = ? WHERE user_id = 'user-demo-123'`) no coincidió con el `user_id` asignado a esas entradas si tenían otro identificador o si fueron purgadas por `deduplicateAndHealEntries`.
- Missing information:
  1. ¿En qué pestaña estás buscando las tareas: en el **Calendario** o en la pestaña de **Tareas pendientes** (el icono de lista/check abajo)?
  2. ¿Desde qué dirección web o acceso directo las creaste ayer (desde el icono anclado en la pantalla de inicio de tu móvil, desde `vercel.app` o desde `ngrok-free.dev`)?
  3. ¿Recuerdas el título o texto aproximado de alguna de las tareas que creaste el 21/10?
- Next Steps:
  - Aclarar con el usuario el origen y la pestaña donde las busca.
  - Comprobar si las tareas siguen en el `localStorage` del origen original.

## Publication history

- 2026-10-21: Registrado como borrador local `needs-triage`.
- 2026-10-22: Actualizado con nueva evidencia sobre recuperación parcial (etiquetas/categorías sí, tareas del 21/10 no) y análisis de aislamiento de almacenamiento local.
