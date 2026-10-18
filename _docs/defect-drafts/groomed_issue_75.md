## Goal

Eliminar el desbordamiento horizontal en pantallas móviles (especialmente iPhone / iOS Safari) asegurando que el botón 'Procesar' en la tarjeta de dictado en vivo (`VoiceCaptureFlow.tsx`) y los selectores nativos de fecha y hora (`DateTimePicker.tsx` y `VoiceCaptureFlow.tsx`) se adapten dinámicamente mediante flexbox wrap, `minWidth: 0` y `flexBasis` responsivo, sin sobresalir de los márgenes de las tarjetas contenedoras.

## Acceptance criteria

- [ ] En `VoiceCaptureFlow.tsx`:
  - `manualTranscriptRow` cuenta con `flexDirection: "row"`, `flexWrap: "wrap"`, `width: "100%"` y alineación adecuada.
  - `transcriptInput` cuenta con `flex: 1`, `minWidth: 150` y `maxWidth: "100%"`, permitiendo que el botón `parseTranscriptBtn` (`[ 🔍 Procesar ]`) permanezca completamente contenido dentro de la tarjeta `liveDictationBox` sin salirse por el margen derecho en viewports de 360px a 430px.
  - En la pantalla de resultados (Screen 2), la fila `dateTimeInputsRow` y sus contenedores de fecha y hora utilizan `minWidth: 0`, `maxWidth: "100%"` y envoltura flex, evitando desbordamientos de los selectores HTML5 `input[type="date"]` y `input[type="time"]`.
- [ ] En `DateTimePicker.tsx`:
  - `pickerField` cuenta con `flex: 1`, `flexBasis: 130`, `minWidth: 0` y `maxWidth: "100%"`.
  - `webInputStyle` incluye `minWidth: 0` y `boxSizing: "border-box"`, garantizando que en pantallas estrechas (iOS Safari) el selector de hora (`[ ⏰ 18:00 ]`) no sea empujado fuera del recuadro del formulario y envuelva naturalmente a la siguiente línea si el ancho disponible es insuficiente.
- [ ] Pruebas unitarias de regresión en frontend (`DateTimePicker.test.tsx` y `VoiceCaptureFlow.test.tsx`) verificando que los contenedores tienen estilos de ajuste responsivo y que todas las pruebas existentes continúan pasando (238/238).

## Out of scope

- Rediseño y ampliación del botón de dictado (reservado para Issue #76).
- Gestión proactiva de permisos al inicio (reservado para Issue #77).

## Constraints

- Archivos: `frontend/components/VoiceCaptureFlow.tsx`, `frontend/components/DateTimePicker.tsx`, y pruebas asociadas.
- Mantener la suite de frontend con 238 tests pasando y backend con 116 tests pasando.
- No agregar dependencias externas no autorizadas.
