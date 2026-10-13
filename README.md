# Proyecto AI — Asistente Personal de Memoria y Organización

[![CI](https://github.com/mariete1223/proyecto-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/mariete1223/proyecto-ai/actions/workflows/ci.yml)

Aplicación personal unificada para registrar, organizar y consultar recuerdos, aprendizajes, tareas y eventos con interacción guiada por voz y arquitectura *offline-first*.

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

---

## 2. Uso de IA y Proceso de Desarrollo

El desarrollo del proyecto ha sido asistido de forma integral por Inteligencia Artificial bajo control humano estricto (*Human-in-the-Loop*):

- **Modelos y Herramientas:** Se ha utilizado **Google Gemini** en el entorno agéntico de **Antigravity IDE**, junto con Web Speech API y modelos de procesamiento de lenguaje natural.
- **Evolución del Flujo de Trabajo:**
  1. *Fase MVP inicial:* Implementación guiada por la especificación de producto ([`_docs/spec.md`](./_docs/spec.md)) y backlog de tareas ([`_docs/tasks.md`](./_docs/tasks.md)).
  2. *Fase de Refinamiento y Defectos:* Adaptación a un ciclo formal multi-agente por roles (**PM -> Software Engineer -> QA Engineer**) documentado en [`_docs/process.md`](./_docs/process.md).
- **Control Humano y Pruebas Reales:** Cada funcionalidad o corrección se prueba en dispositivos físicos reales (iPhone en Safari y Expo Go vía túnel Cloudflare). El intake de fallos es de solo lectura hasta que el usuario ordena explícitamente su resolución.
- **Prompts Versionados:** Los prompts del sistema para extracción estructurada JSON de eventos y tareas están documentados en [`_docs/llm_structuring_prompt.md`](./_docs/llm_structuring_prompt.md).

> 📄 Para consultar el detalle exhaustivo del proceso, prompts y casos resueltos, revisa [`_docs/ai-development-process.md`](./_docs/ai-development-process.md).

---

## 3. Tecnologías y Arquitectura

### Justificación de Tecnologías

| Componente | Tecnología | Justificación |
| :--- | :--- | :--- |
| **Frontend** | React Native + Expo (TypeScript) | Permite una aplicación multiplataforma (iOS, Android y Web) desde una sola base de código con rendimiento nativo y acceso al hardware de audio. |
| **Persistencia Local** | SQLite (`expo-sqlite` / fallback web) | Núcleo de la arquitectura *offline-first*. La aplicación responde de inmediato y funciona al 100% sin conexión. |
| **Backend API** | FastAPI (Python 3.11) + Pydantic v2 | Alto rendimiento asíncrono, validación tipada estricta y generación nativa de contratos OpenAPI. |
| **Persistencia Servidor**| PostgreSQL / SQLite + SQLAlchemy + Alembic | Soporte para despliegue productivo relacional (PostgreSQL) y SQLite local para desarrollo ligero sin dependencias pesadas. |
| **Conectividad / Túneles**| Cloudflare Tunnels (`trycloudflare`) | Permite a dispositivos móviles en red celular conectarse de forma segura y cifrada al servidor de desarrollo local sin configurar puertos ni DNS. |

### Diagrama de Arquitectura

```mermaid
graph TD
    subgraph Cliente ["Cliente (Móvil iPhone / Web)"]
        UI[React Native / Expo UI]
        STT[Voz: Web Speech API / Parser]
        DB_Local[(SQLite Local: expo-sqlite)]
        Sync_Client[Sync Engine Offline-First]
        
        UI -->|Dictado / Entrada manual| STT
        STT -->|Guardado inmediato| DB_Local
        UI <-->|Lectura / Render reactivo| DB_Local
        DB_Local <--> Sync_Client
    end

    subgraph Red ["Capa de Comunicación"]
        Tunnel[Cloudflare Tunnel / HTTPS]
        Sync_Client <-->|REST API JSON| Tunnel
    end

    subgraph Servidor ["Backend & Nube"]
        FastAPI[FastAPI REST API: Python 3.11]
        Auth[Módulo de Autenticación / Usuarios]
        Sync_Service[Servicio de Sincronización Idempotente]
        ORM[SQLAlchemy 2.0 + Alembic]
        DB_Server[(PostgreSQL / SQLite Servidor)]
        
        Tunnel <--> FastAPI
        FastAPI --> Auth
        FastAPI --> Sync_Service
        Sync_Service --> ORM
        ORM <--> DB_Server
    end
```

La documentación arquitectónica detallada se encuentra en [`_docs/arch.md`](./_docs/arch.md) y el protocolo de sincronización en [`_docs/sync-protocol.md`](./_docs/sync-protocol.md).

---

## 4. Contrato OpenAPI

El backend implementa un contrato OpenAPI 3.1 estricto generado automáticamente por FastAPI a partir de los esquemas Pydantic:

- **Documentación Interactiva:** Accesible en vivo en `http://localhost:8000/docs` (Swagger UI) o `/redoc`.
- **Esquema JSON Versionado:** El esquema completo exportado se encuentra disponible en el repositorio en [`_docs/openapi.json`](./_docs/openapi.json).

---

## 5. Pruebas y Control de Calidad

El proyecto cuenta con una cobertura integral de pruebas unitarias y de integración que se ejecutan automáticamente en CI y localmente.

### Pruebas de Integración (Criterio 9 de la Rúbrica)
- **Frontend (`frontend/services/mvpIntegrationTest.test.ts`):** Simula el ciclo completo de la aplicación: captura por voz, almacenamiento en SQLite local y sincronización con el servidor remoto.
- **Backend Sync & DB (`backend/tests/test_sync_api.py`, `test_conflict_handling.py`, `test_database_session.py`):** Validan la persistencia transaccional, resolución de conflictos (*last-write-wins* e idempotencia de IDs) y compatibilidad de esquema con migraciones Alembic.

### Ejecución de Comprobaciones

#### En Windows (PowerShell)
```powershell
# Frontend: Formato, linter, tipos y 158 tests
npm.cmd --prefix frontend run check

# Backend: Formato, linter (ruff), tipos (mypy) y 104 tests (pytest)
& "backend\.venv\Scripts\python.exe" scripts/check.py
```

#### En Linux / macOS (Bash)
```bash
# Frontend
npm --prefix frontend run check

# Backend
uv run --directory backend python scripts/check.py
```

---

## 6. Extensiones para Agentes (Criterio 12 de la Rúbrica)

El repositorio incluye un ecosistema completo para interacción asistida por agentes:

- [`AGENTS.md`](./AGENTS.md): Reglas de operación, comandos permitidos y prohibición de añadir dependencias sin consultar.
- **Roles Especializados ([`_docs/team/`](./_docs/team/)):** Separación de contextos para [Product Manager](./_docs/team/pm.md), [Software Engineer](./_docs/team/software-engineer.md) y [QA Engineer](./_docs/team/qa-engineer.md).
- **Habilidades Agénticas ([`.agents/skills/`](./.agents/skills/)):** Skill `manage-defect-backlog` para triage, deduplicación e ingesta controlada de defectos en lenguaje natural.
- **Límites de Seguridad (Guardrails):** Operación en modo solo lectura durante el reporte de fallos y barrera de pruebas automáticas obligatorias antes de cualquier cierre.

> 📄 Consulta la guía completa de agentes en [`_docs/agent-extensions.md`](./_docs/agent-extensions.md).

---

## 7. Reproducibilidad y Puesta en Marcha (Criterio 14 de la Rúbrica)

Las dependencias están estrictamente bloqueadas mediante archivos de lock versionados (`frontend/package-lock.json` y `backend/uv.lock`).

### Requisitos Previos
- Node.js LTS (v20 o v22) y npm.
- Python 3.11.
- [uv](https://docs.astral.sh/uv/) (gestor de paquetes de Python ultra-rápido).

### 1. Instalación de Dependencias

**Windows (PowerShell):**
```powershell
npm.cmd --prefix frontend ci
uv sync --directory backend --frozen
```

**Linux / macOS (Bash):**
```bash
npm --prefix frontend ci
uv sync --directory backend --frozen
```

### 2. Arrancar la Aplicación

#### Opción A: Modo Completo con Túnel para Móvil (Recomendado para iPhone / Android)
```powershell
# Terminal 1: Inicia el túnel Cloudflare y la API de FastAPI
.\start.ps1

# Terminal 2: Inicia la app Expo
cd frontend
npx expo start --lan
```
*Escanea el código QR desde la app **Expo Go** en tu teléfono.*

#### Opción B: Modo Desarrollo Web Local
```bash
# Terminal 1: Backend
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend Web
cd frontend
npx expo start --web
```
*Abre tu navegador en `http://localhost:8081`.*

---

## 8. Persistencia y Base de Datos

Por defecto, el backend funciona con **SQLite local** (`backend/app.db`) sin requerir configuración adicional. Para conectar a una base de datos PostgreSQL:

```bash
# Configurar variable de entorno
export DATABASE_URL="postgresql+psycopg://USUARIO:CONTRASENA@HOST:5432/BASE_DE_DATOS"

# Comprobar conectividad
uv run --directory backend python -m scripts.check_database
```
