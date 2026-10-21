# Grooming de Issue #109: Ocultar icono de campana en el calendario si la alerta o evento ya ha pasado

## Contexto del Problema
En `CalendarMonthView.tsx`, cuando un día contiene entradas con `reminder_enabled: true`, la celda del día renderiza incondicionalmente el icono de campanita 🔔 (`hasReminders = dayEntries.some((e) => !!e.reminder_enabled)`).
Esto ocurre incluso cuando la fecha u hora de la alerta, evento o recordatorio ya transcurrió en el tiempo (es decir, ya ocurrió y ha quedado en el pasado).
El usuario solicitó explícitamente:
"Si la alerta o evento o otra categoria ya ha pasado no pongas la campanita en el calendario si tenia activada la notificacion"

## Comportamiento Esperado
1. En `CalendarMonthView.tsx`, la presencia del icono de campanita 🔔 en la celda del día (`hasReminders`) debe reflejar exclusivamente avisos o eventos que **no hayan vencido**:
   - Una entrada con `reminder_enabled: true` se considera activa en el calendario si su fecha/hora relevante es mayor o igual a la fecha/hora actual (o si tiene una recurrencia que se proyecta en el futuro sin haber superado `reminder_end_time`).
   - Si la fecha y hora programada del recordatorio o del evento (`occurred_at` / `reminder_time`) es estrictamente anterior al momento actual (y no es una recurrencia activa para fechas futuras), la campanita no debe renderizarse para esa entrada en la celda del día.
2. En el panel de detalle de la entrada, se puede mantener el indicador o reflejar claramente si el recordatorio está activo o si ya fue pasado/vencido.
3. Crear tests unitarios en `CalendarMonthView.test.tsx` que verifiquen:
   - Que para una alerta o evento en el pasado (ayer o hace horas) con `reminder_enabled: true`, la celda del día **no** muestre la campana 🔔 (`testID="day-has-reminder-${pastDateStr}"` es nulo).
   - Que para una alerta o evento futuro o de hoy aún no transcurrido con `reminder_enabled: true`, la celda del día **sí** muestre la campana 🔔.

## Criterios de Aceptación
1. `isEntryReminderPending(entry: Entry, now?: Date): boolean` evalúa si el recordatorio está habilitado y si su disparo o evento aún no ha vencido (teniendo en cuenta recurrencias como `YEARLY`, `DAILY`, etc., y `reminder_end_time`).
2. `hasReminders` en las celdas del mes se calcula usando `dayEntries.some(isEntryReminderPending)`.
3. Todos los tests de frontend (39 suites) y backend (125 tests) pasan al 100%.
