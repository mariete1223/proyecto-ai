### Comportamiento observado

En la cuadrícula mensual del calendario (`CalendarMonthView`), en una celda de día que coincide con la fecha actual (`isToday === true`) y tiene recordatorios activos (`hasReminders === true`), el icono de campana `🔔` (`styles.dayReminderBell`, posicionado de forma absoluta en `top: 2, right: 2`) se superpone directamente encima de la insignia verde "HOY" (`styles.todayPill`).
Asimismo, cuando el día actual acumula múltiples eventos y recordatorios, la celda (con altura fija de 54px) sufre una alta congestión vertical, afectando la legibilidad.

### Comportamiento esperado

La cabecera de la celda debe acomodar limpiamente el número de día, el indicador del día actual y el aviso de recordatorio sin ninguna superposición, colisión de capas ni recortes en pantallas móviles de cualquier ancho (360px a 430px).

### Pasos para reproducir

1. Abrir la aplicación y navegar a la pestaña **Calendario** (`CalendarMonthView`).
2. Tener o crear al menos una entrada con recordatorio activo (`reminder_enabled: 1`) para la fecha de hoy.
3. Observar la celda correspondiente al día actual en un cliente móvil (ej. iOS / Expo Go con ancho ~390px).
4. El emoji de la campana `🔔` aparece dibujado encima de la letra "Y" / píldora verde `HOY`.

### Entorno

- Dispositivo móvil iOS / Expo Go / Web móvil (ancho de viewport ~390px).
- Componente `frontend/components/CalendarMonthView.tsx`.

### Evidencia

- Captura de pantalla aportada por el usuario (`media_1792354202777.jpg`) del 18 de Octubre de 2026 mostrando:
  - Número de día `18` en verde.
  - Insignia `HOY` en verde inmediatamente a su derecha.
  - Icono `🔔` superpuesto sobre la insignia `HOY` en la esquina superior derecha de la celda.

### Triage inicial

- **Clasificación**: `confirmed`
- **Hechos confirmados**:
  - `styles.dayReminderBell` utiliza `position: "absolute", top: 2, right: 2, zIndex: 2`.
  - `styles.dayCellHeaderRow` agrupa `dayNumber` y `todayPill` en una fila centrada horizontalmente.
  - En anchos de celda de ~42px (con 8px de padding total), la suma del ancho del número de día (~14px), el gap (3px) y la píldora `HOY` (~18px) se extiende hasta el margen derecho de la celda (coordenadas x ~35-37px), coincidiendo exactamente con la posición de la campana (x ~34-40px).
- **Hipótesis técnica**:
  - Debe desacoplarse el posicionamiento de la campana del espacio ocupado por la insignia `HOY`, ya sea integrando la campana dentro de la fila de cabecera con espacio flexible, reemplazando la píldora "HOY" por un estilizado más compacto (ej. número en círculo destacado como en calendarios nativos), o ajustando márgenes y dimensiones relativas de la celda.

### Huella de deduplicacion

`calendar-day-cell-space-today-reminder-overlap`

### Duplicados comprobados

- Issue #64 (Cerrada): Abordó desbordamientos horizontales previos posicionando la campana en la esquina, pero generó la colisión actual con la insignia `HOY`.
- Issue #82 (Cerrada): Ajustó el límite de puntos de eventos en la fila inferior de la celda, pero no la cabecera.
