---
fingerprint: entry-form-empty-content-missing-feedback
status: confirmed
github_issue: 91
first_seen: 2026-10-19
last_seen: 2026-10-19
---

# Defect: Falta de explicabilidad y feedback visual al intentar guardar una entrada manual sin contenido

## Observed behaviour

Al intentar guardar una entrada manual en `EntryForm` dejando el campo de contenido vacío (por ejemplo, habiendo introducido únicamente un título o seleccionando una categoría), el botón "Guardar Entrada" no guarda la entrada pero no ofrece feedback visible ni explicabilidad en el área visible del usuario. El mensaje de error queda confinado a la cabecera superior del formulario, fuera de la vista en pantallas móviles o tras haber hecho scroll hacia el botón inferior.

## Expected behaviour

1. Si el usuario pulsa "Guardar Entrada" con el contenido vacío, la aplicación debe explicar claramente el motivo de forma visible e inmediata.
2. El campo de contenido debe resaltar visualmente con borde/indicador de error y un mensaje explicativo visible en la zona de acción (junto al botón o bajo el campo de texto).

## Reproduction

1. En la aplicación web o móvil, abrir el formulario de "Nueva Entrada Manual" (`EntryForm`).
2. Introducir un título (ej. "Revisión médica") o seleccionar una categoría, dejando el campo de texto de contenido completamente vacío.
3. Hacer scroll hacia abajo y pulsar el botón "Guardar Entrada".
4. Observar que no se guarda la entrada y no aparece ninguna indicación ni mensaje explicativo en la zona del botón ni en el campo enfocado.

Frequency: 100% reproducible

## Environment

- Client: Web, PWA móvil y standalone
- Componente: `frontend/components/EntryForm.tsx`

## Evidence

- Reporte del usuario: *"he intentado guardar entrada sin contenido y no me ha dejado pero no me ha dicho el porque lo que no da explicabilidad"*.
- Código fuente en `frontend/components/EntryForm.tsx:103-106`:
  ```ts
  if (!content.trim()) {
    setErrorMessage("El contenido no puede estar vacío.");
    return;
  }
  ```
  y `errorMessage` solo se renderizaba arriba del contenedor bajo el título, mientras `btn-submit-entry` se encuentra al final de un formulario extenso.

## Triage

- Classification: confirmed
- Impact: Medio (UX y accesibilidad: el usuario queda bloqueado sin entender por qué la pulsación del botón no produce ningún efecto observable).
- Facts:
  - En `EntryForm.tsx`, la validación de `content.trim()` detiene el guardado y actualiza `errorMessage`.
  - El mensaje se ubicaba en la parte superior del formulario (`styles.errorBox`), que en la mayoría de resoluciones móviles queda fuera del viewport una vez que el usuario baja hasta el botón de enviar.
  - No existía borde de error en `input-content`, ni texto de error bajo el campo, ni mensaje de error junto al botón de guardar.
- Hypotheses: Añadir borde de error visible en `input-content` cuando esté vacío al pulsar enviar, mostrar el mensaje de validación junto al botón de envío / bajo el campo.
- Missing information: ninguna.
- Possible duplicates checked: Ningún issue existente sobre validación inline en `EntryForm`.
