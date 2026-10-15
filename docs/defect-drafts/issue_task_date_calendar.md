### Comportamiento observado
Al crear o dictar por voz una tarea sin indicar explícitamente una fecha o momento (por ejemplo: "comprar leche"), la tarea no se muestra en la cuadrícula mensual del calendario ni en la celda del día de hoy.

### Comportamiento esperado
Al registrar una tarea sin fecha explícita, debe asignarse la fecha actual por defecto para que aparezca inmediatamente en el día de hoy del calendario, o bien el calendario debe reflejar las tareas pendientes activas.

### Pasos para reproducir
1. Dictar o crear una tarea sin mencionar día ni hora (ej. "comprar pan" asociada a la categoría Tareas).
2. Dirigirse a la vista del Calendario en el mes actual.
3. Observar que en el día de hoy (ni en ningún otro día del mes) aparece la tarea recién creada.

### Entorno
- Cliente: Web PWA y Expo Móvil.
- Plataformas: Navegadores Web (Chrome, Safari iOS) y móvil.

### Evidencia
- Reporte del usuario: *"las tareas no aparecen en el calendario, si no digo fecha de tarea que se ponga la de hoy"*.
- En `frontend/services/voiceParser.ts`: cuando no hay mención temporal, `occurredAt` se emite como `null`.
- En `frontend/db/entries.ts`: la consulta `listLocalEntries` con filtros `start_at` y `end_at` (usada por `CalendarMonthView`) descarta entradas con `occurred_at === null` (`e.occurred_at && e.occurred_at >= filters.start_at`).
- En `frontend/components/CalendarMonthView.tsx`: `entriesByDayMap` únicamente indexa entradas que cuenten con `occurred_at`.

### Triage inicial
- Clasificación: `confirmed`
- Hechos: Las tareas sin fecha no tienen `occurred_at` en base de datos local y quedan fuera de las consultas de rango mensual del calendario.
- Hipótesis: Al procesar tareas sin fecha en el parser de voz o en la creación de tareas, establecer la fecha por defecto a la fecha actual (`today`), permitiendo que el calendario las localice en el día de hoy.

### Huella de deduplicacion
`calendar-task-without-date-missing-from-grid`

### Duplicados comprobados
Comprobadas issues #35 a #64 y directorio `_docs/defect-drafts/`. Ninguna coincidencia abierta ni cerrada.
