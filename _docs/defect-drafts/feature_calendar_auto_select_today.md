### Descripción
Actualmente, al acceder a la pestaña o vista de Calendario (`CalendarMonthView`), no hay ningún día seleccionado por defecto (`selectedDayEntries` es `null`). Para ver las entradas programadas o registradas de una fecha, el usuario está obligado a pulsar manualmente sobre una celda del mes.

### Comportamiento solicitado
Al abrir o navegar a la vista de Calendario, si el mes visualizado contiene el día actual (hoy), dicho día debe quedar automáticamente seleccionado y mostrar de inmediato el listado de entradas asociadas a hoy en el panel inferior, agilizando la consulta diaria sin requerir toques adicionales.
