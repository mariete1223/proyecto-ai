# Groomed Task: Issue #94 - Entrega de notificaciones Web Push con app cerrada y recordatorio automático en alertas sin casilla

## Goal

Garantizar la entrega de notificaciones Web Push con la aplicación cerrada o el iPhone bloqueado al cumplirse la hora de un recordatorio, asegurando que la categoría "Alerta" tenga siempre recordatorio activo por defecto a la hora exacta indicada sin requerir marcar ninguna casilla manual (mientras que el resto de categorías siguen requiriendo la casilla manual), y garantizando que las entradas con recordatorio se sincronicen de forma inmediata con el backend (`backend/app.db`) antes de finalizar el guardado.

## Acceptance criteria

- [ ] **Alerta con recordatorio automático sin casilla**:
  - En `EntryForm.tsx`, cuando la categoría seleccionada es "Alerta" (`isCategoryAlert`), el recordatorio queda siempre activo por defecto (`reminder_enabled: true`) con antelación 0 (`reminder_offset_minutes: 0`) a la hora indicada (`occurred_at` o `reminder_time`).
  - No se exige al usuario marcar ninguna casilla o conmutador para que la alerta suene y notifique a la hora exacta.
  - Para el resto de categorías (Eventos, Tareas, Notas, etc.), el recordatorio solo se activa si el usuario activa conscientemente la casilla/conmutador de recordatorio (`reminderEnabled`).
- [ ] **Programación incondicional en guardado de Alerta**:
  - En `EntryForm.tsx`, al guardar una entrada, la llamada `notificationService.scheduleForEntry(entry)` se ejecuta siempre que `isAlertCategory || reminderEnabled` sea verdadero (sin omitirla si el toggle manual no fue pulsado).
- [ ] **Sincronización garantizada e inmediata antes de cerrar**:
  - En `EntryForm.tsx` (y en `VoiceCaptureFlow.tsx` / `App.tsx`), al guardar una entrada que tenga recordatorio activo (`reminder_enabled === true`), se ejecuta y espera (`await`) la sincronización hacia el backend (`performSync`) para asegurar que el registro quede almacenado en `backend/app.db` antes de cerrar el modal o considerar finalizado el guardado.
  - De esta forma, si el usuario bloquea el móvil o sale de la PWA inmediatamente tras guardar, el backend ya tiene la entrada en su base de datos.
- [ ] **Service Worker con opciones de sonido nativas en iOS**:
  - En `frontend/public/sw.js`, el evento `push` configura las opciones de notificación para iOS/WebKit incluyendo `sound: "default"`, `tag`, `renotify: true` y datos del recordatorio para que la pantalla de bloqueo se ilumine y emita sonido.
- [ ] **Tests y Calidad**:
  - Tests en `EntryForm.test.tsx` que verifiquen que una entrada de categoría Alerta guarda `reminder_enabled: true` y programa el recordatorio sin necesidad de tocar ninguna casilla de recordatorio.
  - Tests que verifiquen que para otra categoría (ej. Eventos) el recordatorio no se activa a menos que la casilla esté marcada.
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).
  - La suite de tests de backend `pytest backend/tests` pasa al 100%.

## Out of scope

- Modificar el algoritmo de encriptación VAPID o los esquemas de base de datos de PostgreSQL/SQLite.

## Constraints

- Archivos principales a modificar: `frontend/components/EntryForm.tsx`, `frontend/App.tsx`, `frontend/public/sw.js`, y tests en `frontend/components/EntryForm.test.tsx`.
- No modificar dependencias en `package.json` ni en `pyproject.toml`.
- Mantener la experiencia offline: si la sincronización falla por falta de red, la entrada se guarda localmente sin colapsar la app.
