# Commands

## Backend
- `uv sync` — install dependencies
- `uv run --directory backend python scripts/check.py` — full CI parity check (`ruff format --check`, `ruff check`, `mypy`, `pytest`)
- `uv run --directory backend python -m mypy app scripts tests` — strict static type check
- `uv run --directory backend python -m pytest` — full backend test suite
- `uv run --directory backend python -m pytest tests/test_home.py` — single backend test file

## Frontend
- `npm --prefix frontend run check` — full CI parity check (`format:check && lint && typecheck && test`)
- `npx --prefix frontend prettier --write frontend` — auto-format frontend files
- `npm --prefix frontend run format:check` — verify Prettier formatting
- `npm --prefix frontend run lint` — run ESLint (`--max-warnings 0`)
- `npm --prefix frontend run typecheck` — run TypeScript compiler (`tsc --noEmit`)
- `npm --prefix frontend test -- --watchAll=false` — run Jest test suite

# Rules & Architectural Invariants

1. **Dependency Management:**
   - Dependencies are added in `pyproject.toml` (backend) or `frontend/package.json` (frontend). Do not add one without asking the user first.
2. **Escalabilidad, adaptabilidad y buenas prácticas:**
   - No se aceptan soluciones chapuceras, parches frágiles ni hacks provisionales (como alturas/píxeles fijos arbitrarios, fallbacks posicionales ciegos o `!important` descontextualizados). Todas las soluciones deben seguir estándares de la industria, patrones de diseño robustos, diseño adaptativo y escalabilidad a largo plazo para cualquier dispositivo o pantalla, asumiendo el esfuerzo adicional de ingeniería que ello requiera.
3. **Investigación y contraste técnico:**
   - Ante cualquier duda sobre arquitectura, UX, diseño o implementación, o en tareas que lo requieran o se beneficien de ello, se debe consultar e investigar cómo se resuelve el problema en entornos maduros y estándares de la industria (no para copiar ciegamente, sino para analizar posibilidades, entender los enfoques consolidados y aplicar la solución más sólida).
4. **Invariante de Identidad Canónica y Sincronización Bidireccional (Offline-First):**
   - Toda entidad del catálogo por defecto (categorías canónicas `Notas`, `Tareas`, `Alerta`, `Eventos` y etiquetas) debe resolverse de forma determinista y bidireccional entre el cliente (`frontend/db/categories.ts`, `frontend/services/syncEngine.ts`) y el servidor (`backend/app/services/category_service.py`, `backend/app/services/sync_service.py`) tanto en `push` como en `pull`.
   - **Prohibido usar fallbacks posicionales o arbitrarios** (como `cats[0]`, `order_by(created_at).first()`, o etiquetas estáticas `"General"`) cuando un `category_id` no coincide directamente por UUID. Siempre debe usarse resolución semántica (`resolveCategoryForEntry` / `CANONICAL_CATEGORY_IDS`) y saneado de huérfanos.
5. **Invariantes de Layout Móvil y Flexbox (WebKit / iOS Safari / Android Chrome):**
   - **Prohibido `height: "100%"` / `maxHeight: "100%"` en hijos Flex con hermanos:** Un contenedor con `flex: 1` que comparte padre con cabeceras (`topHeader`, `modalHeader`), barras de filtro o docks inferiores (`pinnedDockContainer`, `bottomTabBar`) jamás debe declarar `height: "100%"` ni `maxHeight: "100%"` (debe usar `flex: 1, minHeight: 0, overflow: "hidden"`). En WebKit/iOS Safari, `height: 100%` calcula el 100 % del padre ignorando a los hermanos y provoca que el contenido inferior quede oculto o cortado tras la barra de navegación.
   - **Separación de Zonas Scroll vs. Pinned (Thumb Zone):** Las pantallas con controles anclados en la zona del pulgar deben separar estrictamente el `ScrollView` superior (`flex: 1, minHeight: 0`) del dock inferior (`flexShrink: 0`), garantizando margen visual explícito (`>= 12px–16px`) sobre `bottomTabBar` y respetando `env(safe-area-inset-bottom)`.
6. **Matriz de Capacidades Multi-Plataforma (`granted | denied | default | unsupported`):**
   - Cualquier acción vinculada a APIs del navegador/sistema (Notificaciones, Web Push, Micrófono/Voz, Service Workers) debe manejar explícitamente los 4 estados (`"granted"`, `"denied"`, `"default"`, `"unsupported"`).
   - Ningún botón o CTA puede ser un *no-op* silencioso (p. ej. en pestañas de iOS Safari donde `"Notification" in window` es `false` y devuelve `"unsupported"`): debe ofrecer feedback inmediato con instrucciones tanto para **iPhone/iPad (Safari)** como para **Android (Chrome)** y permitir descartar/cerrar el aviso de forma persistente.
7. **Higiene de CI/CD y Verificación Pre-Push:**
   - Antes de hacer commit/push de cualquier cambio, es obligatorio verificar el formateo (`Prettier` en frontend, `ruff format` e `isort` `I001` en backend), reglas de lint (`ESLint` sin warnings, `ruff check` incluyendo `B008` y `B017`), chequeo de tipos (`tsc --noEmit` y `mypy` estricto) y suites de tests.
   - No dejar archivos temporales o de scratch (ej. `*_scratch*`) en el árbol del repositorio; usar el directorio de scratch fuera del workspace si es necesario.
   - Tras hacer `git push`, verificar el estado del workflow de GitHub Actions (`gh run list` / `gh run watch`) hasta confirmar que `Frontend checks`, `Backend checks` y `Continuous Deployment (CD)` están en verde.

# Documents

- `_docs/process.md` — how work is organized (PM → Engineer → QA lifecycle and CI/CD gates)
- `_docs/defect-workflow.md` — how reported defects enter, deduplicate, and leave the backlog
- `_docs/team/pm.md` — Product Manager role and grooming checklist
- `_docs/team/software-engineer.md` — Software Engineer role, architectural invariants, and CI checklist
- `_docs/team/qa-engineer.md` — QA Engineer role, cross-layer audit, and verification rules

# Roles

- **PM** — grooms a task before anyone implements it, follows `_docs/team/pm.md`
- **Engineer** — implements one groomed task and its regression tests, follows `_docs/team/software-engineer.md`
- **QA** — independently verifies every acceptance criterion and invariant, follows `_docs/team/qa-engineer.md`

# Defect Reports

- When the user reports a failure, screenshot, log, or unexpected behaviour, follow `.agents/skills/manage-defect-backlog/SKILL.md`.
- Intake is read-only: investigate, deduplicate, and record the defect, but do not implement a fix until the user explicitly asks to solve it.
- GitHub issues are canonical. If issue creation is unavailable or returns `403`, maintain one idempotent local draft in `_docs/defect-drafts/`.
- A request such as "soluciona los fallos de la recámara" or "soluciónalo" explicitly starts backlog resolution. Use the PM → Engineer → QA lifecycle in `_docs/process.md`; do not treat the whole backlog as one combined implementation task.
