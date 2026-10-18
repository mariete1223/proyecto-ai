## Goal

Permitir que al pulsar el botón "⚡ Aplicar Cambio" en la sección de Edición Inteligente por voz de `EntryDetailView`, la vista de detalle permanezca abierta mostrando los cambios aplicados y el mensaje de éxito, en lugar de cerrarse bruscamente y redirigir a la pantalla de inicio.

## Acceptance criteria

- [ ] Al pulsar "⚡ Aplicar Cambio" tras dictar o escribir un cambio en `EntryDetailView`, la vista de detalle permanece abierta mostrando el mensaje de éxito (`¡Edición por voz aplicada con éxito! ...`).
- [ ] La entrada mostrada en pantalla actualiza inmediatamente sus valores (título, hora, fecha, aviso) sin necesidad de recargar la aplicación ni cerrarla.
- [ ] El callback `onUpdated` propuesto a componentes padres refresca el estado en base de datos y memoria sin desmontar forzosamente la vista (`setSelectedEntryId(null)` solo debe ejecutarse cuando el usuario pulsa explícitamente "Cerrar", "Volver" o "Eliminar").
- [ ] Al pulsar "✕ Cerrar Detalle" o el botón de retorno, el usuario regresa normalmente a la pantalla principal / calendario con los datos ya actualizados.
- [ ] Pruebas unitarias de regresión en `EntryDetailView.test.tsx` verificando que al ejecutar `handleApplyVoiceEdit` la vista no se desmonta y conserva el estado actualizado.

## Out of scope

- Rediseño de la categoría Alerta (movido a #74).
- Corrección de desbordamiento de botones móviles (movido a #75).

## Constraints

- Archivos: `frontend/components/EntryDetailView.tsx`, `frontend/App.tsx`, `frontend/components/EntryDetailView.test.tsx`.
- Mantener compatibilidad con los flujos de actualización de calendario y sincronización en segundo plano.
- Conservar los 234 tests existentes de frontend pasando al 100%.
