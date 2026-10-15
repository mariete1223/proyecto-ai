## Goal

Establecer como comportamiento predeterminado que toda entrada con fecha/hora asignada (`occurred_at`) tenga activada automáticamente una notificación con 1 día de antelación (`1440` minutos), a excepción de la categoría "Alerta", cuyo valor predeterminado sigue siendo a la hora exacta del evento/tarea (`0` minutos).

## Acceptance criteria

- [ ] En la capa de datos (`frontend/db/entries.ts`), cuando se crea una entrada con `occurred_at` y el usuario no especificó explícitamente `reminder_enabled`:
  - Si la categoría es "Alerta": `reminder_enabled = true`, `reminder_offset_minutes = 0`, `reminder_offsets_minutes = [0]`.
  - Para cualquier otra categoría (Tareas, Eventos, Notas, Proyectos, personalizadas): `reminder_enabled = true`, `reminder_offset_minutes = 1440`, `reminder_offsets_minutes = [1440]`.
- [ ] Si la entrada se crea sin fecha (`occurred_at` es `null`), no se activa recordatorio automático (`reminder_enabled` permanece `false`/`null`).
- [ ] Si el usuario desactiva explícitamente el recordatorio (`reminder_enabled: false` o *"sin aviso"* por voz), se respeta la decisión y no se activa ningún recordatorio.
- [ ] En el analizador de voz (`frontend/services/voiceParser.ts`):
  - Al interpretar comandos con fecha para categorías distintas de Alerta (ej. *"tarea para el viernes a las 10 entrega de informe"*), `reminderEnabled` se establece en `true` y `reminderOffsetsMinutes` en `[1440]`, a menos que se hayan dictado offsets específicos o *"sin aviso"*.
- [ ] En los formularios y vistas de captura (`EntryForm.tsx`, `FastForwardCapture.tsx`, etc.):
  - Al asignar o seleccionar fecha para una categoría distinta de Alerta, el valor predeterminado del selector de recordatorio se inicializa activado con 1 día de antelación (`1440` min).
- [ ] Pruebas unitarias actualizadas y ampliadas:
  - `frontend/db/entries.test.ts`: verificar que entradas de Tareas/Eventos con fecha activan aviso de 1 día antes por defecto.
  - `frontend/services/voiceParser.test.ts`: verificar que comandos de voz para Tareas/Eventos con fecha configuran aviso de 1 día antes por defecto.
  - Toda la suite de frontend (`npm test`) y backend (`pytest`) pasando con 100% de éxito.

## Out of scope

- Modificación de entradas ya existentes en la base de datos creadas previamente sin recordatorio.
- Cambio de preferencias globales de recordatorios por usuario.

## Constraints

- Respetar compatibilidad con el sistema de tipos `Entry`, `ReminderConfigSection` y `notificationService`.
- No alterar el comportamiento específico de la categoría "Alerta" (aviso a la hora exacta `offset = 0`).
