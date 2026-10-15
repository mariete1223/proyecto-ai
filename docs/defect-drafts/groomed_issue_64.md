## Goal
Ajustar el layout de la cabecera de la celda de día en la cuadrícula mensual (`CalendarMonthView`) para que el número del día, la etiqueta "HOY" y el indicador de recordatorio quepan perfectamente sin desbordar el recuadro de la celda en ninguna resolución móvil.

## Comportamiento actual y esperado
- **Actual:** En la cuadrícula mensual, cuando coincide que el día es hoy (`isToday === true`) y tiene recordatorios activos (`hasReminders === true`), el número de día, el emoji `🔔` y la etiqueta `HOY` se colocan juntos en una fila horizontal que supera los ~45px de ancho útil de la celda en pantallas móviles, provocando que la etiqueta "HOY" o el número se salgan del recuadro.
- **Esperado:** El indicador de recordatorio (campana `🔔`) se sitúa de forma limpia y compacta (como insignia en la esquina superior derecha de la celda), permitiendo que el número del día y la píldora `HOY` dispongan de todo el espacio horizontal sin colisionar ni desbordarse. La celda previene cualquier fuga visual mediante `overflow: "hidden"`.

## Criterios de Aceptación
- [ ] En `frontend/components/CalendarMonthView.tsx`, cuando una celda del día de hoy (`isToday === true`) tiene recordatorios activos (`hasReminders === true`), el número del día, la etiqueta `HOY` y la campana de aviso quedan totalmente contenidos dentro de la celda `dayCell`.
- [ ] El icono de recordatorio (`dayReminderBell`) se posiciona de manera compacta en la esquina superior derecha (`position: "absolute"`) con tamaño optimizado para no competir por el ancho horizontal con `dayNumber` y `todayPill`.
- [ ] El contenedor `dayCell` tiene `position: "relative"` y `overflow: "hidden"` para garantizar un encuadre estricto y sin desbordamientos en pantallas móviles estrechas (360px a 400px).
- [ ] Se preservan todos los `testID` existentes (`day-cell-${dateStr}`, `day-has-reminder-${dateStr}`).
- [ ] Toda la suite de tests del frontend (189 tests) pasa al 100%.

## Fuera de Alcance
- Modificaciones en la vista de detalle de día o en formularios de creación.

## Restricciones y Reparación de Datos
- Modificar únicamente `frontend/components/CalendarMonthView.tsx`.
- No requiere migraciones ni alteraciones en la base de datos.
- Pasar el 100% de las suites de prueba.
