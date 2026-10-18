## QA: PASS

- [x] **Pantalla de reposo (Paso 1: Dictado sin grabación activa ni texto)** - PASS
  - En reposo (*idle* sin texto), `live-dictation-box` no se renderiza en la vista, eliminando el cuadro "Lo que estás diciendo".
  - La fila `secondaryControlsRow` ("🔄 Limpiar") permanece oculta durante el estado de reposo.
  - La pantalla inicial muestra limpiamente el botón principal de dictado ("🎙️ Toca para Dictar") y la guía de comandos de voz ("chuleta") inmediatamente debajo.
- [x] **Durante y después del dictado** - PASS
  - Al activar la escucha o al existir transcripción, `live-dictation-box` se despliega mostrando el badge "EN DIRECTO", la transcripción y el analizador de ondas.
  - La botonera secundaria aparece con el botón "🔄 Limpiar" habilitado para vaciar la transcripción y volver al estado inicial.
- [x] **Botón superior de cierre en la cabecera** - PASS
  - En `MobileHomeVoiceView.tsx`, `closeModalButton` se actualizó con fondo `rgba(239, 68, 68, 0.2)`, borde `#EF4444` (1.5px), texto rojo `#EF4444` en negrita de 14px y padding amplio (8px vertical, 14px horizontal).
  - En `VoiceCaptureFlow.tsx`, se integró `btn-header-close-voice` arriba a la derecha cuando `onClose` está activo, manteniendo el mismo diseño rojo táctil.
- [x] **Pruebas y calidad** - PASS
  - Tests unitarios en `VoiceCaptureFlow.test.tsx` y `MobileHomeVoiceView.test.tsx` adaptados y pasando al 100%.
  - Pruebas ejecutadas:
    - Frontend: `npm run check` (Prettier, ESLint, TypeScript `tsc --noEmit`, Jest: 37 suites pasadas, 251 tests pasados, 0 fallidos).
    - Backend: `..\backend\.venv\Scripts\python.exe -m pytest` (116 tests pasados, 0 fallidos).
