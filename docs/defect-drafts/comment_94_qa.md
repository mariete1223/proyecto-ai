## QA: PASS

- [x] **Alerta con recordatorio automático sin casilla**: En `EntryForm.tsx`, cuando la categoría es "Alerta", se activa automáticamente el recordatorio a la hora exacta (`reminder_offset_minutes: 0`) sin exigir conmutador ni casilla manual, mostrando el banner informativo `alert-auto-reminder-notice` - PASS
- [x] **Casilla manual para resto de eventos**: Para categorías estándar (Notas, Tareas, Eventos), el recordatorio permanece desactivado por defecto hasta que el usuario acciona voluntariamente el botón conmutador de recordatorio - PASS
- [x] **Programación incondicional en guardado de Alerta**: `notificationService.scheduleForEntry(entry)` se invoca basándose en `effectiveReminderEnabled`, asegurando el agendamiento del aviso para Alertas - PASS
- [x] **Sincronización garantizada e inmediata antes de cerrar**: `handleSubmit` y `App.tsx` esperan (`await`) la sincronización HTTP (`performSync` / `loadDatabaseState`) hacia el backend antes de cerrar los modales o navegar, persistiendo la entrada en `backend/app.db` antes de que el móvil suspenda la ejecución - PASS
- [x] **Service Worker con sonido nativo en iOS**: `frontend/public/sw.js` añade `sound: "default"` a las opciones de `showNotification` en push y en primer plano - PASS
- [x] **Tests automatizados y cobertura**: `EntryForm.test.tsx` incluye verificación de Alerta sin casilla y de eventos con casilla manual - PASS
- [x] `npm --prefix frontend run check` pasa al 100% (37 suites, 275 tests) - PASS
- [x] `backend\.venv\Scripts\python.exe -m pytest backend/tests` pasa al 100% (119 tests) - PASS

Tests ejecutados:
- `npm --prefix frontend run check`
- `backend\.venv\Scripts\python.exe -m pytest backend/tests`
