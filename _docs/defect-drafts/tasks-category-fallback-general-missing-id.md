---
fingerprint: tasks-category-fallback-general-missing-id
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/147
first_seen: 2026-11-02
last_seen: 2026-11-02
---

# Defect: Las tareas muestran la categoría «General» y pierden checkbox al tener category_id no mapeado

## Observed behaviour

Las tareas en la vista de calendario se muestran con una etiqueta de categoría «General» en lugar de «Tareas», perdiendo además el checkbox interactivo para marcarlas como completadas.

## Expected behaviour

Toda tarea debe identificarse y mostrarse siempre con su categoría canónica («Tareas» / «Tarea») y su checkbox de completado funcional. Si una entrada posee atributos de tarea (`task_status`) o su `category_id` no coincide con el mapa en memoria, debe sanearse o resolverse a la categoría canónica `Tareas` en lugar de mostrar «General».

## Reproduction

1. Tener entradas con atributos de tarea (`task_status`) cuyo `category_id` no coincida con el ID presente en `categoryMap` (por ejemplo, por discrepancia de UUIDs previos a la canonicidad o categorías reasignadas/eliminadas).
2. Abrir la vista de Calendario (`CalendarMonthView`).
3. Seleccionar el día de la tarea.
4. Observar la tarjeta: muestra el badge «General» y no renderiza el checkbox de completado.

Frequency: consistente cuando el `category_id` no está en `categoryMap`.

## Environment

- Client: Web y Móvil (Expo, React Native)
- Device or browser: Todos
- Componente: `frontend/components/CalendarMonthView.tsx` (L1428-1430, L1487)

## Evidence

- Reporte del usuario: *"Luego las tareas se me pusieron como categoria 'general'"*.
- En `CalendarMonthView.tsx:1487`:
  ```tsx
  <Text style={styles.catBadgeText}>
    {cat?.name || "General"}
  </Text>
  ```
- En `CalendarMonthView.tsx:1429`:
  ```tsx
  const isTask = cat?.kind === "TASK" && !isCategoryAlert(cat);
  ```

## Triage

- Classification: confirmed
- Impact: Confusión de UX y pérdida de interacción (checkbox) para tareas cuyo `category_id` no resuelve directamente en el mapa cargado.
- Facts:
  - La etiqueta «General» es un valor por defecto codificado en `CalendarMonthView.tsx:1487`.
  - Cuando `cat` es `undefined`, `isTask` es `false`, lo cual suprime el checkbox de tarea.
- Hypotheses: Sincronización o migración de entradas con UUIDs viejos de categoría previos a los IDs canónicos dejan `category_id` huérfanos.
- Missing information: ninguna.
- Possible duplicates checked: #140, #115.

## Publication history

- 2026-11-02: Publicado como Issue #147 en GitHub.
