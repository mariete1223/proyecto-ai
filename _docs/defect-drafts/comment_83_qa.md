## QA: PASS

- [x] **Desacoplamiento visual de la campana y la insignia HOY** - PASS
  - Verificado en `CalendarMonthView.tsx` y cubierto por tests en `CalendarMonthView.test.tsx`.
  - Cuando coincide que una celda es el día actual (`isToday === true`) y contiene recordatorios (`hasReminders === true`), la campana `🔔` (`dayReminderBell`) aplica la clase `dayReminderBellToday` ubicándose en `left: 2, top: 2`.
  - El número de día y la insignia "HOY" se sitúan en el centro-derecha, evitando totalmente la superposición física sobre la etiqueta "HOY".
  - Comprobado mediante `StyleSheet.flatten`: `left: 2`, `right: undefined`.

- [x] **Campana en días regulares** - PASS
  - En días regulares con recordatorios (`isToday === false`), la campana mantiene su posición en la esquina superior derecha (`right: 2, top: 2`, `left: undefined`).
  - No interfiere con el número de día centrado.

- [x] **Espaciado y holgura vertical de la celda de día** - PASS
  - `styles.dayCell` y `styles.emptyDayCell` cuentan con `height: 56` y `paddingHorizontal: 3, paddingVertical: 3`.
  - Proporciona el margen vertical necesario para albergar la cabecera y la fila de puntos sin compresión ni recortes.

- [x] **Preservación de identificadores de prueba** - PASS
  - Se conservan `day-cell-${dateStr}`, `day-has-reminder-${dateStr}` y el texto `"HOY"`.

- [x] **Pruebas y calidad** - PASS
  - Tests en `CalendarMonthView.test.tsx`:
    - `renders reminder bell and HOY pill cleanly in day cell without layout conflict`: PASS.
  - Frontend: `npm run check` completado sin errores (Prettier OK, ESLint 0 advertencias, TypeScript `tsc --noEmit` OK, Jest: 37 suites pasadas, 253 tests pasados).
  - Backend: `..\backend\.venv\Scripts\python.exe -m pytest` (116 tests pasados, 5 skipped, 0 fallidos).
