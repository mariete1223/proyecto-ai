### Implementación Software Engineer (Issue #95)

Se ha completado la simplificación de la pantalla de dictado por voz (`Paso 1: Dictado` en `frontend/components/VoiceCaptureFlow.tsx`):

1. **Eliminación del bloque intermedio redundante**:
   - Se ha retirado `liveDictationContent`, eliminando el placeholder `"🎙️ Habla ahora..."` y la reproducción duplicada del texto dictado encima del campo de entrada.
2. **Badge 'EN DIRECTO' e Input limpio**:
   - La cabecera `liveDictationHeaderRow` mantiene el badge activo `EN DIRECTO` durante la escucha (`voiceState === "LISTENING"`).
   - Las entidades detectadas en tiempo real (`liveParsed`) se integran en dicha cabecera como badges compactos sin añadir márgenes verticales innecesarios.
   - El campo de entrada `TextInput` (`testID="input-transcript"`) queda situado directamente debajo de la cabecera, de modo que el texto dictado se refleja inmediatamente dentro del propio input sin duplicación ni ruido visual.
3. **Tests y validación**:
   - Se actualizó la aserción en `VoiceCaptureFlow.test.tsx` para reflejar la eliminación de `live-dictation-text`.
   - Se añadió un test unitario específico para el Issue #95 que comprueba la presencia del badge `EN DIRECTO` y `input-transcript`, así como la ausencia de elementos de texto redundantes o placeholders intermedios.
   - `npm --prefix frontend run check` pasó al 100% (Prettier, ESLint, TypeScript, 37 test suites / 273 tests).
   - La suite completa de backend (`pytest`) pasó al 100% (119 tests pass).
