# Groomed Task: Issue #81 - Ocultar banner de estado en dictado cuando el micrófono está listo y mostrar aviso solo si no está listo

## Goal

Eliminar el banner informativo estático "Micrófono listo para dictado" en la pantalla de dictado por voz para maximizar el espacio útil en pantalla, mostrándolo únicamente cuando el micrófono no esté listo (ej. estado de error o permisos no concedidos) o durante los estados activos de grabación y procesamiento.

## Acceptance criteria

- [ ] **Ocultar aviso en reposo cuando el micrófono está listo**:
  - En la pantalla de dictado (Paso 1: Dictado), cuando el micrófono está disponible y en reposo (`voiceState === "IDLE"`), no se muestra ningún banner de "Micrófono listo para dictado", dejando la vista limpia con el botón principal de dictado arriba del todo.
- [ ] **Mostrar aviso únicamente cuando no esté listo o en actividad**:
  - Si el micrófono no está listo o presenta un fallo (`voiceState === "ERROR"` o mensaje de error de permisos/dispositivo), se muestra el aviso de alerta correspondiente indicando el estado.
  - Durante la grabación activa (`voiceState === "LISTENING"`) o el procesamiento (`voiceState === "PROCESSING"`), se muestra el indicador visual correspondiente (banner activo / badge "EN DIRECTO" / visualizador de ondas).
- [ ] **Pruebas y calidad**:
  - Tests unitarios en `VoiceCaptureFlow.test.tsx` adaptados y pasando al 100%.
  - `npm run check` completado sin errores de linter, tipo o formato.

## Out of scope

- Cambios en el motor de reconocimiento por voz o lógica de parseo.

## Constraints

- Modificar `frontend/components/VoiceCaptureFlow.tsx` y `frontend/components/VoiceCaptureFlow.test.tsx`.
- Mantener testIDs existentes para compatibilidad.
