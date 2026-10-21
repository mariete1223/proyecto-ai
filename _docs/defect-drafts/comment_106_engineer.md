### Rol: Engineer
**Issue #106: Checkbox de tarea disponible indebidamente en entradas de alerta en vista mensual**

#### Causa Raíz
En `CalendarMonthView.tsx`:
1. La variable `isTask` dentro del panel de detalle diario se calculaba como:
   `const isTask = cat?.kind === "TASK" || ent.task_status !== null;`
   Esto provocaba que cualquier entrada que tuviera residualmente `task_status !== null` o perteneciese a categorías con estado residual mostrase el checkbox interactivo de tarea aunque su categoría no fuese de tipo `TASK` (y específicamente para alertas).
2. Adicionalmente, el handler `handleToggleTaskStatus` no comprobaba el tipo de categoría de la entrada antes de actualizar el estado, permitiendo alternar el estado de completado en entradas que no correspondían a tareas.

#### Solución Implementada
1. **Restricción estricta de `isTask` y `isCompleted`**:
   - `isTask` ahora evalúa estrictamente `cat?.kind === "TASK" && !isCategoryAlert(cat)`.
   - `isCompleted` evalúa `Boolean(isTask && ent.task_status === "DONE")`.
2. **Guarda en `handleToggleTaskStatus`**:
   - Se valida la categoría asociada a la entrada en `categoryMap`: si `!cat || cat.kind !== "TASK" || isCategoryAlert(cat)`, se aborta la ejecución inmediatamente sin mutar la base de datos ni el estado local.
3. **Tests unitarios agregados en `CalendarMonthView.test.tsx`**:
   - `"does not render task checkbox for alert entries and cannot mark them as completed (#106)"`
   - `"renders task checkbox only for TASK category entries and not for STANDARD entries (#106)"`
