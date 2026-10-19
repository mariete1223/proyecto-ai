# Groomed Task: Issue #86 - Las horas dictadas sin sufijo (ej. 10:40) se interpretan como mañana/día por defecto

## Goal

Corregir la desambiguación horaria en `voiceParser.ts` para que las horas dictadas sin sufijo explícito de período (como "a las 10:40", "a las 10", "a las 9:30", "a las 8", "a las 11") se interpreten como horario diurno/mañana (AM) por defecto, reservando el horario nocturno (22:40) únicamente para cuando se especifique explícitamente "de la noche", "de la tarde", "pm", o se dicte en formato de 24 horas (ej. "a las 22:40").

## Acceptance criteria

- [ ] **Interpretación diurna por defecto para horas de mañana (7:00 a 11:59)**:
  - Al dictar una hora entre 7 y 11 sin sufijo (ej. `"a las 10:40"`, `"a las 10"`, `"a las 9:30"`, `"a las 8"`, `"a las 11:15"`), `parseSpokenCommand` asigna la hora diurna correspondiente (10:40, 10:00, 09:30, 08:00, 11:15), NO sumando 12 horas.
- [ ] **Interpretación vespertina explícita o para horas de tarde sin sufijo (1:00 a 6:59)**:
  - Horas entre 1 y 6 dictadas sin sufijo (ej. `"a las 4"`, `"a las 5 y media"`) continúan interpretándose por defecto como horario de tarde (16:00, 17:30).
  - Si el usuario dice explícitamente `"de la mañana"` o `"am"` para horas 1-6 (ej. `"a las 4 de la mañana"`), se respeta la mañana (04:00).
- [ ] **Asignación nocturna explícita**:
  - Si el usuario dicta `"a las 10:40 de la noche"` (o cualquier hora con `"de la noche"`, `"de la tarde"` o `"pm"`), se asigna el horario nocturno correspondiente (`22:40`).
  - Si se dicta `"a las 12 de la noche"`, se asignan las 00:00 (medianoche).
- [ ] **Formato de 24 horas explícito**:
  - Si el usuario dicta directamente `"a las 22:40"`, `"a las 15:00"` o `"09:00"`, se respeta el valor exacto de 24 horas dictado.
- [ ] **Tests y Calidad**:
  - Añadir pruebas unitarias exhaustivas en `frontend/services/voiceParser.test.ts` cubriendo:
    - `"10:40"` sin sufijo -> 10:40 (AM)
    - `"10:40 de la noche"` -> 22:40 (PM)
    - `"22:40"` formato 24h -> 22:40
    - `"9:30"`, `"8:00"`, `"11:15"` sin sufijo -> horas matutinas
    - `"4"`, `"5 y media"` sin sufijo -> 16:00, 17:30
    - `"12 de la noche"` -> 00:00
  - `npm --prefix frontend run check` pasa al 100% (Prettier, ESLint, TypeScript, Jest).
  - `pytest` en backend pasa al 100%.

## Out of scope

- Modificar el reconocedor de voz por hardware (WebSpeech / Audio recording).
- Cambiar el formato de visualización de etiquetas del calendario.

## Constraints

- Los cambios deben concentrarse en `frontend/services/voiceParser.ts` y sus tests asociados en `frontend/services/voiceParser.test.ts`.
- No alterar dependencias en `package.json` ni en `pyproject.toml`.
