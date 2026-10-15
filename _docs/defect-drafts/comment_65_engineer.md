## Software Engineer: Implementation Summary

### Overview of Changes
- **Root Cause**: En `voiceParser.ts`, al dictar tareas sin mención explícita de fecha u hora, `targetDate` y `occurredAt` quedaban como `null`. En la cuadrícula mensual (`CalendarMonthView.tsx`), las entradas se consultan filtrando por el rango del mes actual (`start_at` y `end_at`), descartando toda entrada con `occurred_at === null` y evitando que se indexaran en el día de hoy.
- **Solution**:
  1. **Asignación por defecto en el parser de voz**: En `frontend/services/voiceParser.ts`, si la categoría reconocida es de tipo `TASK` y no hay token explícito de fecha/hora, se asigna por defecto `targetDate = new Date(refDate)` (`occurredAt = refDate.toISOString()`) y se añade el token visual `Fecha: Hoy`.
  2. **Preservación de fechas explícitas**: Si el usuario especifica fechas relativas o absolutas (ej. *"mañana"*, *"el lunes que viene"*), se respeta la fecha indicada.
  3. **Saneamiento de datos existentes**: En `deduplicateAndHealEntries` ([App.tsx](file:///c:/Users/marie/Desktop/Proyecto_AI/frontend/App.tsx)), toda tarea existente con `occurred_at === null` se sanea asignándole su fecha de creación `created_at` para que sea visible en el calendario.
  4. **Configuración de túnel y red**: Sincronizado `ACTIVE_BACKEND_TUNNEL` y `app.json` con el túnel activo.
  5. **Pruebas añadidas**:
     - En `voiceParser.test.ts`: test de tarea dictada sin fecha que valida asignación a hoy y token `Fecha: Hoy`.
     - En `CalendarMonthView.test.tsx`: test que valida que una tarea del día actual se renderiza en la cuadrícula mensual de hoy y en el panel de detalle.

### Commit
- `9c7d2ce`: `fix(voice): default task date to today when not specified so tasks appear on calendar (closes #65)`

### Verification
- `npm test -- --watchAll=false`: 32 suites pasadas, 191 tests pasados al 100%.
- `uv run python -m pytest`: 114 tests pasados en backend.
