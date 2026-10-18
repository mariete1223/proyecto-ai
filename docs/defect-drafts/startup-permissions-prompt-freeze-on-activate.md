---
fingerprint: startup-permissions-prompt-freeze-on-activate
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/78
first_seen: 2026-10-18
last_seen: 2026-10-18
---

# Defect: Bloqueo / congelamiento al pulsar 'Activar Notificaciones y Voz' en StartupPermissionsPrompt

## Observed behaviour

Al iniciar la aplicación y pulsar el botón `[ 🚀 Activar Notificaciones y Voz ]` en el banner inicial `StartupPermissionsPrompt`:
1. El banner muestra el mensaje de éxito *"✅ ¡Permisos activados para avisos y voz!"*.
2. Sin embargo, la pantalla permanece totalmente congelada (*freeze*): el usuario no puede hacer clic en ningún elemento de la interfaz (botones de navegación, pestañas, entradas, etc.) ni se recupera la respuesta táctil.

## Expected behaviour

Al pulsar `[ 🚀 Activar Notificaciones y Voz ]`:
1. La solicitud de permisos de notificaciones debe ejecutarse sin bloquear ni alterar la sesión de audio del sistema.
2. No debe invocarse `navigator.mediaDevices.getUserMedia` en el inicio sin una grabación activa, ya que WebKit (Safari en iOS) bloquea el hilo de renderizado y el dispatch de eventos táctiles al inicializar y cerrar de inmediato sesiones de captura de audio hardware (`AVAudioSession`).
3. El banner debe desaparecer de forma inmediata tras confirmar y la pantalla debe permanecer 100% interactiva en todo momento.

## Reproduction

1. Abrir la aplicación en un dispositivo móvil con iOS (Safari o PWA).
2. En el banner `StartupPermissionsPrompt`, pulsar `[ 🚀 Activar Notificaciones y Voz ]`.
3. Conceder o gestionar el diálogo de permisos si aparece.
4. Observar que aparece el cartel *"✅ ¡Permisos activados para avisos y voz!"*, pero la pantalla queda en estado freeze y no responde a ningún tap/click.

Frequency: 100% reproducible en Safari iOS cuando se invoca `getUserMedia` en el inicio.

## Environment

- Client: Web / PWA móvil
- Device / Browser: iPhone Safari / iOS WebKit
- Frontend Component: `frontend/components/StartupPermissionsPrompt.tsx`

## Evidence

- Mensaje del usuario: *"Me pone que se han activado los permisos pero no me deja clickar nada se ha queado freeze la pantalla"*.
- Código en `StartupPermissionsPrompt.tsx`:
  - Se ejecuta `navigator.mediaDevices.getUserMedia({ audio: true })` y se detienen las pistas con `track.stop()`. En WebKit iOS, abrir y cerrar el dispositivo de audio hardware sin un `AudioContext` de streaming activo causa un bloqueo en el hilo de eventos de WebKit.
  - La captura de voz en la app utiliza `SpeechRecognition` / `webkitSpeechRecognition` (en `VoiceRecognitionService`), que solicita sus propios permisos al empezar a grabar sin necesidad de llamar a `getUserMedia` preventivamente.

## Triage

- Classification: `confirmed`
- Impact: high (bloquea la usabilidad de la aplicación en dispositivos móviles).
- Facts:
  - El mensaje *"✅ ¡Permisos activados para avisos y voz!"* se mostró con éxito, demostrando que `handleGrantPermissions` completó las llamadas iniciales.
  - La congelación de la pantalla persiste tras mostrarse dicho mensaje.
  - La invocación de `getUserMedia` y `track.stop()` en WebKit iOS es conocida por bloquear el despacho de eventos táctiles y congelar la vista web.
- Hypotheses:
  - Eliminar la llamada preventiva a `getUserMedia` (innecesaria porque `SpeechRecognition` solicita el micro de forma nativa al pulsar el botón de dictar) y asegurar el cierre inmediato del banner resolverá de forma definitiva el freeze.
- Missing information: Ninguna.
- Possible duplicates checked:
  - Reabierto sobre la huella idéntica en Issue #78.

## Publication history

- 2026-10-18: Intake inicial registrado y publicado como Issue #78.
- 2026-10-18: Reabierto tras evidenciarse que la pantalla sigue congelada tras mostrarse el mensaje de confirmación de permisos.
