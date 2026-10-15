## QA: PASS

### Checklist de Criterios de Aceptación
- [x] **Asignación por defecto en el parser**: En `voiceParser.ts`, para categorías de tipo `TASK` sin fecha explícita, `occurredAt` se establece a `refDate.toISOString()` y se emite el token `Fecha: Hoy` - PASS
- [x] **Token visible de fecha**: Token `type: "DATE"` con `label: "Fecha: Hoy"` presente en los tokens devueltos por `parseSpokenCommand` - PASS
- [x] **Respeto a fechas explícitas**: Dictados de tareas con *"mañana"*, *"pasado mañana"*, *"el lunes de la semana que viene"* o fechas numéricas conservan su fecha calculada exacta sin sobrescribirse - PASS
- [x] **Renderizado en celda del calendario**: Las tareas creadas para hoy se indexan en `day-cell-${todayStr}` y son accesibles en `day-detail-panel` permitiendo completar/desmarcar - PASS
- [x] **Saneamiento de tareas existentes**: `deduplicateAndHealEntries` repara tareas locales huérfanas sin fecha asignándoles su `created_at` - PASS
- [x] **Cobertura de tests**:
  - `npm test -- services/voiceParser.test.ts`: 38 tests pasados
  - `npx jest components/CalendarMonthView.test.tsx`: 11 tests pasados
  - `npm test -- --watchAll=false`: 32 suites pasadas, 191 tests pasados (0 fallos)
  - `uv run python -m pytest`: 114 tests pasados en backend (0 fallos)

### Veredicto
**QA PASS**: Cumple con todos los criterios de aceptación y permite que cualquier tarea dictada o creada sin fecha se ubique de forma fiable en el día de hoy del calendario.
