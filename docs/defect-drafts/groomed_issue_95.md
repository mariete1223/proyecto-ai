# Groomed Task: Issue #95 - Simplificación de pantalla de dictado: eliminar texto redundante y placeholder 'Habla ahora...', dejando solo badge EN DIRECTO e input

## Goal

Simplificar la pantalla de dictado (`Paso 1: Dictado` en `VoiceCaptureFlow.tsx`), eliminando el bloque intermedio de vista previa de texto y el placeholder `"🎙️ Habla ahora..."` para reducir el ruido visual y el espacio vertical en pantallas móviles, dejando únicamente la cabecera con el badge `"🔴 EN DIRECTO"` (junto a badges compactos de entidades detectadas si las hay) y el campo de entrada `TextInput` directamente debajo.

## Acceptance criteria

- [ ] En `VoiceCaptureFlow.tsx`, cuando la caja de dictado en directo está activa (`showLiveDictation` es true), no se renderiza el bloque `liveDictationContent` ni el texto placeholder `"🎙️ Habla ahora..."` ni la duplicación de texto de transcripción encima del input.
- [ ] La caja de dictado (`live-dictation-box`) muestra en su cabecera el badge `EN DIRECTO` durante la escucha (`voiceState === "LISTENING"`) y, si se detectan entidades en tiempo real (categoría, fecha, etiquetas), se muestran como badges compactos en dicha cabecera.
- [ ] El campo de entrada de texto `TextInput` (`testID="input-transcript"`) se muestra directamente debajo de la cabecera sin elementos de texto intermedios que ocupen espacio vertical.
- [ ] El flujo de dictado por voz y edición manual se mantiene íntegro: el texto reconocido o escrito se vincula a `input-transcript` y pasa al paso de revisión al pulsar "⏹️ Detener y Procesar".
- [ ] Los tests de frontend en `VoiceCaptureFlow.test.tsx` reflejan la ausencia del bloque redundante y verifican la presencia del badge `EN DIRECTO`, el `TextInput` y las entidades detectadas.
- [ ] `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).

## Out of scope

- Resolver el defecto de entrega de notificaciones Web Push con la aplicación cerrada (registrado en el Issue #94).
- Modificar el flujo de guardado o la pantalla de revisión (Paso 2).

## Constraints

- Archivos a modificar: `frontend/components/VoiceCaptureFlow.tsx` y `frontend/components/VoiceCaptureFlow.test.tsx`.
- No alterar dependencias en `package.json` ni `pyproject.toml`.
- Mantener diseño limpio, responsivo y fiel a la guía de estilo.
