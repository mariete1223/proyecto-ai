### Software Engineer Implementation Report: Issue #85

#### Changes implemented

1. **Header Cleanup & Deduplication (`VoiceCaptureFlow.tsx` & `MobileHomeVoiceView.tsx`)**:
   - Removed the duplicate title `"Captura Hablada por Voz"` from the step 1 flow in `VoiceCaptureFlow.tsx`.
   - Removed the duplicate/redundant `"✕ Salir"` button (`btn-header-close-voice`) from `VoiceCaptureFlow.tsx`, leaving only the single top-level `"✕ Cerrar"` button (`btn-close-mobile-voice`) in `MobileHomeVoiceView.tsx`.
   - Cleaned up the header layout to display the step indicator badge (`Paso 1 de 2: Dictado`) directly and uncluttered.

2. **Streamlined Transcription & Live Entity Breakdown (`VoiceCaptureFlow.tsx`)**:
   - Removed the static header label `"🗣️ Lo que estás diciendo:"`.
   - Removed the verbose placeholder text `"🎙️ Escuchando... Di tu comando (ej: 'tarea fecha hoy contenido comprar pan')"`.
   - Replaced with a direct, real-time transcription container showing the spoken words as they are recognized.
   - Added real-time entity breakdown (`liveParsed` via `parseSpokenCommand`): if a category (`📁`), date (`📅`), or tags (`#`) are detected in the speech, they are rendered dynamically as compact visual chips beneath the transcription box.
   - Added unmount cleanup on `voiceService.cancel()` to ensure no background recognition or audio listeners linger.

3. **Anchored Bottom Navigation Bar on Mobile Viewport (`MobileMainLayout.tsx` & `index.html`)**:
   - Updated `.bottomTabBar` in `MobileMainLayout.tsx` with:
     - `position: (Platform.OS === "web" ? "fixed" : "absolute") as any`
     - `bottom: 0`, `left: 0`, `right: 0`, `zIndex: 100`
     - Safe padding for iOS devices (`isIosDevice ? 24 : 6`) to accommodate the home indicator bar.
   - Updated `MobileMainLayout` root web container with `minHeight: "100dvh"` and `height: "100dvh"`.
   - Updated `frontend/public/index.html` root, body, and html styles with `min-height: 100dvh; min-height: -webkit-fill-available;` to eliminate any bottom gap across iOS Safari and mobile PWA standalone mode.

4. **Testing & Validation**:
   - Updated `VoiceCaptureFlow.test.tsx` to assert the removal of `"Captura Hablada por Voz"` and `"✕ Salir"`, the presence of live transcription and parsed entity chips.
   - Updated `MobileMainLayout.test.tsx` to assert bottom anchor styles (`bottom: 0`, `left: 0`, `right: 0`, `zIndex: 100`).
   - Updated `MobileHomeVoiceView.test.tsx` to verify clean modal opening and closing with `"✕ Cerrar"` without duplicate header elements.
