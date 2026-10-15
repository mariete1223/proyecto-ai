## Goal

Permitir a los usuarios configurar avisos periódicos flexibles con frecuencia personalizada en horas (cada 1, 2, 4, 6, 8, 12 horas o cualquier intervalo de X horas) delimitado entre una fecha/hora de inicio y una fecha/hora límite de finalización, asegurando que tanto las notificaciones locales del frontend como el push worker del backend respeten dicho intervalo y dejen de disparar una vez superada la fecha final.

## Acceptance criteria

- [ ] En `ReminderConfigSection` (utilizado en `EntryForm` y `EntryDetailView`), el selector de frecuencia de repetición incluye opciones periódicas en horas ("Cada 2 horas", "Cada 4 horas", "Cada 6 horas", "Cada 8 horas", "Cada 12 horas") y selector flexible personalizable "Cada X horas" (`testID="chip-recurrence-interval-hours"` e `input-recurrence-custom-hours`).
- [ ] Cuando se selecciona una frecuencia por horas, se permite definir y ajustar la fecha y hora final de aviso (`input-reminder-end-date`), garantizando que el usuario puede delimitar el rango temporal entre dos fechas.
- [ ] El texto de ayuda explicativo en vivo (`recurrenceHelpText`) detalla cuándo sonará el primer aviso, el intervalo en horas configurado y la fecha límite en la que cesará la repetición.
- [ ] En `notificationService.ts`, la función `scheduleNextRecurrence` detecta las frecuencias en horas (`EVERY_X_HOURS`), avanza la hora sumando las X horas correspondientes y valida que no se supere `reminder_end_time`; si supera la fecha fin, detiene la recurrencia.
- [ ] En `backend/app/services/push_worker.py`, la evaluación de recordatorios en segundo plano reconoce el patrón horario (`EVERY_(\d+)_HOURS`), calcula el delta en horas y desactiva el recordatorio (`reminder_enabled = False`) si el nuevo tiempo sobrepasa `reminder_end_time`.
- [ ] Pruebas unitarias completas en frontend (`ReminderConfigSection.test.tsx`, `notificationService.test.ts`) y backend (`test_push_api.py` o test específico) que verifiquen el cálculo del siguiente disparo y la detención por fecha fin.

## Out of scope

- Edición de notas/tareas existentes y sus recordatorios por dictado de voz (gestionado en #68).

## Constraints

- Compatibilidad retroactiva total con las recurrencias existentes (`NONE`, `DAILY`, `WEEKLY`, `MONTHLY`).
- No agregar nuevas dependencias en `pyproject.toml` ni `package.json`.
- Todo el código debe estar tipado y sin warnings.
