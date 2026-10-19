# Groomed Task: Issue #88 - Disposición en paralelo de botones Regrabar y Guardar, y eliminación de botón Cancelar en flujo de dictado

## Goal

Disponer los botones "Regrabar" y "Guardar" uno al lado del otro de forma horizontal y equilibrada en la vista de revisión de dictado (`VoiceCaptureFlow.tsx`), y eliminar el botón redundante de "Cancelar" / "Salir" de las barras de acción, aprovechando que el control de cierre ya se encuentra en la cabecera superior.

## Acceptance criteria

- [ ] **Disposición en paralelo de Regrabar y Guardar en la barra rápida de tokens**:
  - En `VoiceCaptureFlow.tsx` (`quickSaveTokensRow`): Los botones de regrabar (`btn-quick-rerecord`) y guardar (`btn-quick-save-tokens`) se muestran en una sola fila horizontal sin salto de línea (`flexDirection: "row"`, `flex: 1` cada uno, `gap: 10`).
  - Se elimina el botón `btn-quick-cancel-tokens` de dicha barra.
- [ ] **Disposición en paralelo en la barra de acciones inferior**:
  - En `VoiceCaptureFlow.tsx` (`actionsRow`): Los botones "🎙️ Regrabar" (`btn-reset-voice-capture`) y "💾 Confirmar y Guardar" (`btn-save-corrected-entry`) se presentan en paralelo con igual peso (`flex: 1` cada uno).
  - Se elimina el botón redundante `btn-close-voice-flow` / `cancelButton` de dicha fila inferior.
- [ ] **Conservación del cierre en la parte superior**:
  - La opción de cerrar la vista de captura permanece disponible en la parte superior (cabecera del modal / vista activa), garantizando una salida clara sin generar botones de cancelación redundantes junto al guardado.
- [ ] **Tests y Calidad**:
  - Tests en `VoiceCaptureFlow.test.tsx` adaptados y verificados.
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).
  - `pytest` en backend pasa al 100%.

## Out of scope

- Modificar la transcripción de audio o la lógica de extracción de entidades.
- Alterar el comportamiento de cierre de otros componentes no relacionados.

## Constraints

- No modificar dependencias en `package.json` ni `pyproject.toml`.
- Mantener diseño limpio y responsivo en pantallas móviles y de escritorio.
