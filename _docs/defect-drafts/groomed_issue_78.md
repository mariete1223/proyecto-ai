# Groomed Task: Issue #78 - Bloqueo / congelamiento al pulsar 'Activar Notificaciones y Voz' en StartupPermissionsPrompt

## Goal

Garantizar que el banner inicial `StartupPermissionsPrompt` nunca bloquee ni congele la aplicación, aplicando límites de tiempo estrictos (timeouts de seguridad) a las solicitudes de permisos nativas del navegador, manteniendo el botón de descarte ("Ahora no") y un botón de cierre accesibles en todo momento, y cerrando el banner limpiamente en caso de éxito, rechazo o demora del sistema.

## Context & Defect Details

- **Affected Component**: `frontend/components/StartupPermissionsPrompt.tsx`
- **Reproducible Current Behaviour**:
  - Al pulsar `[ 🚀 Activar Notificaciones y Voz ]`, el componente ejecuta `setIsRequesting(true)`.
  - Ambos botones quedan deshabilitados (`disabled={true}`).
  - Se ejecutan de forma asíncrona y secuencial `await notificationService.requestPermissions()` y `await navigator.mediaDevices.getUserMedia({ audio: true })` sin límite de tiempo.
  - En navegadores como Safari iOS (fuera de PWA standalone) o navegadores donde la promesa nativa no responde de inmediato o se pierde la activación del gesto de usuario, las promesas quedan en espera indefinida.
  - El usuario queda atrapado en estado `Configurando...` sin poder tocar nada ni descartar el aviso.
- **Expected Behaviour**:
  - Las peticiones de permisos de notificación y micrófono se ejecutan con salvaguarda de timeout (máximo 4 segundos por operación mediante `Promise.race`).
  - El botón `[ Ahora no ]` y un botón de cierre rápido `✕` permanecen operativos y nunca se deshabilitan, permitiendo al usuario descartar el banner en cualquier momento.
  - Si los permisos se conceden, se muestra confirmación y se cierra. Si se deniegan o se agota el tiempo de espera, se guarda la preferencia en `localStorage` y el banner se oculta automáticamente sin bloquear al usuario.
- **Evidence & Environment**:
  - Reporte de usuario: *"le he dado a lo de activar las notificaciones y dictado de voz y se ha quedado pillado y no puedo tocar nada"*.
  - Dispositivos móviles y web Safari / Chrome.
- **Data Repair**: No se requiere reparación en base de datos.
- **Regression Coverage**:
  - Tests unitarios en `frontend/components/StartupPermissionsPrompt.test.tsx` cubriendo timeout de permisos, descarte durante petición y cierre rápido.

## Acceptance Criteria

- [ ] Las solicitudes de permisos de notificaciones y micrófono están protegidas por un timeout de seguridad (máximo 4 segundos) que impide que la UI quede esperando indefinidamente.
- [ ] El botón `[ Ahora no ]` y/o un botón de cierre rápido `✕` en la cabecera del banner se pueden presionar en todo momento, incluso mientras se procesa la solicitud (`isRequesting`).
- [ ] Si el navegador o el sistema operativo no responden dentro del tiempo límite, el estado `isRequesting` se libera, se almacena el descarte en `localStorage` y el banner se cierra automáticamente.
- [ ] Al conceder permisos normalmente, se muestra el mensaje de éxito y se oculta el banner en ~1 segundo.
- [ ] Toda la suite de pruebas unitarias (`npm run check`) pasa al 100% sin errores de linter ni de formato.

## Out of scope

- Modificaciones en la lógica de procesamiento de audio o síntesis de voz en `voiceParser.ts`.
- Cambios en el backend ni en la base de datos.

## Constraints

- Archivos a modificar: `frontend/components/StartupPermissionsPrompt.tsx` y `frontend/components/StartupPermissionsPrompt.test.tsx`.
- Mantener compatibilidad con Expo Web y navegadores móviles.
- Sin nuevas dependencias en `package.json`.
