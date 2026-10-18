## QA: PASS

- [x] **Ocultar aviso en reposo cuando el micrófono está listo** - PASS
  - En la pantalla inicial de dictado con micrófono listo (`voiceState === "IDLE"`), el banner informativo `voice-status-banner` queda totalmente suprimido.
  - La cadena "Micrófono listo para dictado" no se renderiza, optimizando el espacio vertical y situando el botón Hero de dictado en la parte superior.
- [x] **Mostrar aviso únicamente cuando no esté listo o en actividad** - PASS
  - Ante estados no listos (`voiceState === "ERROR"`), se renderiza el banner de alerta con advertencia ("⚠️ Micrófono no disponible para dictado") y estilos de error.
  - En estados activos (`voiceState === "LISTENING"` y `voiceState === "PROCESSING"`), se despliegan los indicadores dinámicos correspondientes ("🔴 GRABANDO VOZ..." y "⚡ Procesando voz...").
- [x] **Pruebas y calidad** - PASS
  - Test automatizado añadido en `VoiceCaptureFlow.test.tsx` (`hides status banner in idle when microphone is ready and shows warning only if not ready (#81)`).
  - Resultados de validación:
    - Frontend: `npm run check` (Prettier, ESLint, TypeScript `tsc --noEmit`, Jest: 37 suites pasadas, 252 tests pasados, 0 fallidos).
    - Backend: `..\backend\.venv\Scripts\python.exe -m pytest` (116 tests pasados, 0 fallidos).
