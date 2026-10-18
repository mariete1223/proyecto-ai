---
fingerprint: startup-permissions-prompt-freeze-on-activate
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/78
first_seen: 2026-10-18
last_seen: 2026-10-18
---

# Defect: Bloqueo / congelamiento al pulsar 'Activar Notificaciones y Voz' en StartupPermissionsPrompt

## Observed behaviour

Al iniciar la aplicación y pulsar el botón `[ 🚀 Activar Notificaciones y Voz ]` en el banner inicial `StartupPermissionsPrompt`, la interfaz se queda congelada/bloqueada ("pillada"), cambiando el botón a estado `Configurando...` y deshabilitando tanto el botón principal como el botón secundario `[ Ahora no ]`, impidiendo al usuario interactuar, descartar el aviso o continuar usando la aplicación con normalidad.

## Expected behaviour

Al pulsar `[ 🚀 Activar Notificaciones y Voz ]`:
1. Las llamadas a `notificationService.requestPermissions()` y `navigator.mediaDevices.getUserMedia()` deben ejecutarse con un límite de tiempo estricto (timeout de 4-5s) y de forma no bloqueante.
2. Si el navegador no soporta Web Notifications (ej. Safari iOS en pestaña normal no añadida a pantalla de inicio), si los permisos están bloqueados en el sistema operativo, o si el diálogo nativo no responde, la UI nunca debe quedarse congelada.
3. El botón `[ Ahora no ]` o un botón de cierre `✕` debe permanecer accesible para que el usuario pueda descartar el banner en cualquier momento.
4. Tras completar o vencer el timeout, el banner debe descartarse automáticamente y registrar la preferencia en `localStorage` para no volver a bloquear la pantalla.

## Reproduction

1. Abrir la aplicación en un navegador o dispositivo móvil (ej. Safari en iOS o Chrome) donde las notificaciones o el micrófono requieran confirmación o no estén en modo standalone.
2. Observar el banner superior `StartupPermissionsPrompt`.
3. Pulsar el botón `[ 🚀 Activar Notificaciones y Voz ]`.
4. Observar que el botón pasa a `Configurando...`, ambos botones quedan en `disabled={true}`, y si el navegador no resuelve inmediatamente las promesas nativas o bloquea la segunda solicitud secuencial de permisos tras perder el gesto de usuario (user gesture activation), la UI queda permanentemente bloqueada sin posibilidad de cancelar.

Frequency: 100% reproducible cuando una promesa de permisos del navegador no retorna o tarda en responder.

## Environment

- Client: Web / PWA móvil
- Device / Browser: iPhone Safari / Navegador Web móvil
- Frontend Component: `frontend/components/StartupPermissionsPrompt.tsx`

## Evidence

- Mensaje del usuario: *"le he dado a lo de activar las notificaciones y dictado de voz y se ha quedado pillado y no puedo tocar nada"*
- Código en `StartupPermissionsPrompt.tsx`:
  - `handleGrantPermissions` ejecuta `setIsRequesting(true)`.
  - Ambos botones tienen `disabled={isRequesting}`.
  - Se ejecuta secuencialmente `await notificationService.requestPermissions()` y luego `await navigator.mediaDevices.getUserMedia({ audio: true })` sin timeout (`Promise.race`) ni fallback de seguridad si la promesa del navegador queda pendiente o se silencia.

## Triage

- Classification: `confirmed`
- Impact: high (bloquea la interacción del usuario en la pantalla inicial).
- Facts:
  - `handleGrantPermissions` no cuenta con timeout ante promesas de permisos que no resuelven.
  - En WebKit / iOS Safari, solicitar `getUserMedia` tras un `await` pierde la activación transitoria de usuario (*user gesture*), lo que puede colgar o rechazar silenciosamente la llamada.
  - Al estar deshabilitado `[ Ahora no ]` durante `isRequesting`, el usuario no tiene ninguna vía de escape si el navegador no devuelve el control.
- Hypotheses:
  - Implementar un timeout de seguridad (ej. 4 segundos con `Promise.race`), desacoplar o paralelizar las peticiones de permisos, permitir descartar el banner en todo momento y no bloquear la interfaz resolverá completamente el problema.
- Missing information: Ninguna.
- Possible duplicates checked:
  - Issue #77: Feature original de solicitud de permisos (cerrada).
  - Issue #60, #61, #62: Notificaciones push y permisos de background (cerradas).
  - Ningún issue abierto ni previo reportando congelamiento de UI en `StartupPermissionsPrompt`.

## Publication history

- 2026-10-18: Intake registrado como borrador local. Pendiente de publicación en GitHub.
