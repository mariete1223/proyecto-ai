# Groomed Task: Issue #72 (Recurrence) - Fallo en el pipeline de CI en comprobaciones de formateo de frontend (Prettier)

## Goal

Restaurar el estado de paso exitoso (PASS verde) en el pipeline de CI en GitHub Actions formateando con Prettier los archivos de frontend recientemente modificados que no cumplen las reglas de estilo del proyecto, desbloqueando el job de despliegue continuo (CD).

## Context & Defect Details

- **Affected Feature**: CI pipeline / Frontend format check (`npm run check` -> `npm run format:check`).
- **Reproducible Current Behaviour**:
  - Al ejecutar `npm run format:check` en `frontend/` (o en GitHub Actions Runner), Prettier falla con código de salida 1 advirtiendo diferencias de estilo en `components/EntryDetailView.test.tsx`, `components/VoiceCaptureFlow.test.tsx` y `components/VoiceCaptureFlow.tsx`.
- **Expected Behaviour**:
  - `npm run format:check` finaliza con código 0 ("All matched files use Prettier code style!").
  - El job `Frontend checks` pasa al 100% y el pipeline de CI ejecuta y completa con éxito el job dependiente `Continuous Deployment (CD)`.
- **Evidence & Environment**:
  - GitHub Actions Run ID `39151185381` (commit `432d7ee`), Job `117744991303`.
  - Node.js 22, Prettier 3.x, npm 10.x.
- **Data Repair**: No se requiere reparación de datos en base de datos.
- **Regression Coverage**:
  - `npm run check` en `frontend/` ejecutando `format:check`, `lint`, `typecheck` y `test`.

## Acceptance Criteria

- [ ] `npm run format:check` en `frontend/` finaliza con código de salida 0 sin advertencias.
- [ ] `npm run check` en `frontend/` pasa satisfactoriamente las 4 comprobaciones (`format:check`, `lint`, `typecheck`, `test`).
- [ ] Ninguna funcionalidad, prueba o comportamiento de frontend ni backend resulta alterado.
- [ ] El pipeline de CI en GitHub Actions completa todos los jobs (`Frontend checks`, `Backend checks`, `Continuous Deployment`) en estado verde.

## Out of scope

- Modificaciones de lógica de negocio o nuevas funcionalidades.
- Ajustes de configuración en `.prettierrc` o `.github/workflows/ci.yml`.

## Constraints

- Archivos afectados: `frontend/components/EntryDetailView.test.tsx`, `frontend/components/VoiceCaptureFlow.test.tsx`, `frontend/components/VoiceCaptureFlow.tsx` (y cualquier otro archivo de frontend con advertencias de estilo).
- No agregar nuevas dependencias en `package.json` ni `pyproject.toml`.
- Todo el conjunto de pruebas unitarias existente (247 pruebas de frontend y 116 de backend) debe seguir pasando al 100%.
