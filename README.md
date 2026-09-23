# Proyecto AI

Aplicación personal para registrar y consultar recuerdos, aprendizajes, tareas y eventos. La especificación funcional y la arquitectura acordada están en [`_docs/`](./_docs/).

## Estructura

- `frontend/`: aplicación Expo, React Native y TypeScript.
- `backend/`: API mínima de FastAPI.
- `_docs/`: especificación, arquitectura y backlog del MVP.

## Requisitos

- Node.js LTS y npm.
- Python 3.11 o posterior.

## Instalar y ejecutar las pruebas

Desde la raíz del repositorio, ejecuta estos pasos en PowerShell:

```powershell
npm.cmd --prefix frontend ci
Push-Location backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[test]"
Pop-Location
npm.cmd --prefix frontend test
.\backend\.venv\Scripts\python.exe -m pytest backend\tests
```

La primera prueba renderiza la pantalla inicial de Expo. La segunda comprueba el endpoint de salud de FastAPI sin necesitar una base de datos ni servicios externos.

Para arrancar la app Expo desde la raíz:

```powershell
npm.cmd --prefix frontend start
```

Para arrancar la API localmente:

```powershell
Push-Location backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
Pop-Location
```
