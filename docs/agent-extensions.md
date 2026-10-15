# Extensiones para Agentes y Sistema Multi-Agente

Este documento describe la arquitectura, configuración y políticas de seguridad para la interacción de agentes de Inteligencia Artificial con el repositorio **Proyecto AI**, dando cumplimiento al criterio de la rúbrica sobre extensiones de agentes.

---

## 1. Configuración Base del Repositorio (`AGENTS.md`)

En la raíz del proyecto se encuentra el archivo [`AGENTS.md`](../AGENTS.md), que actúa como la constitución operativa para cualquier agente que interactúe con el entorno. Establece:

- **Comandos estándar de ejecución:**
  - `uv sync` para sincronizar dependencias de Python.
  - `uv run pytest` para la suite completa de pruebas de backend.
  - Comandos reproducibles de frontend (`npm run check`, `npm test`).
- **Restricciones inmutables de dependencias:**
  - Prohibición estricta de añadir dependencias en `pyproject.toml` o `package.json` sin autorización humana previa.
- **Rutas de documentación y proceso:**
  - Mapeo directo a [`_docs/process.md`](./process.md) y [`_docs/defect-workflow.md`](./defect-workflow.md).

---

## 2. Perfiles y Roles Especializados (`_docs/team/`)

El sistema delega el trabajo técnico a perfiles agénticos con responsabilidades estrictamente separadas:

### Product Manager (PM) — [`_docs/team/pm.md`](./team/pm.md)
- **Función:** Analizar el problema o incidencia antes de cualquier cambio de código.
- **Entregable:** Criterios de aceptación verificables en formato *Given / When / Then*, alcance técnico delimitado y lista de archivos que deben modificarse.
- **Restricción:** No implementa código ni ejecuta correcciones.

### Software Engineer — [`_docs/team/software-engineer.md`](./team/software-engineer.md)
- **Función:** Implementar la solución mínima que satisfaga los criterios del PM.
- **Entregable:** Código fuente modificado y un test automatizado (unitario o de integración) que demuestre que el problema ha sido subsanado.
- **Restricción:** No cierra el issue; solo entrega el código listo para revisión.

### QA Engineer — [`_docs/team/qa-engineer.md`](./team/qa-engineer.md)
- **Función:** Evaluación independiente del cambio.
- **Entregable:** Veredicto binario (**PASS** o **FAIL**) con logs de ejecución y verificación punto a punto de los criterios de aceptación.
- **Restricción:** No edita código fuente; si detecta un fallo, devuelve el informe al ingeniero.

---

## 3. Skills y Habilidades Personalizadas (`.agents/skills/`)

### Skill: `manage-defect-backlog`
Ubicado en [`.agents/skills/manage-defect-backlog/SKILL.md`](../.agents/skills/manage-defect-backlog/SKILL.md), dota al agente de habilidades avanzadas para el ciclo de vida de defectos:
1. **Intake inteligente:** Recibe capturas de pantalla, logs o mensajes informales del usuario y realiza deduplicación contra incidencias existentes.
2. **Creación de Issues:** Usa plantillas estructuradas de GitHub (`.github/ISSUE_TEMPLATE/bug.yml`).
3. **Fallback local idempotente:** Si no hay credenciales de GitHub o devuelve error 403, genera borradores atómicos en `_docs/defect-drafts/` sin perder información.
4. **Comandos en lenguaje natural:** Reconoce expresiones en español como:
   - *"Registra este fallo en la recámara, pero no lo soluciones"*
   - *"Lista los fallos de la recámara"*
   - *"Soluciona los fallos de la recámara"*

---

## 4. Límites, Permisos y Políticas de Seguridad (Guardrails)

Para garantizar un entorno seguro y predecible:

| Capacidad | ¿Permitido? | Regla / Límite de Seguridad |
| :--- | :---: | :--- |
| **Lectura de código y logs** | ✅ Sí | Lectura libre dentro del directorio del workspace. |
| **Ejecución de pruebas locales** | ✅ Sí | Ejecución de `pytest`, `jest`, `ruff`, `mypy`, `npm check`. |
| **Instalación de librerías** | ❌ No | Bloqueada sin confirmación explícita del usuario. |
| **Modificación directa en caliente** | ❌ No | El intake de errores es estrictamente de solo lectura hasta que el usuario ordena la solución. |
| **Acceso a credenciales / tokens** | ❌ No | Prohibido solicitar o almacenar tokens privados en el chat o en archivos de texto plano. |
| **Persistencia de base de datos** | ⚠️ Controlado | En local usa SQLite; conexión a PostgreSQL requiere configuración manual de `DATABASE_URL`. |
