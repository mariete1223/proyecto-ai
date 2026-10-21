### Rol: Engineer
**Issue #107: La sección de recordatorios y notificaciones al editar una entrada debe estar plegada por defecto**

#### Causa Raíz
En `ReminderConfigSection.tsx`, al estar `enabled: true`, la sección `expandedContent` se renderizaba de forma incondicional mostrando todos los bloques de configuración detallada (permisos, botones de prueba, selectores de fecha/hora, antelación, 10 opciones de recurrencia y resumen en vivo), ocupando un espacio vertical excesivo y sin opción de plegado/acordeón.

#### Solución Implementada
1. Se añadió el estado interno `isExpanded` inicializado con `defaultExpanded = false`.
2. Se implementó una barra de cabecera tipo acordeón interactiva (`accordionControlRow`) con:
   - Resumen compacto del aviso configurado (fecha de inicio y frecuencia).
   - Botón interactivo de despliegue/plegado `testID="toggle-reminder-collapse-btn"` con etiquetas dinámicas `▼ Ajustar recordatorio` y `▲ Plegar ajustes`.
3. Al cambiar de `DESACTIVADO` a `ACTIVADO` mediante el botón principal, `isExpanded` pasa automáticamente a `true` para facilitar la configuración inicial inmediata.
4. Actualizados y ampliados los tests en `ReminderConfigSection.test.tsx` (6/6 tests pasando).
