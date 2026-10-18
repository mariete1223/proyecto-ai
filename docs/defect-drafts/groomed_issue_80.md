# Groomed Task: Issue #80 - Visualización condicional de transcripción en dictado y botón de cierre en cabecera más visible

## Goal

Simplificar y limpiar la pantalla inicial de dictado por voz para que en estado de reposo (*idle*) solo se muestre el botón principal de dictado y la guía de comandos (*chuleta*), haciendo que el cuadro de transcripción ("Lo que estás diciendo") y los controles secundarios ("Limpiar") aparezcan únicamente una vez que el usuario comienza a dictar o cuando hay texto dictado; y rediseñar el botón de "Cerrar / Salir" en la cabecera superior derecha para que sea más grande, prominente y en color rojo.

## Acceptance criteria

- [ ] **Pantalla de reposo (Paso 1: Dictado sin grabación activa ni texto)**:
  - El cuadro "Lo que estás diciendo" (`live-dictation-box`) permanece oculto hasta que el usuario pulsa para dictar (`voiceState === "LISTENING"` o `voiceState === "PROCESSING"`) o hasta que exista texto en el transcript.
  - La fila de controles secundarios ("🔄 Limpiar") permanece oculta en reposo y solo se muestra cuando hay texto dictado.
  - En reposo, la vista presenta de forma limpia y directa el botón Hero de dictado ("🎙️ Toca para Dictar") y la chuleta de comandos disponibles abajo.
- [ ] **Durante y después del dictado**:
  - Al pulsar "Toca para Dictar", el cuadro "Lo que estás diciendo" se despliega visiblemente mostrando la transcripción en directo y la onda de audio.
  - El botón "🔄 Limpiar" se encuentra disponible para vaciar la transcripción cuando haya texto.
- [ ] **Botón superior de cierre en la cabecera**:
  - El botón de cierre (`closeModalButton` / `headerCloseButton`) ubicado arriba a la derecha se rediseña con estilo rojo más visible y llamativo (fondo/borde rojo `#EF4444`, texto rojo claro o blanco, tipografía más grande y mayor área táctil con padding optimizado para móvil).
- [ ] **Pruebas y calidad**:
  - Tests unitarios en `VoiceCaptureFlow.test.tsx` adaptados y pasando al 100%.
  - `npm run check` completado sin errores de linter, tipo o formato.

## Out of scope

- Cambios en el motor de reconocimiento de voz.
- Modificaciones en la pantalla de revisión (Paso 2, gestionado en Issue #79).

## Constraints

- Archivos: `frontend/components/VoiceCaptureFlow.tsx`, `frontend/App.tsx` (cabeceras de modal), y `frontend/components/VoiceCaptureFlow.test.tsx`.
- Mantener todos los testIDs existentes para compatibilidad.
