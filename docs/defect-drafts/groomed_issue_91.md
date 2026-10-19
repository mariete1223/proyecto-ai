# Groomed Task: Issue #91 - Explicabilidad y feedback visual al intentar guardar una entrada manual sin contenido

## Goal

Mejorar la explicabilidad y retroalimentación visual en el formulario de entrada manual (`EntryForm.tsx`) para que, al intentar guardar una entrada con el campo de contenido vacío, el usuario reciba un indicador visual claro e inmediato en el propio campo y junto al botón de acción, explicando con claridad por qué no se puede guardar.

## Acceptance criteria

- [x] **Resaltado de error en campo de contenido**:
  - Al pulsar "Guardar Entrada" (`btn-submit-entry`) con el contenido vacío o solo espacios en blanco, el campo de texto `input-content` adquiere un estilo visual de error (borde rojo `#EF4444`).
  - Directamente debajo de `input-content` se muestra un texto explicativo con `testID="content-error-text"` indicando con claridad `"El contenido no puede estar vacío."`.
- [x] **Feedback visible junto al botón de acción**:
  - Encima del botón de envío `btn-submit-entry` se muestra un aviso de error visible (`testID="submit-error-banner"`) que contiene el mensaje explicativo, asegurando que el usuario que tiene el foco o la vista en la parte inferior del formulario vea inmediatamente por qué la acción se detuvo sin necesidad de buscar en la cabecera superior.
- [x] **Limpieza reactiva del error al escribir**:
  - Tan pronto como el usuario introduce texto en `input-content`, el estado de error (borde rojo y mensajes de error) se limpia automáticamente.
- [x] **Tests y Calidad**:
  - Añadir pruebas unitarias en `frontend/components/EntryForm.test.tsx` que verifiquen:
    - Pulsar guardar con contenido vacío muestra el texto de error en `content-error-text` y en `submit-error-banner`, y aplica estilo de error a `input-content`.
    - Escribir texto en `input-content` limpia los mensajes y estilos de error.
    - Guardar con contenido válido no muestra errores y procede con el guardado.
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).
  - Pytest en backend pasa al 100%.

## Out of scope

- Modificar la validación de dictado por voz (`VoiceCaptureFlow.tsx`).
- Cambiar la estructura de categorías o etiquetas.

## Constraints

- Cambios concentrados en `frontend/components/EntryForm.tsx` y sus tests en `frontend/components/EntryForm.test.tsx`.
- No modificar dependencias en `package.json` ni `pyproject.toml`.
