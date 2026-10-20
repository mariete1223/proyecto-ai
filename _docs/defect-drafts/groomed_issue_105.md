## Goal

Al guardar una entrada desde cualquier flujo (voz, formulario manual o pantalla principal móvil) y redirigir a la pestaña del Calendario, seleccionar y desplegar automáticamente el día de la fecha de la entrada creada (`selectedDayEntries`), navegando al mes correspondiente si difiere del actual, para que el usuario vea de inmediato la entrada recién creada en el panel de detalle sin tener que buscarla ni hacer clics manuales.

## Acceptance criteria

- [ ] `CalendarMonthView` acepta una prop opcional `initialSelectedDateStr?: string` (o `focusDateStr?: string`).
- [ ] Cuando `initialSelectedDateStr` (o `focusDateStr`) se proporciona:
  - Si el mes/año de dicha fecha difiere del mes actualmente visualizado en el calendario, el calendario navega automáticamente a ese mes/año.
  - El día correspondiente queda seleccionado automáticamente en `selectedDayEntries`, mostrando en el panel de detalle (`day-detail-panel`) las entradas correspondientes a esa fecha (incluyendo la recién creada).
- [ ] En `frontend/App.tsx`, al crearse una entrada mediante `VoiceCaptureFlow`, `EntryForm` o `MobileHomeVoiceView`, se obtiene el ID/fecha de la entrada guardada (`occurred_at`) y se actualiza el estado de fecha a enfocar en el calendario (`calendarFocusDateStr`).
- [ ] Al cambiar `activeTab` a `"CALENDAR"`, `CalendarMonthView` recibe dicha fecha enfocada y selecciona inmediatamente ese día.
- [ ] Si no hay ninguna fecha enfocada por creación reciente, se mantiene el comportamiento previo de seleccionar el día de hoy por defecto.
- [ ] Pruebas unitarias automatizadas cubren:
  - `CalendarMonthView` abriendo y seleccionando directamente el día indicado en `initialSelectedDateStr` (incluso en meses distintos al actual).
  - Redirección con selección de día en la integración de creación de entrada.
- [ ] La suite de pruebas de frontend y backend pasa al 100% sin regresiones.

## Out of scope

- Deshabilitar el botón de completado para alertas (cubierto en #106).
- Plegado de sección de recordatorios al editar entrada (cubierto en #107).
- Gesto swipe horizontal entre pestañas (cubierto en #108).

## Constraints

- Compatibilidad total tanto en Web/PWA como en entorno móvil/React Native.
- No alterar las firmas existentes de llamadas que dependan de `CalendarMonthView`.
- Cero dependencias añadidas a `package.json` o `pyproject.toml`.
