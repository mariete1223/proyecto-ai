### Rol: Engineer
**Issue #109: Ocultar icono de campana en el calendario si la alerta o evento ya ha pasado**

#### Causa Raíz
En `CalendarMonthView.tsx`, la presencia del icono de campana 🔔 en las celdas del calendario se evaluaba mediante:
`const hasReminders = dayEntries.some((e) => !!e.reminder_enabled);`
Esto provocaba que cualquier día con una alerta o evento que tuviese `reminder_enabled: true` continuara mostrando la campana permanentemente, incluso después de que la fecha y hora de la alerta o notificación ya hubieran vencido y quedado en el pasado.

#### Solución Implementada
1. Se creó la función auxiliar exportada `isEntryReminderPending(entry: Entry, now: Date = new Date()): boolean` en `CalendarMonthView.tsx`.
   - Si la entrada no tiene `reminder_enabled: true`, retorna `false`.
   - Si tiene una regla de recurrencia activa (`reminder_recurrence !== "NONE"`), se verifica si tiene fecha límite (`reminder_end_time`) y si dicha fecha ya venció. Si no ha vencido o no tiene límite, se mantiene como activa.
   - Para avisos puntuales, calcula la fecha/hora efectiva del disparo (`reminder_time` o `occurred_at` menos cualquier antelación `reminder_offset_minutes`). Si el instante ya transcurrió (`triggerTime < now.getTime()`), retorna `false`.
2. Se actualizó el cómputo de `hasReminders` en las celdas de la cuadrícula mensual para usar `dayEntries.some((e) => isEntryReminderPending(e))`.
3. Se añadió un nuevo test unitario en `CalendarMonthView.test.tsx` comprobando que las alertas pasadas con notificación activa no muestran campana en el calendario, mientras que las alertas futuras sí la muestran (18/18 tests pasando).
