## Goal
Permitir que los comandos de voz (en captura y en edición de entradas) reconozcan y configuren avisos/notificaciones con antelaciones de 1 día antes (1440 min), 3 horas antes (180 min) y 1 hora antes (60 min), soportando una o varias opciones simultáneas en el mismo comando (ej: *"avísame 1 día antes y 1 hora antes"*), programando las notificaciones correspondientes para cada momento.

## Acceptance criteria
- [ ] En `frontend/services/voiceParser.ts` (captura inicial) y `frontend/services/voiceEditParser.ts` (edición por voz), el reconocedor detecta:
  - *"1 día antes"* / *"un día antes"* -> offset 1440 minutos.
  - *"3 horas antes"* / *"tres horas antes"* -> offset 180 minutos.
  - *"1 hora antes"* / *"una hora antes"* -> offset 60 minutos.
- [ ] Soporte para combinaciones múltiples en un único enunciado (ej. *"1 día antes y 1 hora antes"*, *"aviso 3 horas antes y 1 hora antes"*, *"notificar 1 día antes, 3 horas antes y 1 hora antes"*), extrayendo la lista completa de antelaciones solicitadas.
- [ ] En el modelo de dominio y persistencia local:
  - Se añade soporte para múltiples offsets de recordatorio (`reminder_offsets?: number[]` o lista serializada compatible con `reminder_offset_minutes` como offset principal).
  - Si se especifican múltiples antelaciones, el resumen visual de recordatorio (`formatReminderSummary`) muestra todas las antelaciones activas (ej: *"🔔 1 día antes, 1 hora antes"*).
- [ ] En `frontend/services/notificationService.ts`:
  - `scheduleForEntry(entry)` programa temporizadores y notificaciones independientes para cada una de las antelaciones configuradas en la entrada cuyo instante objetivo esté en el futuro.
  - Si un offset ya pasó pero otro aún está en el futuro, se programa el que esté vigente.
- [ ] Pruebas unitarias completas:
  - `voiceEditParser.test.ts`: verificar detección individual de 1 día, 3 horas y 1 hora antes, así como combinaciones múltiples.
  - `voiceParser.test.ts`: verificar captura inicial con avisos de antelación individuales y combinados.
  - `notificationService.test.ts`: verificar programación simultánea de múltiples timers para una misma entrada.

## Out of scope
- Configuración manual por UI de más de 3 antelaciones simultáneas fuera de las opciones estándar.
- Categoría Alerta (gestionada en #70).

## Constraints
- Mantener total compatibilidad con entradas existentes que tienen un único `reminder_offset_minutes`.
- No añadir librerías externas.
