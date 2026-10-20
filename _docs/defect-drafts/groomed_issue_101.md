# Groomed Task: Issue #101 - Resaltado visual del botón seleccionado en la fecha rápida (Ahora, Hoy, Mañana, Sin fecha)

## Goal

Proporcionar retroalimentación visual clara e inequívoca sobre cuál de los botones de preajuste rápido de fecha (`⚡ Ahora`, `📅 Hoy 18:00`, `🌅 Mañana 09:00`, `❌ Sin Fecha`) está activo en el componente `DateTimePicker.tsx`, garantizando que al seleccionar cualquiera de ellos se aplique el estilo visual activo correspondiente y no solo en "Sin Fecha".

## Acceptance criteria

- [ ] **Estilo activo en preset 'Ahora'**:
  - Al pulsar el botón `preset-now`, dicho botón adquiere el estilo de selección activa (`presetChipActive` o `presetChipActivePrimary`), destacando con borde y fondo azul/primario distintivo.
- [ ] **Estilo activo en preset 'Hoy 18:00'**:
  - Al pulsar el botón `preset-today-18`, o si la fecha y hora corresponden a hoy a las 18:00, dicho botón adquiere el estilo activo.
- [ ] **Estilo activo en preset 'Mañana 09:00'**:
  - Al pulsar el botón `preset-tomorrow-9`, o si la fecha y hora corresponden a mañana a las 09:00, dicho botón adquiere el estilo activo.
- [ ] **Estilo activo en preset 'Sin Fecha'**:
  - Al pulsar el botón `preset-none`, o cuando no hay fecha asignada (`!dateStr`), dicho botón mantiene su estilo activo distintivo (`presetChipActiveDanger`).
- [ ] **Mutua exclusión y reactividad**:
  - Solo un preset puede estar visualmente activo a la vez. Si el usuario altera manualmente la fecha u hora mediante los selectores nativos/inputs a valores distintos a los presets, el estado activo se desmarca acordemente.
- [ ] **Tests y Calidad**:
  - Añadir pruebas unitarias en `frontend/components/DateTimePicker.test.tsx` verificando que al hacer click en cada preset se aplica el estilo visual correspondiente.
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).

## Out of scope

- Modificación de la lógica de guardado de entradas o envío de formulario en `EntryForm`.
- Cambios en las tareas #102 y #103.

## Constraints

- Archivos a modificar: `frontend/components/DateTimePicker.tsx` y `frontend/components/DateTimePicker.test.tsx`.
- Mantener compatibilidad total tanto en Web (`Platform.OS === 'web'`) como en móvil (Expo/React Native).
