# Groomed Task: Issue #92 - Alertas manuales tratadas como tareas y sin alarma/fecha por defecto

## Goal

Garantizar que la categoría "Alerta" funcione como un aviso puntual (kind `STANDARD`), no como una tarea:
1. Eliminar cualquier comportamiento de tarea (selectores de estado y prioridad en UI y registro en base de datos) para la categoría "Alerta".
2. Establecer por defecto la alarma activa y la fecha/hora actual en `EntryForm.tsx` al seleccionar "Alerta", garantizando que la alarma se programe efectivamente.
3. Migrar y sanear la base de datos `backend/app.db` y `backend/app/main.py` para que la categoría "Alerta" tenga `kind = 'STANDARD'` y sus entradas no contengan campos de tarea.

## Acceptance criteria

- [ ] **Frontend - Desacoplamiento total de Tarea para "Alerta"**:
  - En `frontend/components/EntryForm.tsx`, `isTaskCategory` debe ser estrictamente `false` cuando la categoría seleccionada sea "Alerta" (por nombre normalizado `"alerta"`, comando de voz `"alerta"`, nombre `"Alerta"`, o ID canónico `CANONICAL_CATEGORIES.ALERTA.id`), incluso si por herencia o sincronización su campo `kind` fuera `"TASK"`.
  - Los selectores de "Estado de Tarea" y "Prioridad" (`task-options`) no deben mostrarse cuando la categoría seleccionada sea "Alerta".
  - Al guardar una entrada con categoría "Alerta", los campos `task_status`, `task_priority` y `task_recurrence` deben ser `null`, impidiendo que se liste indebidamente en "Tareas Pendientes".
- [ ] **Frontend - Alarma y fecha/hora por defecto en "Alerta"**:
  - En `frontend/components/EntryForm.tsx`, al seleccionar el chip de la categoría "Alerta":
    - Se activa `reminderEnabled = true`.
    - Se establece `reminderOffsetMinutes = 0` (alarma en el momento exacto).
    - Si `occurredAt` está vacío, se inicializa automáticamente con la fecha y hora actual en formato ISO (`new Date().toISOString()`), permitiendo visualizarla y ajustarla en el `DateTimePicker`.
  - En `handleSubmit`: si la categoría es "Alerta" y `occurredAt` está vacío, se asigna `new Date().toISOString()`, garantizando que `scheduleForEntry()` y el push worker reciban fecha/hora válida y programen la notificación.
- [ ] **Backend y Base de Datos - Migración e Integridad**:
  - En `backend/app.db`, migrar la categoría `c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9` a `kind = 'STANDARD'`.
  - En `backend/app.db`, limpiar las entradas existentes asociadas a la categoría "Alerta" (`task_status = NULL`, `task_priority = NULL`, `task_recurrence = NULL`).
  - En `backend/app/main.py`, incorporar la actualización automática en `_create_sqlite_tables` para asegurar persistencia y resiliencia tras reinicios.
- [ ] **Tests y Calidad**:
  - Pruebas unitarias en `frontend/components/EntryForm.test.tsx` verificando:
    - Que seleccionar "Alerta" oculta `task-options`.
    - Que seleccionar "Alerta" inicializa `occurredAt` y activa `reminderEnabled`.
    - Que guardar una "Alerta" envía `task_status: null`, `task_priority: null`, `reminder_enabled: true` y `occurred_at` válido.
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).
  - Pytest en backend pasa al 100%.

## Out of scope

- Modificar la lógica de voz de `voiceParser.ts` (ya soporta alertas y fechas de hoy).
- Modificar el flujo de dictado `VoiceCaptureFlow.tsx`.

## Constraints

- Cambios concentrados en `backend/app/main.py`, `backend/app.db`, `frontend/components/EntryForm.tsx` y `frontend/components/EntryForm.test.tsx`.
- No modificar dependencias en `package.json` ni `pyproject.toml`.
