# Proyecto AI

Aplicación personal para registrar y consultar recuerdos, aprendizajes, tareas y eventos. La [especificación funcional](./_docs/spec.md), la [arquitectura](./_docs/arch.md) y el [modelo de dominio v0.1](./_docs/domain-model-v0.1.md) están en [`_docs/`](./_docs/).

## Estructura

- `frontend/`: aplicación Expo, React Native y TypeScript.
- `backend/`: API mínima de FastAPI.
- `_docs/`: especificación, arquitectura y backlog del MVP.

## Requisitos

- Node.js LTS y npm.
- Python 3.11 o posterior.
- [uv](https://docs.astral.sh/uv/) para instalar y ejecutar el entorno Python.

## Instalar dependencias

Desde la raíz del repositorio, las instalaciones reproducibles usan los archivos
de bloqueo versionados:

```powershell
npm.cmd --prefix frontend ci
uv sync --directory backend --frozen
```

## Comprobaciones de calidad

Los comandos de comprobación no modifican archivos. Para ejecutar todas las
comprobaciones de cada entorno:

```powershell
npm.cmd --prefix frontend run check
uv run --directory backend python scripts/check.py
```

También pueden ejecutarse por separado desde la raíz:

```powershell
# Frontend
npm.cmd --prefix frontend run format:check
npm.cmd --prefix frontend run lint
npm.cmd --prefix frontend run typecheck
npm.cmd --prefix frontend run test

# Backend
uv run --directory backend ruff format --check app scripts tests
uv run --directory backend ruff check app scripts tests
uv run --directory backend mypy app scripts tests
uv run --directory backend pytest
```

Para aplicar formato de manera intencionada, usa comandos separados de las
comprobaciones:

```powershell
npm.cmd --prefix frontend run format
uv run --directory backend ruff format app scripts tests
```

La prueba del frontend renderiza la pantalla inicial de Expo. La del backend
comprueba el endpoint de salud de FastAPI sin necesitar una base de datos ni
servicios externos.

Para arrancar la app Expo desde la raíz:

```powershell
npm.cmd --prefix frontend start
```

Para arrancar la API localmente:

```powershell
Push-Location backend
uv run uvicorn app.main:app --reload
Pop-Location
```
