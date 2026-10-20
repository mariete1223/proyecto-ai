---
fingerprint: datetime-picker-presets-missing-selected-state
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/101
first_seen: 2026-10-20
last_seen: 2026-10-20
---

# Defect: Los botones de fecha rápida (Ahora, Hoy, Mañana) no se marcan visualmente como seleccionados

## Observed behaviour

Al crear o editar una entrada manual en el formulario (`EntryForm.tsx`), al pulsar sobre los botones de selección rápida de fecha (`⚡ Ahora`, `📅 Hoy 18:00`, `🌅 Mañana 09:00`), la fecha/hora interna se actualiza correctamente, pero ninguno de estos botones recibe el estilo visual de seleccionado (`styles.presetChipActive`). El único botón de la fila de presets que se marca con estilo activo es `❌ Sin Fecha`.

## Expected behaviour

Al pulsar cualquiera de los botones de preajuste de fecha (`⚡ Ahora`, `📅 Hoy 18:00`, `🌅 Mañana 09:00` o `❌ Sin Fecha`), o cuando la fecha y hora seleccionadas coinciden con el preset correspondiente, dicho botón debe mostrar un estilo visual destacado de seleccionado (borde activo, fondo contrastado y/o texto diferenciado) para proporcionar retroalimentación clara al usuario sobre cuál opción está activa.

## Reproduction

1. Abrir el formulario de creación manual de entrada (`EntryForm`).
2. Observar la fila de accesos rápidos de fecha (`⚡ Ahora`, `📅 Hoy 18:00`, `🌅 Mañana 09:00`, `❌ Sin Fecha`).
3. Pulsar sobre `⚡ Ahora`, `📅 Hoy 18:00` o `🌅 Mañana 09:00`.
4. Observar que el botón pulsado no adquiere el estilo activo `presetChipActive`, mientras que pulsar `❌ Sin Fecha` sí lo resalta.

Frequency: 100% reproducible

## Environment

- Client: Web PWA / Expo mobile
- Component: `frontend/components/DateTimePicker.tsx`
- Build / Branch: `main`

## Evidence

- User report: "cuando estoy creando una entrada manual le he dado a ahora, hoy mañana, y no se marca como seleccionado solo pasa con sin fecha"
- Código fuente inspeccionado en `frontend/components/DateTimePicker.tsx:148-179`:
  - `preset-now`, `preset-today-18`, `preset-tomorrow-9` tienen `style={styles.presetChip}` sin condición de activo.
  - Únicamente `preset-none` tiene `style={[styles.presetChip, !dateStr && styles.presetChipActive]}`.

## Triage

- Classification: confirmed
- Impact: Confusión de usuario en la selección de fecha/hora manual al carecer de feedback visual del preset seleccionado.
- Facts:
  - En `DateTimePicker.tsx`, las etiquetas `preset-now`, `preset-today-18` y `preset-tomorrow-9` carecen de `styles.presetChipActive`.
  - Solo `preset-none` evalúa `!dateStr` para aplicar el estilo activo.
- Hypotheses: Debe implementarse una detección de estado activo para cada preset (por ejemplo, evaluando si el último preset pulsado o si los valores `dateStr` y `timeStr` concuerdan con la fecha/hora correspondiente a dicho preset).
- Missing information: Ninguna.

## Publication history

- 2026-10-20: Intake registrado y verificado.
