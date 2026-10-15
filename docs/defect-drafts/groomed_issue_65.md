## Goal
Garantizar que al dictar o crear una tarea sin especificar una fecha o momento explícito, se asigne por defecto la fecha actual (`today`), de forma que la tarea se guarde con un `occurred_at` válido y aparezca inmediatamente en el día de hoy del calendario mensual y en las listas temporales.

## Comportamiento actual y esperado
- **Actual:** Al dictar una tarea (por ejemplo *"comprar leche"*) en una categoría de tipo `TASK`, el parser de voz devuelve `occurredAt: null`. La entrada se almacena con `occurred_at: null`. La consulta mensual del calendario (`listLocalEntries` con `start_at` y `end_at`) descarta toda entrada con `occurred_at === null` y la cuadrícula no la puede asociar a ningún día, volviéndola invisible en el calendario.
- **Esperado:** Cuando se procesa una tarea sin indicación temporal explícita, se le asigna por defecto la fecha actual (`today`, tomando como base `refDate`). La tarea se almacena con `occurred_at` válido y se visualiza de forma inmediata en la celda de hoy del calendario mensual. Si el dictado incluye una fecha explícita (ej. *"mañana"*, *"el lunes que viene"*), se respeta la fecha indicada.

## Acceptance criteria
- [ ] En `frontend/services/voiceParser.ts`, cuando la categoría reconocida es de tipo `TASK` (`matchedCategory.kind === "TASK"`) y no se detecta ningún token de fecha explícito en la transcripción, `occurredAt` se establece por defecto a la fecha actual (`refDate.toISOString()`) en lugar de `null`.
- [ ] Se añade un token visible de fecha (`type: "DATE"`, `label: "Fecha: Hoy"`) en la previsualización del dictado para que el usuario vea reflejado que la tarea se programará para hoy.
- [ ] Si la tarea incluye fecha o día explícito (ej. *"mañana"*, *"el viernes"*, *"el 20 de octubre"*), el parser continúa resolviendo y asignando dicha fecha explícita con normalidad.
- [ ] En `frontend/components/CalendarMonthView.tsx`, las tareas creadas para el día de hoy aparecen en la celda correspondiente (`day-cell-${todayStr}`) y se reflejan en el detalle del día.
- [ ] Reparación de datos existentes: En la sincronización / saneamiento local (`deduplicateAndHealEntries` en `App.tsx`), si existen tareas con `task_status` pendiente y `occurred_at === null`, se les asigna su fecha de creación `created_at` para que no queden invisibles en el calendario.
- [ ] Pruebas unitarias completas:
  - En `frontend/services/voiceParser.test.ts`: test de tarea dictada sin fecha que valida asignación de `occurredAt` a hoy y token `Fecha: Hoy`.
  - En `frontend/components/CalendarMonthView.test.tsx`: test que valida que una tarea del día actual se renderiza en la cuadrícula mensual de hoy.
- [ ] Toda la suite de pruebas del frontend (190+ tests) y backend (114 tests) pasa al 100%.

## Out of scope
- Edición de entradas y cambio de fecha mediante comandos de voz (propuesta de feature futura).
- Configuración de avisos por horas recurrentes (propuesta de feature futura).
- Pantallas de bienvenida/onboarding de nuevos usuarios (propuesta de feature futura).

## Constraints
- Archivos a modificar: `frontend/services/voiceParser.ts`, `frontend/App.tsx`, y archivos de tests correspondientes (`voiceParser.test.ts`, `CalendarMonthView.test.tsx`).
- No añadir dependencias externas.
- Preservar compatibilidad con categorías de tipo `NOTE` o eventos existentes.
