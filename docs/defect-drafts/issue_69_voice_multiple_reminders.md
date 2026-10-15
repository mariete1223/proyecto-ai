## Goal
Permitir que el motor de reconocimiento de voz y comandos acepte la configuración de avisos y notificaciones con antelaciones específicas (1 día antes, 3 horas antes, 1 hora antes), permitiendo especificar una o varias de estas opciones simultáneamente en la misma orden por voz (ej: "avísame 1 día antes y 1 hora antes").

## Acceptance criteria (Initial)
- [ ] En el reconocimiento por voz (captura inicial y edición), detectar menciones de antelación para notificaciones:
  - 1 día antes (1440 min)
  - 3 horas antes (180 min)
  - 1 hora antes (60 min)
- [ ] Soportar combinaciones múltiples en el mismo comando (ej: "poner aviso 1 día antes y 1 hora antes", "notificar 3 horas antes y 1 hora antes").
- [ ] El motor de notificaciones (`NotificationService`) programa las alertas correspondientes para cada uno de los momentos solicitados.
- [ ] Visualización clara en el resumen del recordatorio de los avisos programados.
- [ ] Pruebas unitarias para el parser de voz y el programador de notificaciones verificando los casos individuales y combinados.

## Out of scope
- Categoría inicial Alerta (objeto de issue separada).

## Constraints
- Mantener compatibilidad con las opciones de recordatorio existentes (`reminder_offset_minutes`, `EVERY_X_HOURS`, etc.).
- Sin librerías externas adicionales.
