# Groomed Task: Issue #82 - Limitar puntos de eventos en celdas del calendario con indicador +X responsivo

## Goal

Optimizar la visualización de eventos en las celdas mensuales del calendario (`CalendarMonthView`), limitando la cantidad máxima de puntos visibles a 2 y mostrando un badge compacto `+X` con la cantidad de eventos restantes cuando haya más de 2 eventos, garantizando que los indicadores nunca desborden ni rompan la celda en pantallas móviles.

## Acceptance criteria

- [ ] **Límite de puntos visibles en celdas de día**:
  - Si un día tiene 1 evento, se renderiza exactamente 1 punto de color y ningún indicador de exceso (`+X`).
  - Si un día tiene 2 eventos, se renderizan exactamente 2 puntos de color y ningún indicador de exceso (`+X`).
- [ ] **Indicador de exceso `+X` cuando hay más de 2 eventos**:
  - Si un día tiene `N` eventos con `N > 2`, se renderizan los primeros 2 puntos de color y un indicador textual `+${N - 2}` (ej. `+1` para 3 eventos, `+2` para 4 eventos, `+3` para 5 eventos).
- [ ] **Ajuste visual y responsividad**:
  - El contenedor de puntos (`badgesContainer`) utiliza `flexWrap: "nowrap"`, `alignItems: "center"`, `justifyContent: "center"` y `maxWidth: "100%"`, asegurando que los puntos y el badge quepan cómodamente en una sola línea horizontal dentro del ancho de la celda en pantallas móviles sin desbordar verticalmente.
  - El indicador `+X` cuenta con `testID="day-extra-count-${dateStr}"` para verificabilidad.
- [ ] **Pruebas y calidad**:
  - Tests unitarios en `CalendarMonthView.test.tsx` que verifiquen el renderizado de 1 evento, 2 eventos, 3 eventos (`+1`), y 4 o más eventos (`+X`).
  - La suite completa de frontend (`npm test`) y backend (`uv run pytest`) pasan al 100%.
  - `npm run check` completado sin errores de linter, tipo o formato.

## Out of scope

- Modificación de la lógica del modal de detalle de día (`dayDetailBox`) o del formulario rápido de creación de entradas.
- Modificación de los filtros de categoría o etiquetas.

## Constraints

- Modificar `frontend/components/CalendarMonthView.tsx` y `frontend/components/CalendarMonthView.test.tsx`.
- Mantener los testIDs existentes (`day-cell-${dateStr}`, `entry-dot-${id}`) para compatibilidad con tests previos.
