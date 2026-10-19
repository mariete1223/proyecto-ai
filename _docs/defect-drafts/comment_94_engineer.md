### Implementación Software Engineer (Issue #94)

Se ha completado la resolución del fallo de entrega de notificaciones Web Push con la aplicación cerrada y la automatización del recordatorio para la categoría Alerta sin casillas manuales:

1. **Alerta automática a la hora exacta sin casilla manual**:
   - En `frontend/components/EntryForm.tsx`, cuando la categoría seleccionada es "Alerta" (`isCategoryAlert`), no se muestra el conmutador/casilla manual de activación de recordatorios.
   - En su lugar, se muestra un banner explicativo (`alertNoticeBox` / `alert-auto-reminder-notice`) que indica que la alarma sonará y notificará en el momento exacto programado (`offset_minutes: 0`).
   - `effectiveReminderEnabled` se establece incondicionalmente a `true` y `effectiveOffset` a `0`.
   - Para el resto de categorías (Eventos, Tareas, etc.), la activación del recordatorio sigue dependiendo del conmutador manual (`ReminderConfigSection`), evitando que se auto-active involuntariamente al seleccionar una fecha.
2. **Sincronización pre-cierre garantizada**:
   - En `EntryForm.tsx`, antes de cerrar el formulario y notificar éxito, se ejecuta y espera (`await performSync(...)`) la sincronización hacia el backend (`POST /api/v1/sync/push`) siempre que `apiConfig` esté presente y el recordatorio esté activo.
   - En `frontend/App.tsx`, tanto `EntryForm.onSuccess` como `VoiceCaptureFlow.onEntryCreated` y `MobileHomeVoiceView.onEntryCreated` esperan (`await loadDatabaseState(true)`) antes de cerrar los modales o cambiar de pantalla.
   - De este modo, los datos quedan persistidos en `backend/app.db` antes de que el usuario pueda bloquear la pantalla o cerrar la PWA móvil en iOS.
3. **Service Worker con opciones de sonido nativas en iOS**:
   - En `frontend/public/sw.js`, se ha añadido `sound: "default"` a las opciones de `showNotification` en los listeners de `push` y de mensaje, garantizando que WebKit en iOS emita el tono de aviso en la pantalla de bloqueo.
4. **Tests y Calidad**:
   - Se añadieron tests en `EntryForm.test.tsx` verificando que Alerta activa el recordatorio a la hora exacta sin requerir conmutador manual y que para otras categorías se respeta la casilla manual.
   - Se añadió `testID="reminder-toggle-btn"` en `ReminderConfigSection.tsx`.
   - `npm --prefix frontend run check` pasa al 100% (37 test suites, 275 tests, Prettier, ESLint y TypeScript limpios).
   - `pytest backend/tests` pasa al 100% (119 tests pass).
