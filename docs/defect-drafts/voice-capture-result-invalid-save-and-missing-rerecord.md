---
fingerprint: voice-capture-result-invalid-save-and-missing-rerecord
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/79
first_seen: 2026-10-18
last_seen: 2026-10-18
---

# Defect: En 'Resultado del Dictado' se permite guardar sin comando detectado, falta botón para repetir comando y el botón 'Guardar Entrada' se trunca

## Observed behaviour

En el Paso 2 de Captura de Voz ("Resultado del Dictado"):
1. Al dictar una frase donde no se reconoce ningún comando válido o la categoría no existe (ej. *"Hola"*, mostrando *"Categoría no reconocida: Hola"*), el botón de guardar (`💾 Guardar Entrada`) sigue activo y habilitado, permitiendo al usuario guardar una entrada inválida bajo una categoría por defecto.
2. No existe ninguna opción rápida o visible en la parte superior para repetir el dictado o reintentar el comando. El usuario se ve forzado a pulsar *"✕ Salir"* y volver a abrir la captura de voz desde el inicio.
3. En la barra de acciones rápidas de comandos (`quickSaveTokensRow`), el botón de guardar se desborda y su texto se corta con puntos suspensivos: `💾 Guardar Ent...` en pantallas móviles estrechas.

## Expected behaviour

1. Si no se detecta ningún comando válido o la categoría no es reconocida (`parsedResult.isSuccess === false` o sin comando válido), el botón de guardar debe estar deshabilitado (`disabled`) o no permitir el guardado accidental, alertando al usuario de que debe dictar un comando válido o seleccionarlo manualmente.
2. En la sección de comandos reconocidos / revisión superior debe existir un botón directo y prominente para **"🎙️ Repetir Dictado"** que regrese al Paso 1 y reactive el micrófono sin necesidad de salir del modal y volver a entrar.
3. El botón de guardar y los botones secundarios deben organizarse responsivamente (envoltura `flexWrap: "wrap"` o disposición vertical en móviles) y sin `numberOfLines={1}` rígido para que el texto completo `💾 Guardar Entrada` sea siempre visible y legible.

## Reproduction

1. Abrir la captura de voz en un dispositivo móvil.
2. Dictar una frase sin comando, por ejemplo *"Hola"*.
3. En la pantalla "Paso 2 de 2: Revisión", observar:
   - Aviso rojo: `Categoría no reconocida: "Hola"`.
   - Botón `💾 Guardar Ent...` habilitado y con texto truncado.
   - Ausencia de botón superior para repetir o reintentar el comando.

Frequency: 100% reproducible en pantallas móviles con dictados sin comando reconocido.

## Environment

- Client: Web / PWA móvil
- Device / Screen: Pantalla móvil (375px - 390px)
- Component: `frontend/components/VoiceCaptureFlow.tsx`

## Evidence

- Captura de pantalla aportada por el usuario mostrando el mensaje de error `Categoría no reconocida: "Hola"`, el botón verde truncado `💾 Guardar Ent...` y el botón rojo `✕ Salir`.
- Código en `VoiceCaptureFlow.tsx`:
  - `btn-quick-save-tokens` no valida `parsedResult.isSuccess` antes de habilitarse.
  - `quickSaveTokensRow` solo incluye `btn-quick-save-tokens` y `btn-quick-close-tokens` (falta botón para reintentar/regrabar).
  - Estilos de `quickSaveBtn` con `flex: 1` y `numberOfLines={1}` en `quickSaveBtnText` provocan el recorte en pantallas estrechas.

## Triage

- Classification: `confirmed`
- Impact: high (permite persistir entradas incorrectas y degrada la experiencia de dictado continuo en móviles).
- Facts:
  - `parsedResult.isSuccess` es `false` cuando no se reconoce la categoría.
  - `quickSaveTokensRow` renderiza el botón de guardado habilitado independientemente de la validez del comando.
  - El botón para regrabar (`btn-rerecord-voice-flow`) solo existe al final de la página tras un scroll largo.
  - El texto del botón de guardar se trunca a `💾 Guardar Ent...`.
- Hypotheses:
  - Deshabilitar el botón de guardado rápido si no hay categoría o comando válido, añadir el botón `[ 🎙️ Repetir Dictado ]` en la fila superior de acciones y aplicar flexbox responsivo resolverá los tres problemas.
- Missing information: Ninguna.
- Possible duplicates checked:
  - Issue #75: Desbordamiento en botón Procesar de dictado y DateTimePicker (cerrada; scope diferente).
  - Issue #76: Rediseño del botón de dictado (cerrada).

## Publication history

- 2026-10-18: Intake registrado como borrador local. Pendiente de publicación en GitHub.
