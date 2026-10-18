## Goal

Rediseñar la interfaz de dictado por voz en `VoiceCaptureFlow.tsx` para proporcionar un botón principal de dictado estilo "Hero", mucho más grande, prominente y accesible para el pulgar en pantallas móviles, con estados visuales claros e inequívocos tanto para iniciar el dictado ("🎙️ Toca para Dictar") como para detenerlo ("⏹️ Detener Dictado y Procesar"), reorganizando el espacio vertical para que la tarjeta de texto dictado en directo ("Lo que estás diciendo") y los controles secundarios ("Limpiar", "Salir") estén ordenados de forma intuitiva y ergonómica.

## Acceptance criteria

- [ ] En `VoiceCaptureFlow.tsx`:
  - El botón de inicio de dictado (`testID="btn-start-listening"`) ocupa el ancho completo de la tarjeta con estilo Hero (`minHeight: 56`, `borderRadius: 14`, color cyan `#38BDF8`, tipografía destacada de tamaño >= 16px con subtítulo de guía).
  - El botón de detención de dictado (`testID="btn-stop-listening"`) es igualmente prominente (`minHeight: 56`, `borderRadius: 14`, color rojo vibrante `#EF4444`, texto visible "⏹️ Detener Dictado y Procesar").
  - Los botones de control secundario ("🔄 Limpiar" y "✕ Salir") se ubican en una fila secundaria compacta y equilibrada sin competir por el espacio principal del botón de dictado.
  - La tarjeta "Lo que estás diciendo" (`live-dictation-box`) optimiza el espacio con tipografía limpia y espaciosa (`fontSize: 17`, `lineHeight: 24`) para visualizar con total claridad el texto en tiempo real.
- [ ] En `MobileHomeVoiceView.tsx`:
  - Se mantiene la consistencia visual y de interacción con el botón central de micrófono hero.
- [ ] Pruebas unitarias actualizadas y pasando (241/241 frontend, 116/116 backend).

## Out of scope

- Solicitud guiada y proactiva de permisos al iniciar la app (reservado para Issue #77).

## Constraints

- Archivos: `frontend/components/VoiceCaptureFlow.tsx`, `frontend/components/MobileHomeVoiceView.tsx`, y pruebas correspondientes.
- Conservar todos los testIDs existentes (`btn-start-listening`, `btn-stop-listening`, `btn-reset-voice-capture`, `btn-close-voice-flow`, `live-dictation-box`, `input-transcript`, `btn-parse-transcript`).
