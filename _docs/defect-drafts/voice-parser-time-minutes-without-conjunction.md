---
fingerprint: voice-parser-time-minutes-without-conjunction
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/100
first_seen: 2026-10-19
last_seen: 2026-10-19
---

# Defect: Al dictar horas y minutos sin la conjunción "y" (ej. "17 18"), el parser no extrae los minutos

## Observed behaviour

Al dictar una hora con minutos diciendo las cifras consecutivas sin la conjunción "y" (por ejemplo: "a las 17 18" o "17 18"), el parser de voz no extrae el número de minutos. En su lugar, interpreta la hora fija a en punto (17:00) y los minutos ("18") quedan como texto residual dentro del contenido de la nota o tarea. En cambio, si se pronuncia "17 y 18", sí se interpreta como 17:18.

## Expected behaviour

El parser debe interpretar correctamente la hora tanto si se dice "17 y 18" como si se dice "17 18" (o en palabras "diecisiete dieciocho" / "diecisiete y dieciocho"), reconociendo 17:18 y eliminando ambos números de hora y minuto del texto de contenido.

## Reproduction

1. Iniciar captura por voz o llamar a `parseSpokenCommand`.
2. Dictar: "alerta a las 17 18 médico" o "tarea hoy a las 17 18 comprar pan".
3. Observar:
   - `occurredAt` se fija en 17:00 en lugar de 17:18.
   - `content` contiene "18 médico" o "18 comprar pan".

Frequency: 100% reproducible.

## Environment

- Client: Web & Mobile PWA / Expo
- Component: `frontend/services/voiceParser.ts`

## Evidence

- Reporte del usuario: *"Tiene problemas al decirle 17 18, si no digo 17 y 18 no me pone correctamente el 17:18 revisa eso"*

## Triage

- Classification: confirmed
- Impact: Medio (afecta a la precisión de horarios dictados por voz para tareas y alertas)
- Facts:
  - En `frontend/services/voiceParser.ts` (línea 462), la expresión regular `timeMatch` requiere estrictamente la conjunción `\s+y\s+` para capturar los minutos: `(?:\s+y\s+(media|cuarto|...|\d{1,2}))?`.
  - Cuando se dicta sin "y" (espacio simple: `17 18`), el grupo de minutos no coincide y se extrae solo la hora base `17`, dejando los minutos como parte del texto de contenido.
  - Además, `hourWordsMap` solo contempla horas del 1 al 12 en texto, no cubriendo números de hora militar en palabras (e.g. "diecisiete").
- Hypotheses:
  - Flexibilizar el separador de minutos en la regex de hora para admitir `(?:\s+(?:y\s+)?(\d{1,2}|media|...))` permitirá capturar minutos tanto con "y" como sin "y".
- Missing information: ninguna.
- Possible duplicates checked:
  - Issue #86: cubría horas de la mañana vs tarde sin sufijo.
  - Issue #96: cubría inputs de fecha/hora y alarma automática.
  - Ningún issue o borrador previo cubre la omisión de la conjunción "y".

## Publication history

- 2026-10-19: Borrador local creado e investigado.
