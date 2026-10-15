---
fingerprint: voice-task-priority-content-extraction-error
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/59
first_seen: 2026-10-13
last_seen: 2026-10-13
---

# Defect: Error al extraer el contenido de la transcripción al dictar tarea con prioridad en Safari

## Observed behaviour

Al dictar un comando de voz para una tarea con fecha y prioridad en Safari (ej. «Tarea fecha mañana tengo que ir a comprar al mercado prioridad alta»), la interfaz muestra el error «No se pudo extraer el contenido de la transcripción.» impidiendo la creación y guardado de la tarea.

## Expected behaviour

Al dictar «Tarea fecha mañana tengo que ir a comprar al mercado prioridad alta», la aplicación debe reconocer la categoría Tareas, la fecha relativa Mañana, la prioridad Alta y el contenido «tengo que ir a comprar al mercado» sin perder información ni mostrar error de contenido vacío.

## Reproduction

1. Acceder a la aplicación desde Safari (iOS WebKit) a través del túnel o localmente.
2. Iniciar la captura de voz en el panel principal o modal de dictado.
3. Dictar la frase completa: «Tarea fecha mañana tengo que ir a comprar al mercado prioridad alta».
4. Pulsar el botón para detener la grabación.
5. Se muestra en pantalla el error: «No se pudo extraer el contenido de la transcripción.».

Frequency: sistemático en Safari según reporte del usuario.

## Environment

- Client: Expo Web / React Native
- Device or browser: Safari (iOS / WebKit)
- Backend or build: FastAPI / SQLite local

## Evidence

- Mensajes del usuario:
  - «Cuando le meto la prioridad a la tarea hay error al extraer el contenido de la transcripcion»
  - «En safari, dije: 'Tarea fecha mañana tengo que ir a comprar al mercado prioridad alta'»

## Triage

- Classification: confirmed
- Impact: Impide registrar tareas por voz cuando el usuario especifica la prioridad al final del dictado en Safari móvil.
- Facts:
  - El mensaje «No se pudo extraer el contenido de la transcripción.» se origina exclusivamente en `voiceParser.ts:679` cuando `content.length === 0`.
  - En `voiceRecognition.ts`, al detener la escucha (`stopListening` y `onend`), el servicio emite `this.finalizedText`. Si en Safari WebKit el fragmento central que contiene el cuerpo de la tarea aún permanece en `interimResults` (`isFinal === false`) en el instante en que el usuario pulsa detener, `this.finalizedText` descarta dicho texto provisional y sobreescribe la transcripción con los fragmentos finalizados residuales (ej. «Tarea fecha mañana prioridad alta»), consumiendo fecha y prioridad y dejando el contenido vacío.
- Hypotheses:
  - `voiceRecognition.ts` debe preservar el último texto completo reconocido (`fullText = finalizedText + interimText`) al invocar `stopListening()`, evitando que al detener la captura se pierdan segmentos intermedios que WebKit aún no haya marcado como `isFinal`.
- Missing information: ninguna; caso reproducido e identificado.
- Possible duplicates checked:
  - Issue #52 (Documentar y verificar prioridad en la captura de tareas por voz - cerrado)
  - Issue #57 (Duplicación de texto en Safari continuo - cerrado)
  - Borrador local: `_docs/defect-drafts/voice-task-priority-content-extraction-error.md`

## Publication history

- 2026-10-13: Publicado en GitHub como Issue #59 tras confirmación de reproducción en Safari.
