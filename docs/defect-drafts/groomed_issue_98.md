## Goal

Permitir dictar notas libres por voz directamente en la pantalla de estructurar notas con IA (`LlmBatchProcessor.tsx`), volcando la transcripción en tiempo real en el campo de texto del Paso 1, permitiendo combinar habla, escritura y pegado sin tener que crear una nota previa ni copiar/pegar manualmente entre pantallas.

## Acceptance criteria

- [ ] En `LlmBatchProcessor.tsx`:
  - Se añade un control de dictado interactivo (`btn-dictate-llm-note`) en el Paso 1, accesible y claramente visible.
  - Cuando el micrófono está inactivo (`IDLE`), el botón muestra `🎙️ Dictar por Voz` con estilo destacado.
  - Al pulsar el botón, se inicializa `VoiceRecognitionService` y se inicia la escucha activa, cambiando el estado a `LISTENING`.
  - Mientras escucha, el botón muestra `⏹️ Detener Dictado` con indicador de grabación en vivo (`🔴 Grabando...`), y se muestra una barra de estado o badge informativo.
  - La transcripción recibida se refleja en tiempo real en el área de texto (`rawNoteText`). Si ya existía texto previo, el nuevo dictado se anexa respetando el contenido existente.
  - Al detener el dictado (pulsando de nuevo o si finaliza), el texto permanece editable manualmente en el `TextInput`.
  - Los errores de permisos o reconocimiento se muestran en el cuadro de error existente sin bloquear la interfaz.
  - Se gestiona la limpieza (`cancel()`) del servicio de voz al desmontar el componente o al cambiar de pestaña.
- [ ] Pruebas unitarias en `LlmBatchProcessor.test.tsx` que validan:
  - Presencia del botón de dictado.
  - Inicio de escucha y actualización del texto `rawNoteText` mediante eventos de voz.
  - Detención de la escucha y persistencia del texto transcrito.
- [ ] Verificación completa con `npm run check` pasando al 100% (Prettier, ESLint, TypeScript, Jest).

## Out of scope

- Procesamiento automático del LLM en el backend sin intervención del usuario (se mantiene el flujo actual de generación/copia de prompt o importación).
- Cambios en el motor de reconocimiento de voz.

## Constraints

- Modificar solo `frontend/components/LlmBatchProcessor.tsx` y `frontend/components/LlmBatchProcessor.test.tsx`.
- Reutilizar `VoiceRecognitionService` ya existente en `frontend/services/voiceRecognition.ts`.
- No agregar dependencias a `package.json`.
- Mantener diseño consistente con el sistema de diseño oscuro y tokens de la app.
