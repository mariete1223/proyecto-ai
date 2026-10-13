# Proyecto AI — Asistente Personal de Memoria y Organización

Aplicación personal unificada para registrar, organizar y consultar recuerdos, aprendizajes, tareas y eventos con interacción guiada por voz.

---

## 1. Problema y Producto

### ¿Qué problema resuelve?
Tradicionalmente, las personas separan su organización diaria (calendarios, listas de tareas pendientes) de su memoria personal (diarios, notas reflexivas, aprendizajes o momentos destacados). Esta fragmentación provoca dos problemas habituales:
1. **Pérdida de momentos destacados:** Con el paso del tiempo, olvidamos anécdotas, aprendizajes o vivencias personales importantes por falta de un registro accesible y centralizado.
2. **Fricción al registrar información:** Rellenar formularios manuales en el móvil (seleccionar fecha, hora, categoría y escribir párrafos en pantallas pequeñas) quita tiempo y desalienta el hábito diario.

**Proyecto AI** resuelve esta fricción unificando la agenda de compromisos y el diario de vida en un único lugar, permitiendo capturar cualquier acontecimiento o tarea en segundos mediante **comandos de voz naturales**, sin perder tiempo y sin fricción.

### ¿A quién va dirigido y qué necesidad cubre?
- **Público objetivo:** Cualquier usuario que desee recopilar lo que hace día a día, tener un registro de sus vivencias pasadas y un control ordenado de lo que tiene pendiente por hacer en el futuro.
- **Necesidades clave:**
  - Reducir la carga mental mediante un vaciado rápido de ideas (*brain dump*) sobre la marcha.
  - Conservar una memoria vital a largo plazo conectada a un calendario cronológico.
  - Asegurar la privacidad total y la disponibilidad sin conexión a Internet (*offline-first*).

### Funcionalidades principales y comportamiento esperado
- 🎙️ **Captura por voz inteligente (Speech-to-Text):** Hablas con naturalidad y el asistente interpreta automáticamente la categoría, fecha/hora relativa (ej. *"para el lunes de la semana que viene a las 17:00"*), prioridad (*"prioridad alta"*) y etiquetas, extrayendo el contenido limpio sin intervención manual.
- 📅 **Calendario y Diario unificado:** Visualización mensual y diaria para consultar tanto eventos y citas futuras como notas y recuerdos registrados en el pasado.
- ✅ **Gestor de Tareas y Prioridades:** Soporte para tareas con fecha y tareas flotantes/pendientes con transiciones de estado (*Pendiente*, *En progreso*, *Completada*) y clasificación visual por prioridad (*Alta*, *Media*, *Baja*).
- 🏷️ **Categorías y Etiquetas personalizadas:** Catálogo configurable con comandos de voz propios, colores únicos e iconos para adaptar el sistema al estilo de vida del usuario.
- 🔄 **Sincronización robusta Offline-First:** Los datos se guardan al instante en la base de datos local SQLite del dispositivo (móvil o web) y se sincronizan de manera bidireccional e idempotente con el backend FastAPI / PostgreSQL.

La [especificación funcional en detalle](./_docs/spec.md), la [arquitectura técnica](./_docs/arch.md) y el [modelo de dominio](./_docs/domain-model-v0.1.md) se encuentran disponibles en [`_docs/`](./_docs/).

---

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

## Arrancar la aplicación

### Flujo habitual (ordenador + iPhone)

> **Usa este proceso cada vez que enciendas el ordenador.**

**Terminal 1 — Backend y túnel:**
```powershell
.\start.ps1
```
El script hace automáticamente:
1. Lanza un túnel público Cloudflare y captura su URL
2. Escribe la URL en `frontend/.env.local` y `frontend/app.json`
3. Arranca el backend FastAPI en `localhost:8000`

Espera hasta que aparezca `Tunel activo: https://xxx.trycloudflare.com`.

**Terminal 2 — Frontend Expo:**
```powershell
cd frontend
npx expo start --lan
```

**iPhone:**
- Abre **Expo Go** → escanea el QR que aparece en la terminal
- La app ya tiene configurada automáticamente la URL del túnel

> ⚠️ El túnel Cloudflare genera una URL nueva cada vez que se reinicia. El script `start.ps1` la actualiza automáticamente, así que solo tienes que volver a ejecutarlo.

---

### Solo web (sin iPhone)

Si solo usas el ordenador, puedes arrancar el backend directamente:

```powershell
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Y el frontend:
```powershell
cd frontend
npx expo start --lan
```

### Solo back-end

```powershell
cd backend
uv run uvicorn app.main:app --reload
```

## Conexión del backend a PostgreSQL

Por defecto el backend usa **SQLite local** (`backend/app.db`) sin configuración.
Para usar PostgreSQL en producción, configura `DATABASE_URL` antes de arrancar:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://USUARIO:CONTRASENA@HOST:5432/BASE_DE_DATOS"
```

Para comprobar la configuración y conectividad mediante `SELECT 1`, ejecuta
desde la raíz:

```powershell
uv run --directory backend python -m scripts.check_database
```

Una conexión correcta muestra `PostgreSQL connection check succeeded.` y
termina con código `0`. Una configuración inválida o un fallo de conexión
muestra `PostgreSQL connection check failed.` y termina con un código distinto
de `0`; la salida no incluye credenciales ni la URL de conexión.
