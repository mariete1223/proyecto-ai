## Goal
Permitir la configuración de avisos flexibles periódicos con frecuencia personalizada cada X horas (por ejemplo: cada 2, 4, 6, 8 o 12 horas) entre dos fechas/horas de inicio y fin, tanto desde el formulario de entradas como en los recordatorios rápidos.

## Acceptance criteria (Initial)
- [ ] Soporte para tipo de recurrencia o intervalo en horas (ej. `INTERVAL_HOURS` o frecuencia configurable cada X horas) con hora/fecha de inicio y fin.
- [ ] En los selectores de recordatorio (formulario y detalle rápido), permitir elegir aviso cada X horas e indicar fecha/hora límite.
- [ ] El servicio de notificaciones programa las repeticiones o evalúa el siguiente disparo dentro del rango temporal establecido.
- [ ] Pruebas unitarias en frontend y backend cubriendo la programación y el cálculo de la próxima hora de aviso.

## Out of scope
- Onboarding inicial (#66).
- Edición por voz (#68).
