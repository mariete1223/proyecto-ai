# Work process

GitHub issues are the canonical backlog. Defects reported during exploratory
use first pass through the intake and triage workflow in
`_docs/defect-workflow.md`. A local defect draft is only a durable fallback
when GitHub issue creation is unavailable; it is not a second backlog.

General rules:

- Work on one groomed issue at a time.
- Read the acceptance criteria before implementation and before closure.
- PM grooms a task and follows `_docs/team/pm.md`.
- Engineer implements one groomed task and follows
  `_docs/team/software-engineer.md`.
- QA checks the result and follows `_docs/team/qa-engineer.md`.
- Keep implementation and QA in separate agent contexts.
- Do not implement a newly reported defect unless the user explicitly asks to
  solve it.

## Orchestrator

The main session is the orchestrator. It launches PM, Engineer, and QA as
separate agents. It does not groom, implement, or test the issue itself.

## Lifecycle

1. Select the next confirmed GitHub issue from the backlog. When processing a
   local fallback draft, publish or reconcile it with GitHub first if write
   access is available.
2. PM grooms that single issue, ensuring acceptance criteria cover end-to-end
   data flow (offline ↔ sync ↔ online), cross-platform states (iOS Safari tab,
   iOS PWA standalone, Android Chrome, desktop), and layout invariants.
3. Engineer implements it, adds regression tests demonstrating the defect where
   practical, and passes full formatting, lint, typecheck, and test checks.
4. QA independently verifies every acceptance criterion and architectural
   invariant (Flexbox layout, canonical ID sync, CI checks).
5. On FAIL, return the issue and QA evidence to Engineer, then run QA again.
6. On PASS, the orchestrator records the evidence, updates the local draft
   status to `resolved`, closes the GitHub issue, and pushes to `origin/main`
   verifying that the GitHub Actions CI/CD workflow completes green (`✓`).
7. Select the next issue only after the current issue has passed QA.

The command to solve "all queued defects" means repeat this lifecycle for the
confirmed defects visible at the start of the run. Report the ordered queue
before editing code. A newly discovered unrelated defect is recorded for a
later run rather than silently expanding the current issue.

## Rules & Quality Gates

- Do not skip the PM pass.
- Engineer does not close the issue.
- QA does not fix code; it only outputs PASS or FAIL.
- The orchestrator closes the issue only after QA outputs PASS.
- A `needs-triage` item cannot be selected for implementation.
- Do not combine multiple defects into one implementation or commit merely
  because the user requested the full queue.
- Stop the batch and report the blocker if a selected item cannot be made into
  a groomed, verifiable issue.
- **CI/CD Gate:** Every commit pushed to `main` must pass both `Frontend checks`
  (`format:check`, `lint`, `typecheck`, `test`) and `Backend checks`
  (`ruff format --check`, `ruff check`, `mypy`, `pytest`) in GitHub Actions.
