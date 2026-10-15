## Software Engineer: Implementation Summary

### Overview of Changes
- **Root Cause**: En `CalendarMonthView.tsx`, la fila de cabecera de celda (`dayCellHeaderRow`) intentaba colocar horizontalmente en flex-row el número del día (`dayNumber`), el icono de campana `🔔` (`dayReminderBell`) y la píldora verde `HOY` (`todayPill`). En vistas móviles con celdas de ~44-46px de ancho, la suma de los tres elementos superaba el espacio disponible, desbordando el número de día o la etiqueta fuera del recuadro.
- **Solution**:
  1. **Posicionamiento absoluto del indicador de aviso**: Se extrajo `dayReminderBell` de `dayCellHeaderRow` y se posicionó como badge absoluto en la esquina superior derecha de la celda (`position: "absolute"`, `top: 2`, `right: 2`, `fontSize: 9`, `lineHeight: 11`, `zIndex: 2`).
  2. **Contenedor protegido contra desbordamiento**: Se añadió `position: "relative"` y `overflow: "hidden"` a `dayCell` para asegurar que ningún contenido se salga del recuadro de la celda en ninguna resolución o densidad de pantalla.
  3. **Fila de cabecera limpia**: En `dayCellHeaderRow` solo conviven el `dayNumber` y `todayPill` con `gap: 3` y `maxWidth: "100%"`, disponiendo de todo el ancho útil disponible sin ninguna colisión.
  4. **Preservación de selectores**: Se mantuvieron intactos todos los `testID` (`day-cell-${dateStr}`, `day-has-reminder-${dateStr}`).
  5. **Cobertura de pruebas**: Se añadió un test unitario dedicado en `frontend/components/CalendarMonthView.test.tsx` que valida la coexistencia de `dayCell`, `day-has-reminder` y la píldora `HOY` sin desbordamiento.

### Commit
- `4ac85d8`: `fix(calendar): position reminder bell absolutely to prevent header row overflow with HOY badge (closes #64)`

### Verification
- `npm test -- --watchAll=false`: 32 suites pasadas, 190 tests pasados (10/10 en `CalendarMonthView.test.tsx`).
- `uv run python -m pytest`: 114 tests pasados en el backend.
