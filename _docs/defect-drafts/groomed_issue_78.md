# Groomed Task: Issue #78 (Recurrence Fix) - Eliminación de freeze en pantalla al activar permisos

## Goal

Eliminar de forma definitiva la congelación (*screen freeze*) de la interfaz al pulsar `[ 🚀 Activar Notificaciones ]` suprimiendo la llamada preventiva a `navigator.mediaDevices.getUserMedia` (que bloquea el hilo de despacho de eventos táctiles en WebKit iOS), gestionando las notificaciones con timeout seguro y asegurando un cierre inmediato y no bloqueante del banner.

## Context & Defect Details

- **Affected Component**: `frontend/components/StartupPermissionsPrompt.tsx`
- **Reproducible Current Behaviour**:
  - Al pulsar el botón de activar permisos, el mensaje *"✅ ¡Permisos activados para avisos y voz!"* se muestra en pantalla.
  - Sin embargo, la pantalla permanece congelada (*freeze*): no responde a toques, clics de navegación, pestañas ni botones.
  - La causa raíz demostrada es la invocación de `navigator.mediaDevices.getUserMedia({ audio: true })` seguida de `track.stop()`, lo cual en WebKit (Safari en iOS) deja bloqueada la sesión de audio del hardware (`AVAudioSession`) y congela la cola de eventos táctiles de la vista web.
  - Además, la función de dictado por voz de la app utiliza `SpeechRecognition` (en `VoiceRecognitionService`), que solicita sus propios permisos nativos al dictar sin requerir `getUserMedia`.
- **Expected Behaviour**:
  - `StartupPermissionsPrompt` solicita exclusivamente los permisos de notificaciones mediante `notificationService.requestPermissions()` con timeout de seguridad.
  - No se invoca `getUserMedia` en el arranque de la app.
  - Al pulsar el botón de activar o al pulsar "Ahora no", el banner se descarta de forma rápida y la pantalla permanece 100% interactiva sin ningún freeze.
- **Evidence & Environment**:
  - Reporte de usuario: *"Me pone que se han activado los permisos pero no me deja clickar nada se ha queado freeze la pantalla"*.
  - Dispositivos móviles iOS Safari / PWA.
- **Data Repair**: No se requiere reparación en base de datos.
- **Regression Coverage**:
  - Tests unitarios en `frontend/components/StartupPermissionsPrompt.test.tsx`.

## Acceptance Criteria

- [ ] Se elimina completamente la invocación de `navigator.mediaDevices.getUserMedia` de `StartupPermissionsPrompt.tsx`.
- [ ] La solicitud de permisos de notificaciones se ejecuta con protección de timeout (3.5s) y auto-descarte fluido.
- [ ] La pantalla permanece 100% interactiva tras conceder o descartar los permisos (sin bloqueos de eventos táctiles).
- [ ] El botón de cierre `✕` y el botón `[ Ahora no ]` permanecen operativos en todo momento.
- [ ] Toda la suite de frontend (`npm run check`) pasa al 100% con 0 errores de formateo, tipos, linter y tests.

## Out of scope

- Modificaciones en `voiceRecognition.ts` (SpeechRecognition sigue solicitando el micrófono cuando el usuario pulsa para dictar).
- Modificaciones en la base de datos o backend.

## Constraints

- Archivos a modificar: `frontend/components/StartupPermissionsPrompt.tsx` y `frontend/components/StartupPermissionsPrompt.test.tsx`.
- Cero dependencias adicionales.
