---
fingerprint: ci-format-check-failures
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/72
first_seen: 2026-10-15
last_seen: 2026-10-15
---

# Defect: Fallos en el pipeline de CI en comprobaciones de formateo de frontend (Prettier) y backend (Ruff)

## Observed behaviour

En los pushes a la rama `main`, el pipeline de CI de GitHub Actions falla sistemáticamente en los jobs `Frontend checks` y `Backend checks`:
1. `Frontend checks`: `npm run check` falla en `npm run format:check` (`prettier --check .`) reportando problemas de estilo en 37 archivos.
2. `Backend checks`: `uv run --directory backend python scripts/check.py` falla en el paso 1 `ruff format --check app scripts tests` indicando que 8 archivos requieren reformateo.
Como consecuencia, el job dependiente de despliegue continuo (`Continuous Deployment (CD)`) se omite.

## Expected behaviour

El pipeline de CI en GitHub Actions debe completarse con éxito (PASS verde) en todos los jobs (`Frontend checks`, `Backend checks` y `Continuous Deployment`), pasando satisfactoriamente todas las validaciones de formato, tipado, linter y tests automatizados.

## Reproduction

1. Ejecutar localmente o en GitHub Actions:
   - Frontend: `npm run format:check` en `frontend/`
   - Backend: `python -m ruff format --check app scripts tests` en `backend/`
2. Observar que Prettier emite:
   `Code style issues found in 37 files. Run Prettier with --write to fix.` (Exit code 1)
3. Observar que Ruff emite:
   `8 files would be reformatted, 59 files already formatted` (Exit code 1)
4. GitHub Actions finaliza con fallo general (Run ID `38703809439`).

Frequency: 100% reproducible en los últimos commits de `main`.

## Environment

- CI: GitHub Actions Runner `ubuntu-latest`
- Frontend: Node.js 22, Prettier 3.x, npm 10.x
- Backend: Python 3.11, Ruff 0.x, uv 0.4.x

## Evidence

- GitHub Actions Run ID: `38703809439` (commit `b18958a`)
  - Job ID `116318128978` (Backend checks): Fallo en `ruff format --check` con exit code 1.
  - Job ID `116318129257` (Frontend checks): Fallo en `prettier --check .` con exit code 1.
  - Job ID `116318350095` (CD): Omitido por fallo en dependencias.
- Logs locales reproducidos con idéntico resultado en ambos entornos.

## Triage

- Classification: `confirmed`
- Impact: Bloquea el estado de salud del repositorio en CI y detiene el pipeline de despliegue continuo (CD).
- Facts:
  - Las suites de tests unitarios de frontend (232 tests) y backend (116 tests) y el chequeo de tipos de TypeScript están pasando al 100%.
  - La causa raíz del fallo es exclusivamente el chequeo estricto de formateo de código (`prettier --check` y `ruff format --check`).
- Hypotheses:
  - Ejecutar el formateador de código en frontend (`npx prettier --write .`) y backend (`ruff format app scripts tests`) resolverá el fallo sin impacto en la lógica de negocio.
- Missing information: Ninguna.
- Possible duplicates checked:
  - Issues #1 a #71 comprobadas; no existe ninguna issue abierta ni cerrada reportando este fallo de CI.

## Publication history

- 2026-10-15: Intake local registrado como borrador idempotente `ci-format-check-failures.md`.
- 2026-10-15: Publicado en GitHub como Issue #72.
- 2026-10-15: Resuelto mediante ciclo PM -> Engineer -> QA. Commit `db5a755`. Verificado en verde en GitHub Actions Run 38711190991. Issue cerrada.
