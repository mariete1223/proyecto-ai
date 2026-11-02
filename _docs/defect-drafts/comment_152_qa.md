## QA: PASS

- [x] Al pulsar **«Activar 🔔»** (`testID="btn-activate-notif-banner"`) en el banner amarillo de `MobileHomeVoiceView` cuando `notificationService.requestPermissions()` devuelve `"unsupported"` (p. ej. pestaña de Safari en iOS donde `"Notification" in window` es `false`), el banner no se queda sin hacer nada: actualiza su título y descripción para explicar cómo habilitar notificaciones en iOS/Safari (indicando que en iPhone/iPad es necesario pulsar **Compartir** y seleccionar **«Añadir a pantalla de inicio»** para activar las notificaciones Web Push) y muestra un botón de acción explícito (**«Entendido»** / **«✕»**) para descartar/ocultar el banner - PASS
- [x] Al pulsar el botón de cierre/descarte (**«Entendido»** / **«✕»**) del banner amarillo en `MobileHomeVoiceView`, el banner se oculta inmediatamente y persiste el descarte en `localStorage` para que no vuelva a quedarse bloqueado en pantalla en recargas posteriores - PASS
- [x] Al pulsar **«Activar 🔔»** en el banner amarillo de `MobileHomeVoiceView` cuando `notificationService.requestPermissions()` devuelve `"granted"`, el banner desaparece inmediatamente (`testID="mobile-notif-status-banner"` deja de renderizarse) y se activa la suscripción Web Push (`notificationService.subscribeToWebPush()`) si hay sesión/backend configurados - PASS
- [x] Al pulsar **«Activar 🔔»** en el banner amarillo de `MobileHomeVoiceView` cuando `notificationService.requestPermissions()` devuelve `"denied"`, el banner actualiza su vista al estado bloqueado (**«🚫 Notificaciones bloqueadas»**) con las instrucciones para habilitar el permiso desde el navegador y ofrece también la opción de cerrar/descartar el banner - PASS
- [x] Cuando el usuario completa o cierra el banner superior `StartupPermissionsPrompt` (ya sea concediendo permisos o pulsando «Ahora no» / «Entendido» / «✕»), `MobileHomeVoiceView` refresca y sincroniza el estado de su banner de notificaciones sin requerir recargar la página ni mostrar dos avisos contradictorios - PASS
- [x] Existen pruebas unitarias de regresión en `frontend/components/MobileHomeVoiceView.test.tsx` que verifican los flujos `"unsupported"` (pestaña de iOS Safari: muestra instrucciones de pantalla de inicio tras pulsar «Activar 🔔» y permite descartar el banner), `"denied"` y `"granted"` en el banner amarillo, así como la sincronización del estado - PASS

Tests:
- `npm --prefix frontend test -- components/MobileHomeVoiceView.test.tsx --watchAll=false`: 1 suite passed, 8 passed, 0 failed
- `npm --prefix frontend test -- StartupPermissionsPrompt notificationService --watchAll=false`: 2 suites passed, 23 passed, 0 failed
- `npm --prefix frontend run format:check`: passed (0 issues)
- `npm --prefix frontend run lint`: passed (0 warnings, 0 errors)
- `npm --prefix frontend run typecheck`: passed (0 errors)
