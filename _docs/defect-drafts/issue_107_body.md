### Comportamiento observado
Al editar una entrada existente en `EntryDetailView` (o al tener un recordatorio activo), la sección `ReminderConfigSection` se muestra completamente desplegada y expandida en pantalla. Dado que contiene permisos de navegador, botones de prueba, selectores de fecha/hora, chips de antelación, 10 opciones de recurrencia con descripciones y resúmenes, ocupa un espacio vertical masivo (muy verboso) y no permite plegarse u ocultarse si al usuario no le interesa modificarlo en ese momento, dificultando la edición del contenido principal.

### Comportamiento esperado
La sección detallada de configuración de recordatorios y avisos debe presentarse plegada/colapsada por defecto al entrar a la edición, mostrando únicamente una cabecera o resumen compacto (ej: estado activo/inactivo y resumen del aviso actual) y un control para desplegar/plegar (acordeón). Solo al pulsar o hacer clic debe expandirse el panel detallado de configuración, permitiendo volver a plegarlo cuando se desee.

### Pasos para reproducir
1. Abrir cualquier entrada fechada con recordatorio y pulsar en '✏️ Editar'.
2. Desplazarse por el formulario de edición: observar que toda la sección `ReminderConfigSection` se encuentra totalmente expandida por defecto ocupando gran parte de la pantalla.
3. No existe mecanismo para colapsar u ocultar las opciones detalladas de recordatorio sin tener que desactivar el recordatorio por completo.

### Entorno
- Cliente: Web / PWA / Móvil
- Componentes: `frontend/components/EntryDetailView.tsx`, `frontend/components/ReminderConfigSection.tsx`

### Evidencia
Reporte directo del usuario: "Tambien, el tema de recordatorios y notificaciones cuando editas una entrada quiero que este plegado, ya que ocupa un monton, que si se clicka que se abra sino es muuy verboso y no se puede ocultar si no interesa"

### Triage inicial
- Clasificación: `confirmed`
- Hechos: En `ReminderConfigSection.tsx`, la condición `{enabled && (` expande incondicionalmente todos los bloques de configuración detallada (permisos, antelaciones, lista completa de recurrencias) sin un estado de colapso/acordeón (`isCollapsed` / `isExpanded`).
- Huella de deduplicación: `entry-edit-reminder-config-section-collapsible-by-default`
