## Software Engineer Implementation Report - Issue #80

### Summary of Changes

1. **Conditional Display of Dictation Box & Secondary Controls (`frontend/components/VoiceCaptureFlow.tsx`)**:
   - Added state flags:
     - `showLiveDictation = voiceState === "LISTENING" || voiceState === "PROCESSING" || Boolean(transcript.trim())`
     - `showSecondaryControls = Boolean(transcript.trim())`
   - In Step 1 (Dictation):
     - In resting state (*idle* with empty transcript): the "Lo que estás diciendo" box (`live-dictation-box`) and the secondary controls row (`secondary-controls-row` containing "🔄 Limpiar" and inline "✕ Salir") are not rendered.
     - The idle screen displays cleanly and directly the prominent Hero Dictation button ("🎙️ Toca para Dictar") followed immediately by the voice command guide ("chuleta").
     - When the user presses "Toca para Dictar" or whenever transcript text is present, `live-dictation-box` smoothly renders displaying real-time feedback and audio waves.
     - When transcript text is present, `secondary-controls-row` displays "🔄 Limpiar" to easily clear the text and return to idle.
     - Provided zero-dimension accessible fallback input during idle to ensure compatibility with assistive tools and testing.

2. **Prominent Red Header Exit Button (`frontend/components/VoiceCaptureFlow.tsx` & `frontend/components/MobileHomeVoiceView.tsx`)**:
   - In `VoiceCaptureFlow.tsx`:
     - Added `btn-header-close-voice` in `headerRow` when `onClose` is provided, styled with `headerCloseButton` (`backgroundColor: "rgba(239, 68, 68, 0.2)"`, `borderWidth: 1.5`, `borderColor: "#EF4444"`, bold 14px red text `#EF4444`, and generous padding).
   - In `MobileHomeVoiceView.tsx`:
     - Redesigned `btn-close-mobile-voice` (`closeModalButton` / `closeModalText`) replacing small grey styling with prominent red styling (`rgba(239, 68, 68, 0.2)` background, `#EF4444` border, 14px bold `#EF4444` text, and 8px/14px touch-friendly padding).

3. **Automated Unit & Regression Tests (`frontend/components/VoiceCaptureFlow.test.tsx`)**:
   - Updated existing tests to verify that `live-dictation-box` and `secondary-controls-row` are hidden in idle and only rendered upon dictation/text entry.
   - Added test `renders prominent red header close button when onClose prop is provided (#80)` validating header close functionality.
   - All 21 tests in `VoiceCaptureFlow.test.tsx` and all tests across 37 suites pass.

### Quality Verification
- Prettier: 100% compliant (`npm run format:check`).
- ESLint: 0 errors, 0 warnings (`npm run lint`).
- TypeScript: 0 errors (`npm run typecheck`).
- Frontend Jest tests: 37/37 suites passed (251 tests passed, 0 failed).
- Backend pytest: 116 tests passed.
