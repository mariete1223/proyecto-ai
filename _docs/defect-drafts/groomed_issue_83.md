# Groomed Task: Issue #83 - Superposición de campana de recordatorio con insignia 'HOY' y congestión de espacio en celda de día

## Goal

Resolver la superposición visual entre la campana de aviso (`🔔`) y la insignia "HOY" en la celda del día actual del calendario (`CalendarMonthView`), optimizando la distribución espacial y la altura de las celdas para que el número de día, los indicadores y los puntos de eventos se presenten de manera limpia, equilibrada y sin colisiones en dispositivos móviles.

## Acceptance criteria

- [ ] **Desacoplamiento visual de la campana y la insignia HOY**:
  - Cuando una celda corresponde al día de hoy (`isToday === true`) y tiene recordatorios activos (`hasReminders === true`), la campana de aviso (`dayReminderBell`) se posiciona en la esquina superior izquierda de la celda (`top: 2, left: 2`), mientras que el número de día y la insignia "HOY" ocupan el centro y derecha de la cabecera.
  - La campana `🔔` y la insignia `HOY` nunca se superponen ni colisionan visualmente en ninguna resolución móvil (360px a 430px de ancho).
- [ ] **Campana en días regulares**:
  - En celdas con recordatorios que no correspondan al día de hoy (`hasReminders === true && isToday === false`), la campana de aviso se mantiene posicionada en la esquina superior derecha (`top: 2, right: 2`), sin interferir con el número de día centrado.
- [ ] **Espaciado y holgura vertical de la celda de día**:
  - `styles.dayCell` ajusta su altura/holgura a `height: 56` (o `minHeight: 56`) y padding controlado, proporcionando espacio vertical adecuado para que la cabecera (número, HOY, campana) y la fila de puntos/badge (`badgesContainer`) no queden comprimidos ni recortados.
- [ ] **Preservación de identificadores de prueba**:
  - Se mantienen intactos los `testID` existentes: `day-cell-${dateStr}`, `day-has-reminder-${dateStr}`, y el texto `"HOY"`.
- [ ] **Pruebas y calidad**:
  - Tests unitarios en `CalendarMonthView.test.tsx` que verifiquen:
    1. Renderizado de celda de hoy con recordatorio activo sin colisión (comprobando estilos/posicionamiento específico `dayReminderBellToday`).
    2. Renderizado de celda de día regular con recordatorio activo en su posición habitual.
  - `npm run check` completado sin errores (Prettier, ESLint 0 advertencias, TypeScript `tsc --noEmit`, Jest 100% pasando).
  - Tests de backend (`pytest`) pasando al 100%.

## Out of scope

- Modificaciones en la vista de detalle de día (`dayDetailBox`).
- Modificaciones en la lógica de cálculo o programación de notificaciones.

## Constraints

- Modificar `frontend/components/CalendarMonthView.tsx` y `frontend/components/CalendarMonthView.test.tsx`.
- No alterar esquemas de base de datos ni modelos de dominio.
