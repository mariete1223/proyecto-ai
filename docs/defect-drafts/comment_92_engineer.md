# Engineer Implementation Report: Issue #92

## Summary of Changes

### 1. Base de datos del Backend (`backend/app.db`)
- Se actualizó la fila de la categoría 'Alerta' (`c3d4e5f6-a7b8-4901-c2d3-e4f5a6b7c8d9`) para que `kind = 'STANDARD'` (eliminando el valor erróneo `TASK`).
- Se sanearon todas las entradas existentes asociadas a la categoría 'Alerta', estableciendo `task_status = NULL`, `task_priority = NULL` y `task_recurrence = NULL`, impidiendo que aparezcan como tareas pendientes.

### 2. Arranque del Backend (`backend/app/main.py`)
- Se incluyeron sentencias de actualización en `_create_sqlite_tables` para que, en cada inicio de la aplicación en modo desarrollo, se asegure que cualquier categoría con nombre 'Alerta' o ID canónico tenga `kind = 'STANDARD'` y sus entradas tengan los campos de tarea vacíos.

### 3. Formulario de Entrada Manual (`frontend/components/EntryForm.tsx`)
- **Desacoplamiento total de Tarea**: Se introdujo el helper `isCategoryAlert` y se definió `isTaskCategory = selectedCategory?.kind === "TASK" && !isAlertCategory`. Al seleccionar 'Alerta', los controles de tarea (`task-options`: estado y prioridad) se ocultan por completo.
- **Alarma y Fecha/Hora por defecto**: Al pulsar el chip de la categoría 'Alerta', se activa automáticamente la alarma (`reminderEnabled = true`, `reminderOffsetMinutes = 0`) y, si `occurredAt` está vacío, se pre-pobla con la fecha y hora actual (`new Date().toISOString()`), mostrándola en el `DateTimePicker`.
- **Persistencia garantizada en envío**: En `handleSubmit`, si la categoría es 'Alerta' y no tiene fecha, se asigna la fecha/hora actual, asegurando que `notificationService.scheduleForEntry` y el push worker del backend reciban una fecha válida y programen la notificación. Los campos de tarea se envían estrictamente como `null`.

### 4. Capa de Datos Local (`frontend/db/entries.ts`)
- En `createLocalEntry` y `updateLocalEntry`, se verifica `isAlertCategory`. Para cualquier entrada bajo la categoría 'Alerta', los campos de tarea (`task_status`, `task_priority`, `task_recurrence`) se fuerzan a `null` de forma defensiva, y se garantizan los valores por defecto de `occurred_at = now` y `reminder_enabled = true`.

### 5. Tests Automatizados
- En `frontend/components/EntryForm.test.tsx`:
  - Se agregó una prueba unitaria que simula una categoría 'Alerta' con `kind: 'TASK'`, verificando que `task-options` no se muestra, que se activa la alarma con fecha por defecto, y que al guardar se persiste con `task_status: null`, `task_priority: null`, `reminder_enabled: 1` y `occurred_at` válido.
- En `frontend/db/entries.test.ts`:
  - Se agregó una prueba unitaria que verifica que una alerta sin fecha explícita recibe automáticamente la fecha actual, activa el recordatorio y limpia los campos de tarea.

## Verification

- **Frontend check (`npm run check`)**: Prettier, ESLint, TypeScript y Jest (37/37 suites, 272/272 tests) pasaron exitosamente.
- **Backend pytest**: 117 tests pasaron exitosamente.
