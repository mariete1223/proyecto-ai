---
name: manage-defect-backlog
description: Intake, deduplicate, triage, and queue software defects reported with screenshots, logs, or informal evidence; also orchestrate their explicit PM-to-Engineer-to-QA resolution. Use for newly observed app failures and requests to solve the queued defect backlog, not for a standalone pre-groomed feature request.
---

# Manage Defect Backlog

Read `_docs/defect-workflow.md` and `_docs/process.md` before acting.

For a new report, remain read-only: preserve evidence, inspect enough context to
separate facts from hypotheses, classify it, and search GitHub plus
`_docs/defect-drafts/` for an equivalent symptom. Update the existing record
when one matches. Otherwise create an issue using
`.github/ISSUE_TEMPLATE/bug.yml`.

If essential reproduction or classification information is missing, ask the
user concrete, minimal questions about those exact facts. Preserve the intake
as a `needs-triage` local draft with the unanswered questions, but do not create
or describe a confirmed/actionable GitHub issue. Update the same fingerprinted
draft when the answers arrive.

If GitHub creation is unavailable or returns `403`, follow the idempotent local
fallback in `_docs/defect-workflow.md` and use
`_docs/defect-draft-template.md`. Clearly report that a draft, not a GitHub
issue, was created. Treat the permission failure as recoverable: tell the user
they can configure a GitHub App, connector credential, or fine-grained token
for the target repository with **Issues: read and write** permission (plus
repository metadata read access if required). Never ask them to paste or share
the token in chat. Keep the draft pending, offer to retry after credentials are
configured, and deduplicate again before publishing. Do not fix code during
intake.

Only begin implementation when the user explicitly asks to solve queued
defects. Snapshot and report the confirmed queue, then process one item at a
time through separate PM, Engineer, and QA contexts. A QA failure returns the
same issue to Engineer; QA never edits code. Close an issue only after PASS and
record the verification evidence. Do not silently expand the batch with newly
found defects.

Recognize natural Spanish commands such as:

- `Registra este fallo en la recámara, pero no lo soluciones.`
- `Lista los fallos de la recámara.`
- `Reintenta publicar en GitHub los borradores locales.`
- `Soluciona todos los fallos confirmados de la recámara.`
