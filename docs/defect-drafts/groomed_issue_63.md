## Goal
Garantizar que cualquier recordatorio configurado con antelación (`reminder_offset_minutes`) dispare la notificación exactamente a la hora calculada restando dicho offset (tanto en local in-app como en segundo plano vía Web Push), y que la tarjeta de la entrada en el preview del calendario muestre explícitamente la hora exacta calculada a la que sonará el aviso.

## Comportamiento actual y esperado
- **Actual:** Si una entrada para las 17:30 tiene `reminder_offset_minutes = 60` ("1 hora antes"), `notificationService.ts` y `push_worker.py` toman `reminder_time` directamente si está definido y no restan el offset, programando la alarma para las 17:30. Además, la tarjeta del calendario muestra únicamente el texto relativo ("1 hora antes") sin indicar la hora calculada.
- **Esperado:** La notificación se programa y dispara a las 16:30 tanto en local como en Web Push. La insignia de la tarjeta en el calendario muestra de forma legible la hora exacta del aviso: ej. `🔔 16:30 (1h antes)` (o `🔔 17:30 (A la hora del evento)`).

## Criterios de Aceptación
- [ ] En `frontend/services/notificationService.ts`, el cálculo de `targetDate` para programar el temporizador resta `reminder_offset_minutes * 60 * 1000` de la fecha base del evento (sea `reminder_time` u `occurred_at`), garantizando que si el evento es a las 17:30 con 60 min de anticipación, `targetDate` es las 16:30.
- [ ] En `backend/app/services/push_worker.py`, el cálculo de `trigger_dt` resta `timedelta(minutes=offset_mins)` de la fecha base del evento antes de evaluar la ventana de envío de Web Push.
- [ ] En `frontend/types/domain.ts` (`formatReminderSummary`), si existe un offset de minutos, el texto formateado incluye la hora calculada resultante a la que sonará el aviso (por ejemplo: `16:30 (1h antes)`, `17:15 (15 min antes)`, `16:30 (1 día antes)` o `17:30 (A la hora del evento)`).
- [ ] En `frontend/components/CalendarMonthView.tsx`, la insignia `entry-reminder-badge` muestra la hora calculada a la que sonará el aviso para que el usuario pueda verificarlo inmediatamente en el calendario.
- [ ] Al ajustar el aviso rápido desde el drawer de recordatorios del calendario (0, 15 min, 1h, 1 día), la insignia se actualiza inmediatamente reflejando la nueva hora calculada.
- [ ] Cobertura de regresión: Pruebas automatizadas en frontend (`notificationService.test.ts` / `domain.test.ts`) y backend (`test_push_api.py`) comprobando que un evento a las 17:30 con offset 60 dispara a las 16:30 y genera el texto con la hora exacta.

## Fuera de Alcance
- Corrección del desbordamiento en la celda del calendario cuando coinciden la campana y la etiqueta "HOY" (gestionado en [#64](https://github.com/mariete1223/proyecto-ai/issues/64)).

## Restricciones y Reparación de Datos
- Mantenerse dentro de `frontend/services/notificationService.ts`, `frontend/types/domain.ts`, `frontend/components/CalendarMonthView.tsx` y `backend/app/services/push_worker.py`.
- No requiere migraciones de base de datos adicionales; los datos persistidos se benefician del nuevo cálculo en tiempo de ejecución.
- Toda la suite de tests (113 backend + 183 frontend) debe ejecutarse y pasar al 100%.
