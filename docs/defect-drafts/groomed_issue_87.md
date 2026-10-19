# Groomed Task: Issue #87 - Navegación al calendario tras guardar entrada, dictado en detalle de día y unificación de cancelar/cerrar

## Goal

Permitir al usuario ver de inmediato en el calendario cualquier entrada recién guardada cambiando automáticamente a la vista de Calendario tras su guardado exitoso, habilitar la opción de dictado por voz para un día concreto desde el panel de detalle diario del calendario, y simplificar los controles eliminando la coexistencia confusa de botones "✕ Cancelar" y "✕ Cerrar".

## Acceptance criteria

- [ ] **Navegación automática al calendario tras guardado exitoso**:
  - En `App.tsx`: Cuando se guarda exitosamente una entrada desde la vista de inicio móvil (`MobileHomeVoiceView.tsx`), desde el modal de dictado por voz (`VoiceCaptureFlow.tsx`), o desde el formulario manual (`EntryForm.tsx`), la aplicación cambia automáticamente la pestaña activa a `"CALENDAR"` (`activeTab = "CALENDAR"`) y recarga el estado para que la nueva entrada se muestre en el calendario sin requerir clics adicionales.
- [ ] **Opción de dictado por voz en el día seleccionado del calendario**:
  - En `CalendarMonthView.tsx`: En el panel de detalle de día (`selectedDayEntries`), además del formulario manual rápido ("➕ Manual"), se incluye un botón para dictar por voz (`"🎙️ Dictar"` / `testID="btn-quick-voice-add"`).
  - Al pulsar `"🎙️ Dictar"`, se abre el flujo de captura por voz (`VoiceCaptureFlow`) preconfigurado para la fecha seleccionada (`targetDate` fijado a la fecha del día elegido o permitiendo dictar con esa fecha predefinida), permitiendo al usuario dictar notas, tareas o alertas para ese día.
  - Al completarse el guardado por voz, el modal de voz se cierra y el día seleccionado en el calendario se actualiza mostrando la nueva entrada.
- [ ] **Unificación de botones de Cancelar / Cerrar**:
  - En `CalendarMonthView.tsx`: En la cabecera del panel de detalle diario (`detailHeaderActions`), no deben coexistir simultáneamente dos botones que indiquen cerrar/cancelar ("✕ Cancelar" y "✕ Cerrar").
  - Si el formulario de añadir entrada está cerrado, la cabecera muestra los botones de acción (`"➕ Manual"`, `"🎙️ Dictar"`) y un único botón `"✕ Cerrar"` para cerrar el panel del día.
  - Si el formulario de añadir entrada está abierto, existe un único botón de salida claro ("✕ Cerrar" en la cabecera o botón cancelar en el pie del formulario) sin generar confusión visual de doble botón "cancelar" + "cerrar" adyacentes en la cabecera.
- [ ] **Tests y Calidad**:
  - Actualizar tests de `App.test.tsx` o componentes relacionados para validar que al crear una entrada se activa la pestaña de calendario.
  - Actualizar tests en `CalendarMonthView.test.tsx` para verificar la existencia del botón de dictar por voz y la ausencia de botones duplicados Cancelar/Cerrar en la cabecera.
  - `npm --prefix frontend run check` pasa 100% (Prettier, ESLint, TypeScript, Jest).
  - Backend `pytest` pasa 100%.

## Out of scope

- Cambiar la lógica de filtrado de categorías en el calendario.
- Reorganizar la vista de escritorio `WebMainLayout.tsx` más allá del cambio automático de tab al guardar.

## Constraints

- Mantener compatibilidad total en Web, iOS y Android.
- No alterar esquemas de base de datos ni modelos de dominio.
- No modificar dependencias en `package.json` ni `pyproject.toml`.
