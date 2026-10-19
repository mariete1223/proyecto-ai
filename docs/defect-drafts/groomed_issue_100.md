## Goal

Permitir que el parser de voz (`parseSpokenCommand`) interprete correctamente horas con minutos dictadas sin la conjunción "y" (e.g. "17 18", "a las 17 18", "alerta 17 18", "diecisiete dieciocho"), configurando `occurredAt` a la hora y minuto exactos (17:18) y eliminando ambos números del contenido residual de la entrada.

## Acceptance criteria

- [ ] En `frontend/services/voiceParser.ts`:
  - Se flexibiliza la extracción de hora y minutos (`timeMatch`) para que la conjunción "y" entre hora y minutos sea opcional (reconociendo tanto `17 18` como `17 y 18`).
  - Se admite la extracción de hora y minutos tanto con prefijo ("a las", "a la") como en órdenes directas ("alerta 17 18", "tarea 17 18", "17:18").
  - Se amplía el mapeo de horas verbales para incluir horas de 13 a 23 (trece, catorce, quince, dieciséis/dieciseis, diecisiete, dieciocho, diecinueve, veinte, veintiuno, veintidós/veintidos, veintitrés/veintitres).
  - La hora y los minutos reconocidos se consumen completamente de `workingText`, garantizando que los minutos no se filtren como texto residual en `content`.
- [ ] Pruebas unitarias en `frontend/services/voiceParser.test.ts`:
  - Prueba con "a las 17 18" extrayendo 17:18 y verificando que el contenido no contiene "18".
  - Prueba con "alerta 17 18 dentista" extrayendo 17:18 y asignando categoría y contenido limpios.
  - Prueba con palabras "diecisiete dieciocho" interpretando 17:18.
  - Verificación de regresión: Todas las pruebas de tiempo previas ("a las 10:40 de la noche", "a las 4 de la tarde", "a las 5 y media", etc.) continúan pasando sin alteración.
- [ ] Verificación de calidad completa:
  - Frontend: `npm run check` (Prettier, ESLint, TypeScript, Jest) pasando al 100%.
  - Backend: `uv run --directory backend python scripts/check.py` pasando al 100%.

## Out of scope

- Modificaciones en la captura de audio o en la API de síntesis/reconocimiento del navegador.

## Constraints

- Modificar solo los archivos necesarios (`frontend/services/voiceParser.ts`, `frontend/services/voiceParser.test.ts`, y corrección de CI en `backend/tests/test_push_api.py`).
- No añadir dependencias externas.
