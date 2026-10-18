## QA: PASS

- [x] **Límite de puntos visibles en celdas de día** - PASS
  - Verificado en `CalendarMonthView.tsx` y cubierto por tests en `CalendarMonthView.test.tsx`.
  - Con 1 entrada fechada, se renderiza exactamente 1 punto indicador (`entry-dot-...`) y ningún badge de exceso (`day-extra-count` es nulo).
  - Con 2 entradas fechadas, se renderizan exactamente 2 puntos indicadores y ningún badge de exceso (`day-extra-count` es nulo).

- [x] **Indicador de exceso `+X` cuando hay más de 2 eventos** - PASS
  - Verificado para casos con `N > 2`:
    - Con 3 entradas: se visualizan 2 puntos y el badge textual `+1`.
    - Con 4 entradas: se visualizan 2 puntos y el badge textual `+2`.
    - Con 5 entradas: se visualizan 2 puntos y el badge textual `+3`.
  - El cálculo `extraCount = Math.max(0, dayEntries.length - MAX_VISIBLE_CALENDAR_DOTS)` garantiza precisión matemática en cualquier volumen de entradas.

- [x] **Ajuste visual y responsividad** - PASS
  - `styles.badgesContainer` configurado con `flexWrap: "nowrap"`, `alignItems: "center"`, `justifyContent: "center"`, `gap: 3` y `maxWidth: "100%"`.
  - La fila de puntos y badge ocupa un ancho máximo de ~31px, alojándose perfectamente dentro de los ~42px-48px de ancho disponible por celda en resoluciones móviles, evitando el desbordamiento o salto de línea vertical.
  - El elemento textual dispone del atributo verificable `testID="day-extra-count-${cell.dateStr}"`.

- [x] **Pruebas y calidad** - PASS
  - Tests unitarios actualizados y creados en `CalendarMonthView.test.tsx`:
    - `handles day saturation (+2 indicator for 4 entries on same day)`: PASS.
    - `limits visible entry dots to 2 and shows correct +X indicator dynamically`: PASS.
  - Frontend: `npm run check` completado sin errores (Prettier OK, ESLint 0 advertencias, TypeScript `tsc --noEmit` OK, Jest: 37 suites pasadas, 253 tests pasados).
  - Backend: `..\backend\.venv\Scripts\python.exe -m pytest` (116 tests pasados, 5 skipped, 0 fallidos).
