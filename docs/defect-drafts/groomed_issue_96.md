## Goal

Corregir la presentación visual y la alineación de los selectores de fecha y hora en la pantalla de previsualización antes de guardar (`VoiceCaptureFlow.tsx` y `DateTimePicker.tsx`), garantizando alturas idénticas (44px), anchos equitativos (50/50), texto centrado, eliminación de desbordamientos en iOS Safari, placeholder visible cuando no hay fecha, y pre-poblado automático de la fecha actual ('Hoy') con alarma inmediata/exacta (offset 0) para la categoría 'Alerta' sin requerir casillas adicionales.

## Acceptance criteria

- [ ] En `VoiceCaptureFlow.tsx`:
  - En la fila `dateTimeInputsRow`, ambos contenedores de fecha y hora tienen distribución equitativa (`flex: 1, minWidth: 0, maxWidth: "100%"`).
  - Los inputs nativos HTML5 (`<input type="date">` y `<input type="time">`) en Web/Safari tienen una altura idéntica y estandarizada de 44px (`height: 44, minHeight: 44, maxHeight: 44, lineHeight: "44px"`), `textAlign: "center"`, `WebkitAppearance: "none"`, evitando que el input de hora se sobredimensione o sobresalga hacia abajo.
  - Si el selector de fecha no tiene valor asignado, se muestra un placeholder visual accesible ("Seleccionar fecha...") visible en iOS Safari / WebKit.
  - Para la categoría 'Alerta':
    - Si al procesar la transcripción no se detecta fecha o si el usuario selecciona el chip 'Alerta', la fecha se pre-pobla automáticamente con la fecha de hoy (`toLocalDateString()`), activando visualmente el chip de preset 'Hoy'.
    - Al guardar una entrada de categoría 'Alerta', se garantiza `reminder_enabled = true` y `reminder_offset_minutes = 0` (y `task_status: null`, `task_priority: null`) sin requerir selección manual de casillas.
- [ ] En `DateTimePicker.tsx`:
  - Se homogeneizan los estilos nativos web (`webInputStyle`) con altura estricta de 44px, `lineHeight: "44px"`, `WebkitAppearance: "none"`, y placeholder visual cuando no hay fecha seleccionada.
- [ ] En `frontend/db/entries.ts`:
  - Asegurar que para la categoría 'Alerta', `reminder_enabled` siempre sea true con offset 0 por defecto, mientras que para el resto de categorías con fecha el recordatorio no se auto-active a menos que se indique explícitamente.
- [ ] Pruebas unitarias de frontend (`VoiceCaptureFlow.test.tsx`, `DateTimePicker.test.tsx`, `entries.test.ts`) actualizadas y pasando el 100% de la suite (`npm run check`).

## Out of scope

- Cambios en el motor de reconocimiento de voz de Safari.
- Nuevas pantallas o modificaciones no relacionadas con inputs de fecha/hora o categoría alerta.

## Constraints

- Modificar solo `frontend/components/VoiceCaptureFlow.tsx`, `frontend/components/DateTimePicker.tsx`, `frontend/db/entries.ts` y sus respectivos tests.
- Mantener la suite de frontend con el 100% de tests pasando.
- No añadir dependencias en `package.json`.
