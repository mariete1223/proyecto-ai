# Engineer Implementation Report: Issue #91

## Summary of Changes

En `frontend/components/EntryForm.tsx`:
1. **Estado de error de contenido**: Se añadió el estado `contentError` para rastrear si la validación del contenido ha fallado.
2. **Validación inline y explicabilidad**:
   - En `handleSubmit`, cuando `!content.trim()`, se asigna el mensaje `"El contenido no puede estar vacío."` tanto a `errorMessage` como a `contentError`.
   - El campo de texto `input-content` recibe el estilo condicional `styles.inputError` (`borderColor: "#EF4444", borderWidth: 1.5`), destacando visualmente el campo que requiere atención.
   - Justo debajo de `input-content` se renderiza el mensaje explicativo con `testID="content-error-text"`.
3. **Banner de error visible en la zona de acción**:
   - Se añadió un aviso de error directamente encima de `btn-submit-entry` con `testID="submit-error-banner"`, garantizando que usuarios en pantallas móviles o con scroll hacia abajo vean inmediatamente la causa del bloqueo sin tener que desplazarse a la cabecera.
4. **Limpieza reactiva al escribir**:
   - Al introducir texto en `input-content`, el callback `onChangeText` borra automáticamente tanto `contentError` como `errorMessage`.

En `frontend/components/EntryForm.test.tsx`:
- Se añadió un test unitario que verifica:
  1. Que inicialmente no se muestran los indicadores de error.
  2. Que al presionar `btn-submit-entry` con contenido vacío se renderizan `content-error-text`, `submit-error-banner` y se aplica el estilo de error.
  3. Que al teclear texto en `input-content` se limpian reactivamente los errores.

## Verification

- **Frontend suite (`npm run check`)**: Prettier, ESLint, TypeScript y Jest (37/37 suites, 270/270 tests) pasaron al 100%.
- **Backend tests**: 117 tests pasaron exitosamente en pytest.
