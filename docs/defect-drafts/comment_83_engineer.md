## Software Engineer Report - Issue #83

### Summary of Changes

1. **Desacoplamiento de posición de campana en el día actual (`isToday`)**:
   - En `frontend/components/CalendarMonthView.tsx`, se aplicó el estilo condicional `styles.dayReminderBellToday` al icono de campana `🔔`:
     ```tsx
     <Text
       style={[
         styles.dayReminderBell,
         isToday && styles.dayReminderBellToday,
       ]}
       testID={`day-has-reminder-${cell.dateStr}`}
     >
       🔔
     </Text>
     ```
   - Cuando el día es "HOY" (`isToday === true`), la campana se ubica en la esquina superior izquierda (`left: 2, top: 2`), mientras que el número y la insignia "HOY" ocupan el centro y lado derecho, eliminando completamente cualquier colisión o solapamiento.
   - En días regulares (`isToday === false`), la campana conserva su ubicación estándar en la esquina superior derecha (`right: 2, top: 2`).

2. **Espaciado y holgura de celda**:
   - Se ajustó `styles.dayCell` y `styles.emptyDayCell` con `height: 56` (2px adicionales de holgura vertical) y `paddingHorizontal: 3, paddingVertical: 3`, evitando la compresión entre la cabecera y la fila de puntos de eventos.
   - Se redujo el tamaño de fuente de la campana a 8px (`fontSize: 8, lineHeight: 10`) para un encaje ultra-compacto y limpio en la celda.

3. **Pruebas unitarias de regresión y cobertura**:
   - En `frontend/components/CalendarMonthView.test.tsx`, se expandió el test `renders reminder bell and HOY pill cleanly in day cell without layout conflict` para validar:
     - Celda de hoy: `left: 2`, `right: undefined` sin colisión con "HOY".
     - Celda de día regular: `right: 2`, `left: undefined`.

### Verification

- `npm run check` (Prettier, ESLint, TypeScript `tsc --noEmit`, Jest: 37 suites pasadas, 253 tests pasados).
- Backend tests: 116 pasados, 0 fallados.
