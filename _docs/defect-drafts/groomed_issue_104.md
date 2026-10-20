## Goal

Permitir al usuario seleccionar la prioridad de la tarea (Alta, Media, Baja) al usar el formulario de creación rápida del calendario cuando la categoría es de tipo Tarea, y activar automáticamente el recordatorio a la hora del evento cuando se selecciona la categoría Alerta.

## Acceptance criteria

- [ ] En el formulario rápido de creación de `CalendarMonthView`, cuando la categoría seleccionada es de tipo Tarea (`kind === "TASK"`), se muestra un selector de prioridad con chips para "🔴 Alta" (`HIGH`), "🟡 Media" (`MEDIUM`) y "🔵 Baja" (`LOW`).
- [ ] La prioridad inicial por defecto al seleccionar una categoría de tipo Tarea es "🟡 Media" (`MEDIUM`).
- [ ] Al pulsar sobre "🔴 Alta" o "🔵 Baja", el chip se marca como activo visualmente y la entrada creada se guarda con el `task_priority` seleccionado en la base de datos local.
- [ ] Si la categoría seleccionada no es de tipo tarea (`kind !== "TASK"`), el selector de prioridad no se muestra y `task_priority` se guarda como `null`.
- [ ] Al seleccionar la categoría "Alerta", el recordatorio `quickAddReminderEnabled` se activa automáticamente en `true` con antelación en 0 minutos (hora exacta del evento).
- [ ] Si el usuario cambia de categoría de "Alerta" a otra categoría estándar, el recordatorio vuelve a su estado desactivado por defecto para no forzar alarmas no deseadas en notas normales.
- [ ] Se añaden pruebas unitarias automatizadas que verifiquen:
  - La visualización y selección de prioridad para tareas en la creación rápida del calendario.
  - La autoactivación del recordatorio para alertas al seleccionar la categoría "Alerta".
- [ ] La suite de pruebas de frontend pasa al 100% sin regresiones.

## Out of scope

- Navegación al calendario tras guardar una entrada (cubierto en #105).
- Deshabilitar completitud de alertas en el calendario (cubierto en #106).
- Plegado de opciones de recordatorio en edición de entrada (cubierto en #107).
- Deslizamiento lateral entre pestañas (cubierto en #108).

## Constraints

- Cambios concentrados en `frontend/components/CalendarMonthView.tsx` y sus pruebas.
- No añadir nuevas dependencias a `package.json` ni a `pyproject.toml`.
- Mantener la paleta de colores del tema oscuro de la aplicación.
