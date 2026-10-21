# Grooming de Issue #107: La sección de recordatorios y notificaciones al editar una entrada debe estar plegada por defecto

## Contexto del Problema
Al editar una entrada existente en `EntryDetailView` (o al tener un recordatorio activo en `EntryForm`), `ReminderConfigSection` se muestra completamente desplegado. Debido a la cantidad de información detallada (permisos del navegador, botones de prueba, selectores de fecha/hora de inicio y fin, antelación, 10 opciones de recurrencia, horas personalizadas y tarjetas de resumen en vivo), la sección ocupa un espacio vertical masivo (muy verboso), dificultando la navegación y edición rápida del contenido principal.

## Comportamiento Esperado
1. En `ReminderConfigSection`, cuando `enabled` está activado (`ACTIVADO`), debe existir un comportamiento de tipo acordeón (colapsable):
   - Por defecto debe iniciar **plegado/colapsado** (`isExpanded = false`).
   - Cuando está plegado, muestra la cabecera actual con el botón de activación y una barra/resumen compacto informativo con:
     - Resumen del aviso actual (ej. fecha del primer aviso y frecuencia seleccionada).
     - Botón o control claro para desplegar/plegar (ej. `[🔽 Ver/Editar configuración]` / `[🔼 Ocultar configuración]`, con `testID="toggle-reminder-collapse-btn"` o similar).
   - Al pulsar el botón de desplegar, se muestra el panel completo con todas las opciones existentes (`expandedContent`).
   - Al pulsar el botón de plegar, se vuelve a contraer.
   - Si el usuario conmuta el estado de DESACTIVADO a ACTIVADO, opcionalmente puede expandirse automáticamente para permitir configurar el recordatorio inmediatamente.
   - Si `defaultExpanded` se pasa como prop opcional (por defecto `false`), los tests que requieran renderizar el formulario expandido directamente pueden pasar `defaultExpanded={true}` o simplemente simular el clic en el botón de desplegar.

## Criterios de Aceptación
1. `ReminderConfigSection` incluye soporte para desplegar/plegar cuando `enabled` es `true`.
2. Por defecto, al entrar con `enabled={true}`, el contenido detallado de configuración está plegado.
3. Se muestra un resumen o banner compacto indicando el estado del recordatorio y un botón para desplegarlo.
4. Al pulsar el botón de desplegar, se muestran los campos detallados (`testID="input-reminder-start-date"`, `input-reminder-end-date`, opciones de recurrencia, etc.).
5. Al pulsar de nuevo, se pliega de vuelta.
6. Todos los tests de `ReminderConfigSection.test.tsx`, `EntryDetailView.test.tsx` y `EntryForm.test.tsx` siguen pasando o se actualizan para contemplar la interacción de despliegue.
7. `npm run check` (39 suites) y `uv run --directory backend python scripts/check.py` (125 tests) pasan al 100%.
