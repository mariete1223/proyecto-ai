### Software Engineer Implementation Report: Issue #89

#### Summary of Changes

1. **Repositioned Main Action Button to the Top**:
   - In `frontend/components/VoiceCaptureFlow.tsx` (Step 1 `DICTATE`): `heroButtonContainer` is now the very first element inside `screenContainer`.
   - In idle state without text: displays `testID="btn-start-listening"` (`"🎙️ Toca para Dictar"`).
   - In active listening state (`voiceState === "LISTENING"`) or with text ready to process: displays `testID="btn-stop-listening"` (`"⏹️ Detener y Procesar"`). Pressing it stops listening (if active) and directly processes the transcription to review.

2. **Removed 'GRABANDO VOZ...' Banner**:
   - Removed `statusBanner` (`"🔴 GRABANDO VOZ... Habla tu comando o nota"`), eliminating screen clutter since recording status is directly communicated by the prominent active red button, the animated wave visualizer, and the `"EN DIRECTO"` live badge.

3. **Removed Redundant 'Procesar' Button from Transcription Display**:
   - In `manualTranscriptRow`, removed `btn-parse-transcript` (`"🔍 Procesar"`).
   - The text input spans full width cleanly, and transcription processing is triggered exclusively via the top hero button `"Detener y Procesar"`.

4. **Removed Secondary 'Limpiar' and 'Salir' Controls**:
   - Removed `secondaryControlsRow` (`btn-reset-voice-capture` `"🔄 Limpiar"` and `btn-close-voice-flow` `"✕ Salir"`).
   - Modal/screen exit remains cleanly managed by the top modal header (`✕ Cerrar`).

5. **Testing & Quality**:
   - In `frontend/components/VoiceCaptureFlow.test.tsx`:
     - Updated all parsing tests to trigger through `btn-stop-listening`.
     - Added dedicated test `simplifies dictate screen: hero button first, no status banner, no redundant parse button, no secondary controls (#89)`.
   - `npm --prefix frontend run check`: 37 test suites, 259 tests passed. Prettier clean, ESLint 0 warnings, TypeScript 0 errors.
   - Backend `pytest`: 117 tests passed, 5 skipped.
