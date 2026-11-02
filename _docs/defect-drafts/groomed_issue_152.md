## Goal

Al pulsar **«Activar 🔔»** en el banner amarillo **«🔔 Notificaciones inactivas»** dentro de `MobileHomeVoiceView`, el botón nunca se queda inerte: si las notificaciones del sistema se conceden (`"granted"`), el banner desaparece de inmediato y registra la suscripción Web Push; si el navegador no expone la API de notificaciones (`"unsupported"`, como una pestaña estándar de Safari en iOS fuera del modo standalone en pantalla de inicio), el banner muestra instrucciones claras para habilitar notificaciones en iOS (añadir la web app a la pantalla de inicio) y permite cerrarlo/descartarlo de forma persistente; y cuando `StartupPermissionsPrompt` finaliza (activando o descartando permisos), el banner amarillo sincroniza su estado automáticamente.

## Acceptance criteria

- [ ] Al pulsar **«Activar 🔔»** (`testID="btn-activate-notif-banner"`) en el banner amarillo de `MobileHomeVoiceView` cuando `notificationService.requestPermissions()` devuelve `"unsupported"` (p. ej. pestaña de Safari en iOS donde `"Notification" in window` es `false`), el banner no se queda sin hacer nada: actualiza su título y descripción para explicar cómo habilitar notificaciones en iOS/Safari (indicando que en iPhone/iPad es necesario pulsar **Compartir** y seleccionar **«Añadir a pantalla de inicio»** para activar las notificaciones Web Push) y muestra un botón de acción explícito (**«Entendido»** / **«✕»**) para descartar/ocultar el banner.
- [ ] Al pulsar el botón de cierre/descarte (**«Entendido»** / **«✕»**) del banner amarillo en `MobileHomeVoiceView`, el banner se oculta inmediatamente y persiste el descarte en `localStorage` para que no vuelva a quedarse bloqueado en pantalla en recargas posteriores.
- [ ] Al pulsar **«Activar 🔔»** en el banner amarillo de `MobileHomeVoiceView` cuando `notificationService.requestPermissions()` devuelve `"granted"`, el banner desaparece inmediatamente (`testID="mobile-notif-status-banner"` deja de renderizarse) y se activa la suscripción Web Push (`notificationService.subscribeToWebPush()`) si hay sesión/backend configurados.
- [ ] Al pulsar **«Activar 🔔»** en el banner amarillo de `MobileHomeVoiceView` cuando `notificationService.requestPermissions()` devuelve `"denied"`, el banner actualiza su vista al estado bloqueado (**«🚫 Notificaciones bloqueadas»**) con las instrucciones para habilitar el permiso desde el navegador y ofrece también la opción de cerrar/descartar el banner.
- [ ] Cuando el usuario completa o cierra el banner superior `StartupPermissionsPrompt` (ya sea concediendo permisos o pulsando «Ahora no» / «Entendido» / «✕»), `MobileHomeVoiceView` refresca y sincroniza el estado de su banner de notificaciones sin requerir recargar la página ni mostrar dos avisos contradictorios.
- [ ] Existen pruebas unitarias de regresión en `frontend/components/MobileHomeVoiceView.test.tsx` que verifican los flujos `"unsupported"` (pestaña de iOS Safari: muestra instrucciones de pantalla de inicio tras pulsar «Activar 🔔» y permite descartar el banner), `"denied"` y `"granted"` en el banner amarillo, así como la sincronización del estado.

## Out of scope

- Modificar el servicio backend de envío Web Push (`src/api/push_worker.py`) o la generación de claves VAPID (cubierto previamente en #148).
- Implementar notificaciones nativas APNs mediante empaquetado nativo de iOS fuera de la PWA Web Push estándar.

## Constraints

- **Archivos afectados**:
  - `frontend/components/MobileHomeVoiceView.tsx`
  - `frontend/components/StartupPermissionsPrompt.tsx` (y/o `frontend/App.tsx` para la propagación/sincronización al completar `StartupPermissionsPrompt`)
  - `frontend/services/notificationService.ts` (solo si se requiere exponer helper o evento de sincronización de estado/descarte)
  - `frontend/components/MobileHomeVoiceView.test.tsx`
- **Dependencias**: No añadir ninguna dependencia nueva en `package.json` ni `pyproject.toml`.
- **Estándares de calidad**: Seguir las reglas de `AGENTS.md` (diseño adaptativo, sin hacks ni alturas fijas arbitrarias, manejo seguro de `window.localStorage` y `Notification` en entornos web/SSR/test).

---

## Defect Context & Evidence

### Observed behaviour
En iOS Safari (`voxdaily.vercel.app`), dentro de la pantalla de inicio móvil (`MobileHomeVoiceView`), aparece la tarjeta amarilla **«🔔 Notificaciones inactivas — Actívalas para que tus avisos y alertas te despierten incluso con la pantalla apagada»** con el botón **«Activar 🔔»**. Al pulsar el botón **«Activar 🔔»**, no ocurre absolutamente nada: no se solicita permiso del sistema, no cambia el estado del banner, no se muestra ningún mensaje explicativo ni opción para ocultarlo. En cambio, el otro banner emergente de permisos (`StartupPermissionsPrompt`) sí responde al pulsarlo.

### Expected behaviour
- Si el navegador soporta `Notification.requestPermission()`, debe solicitarse el permiso y actualizarse el estado del banner en consecuencia (ocultándose al pasar a `"granted"` y registrando Web Push).
- Si el entorno devuelve `"unsupported"` (como una pestaña normal de Safari en iOS fuera del modo standalone en pantalla de inicio), pulsar **«Activar 🔔»** debe informar claramente al usuario de cómo habilitarlas en iOS (añadir la web app a la pantalla de inicio) y permitir descartar/cerrar el aviso de forma persistente.
- Si el usuario activa o descarta las notificaciones desde `StartupPermissionsPrompt`, el banner amarillo de `MobileHomeVoiceView` debe sincronizar su estado sin quedar desfasado.

### Reproduction
1. Abrir `https://voxdaily.vercel.app` en Safari en iOS (pestaña del navegador).
2. En la pestaña «Captura» (`MobileHomeVoiceView`), observar el banner amarillo «🔔 Notificaciones inactivas».
3. Pulsar el botón «Activar 🔔».
4. Observar que el botón no realiza ninguna acción visible y el banner permanece idéntico.

- **Frequency**: Siempre (100%) en pestaña de navegador iOS Safari donde `"Notification" in window` es `false`.

### Environment & Evidence
- **Client**: Web móvil (`https://voxdaily.vercel.app`)
- **Device / Browser**: iOS Safari (pestaña estándar del navegador)
- **Evidence**: Captura de pantalla aportada por el usuario mostrando `voxdaily.vercel.app` en iOS Safari con el banner amarillo «🔔 Notificaciones inactivas» y el botón «Activar 🔔», junto con el reporte: *"lo de notificaciones inactivas la alerta si estoy en safari, si pulso en boton no hace nada, me refieo la notificacion amarilla, la otra si funciona."*

### Persisted Data Repair
- **Base de datos (SQLite / Postgres)**: No requiere migración ni reparación de datos existentes en la base de datos.
- **Almacenamiento local (`localStorage`)**: Sincronizar o persistir la clave de descarte del banner en `localStorage` para que los usuarios en navegadores sin soporte (`"unsupported"`) o que descarten explícitamente el aviso no sufran un banner bloqueado permanentemente.
