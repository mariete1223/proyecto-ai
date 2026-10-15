Commands

- `uv sync` - install dependencies
- `uv run pytest` - the whole suite
- `uv run pytest tests/test_home.py` - one test file

Rules

- Dependencies are added in `pyproject.toml`. Do not add one without
  asking


Documents

- `_docs/process.md` - how work is organized
- `_docs/defect-workflow.md` - how reported defects enter and leave the backlog

Roles

- PM - grooms a task before anyone implements it, follows _docs/team/pm.md

Defect reports

- When the user reports a failure, screenshot, log, or unexpected behaviour,
  follow `.agents/skills/manage-defect-backlog/SKILL.md`.
- Intake is read-only: investigate, deduplicate, and record the defect, but do
  not implement a fix until the user explicitly asks to solve it.
- GitHub issues are canonical. If issue creation is unavailable or returns
  `403`, maintain one idempotent local draft in `_docs/defect-drafts/`.
- A request such as "soluciona los fallos de la recamara" explicitly starts
  backlog resolution. Use the PM -> Engineer -> QA lifecycle in
  `_docs/process.md`; do not treat the whole backlog as one implementation task.
