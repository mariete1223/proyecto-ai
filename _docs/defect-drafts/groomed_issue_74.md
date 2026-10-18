## Goal

Configurar la categoría canónica "Alerta" como categoría de aviso/notificación puntual de agenda (sin atributos de tarea to-do), de modo que las entradas creadas o visualizadas bajo "Alerta" no tengan selector de prioridad (Alta/Media/Baja), no muestren estado de tarea (Pendiente/Completada), no se listen en la pestaña de "Tareas Pendientes", y mantengan su comportamiento característico de recordatorio con fecha y hora.

## Acceptance criteria

- [ ] En `frontend/db/categories.ts` y `backend/app/services/category_service.py`, la categoría canónica "Alerta" (`c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9`) tiene `kind: "STANDARD"`.
- [ ] En la creación de entradas (`EntryForm.tsx` y `VoiceCaptureFlow.tsx` / `voiceParser.ts`):
  - Al seleccionar "Alerta", se ocultan los campos y selectores de Prioridad (`task_priority`) y no se le asigna estado de tarea (`task_status = null`).
  - Se mantiene la activación automática del recordatorio a la hora establecida (`reminder_enabled = true`, `reminder_offset_minutes = 0`).
- [ ] En la visualización y edición en `EntryDetailView.tsx`:
  - Para entradas de categoría "Alerta", no se renderizan los badges de prioridad ni el selector de estado de tarea (`PENDING` / `COMPLETED`).
- [ ] En la pestaña de tareas pendientes (`PendingTasksView.tsx` y `CalendarMonthView.tsx`):
  - Las entradas de categoría "Alerta" no aparecen en el listado de pendientes ni muestran casillas de verificación de tarea completada.
- [ ] Migración/reparación de entradas existentes en SQLite local y backend: las entradas con categoría "Alerta" limpian `task_status = null` y `task_priority = null` conservando intactos su contenido, fecha/hora y recordatorio.
- [ ] Pruebas unitarias actualizadas en frontend y backend verificando que la categoría "Alerta" tiene `kind: "STANDARD"` y no genera atributos de tarea.

## Out of scope

- Desbordamiento horizontal en botones móviles (movido a #75).
- Rediseño de botones de dictado por voz (movido a #76).

## Constraints

- Archivos: `frontend/db/categories.ts`, `backend/app/services/category_service.py`, `frontend/services/voiceParser.ts`, `frontend/components/EntryForm.tsx`, `frontend/components/EntryDetailView.tsx`, `frontend/components/PendingTasksView.tsx`, `frontend/App.tsx`, y pruebas correspondientes.
- Conservar los 235 tests de frontend y 116 tests de backend pasando al 100%.
