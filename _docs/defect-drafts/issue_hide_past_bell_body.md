### Comportamiento observado
En la vista mensual del calendario (`CalendarMonthView.tsx`), los días que contienen entradas con recordatorio activo (`reminder_enabled: true`) muestran incondicionalmente el icono de campanita 🔔 en la celda del día (`hasReminders = dayEntries.some((e) => !!e.reminder_enabled)`), incluso cuando la fecha/hora de la alerta, evento o recordatorio ya venció y ha quedado en el pasado.

### Comportamiento esperado
Si la alerta, evento u otra categoría ya ha pasado (la fecha u hora de aviso o evento ya transcurrió en el tiempo y no tiene recurrencias futuras pendientes), no debe mostrarse la campanita en el calendario aunque tuviera activada la notificación. La campanita solo debe señalar recordatorios y avisos que aún estén pendientes o activos en el presente o futuro.

### Entorno y Componentes
- Frontend: `frontend/components/CalendarMonthView.tsx`
- Tests: `frontend/components/CalendarMonthView.test.tsx`
