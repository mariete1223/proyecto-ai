# Groomed Task: Issue #89 - Simplificación de pantalla de dictado: botón principal arriba, eliminar 'Grabando voz', procesar redundante y limpiar/salir

## Goal

Optimizar y simplificar la pantalla de dictado (`Paso 1: Dictado` en `VoiceCaptureFlow.tsx`), posicionando el botón principal de acción ("Toca para Dictar" / "Detener y Procesar") en primer lugar, arriba del todo, eliminando el banner redundante con "GRABANDO VOZ...", retirando el botón "Procesar" duplicado junto a la transcripción, y eliminando los controles secundarios de "Limpiar" y "Salir".

## Acceptance criteria

- [ ] **Eliminación del banner 'GRABANDO VOZ...'**:
  - En `VoiceCaptureFlow.tsx`: No se muestra el banner de texto `"🔴 GRABANDO VOZ... Habla tu comando o nota"` durante la grabación. El estado activo se evidencia a través del botón activo ("Detener y Procesar"), el visualizador de ondas y el indicador "EN DIRECTO".
- [ ] **Botón principal en primer lugar (arriba)**:
  - En `VoiceCaptureFlow.tsx` dentro de `screenContainer` (Paso 1): `heroButtonContainer` se renderiza como el primer elemento visual de la pantalla.
  - En estado inactivo sin texto: Renderiza `btn-start-listening` con `"🎙️ Toca para Dictar"`.
  - En estado activo grabando (`voiceState === "LISTENING"`) o con texto listo para procesar: Renderiza `btn-stop-listening` con `"⏹️ Detener y Procesar"`. Al pulsarlo, detiene la grabación (si está activa) y procesa la transcripción pasando a la pantalla de revisión.
- [ ] **Eliminación del botón redundante 'Procesar' en la transcripción**:
  - Se retira el botón `btn-parse-transcript` ("🔍 Procesar") de `manualTranscriptRow`.
  - La transcripción se procesa a través del botón principal `"⏹️ Detener y Procesar"`.
- [ ] **Eliminación de controles secundarios 'Limpiar' y 'Salir'**:
  - Se elimina `secondaryControlsRow` (botones `"🔄 Limpiar"` y `"✕ Salir"`) del Paso 1.
- [ ] **Tests y Calidad**:
  - Actualizar `VoiceCaptureFlow.test.tsx` para reflejar la eliminación de `btn-parse-transcript` y los controles secundarios, ejecutando el flujo con `btn-stop-listening`.
  - Añadir test específico para Issue #89 validando el orden de elementos y la ausencia de los elementos eliminados.
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).
  - `pytest` en backend pasa al 100%.

## Out of scope

- Modificar la lógica de parsing de comandos ni el servicio WebSpeech.
- Cambiar la pantalla de revisión (Paso 2).

## Constraints

- No modificar dependencias en `package.json` ni `pyproject.toml`.
- Mantener diseño limpio y responsivo en web y móviles.
