## Goal

Garantizar que en la vista de calendario (`CalendarMonthView`) y en todo el sistema, únicamente las entradas pertenecientes a categorías de tipo Tarea (`kind === "TASK"` y no Alerta) muestren casilla de verificación (`taskCheckbox`), admitan ser marcadas como completadas (`DONE`) y apliquen estilo de tachado. Las alertas y otras entradas sin naturaleza de tarea no deben mostrar checkbox de completitud ni admitir alternancia de estado de tarea.

## Acceptance criteria

- [ ] En `CalendarMonthView`, las entradas pertenecientes a la categoría 'Alerta' (o cualquier otra categoría con `kind !== "TASK"`) no renderizan el botón/checkbox de tarea (`testID="btn-toggle-task-${ent.id}"`).
- [ ] En `CalendarMonthView`, solo las entradas cuya categoría sea explícitamente de tipo tarea (`cat.kind === "TASK"` y no sea Alerta) renderizan la casilla de verificación.
- [ ] Al pulsar sobre una entrada de tipo Alerta en el calendario, no es posible cambiar su estado a completada (`DONE`).
- [ ] Las alertas en el calendario no muestran su título ni contenido tachado con estilo de completado (`textCompletedStrikethrough`), incluso si existiesen datos heredados con `task_status` residual en la base de datos local.
- [ ] Las tareas reales (`kind === "TASK"`, ej: 'Tareas') continúan mostrando su casilla de verificación y alternan normalmente entre `PENDING` y `DONE` con feedback sonoro/visual.

## Out of scope

- Modificar el flujo de creación o recordatorio de alertas (se mantiene intacto).
- Añadir estados adicionales de tarea (como `IN_PROGRESS`) a la vista de calendario rápida.

## Constraints

- Archivos a modificar: `frontend/components/CalendarMonthView.tsx`, pruebas asociadas (`CalendarMonthView.test.tsx`), y `frontend/components/EntryDetailView.tsx` si aplica.
- No agregar dependencias de terceros en `package.json` ni `pyproject.toml`.
- Todas las suites de pruebas de frontend y backend deben pasar al 100%.
