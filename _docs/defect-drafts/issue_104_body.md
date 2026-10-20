### Comportamiento observado
Al utilizar el formulario de creación rápida dentro del calendario ("➕ Nueva entrada para el YYYY-MM-DD" en CalendarMonthView):
1. Si la categoría elegida es de tipo Tarea (o Tareas), no existe selector de prioridad (Alta, Media, Baja); la prioridad queda asignada rígidamente como MEDIUM en el código.
2. Si la categoría elegida es 'Alerta', el recordatorio no se activa automáticamente a la hora del evento (offset 0), obligando al usuario a marcar manualmente el checkbox "Programar recordatorio para esta entrada".

### Comportamiento esperado
1. Al seleccionar una categoría de tipo Tarea en la creación rápida del calendario, debe mostrarse el selector de prioridad (Alta, Media, Baja) para que el usuario pueda definirla.
2. Al seleccionar la categoría 'Alerta', el recordatorio debe activarse automáticamente por defecto a la hora exacta del evento (offset 0), sin requerir pulsar manualmente el toggle de recordatorio.

### Pasos para reproducir
1. Abrir la vista de Calendario y seleccionar un día.
2. Pulsar en '➕ Nueva entrada'.
3. Seleccionar categoría 'Tareas': observar que no hay selector de prioridad (se guarda fija como MEDIA).
4. Seleccionar categoría 'Alerta': observar que el checkbox de recordatorio permanece desactivado en lugar de activarse automáticamente a la hora del evento.

### Entorno
- Cliente: Web / PWA / Móvil
- Componentes: `frontend/components/CalendarMonthView.tsx`

### Evidencia
Reporte directo del usuario: "Cuando introduces manualmente desde el calendario una tarea no permite poner prioridad, luego en alerta el recordatorio es a la hora de la alerta no hay que darle a programar recordatorio"

### Triage inicial
- Clasificación: `confirmed`
- Hechos: En `CalendarMonthView.tsx`, `handleQuickCreateEntry` fija `task_priority: isTask ? "MEDIUM" : null` sin exponer controles de UI para prioridad. `quickAddReminderEnabled` se inicializa en `false` independientemente de si la categoría seleccionada es de tipo Alerta.
- Huella de deduplicación: `calendar-quick-add-task-priority-and-alert-reminder`
