## Software Engineer Implementation Report — Issue #152

### Root Cause
En `MobileHomeVoiceView.tsx`, el banner amarillo de estado de notificaciones (`testID="mobile-notif-status-banner"`) se renderizaba siempre que `notifStatus !== "granted"`. En una pestaña estándar de Safari en iOS (fuera del modo PWA en pantalla de inicio), `"Notification" in window` es `false`, por lo que `notificationService.getPermissionStatus()` y `notificationService.requestPermissions()` devuelven `"unsupported"`.
Como el renderizado del banner solo distinguía entre `"denied"` y cualquier otro estado distinto de `"granted"`, al pulsar **«Activar 🔔»** (`testID="btn-activate-notif-banner"`), `notifStatus` se actualizaba de `"unsupported"` a `"unsupported"` sin cambiar el título, la descripción ni ofrecer una acción de cierre/descarte. Además, cuando `StartupPermissionsPrompt` se completaba o cerraba en `App.tsx`, no notificaba el cambio de estado a `MobileHomeVoiceView`.

### Changes Made
1. **`frontend/components/MobileHomeVoiceView.tsx`**:
   - Añadido soporte explícito para el estado `"unsupported"` tras pulsar **«Activar 🔔»** (`showUnsupportedGuidance`), mostrando el título **«📲 Añade la web a Inicio en iPhone/iPad»** y las instrucciones claras para Safari en iOS (**Compartir (⬆️) → «Añadir a pantalla de inicio»**).
   - Añadidos botones de cierre y descarte explícitos (`testID="btn-dismiss-notif-banner"` con texto **«Entendido»** y `testID="btn-close-notif-banner"` con **«✕»**) tanto para el estado `"unsupported"` guiado como para el estado `"denied"`, persistiendo el descarte en `window.localStorage` (`MOBILE_NOTIF_BANNER_DISMISSED_KEY = "voxdaily_notif_banner_dismissed"`).
   - Protegida la solicitud de permisos con `withTimeout(..., 3500, fallbackStatus)` y activación inmediata de `notificationService.subscribeToWebPush()` cuando el permiso pasa a `"granted"`.
   - Sincronizado el estado del banner mediante `useEffect` dependiente de `refreshSignal` y suscripción a `notificationService.onPermissionChange`.
2. **`frontend/services/notificationService.ts`**:
   - Añadido `onPermissionChange` / `emitPermissionChange` para propagar en tiempo real los cambios de estado de permisos de notificación entre componentes (`StartupPermissionsPrompt` y `MobileHomeVoiceView`).
3. **`frontend/App.tsx`**:
   - Conectado `onComplete={() => setLastSyncTime(Date.now())}` en `<StartupPermissionsPrompt />` para refrescar inmediatamente `MobileHomeVoiceView` al completar o descartar el banner superior.
4. **`frontend/components/MobileHomeVoiceView.test.tsx`**:
   - Añadidas pruebas unitarias de regresión cubriendo los flujos `"unsupported"` (instrucciones para iOS Safari y descarte persistente en `localStorage`), `"denied"`, `"granted"` (incluyendo llamada a `subscribeToWebPush`) y la sincronización vía `refreshSignal`.
