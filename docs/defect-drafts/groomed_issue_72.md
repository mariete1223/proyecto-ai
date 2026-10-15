## Goal

Restablecer el estado verde (PASS) en el pipeline de Integración Continua (CI) de GitHub Actions en la rama `main`, formateando de manera exhaustiva todos los archivos del repositorio para cumplir estrictamente con las reglas de estilo de Prettier en frontend y Ruff en backend sin alterar la lógica de negocio ni la cobertura de tests.

## Current vs. Expected Behaviour

- **Current behaviour**: El pipeline de CI de GitHub Actions falla en cada push a `main`:
  - `Frontend checks`: `npm run check` falla en el sub-paso `prettier --check .` indicando que 37 archivos tienen problemas de estilo.
  - `Backend checks`: `scripts/check.py` falla en el sub-paso `ruff format --check app scripts tests` indicando que 8 archivos necesitan reformateo.
  - `CD`: El job de despliegue continuo queda bloqueado/omitido.
- **Expected behaviour**: Todos los jobs de CI (`Frontend checks`, `Backend checks` y `CD`) finalizan con código de salida 0 (PASS verde).

## Evidence & Environment

- **Evidencia**: GitHub Actions Run ID `38703809439` (commit `b18958a`), job `116318128978` y `116318129257`.
- **Entorno**: GitHub Actions Runner `ubuntu-latest`, Node.js 22, Python 3.11, Prettier 3.x, Ruff 0.x.

## Data repair

- No requiere reparación de datos persistidos en SQLite ni PostgreSQL; es un defecto puramente de formateo y estilo de código fuente.

## Acceptance criteria

- [ ] En `frontend/`, la ejecución de `npm run format:check` finaliza con código de salida 0 sin ningún archivo pendiente de formatear (`All matched files use Prettier code style!`).
- [ ] En `frontend/`, la ejecución del comando completo de CI `npm run check` (`format:check`, `lint`, `typecheck` y `test`) finaliza con código de salida 0.
- [ ] En `backend/`, la ejecución de `python -m ruff format --check app scripts tests` finaliza con código de salida 0 (`X files already formatted`).
- [ ] En `backend/`, la ejecución del script completo de CI `python scripts/check.py` (`ruff format`, `ruff check`, `mypy` y `pytest`) finaliza con código de salida 0.
- [ ] Ninguna funcionalidad, test unitario existente o lógica de la aplicación se ve alterada o degradada.
- [ ] Al hacer push del commit a `origin main`, el workflow de GitHub Actions se ejecuta y finaliza con éxito completo (PASS verde) en todos los jobs.

## Regression coverage

- Validación local estricta antes del push mediante `npm run check` en `frontend/` y `python scripts/check.py` en `backend/`.
- Verificación del estado del workflow en GitHub Actions tras el push mediante `gh run list` / `gh run view`.

## Out of scope

- Modificación de las reglas de configuración de `.prettierrc` o `pyproject.toml` (deben mantenerse las reglas estándar establecidas).
- Adición de nuevas dependencias o eliminación de linters existentes.

## Constraints

- No modificar dependencias en `package.json` ni en `pyproject.toml`.
- Preservar comentarios, tipos TypeScript y docstrings intactos.
