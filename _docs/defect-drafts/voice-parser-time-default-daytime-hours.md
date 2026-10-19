---
fingerprint: voice-parser-time-default-daytime-hours
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/86
first_seen: 2026-10-19
last_seen: 2026-10-19
---

# Defect: Las horas dictadas sin sufijo (ej. 10:40) se interpretan como noche (22:40) en lugar de mañana/día por defecto

## Observed behaviour

Al dictar un comando de voz especificando una hora como "a las 10:40" sin indicar "de la mañana", "de la tarde" o "de la noche", el analizador de voz (`voiceParser.ts`) aplica por defecto un incremento de 12 horas (`hours += 12`) a cualquier hora entre 1 y 11 que no comience explícitamente con cero, asignando las 22:40 en vez de las 10:40.

## Expected behaviour

1. Si el usuario dice "10:40" (o cualquier hora diurna estándar sin sufijo), debe interpretarse como hora de día (10:40 AM) por defecto.
2. Para que se interprete como las 22:40, el usuario debe indicar explícitamente "de la noche" (por ejemplo: "a las 10:40 de la noche") o bien dictar el formato de 24 horas directamente ("a las 22:40").

## Reproduction

1. En la aplicación móvil o web, iniciar el dictado por voz (o probar la función `parseSpokenCommand`).
2. Dictar el comando: `"nota fecha hoy a las 10:40 contenido revisión médica"`.
3. Observar la hora resultante asignada en `occurredAt` y en la etiqueta visual.
4. Resultado observado: se asigna `22:40` (10:40 PM).
5. Resultado esperado: debe asignarse `10:40` (10:40 AM).

Frequency: 100% reproducible

## Environment

- Client: Web, PWA y Móvil (Expo / iOS / Android)
- Componente: `frontend/services/voiceParser.ts` (`parseSpokenCommand`)

## Evidence

- Reporte informal del usuario: *"luego, el tema de las horas si se dice 10:40 q sea de dia por defecto, tiene que decir de la noche para q sea 22:40 o que diga 22:40 directamente"*
- Código fuente en `frontend/services/voiceParser.ts:520-523`:
  ```ts
  } else if (!isExplicit24h && hours >= 1 && hours <= 11) {
    // Unspecified hour (e.g. "a las 4", "a las cinco") defaults to PM (16:00, 17:00)
    hours += 12;
  }
  ```

## Triage

- Classification: confirmed
- Impact: Medio. Asignación errónea de recordatorios y eventos a la noche (22:40) en lugar del horario matutino habitual (10:40) cuando el usuario dicta horas compuestas sin sufijo de período del día.
- Facts: La regla actual en `voiceParser.ts` suma deterministamente 12 a todas las horas entre 1 y 11 salvo que tengan formato 24h explícito o especificación de mañana.
- Hypotheses: El comportamiento por defecto para horas como 10:40 debe asumir horario de mañana/día por defecto salvo que se exprese "de la tarde", "de la noche", "pm" o se usen horas >= 13 o formato 24h.
- Missing information: Ninguna.
- Possible duplicates checked: Issue #29, #63, #67, #68, #69, #75. Ningún issue aborda la regla de desambiguación AM/PM para horas dictadas sin sufijo.
