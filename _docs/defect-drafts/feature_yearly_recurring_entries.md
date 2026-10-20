### Descripción
Actualmente, las entradas registradas con fecha (`occurred_at`) solo existen y se visualizan en el año específico en el que fueron creadas. No existe una opción para indicar que un evento o apunte ocurre todos los años (como cumpleaños, aniversarios, festividades anuales o renovaciones).

### Comportamiento solicitado
1. **Opción de repetición anual**:
   - Disponer de una opción explícita (ej. "Todos los años" / `YEARLY`) en la configuración de recurrencia al crear o editar una entrada (en `EntryForm`, `ReminderConfigSection` y `EntryDetailView`).
2. **Visualización en el calendario para todos los años**:
   - En la vista mensual del calendario (`CalendarMonthView`), las entradas configuradas con repetición anual deben mostrarse en el día y mes correspondiente de cualquier año visualizado (año actual, pasados y futuros), no únicamente en el año original de creación.
3. **Recordatorios periódicos anuales**:
   - Si la entrada anual tiene avisos configurados, el sistema de notificaciones/recordatorios debe calcular y programar el aviso para cada año de forma recurrente.
