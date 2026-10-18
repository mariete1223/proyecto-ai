---
fingerprint: ci-format-check-failures
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/72
first_seen: 2026-10-15
last_seen: 2026-10-18
---

# Defect: Fallos en el pipeline de CI en comprobaciones de formateo de frontend (Prettier) y backend (Ruff)

## Observed behaviour

En los pushes a la rama `main`, el pipeline de CI de GitHub Actions falla en el job `Frontend checks`:
1. `Frontend checks`: `npm run check` falla en el sub-paso `npm run format:check` (`prettier --check .`) reportando advertencias de estilo en 3 archivos del frontend.
Como consecuencia, el job dependiente de despliegue continuo (`Continuous Deployment (CD)`) se omite y el pipeline finaliza con fallo general.

## Expected behaviour

El pipeline de CI en GitHub Actions debe completarse con éxito (PASS verde) en todos los jobs (`Frontend checks`, `Backend checks` y `Continuous Deployment`), pasando satisfactoriamente todas las validaciones de formato, tipado, linter y tests automatizados.

## Reproduction

1. Ejecutar localmente o en GitHub Actions:
   - Frontend: `npm run format:check` en `frontend/`
2. Observar que Prettier emite:
   ```
   Checking formatting...
   [warn] components/EntryDetailView.test.tsx
   [warn] components/VoiceCaptureFlow.test.tsx
   [warn] components/VoiceCaptureFlow.tsx
   [warn] Code style issues found in 3 files. Run Prettier with --write to fix.
   ```
   (Exit code 1).
3. GitHub Actions finaliza con fallo general (Run ID `39151185381`).

Frequency: 100% reproducible en los últimos commits de `main`.

## Environment

- CI: GitHub Actions Runner `ubuntu-latest`
- Frontend: Node.js 22, Prettier 3.x, npm 10.x
- Backend: Python 3.11, Ruff 0.x, uv 0.4.x

## Evidence

- GitHub Actions Run ID: `39151185381` (commit `432d7ee`)
  - Job ID `117744991091` (Backend checks): PASS verde en 57s.
  - Job ID `117744991303` (Frontend checks): Fallo en `npm run check` -> `prettier --check .` con exit code 1.
  - Job ID `117745199242` (CD): Omitido por fallo en dependencias.
- Runs previos afectados tras resolución de issues #73-#76: Run ID `39150562857`, `39150177932`, `39149704157`.
- Logs locales reproducidos con idéntico resultado en `frontend/`:
  - `components/EntryDetailView.test.tsx`
  - `components/VoiceCaptureFlow.test.tsx`
  - `components/VoiceCaptureFlow.tsx`

## Triage

- Classification: `confirmed`
- Impact: Bloquea el estado de salud del repositorio en CI y detiene el pipeline de despliegue continuo (CD).
- Facts:
  - Las suites de tests unitarios de frontend (247 tests) y backend (116 tests), el linter (`eslint`) y el chequeo de tipos de TypeScript están pasando al 100%.
  - La causa raíz del fallo es exclusivamente el chequeo estricto de formateo de código de Prettier en 3 archivos modificados recientemente.
- Hypotheses:
  - Ejecutar el formateador Prettier en frontend (`npm run format` o `npx prettier --write components/EntryDetailView.test.tsx components/VoiceCaptureFlow.test.tsx components/VoiceCaptureFlow.tsx`) resolverá el fallo sin alterar lógica de negocio.
- Missing information: Ninguna.
- Possible duplicates checked:
  - Coincidencia exacta con la huella `ci-format-check-failures` documentada en Issue #72.

## Publication history

- 2026-10-15: Intake local registrado como borrador idempotente `ci-format-check-failures.md`.
- 2026-10-15: Publicado en GitHub como Issue #72.
- 2026-10-15: Resuelto mediante ciclo PM -> Engineer -> QA. Commit `db5a755`. Verificado en verde en GitHub Actions Run 38711190991. Issue cerrada.
- 2026-10-18: Recurrencia observada en CI tras commits de issues #73-#77. Reabierto en GitHub Issue #72 con nueva evidencia.
