### Comportamiento observado
En la vista de calendario (`CalendarMonthView`), las entradas de categoría 'Alerta' (o cualquier entrada que no sea estrictamente una tarea pero tenga `task_status` no nulo) muestran una casilla de verificación (`taskCheckbox`) y permiten ser marcadas como completadas (`DONE`) con texto tachado. Marcar como completada una alerta carece de sentido lógico, ya que una alerta es un aviso o recordatorio puntual, no una tarea pendiente con estado de completitud.

### Comportamiento esperado
Solo las entradas cuya categoría sea de tipo Tarea (`category.kind === "TASK"` y no Alerta) deben mostrar la casilla de verificación y poder marcarse como completadas (`DONE`/`PENDING`). Las alertas y demás entradas no pertenecientes a tareas no deben presentar casilla de completitud ni admitir estado de tarea.

### Pasos para reproducir
1. Crear una entrada de categoría 'Alerta' con fecha/hora.
2. Abrir la vista del Calendario y seleccionar el día de la alerta.
3. Observar la fila de la entrada en el panel de detalle: se muestra el botón de checkbox para marcar como completada.
4. Pulsar el checkbox: la alerta se marca como completada (`DONE`), aparece el aviso "✅ Tarea completada" y el texto se tacha.

### Entorno
- Cliente: Web / PWA / Móvil
- Componentes: `frontend/components/CalendarMonthView.tsx`, `frontend/db/entries.ts`

### Evidencia
Reporte directo del usuario: "Luego lo de que pueda marcar como completada una alerta no tiene sentido, sol odebe poder marcarse como completada una tarea revisa eso"

### Triage inicial
- Clasificación: `confirmed`
- Hechos: En `CalendarMonthView.tsx` línea 931, `isTask` se calcula como `cat?.kind === "TASK" || ent.task_status !== null`, provocando que cualquier alerta con `task_status` presente muestre el checkbox de tarea. Además, `handleToggleTaskStatus` permite alternar `task_status` de cualquier entrada independientemente de su categoría. En `frontend/db/entries.ts`, `task_status` no se fuerza a `null` para alertas si el llamador envía un valor.
- Huella de deduplicación: `calendar-alert-entry-cannot-be-completed-only-tasks`
