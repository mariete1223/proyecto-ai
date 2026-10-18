## Groomed Task: Issue #79

## Goal

Garantizar que en la pantalla de revisión de voz (Paso 2) no se permita el guardado accidental de entradas si no se ha detectado un comando o categoría válidos, ofrecer un botón de acceso directo "🎙️ Repetir Dictado" para reintentar la captura de voz sin tener que salir y volver a entrar, y adaptar la botonera rápida para que el texto "💾 Guardar Entrada" no se corte en pantallas estrechas.

## Acceptance criteria

- [ ] **Validación de comando detectado antes de guardar**:
  - En la pantalla de revisión (Paso 2), si la categoría no es reconocida o el comando no fue válido (`parsedResult.isSuccess === false` o sin categoría válida), el botón de guardado rápido (`btn-quick-save-tokens`) y el botón principal de guardar (`btn-save-corrected-entry`) están deshabilitados (`disabled` y con estilo visual disabled).
  - Si el comando es reconocido válidamente (`parsedResult.isSuccess === true` con `categoryId`), ambos botones de guardado están habilitados.
- [ ] **Botón directo de repetir dictado**:
  - En la fila superior de acciones rápidas (`quickSaveTokensRow`) se incluye un botón prominente "🎙️ Repetir Dictado" (`testID="btn-quick-rerecord"`).
  - Al pulsar "🎙️ Repetir Dictado", se reinicia el flujo de voz regresando al Paso 1 (dictado) con el estado limpio para dictar de nuevo inmediatamente.
- [ ] **Diseño responsivo de los botones de acción rápida**:
  - El botón `quickSaveBtn` y su texto `quickSaveBtnText` ("💾 Guardar Entrada") no se truncan con elipsis en pantallas estrechas; la fila `quickSaveTokensRow` usa `flexWrap: "wrap"` con espaciado flexible (`gap: 10`) y dimensiones que aseguran la legibilidad completa del texto.
- [ ] **Pruebas y calidad**:
  - Tests unitarios en `frontend/components/VoiceCaptureFlow.test.tsx` que verifiquen:
    - Deshabilitación de guardado ante comando fallido/categoría no reconocida.
    - Habilitación de guardado ante comando válido.
    - Presencia y funcionamiento del botón `btn-quick-rerecord`.
  - Frontend test suite completa y `npm run check` pasando al 100%.

## Out of scope

- Modificaciones en la pantalla inicial de dictado en reposo (gestionado en Issue #80).
- Cambios en las reglas léxicas de parseo de voz.

## Constraints

- Archivos a modificar: `frontend/components/VoiceCaptureFlow.tsx` y `frontend/components/VoiceCaptureFlow.test.tsx`.
- Mantener testIDs existentes para compatibilidad.
