## QA: PASS

- [x] En `VoiceCaptureFlow.tsx`, cuando la caja de dictado en directo está activa (`showLiveDictation` es true), no se renderiza el bloque `liveDictationContent` ni el texto placeholder `"🎙️ Habla ahora..."` ni la duplicación de texto de transcripción encima del input - PASS
- [x] La caja de dictado (`live-dictation-box`) muestra en su cabecera el badge `EN DIRECTO` durante la escucha (`voiceState === "LISTENING"`) y, si se detectan entidades en tiempo real (categoría, fecha, etiquetas), se muestran como badges compactos en dicha cabecera - PASS
- [x] El campo de entrada de texto `TextInput` (`testID="input-transcript"`) se muestra directamente debajo de la cabecera sin elementos de texto intermedios que ocupen espacio vertical - PASS
- [x] El flujo de dictado por voz y edición manual se mantiene íntegro: el texto reconocido o escrito se vincula a `input-transcript` y pasa al paso de revisión al pulsar "⏹️ Detener y Procesar" - PASS
- [x] Los tests de frontend en `VoiceCaptureFlow.test.tsx` reflejan la ausencia del bloque redundante y verifican la presencia del badge `EN DIRECTO`, el `TextInput` y las entidades detectadas - PASS
- [x] `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest) - PASS

Tests:
- `npm --prefix frontend run check`: Prettier OK, ESLint OK (0 warnings), TypeScript OK, 37 test suites passed, 273 tests passed.
- `backend\.venv\Scripts\python.exe -m pytest backend/tests`: 119 passed, 5 skipped, 0 failed.
