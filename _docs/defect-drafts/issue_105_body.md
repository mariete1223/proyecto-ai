### Comportamiento observado
Al guardar una entrada desde la captura por voz (`VoiceCaptureFlow`), escritura manual (`EntryForm`) o la vista principal móvil (`MobileHomeVoiceView`), la aplicación redirige a la vista del Calendario (`activeTab = "CALENDAR"`), pero no selecciona ni despliega automáticamente el día en el que se acaba de programar la entrada. El usuario debe buscar la fecha y pulsar manualmente sobre la celda del día en la cuadrícula para ver la entrada recién guardada.

### Comportamiento esperado
Al guardar una entrada y navegar automáticamente al Calendario, la vista del calendario debe abrirse con el día de la fecha de la entrada creada seleccionado/clickado de forma predeterminada, mostrando directamente sus datos en el panel de detalle sin requerir clics adicionales.

### Pasos para reproducir
1. Crear y guardar una entrada para una fecha determinada (por ejemplo, mañana o una fecha específica) mediante voz o formulario manual.
2. La app redirige al Calendario.
3. Observar que el día de la nueva entrada no está seleccionado en el panel de detalle, obligando al usuario a hacer clic manualmente en la casilla de ese día para verla.

### Entorno
- Cliente: Web / PWA / Móvil
- Componentes: `frontend/App.tsx`, `frontend/components/CalendarMonthView.tsx`

### Evidencia
Reporte directo del usuario: "Se abre cuando guardas una categoria [entrada] el calendario pero no se muestra la entrada, osea cuando clocas en el dia muestra las entradas, quieroque cuando aparezca este clickado el dia en el que se ha puesto la entrada"

### Triage inicial
- Clasificación: `confirmed`
- Hechos: En `App.tsx`, las callbacks `onEntryCreated` y `onSuccess` llaman a `setActiveTab("CALENDAR")` sin transmitir la fecha ni el ID de la entrada creada a `CalendarMonthView`. `CalendarMonthView` inicializa `selectedDayEntries` solo con la fecha de hoy si es el mes actual, sin focalizar el día de la entrada guardada.
- Huella de deduplicación: `calendar-nav-missing-auto-select-created-entry-day`
