# Defect intake and resolution

This workflow turns screenshots, logs, and informal descriptions into a
deduplicated, verifiable backlog. Intake never authorizes a code change.

## Intake

When the user reports unexpected behaviour:

1. Preserve the supplied evidence. Refer to an attachment by its message or
   URL; do not invent a repository path for it.
2. Capture the observed result, expected result, reproduction steps, client
   and environment, frequency, impact, and any missing information.
3. Inspect relevant code, tests, and available read-only state only far enough
   to establish whether the report is reproducible and where it may originate.
4. Classify it as `confirmed`, `needs-triage`, `duplicate`, or
   `expected-behaviour`. State facts separately from hypotheses.
5. Search open and closed GitHub issues and `_docs/defect-drafts/` using the
   affected feature, normalized symptom, and distinctive error text. Reuse an
   existing record when its user-visible symptom and scope match.
6. For a new actionable report, create a GitHub issue from
   `.github/ISSUE_TEMPLATE/bug.yml`. Do not propose implementation acceptance
   criteria before the PM pass.

If the user has not asked for a fix, stop after reporting the classification
and issue number or local draft path.

### Missing reproduction information

If information essential to reproduce or classify the report is missing, keep
the intake instead of discarding it and ask the user concrete, minimal
questions about the missing facts. For example: "¿Lo viste en Expo Go, en la
web o en ambos?" or "¿Qué acción realizaste justo antes de que apareciera el
duplicado?" Do not replace those questions with a generic request for more
details.

Record the available evidence as a `needs-triage` local draft, including the
specific unanswered questions under `Missing information`. Do not create or
describe a GitHub issue as a confirmed/actionable defect until those answers
make reproduction and classification possible. When the user answers, update
the same draft by fingerprint and resume deduplication and triage.

## Example user commands

- Report and queue a defect without solving it: `He encontrado este fallo:
  aparecen dos etiquetas Urgente. Adjunto una captura. Regístralo en la
  recámara, pero no lo soluciones todavía.`
- List the queue: `Lista los fallos que hay ahora mismo en la recámara y dime
  cuáles están confirmados y cuáles necesitan información.`
- Retry draft publication: `Reintenta publicar en GitHub todos los borradores
  locales y no dupliques issues que ya existan.`
- Resolve the confirmed queue: `Soluciona todos los fallos confirmados que haya
  en la recámara, uno a uno, siguiendo PM -> Engineer -> QA.`

## Idempotent fallback when GitHub is read-only

When issue creation is unavailable or returns `403`, create a Markdown file in
`_docs/defect-drafts/` from `_docs/defect-draft-template.md`.

- Set `fingerprint` to a stable lowercase kebab-case value made from the
  affected feature and normalized user-visible symptom, for example
  `tags-duplicate-normalized-name`.
- Name the file `<fingerprint>.md`.
- Before creating it, search the `fingerprint` fields and content of all local
  drafts. If it exists, update that file with the new evidence and most recent
  observation; never create a numbered copy.
- Set `github_issue` to `null` until publication. After publishing, add the
  issue URL and set `status` to `published`; do not delete the draft, so a
  retry remains idempotent and auditable.
- Before retrying publication, search GitHub again. If an equivalent issue now
  exists, link it instead of creating another.

Never claim an issue was created when only a local draft was written.

A permission failure is recoverable, not a definitive inability to publish.
Always tell the user that they can fix access by configuring a GitHub App,
connector credential, or fine-grained personal access token for the target
repository with **Issues: read and write** permission (and repository metadata
read access when the credential provider requires it). Ask them to configure
the credential in the GitHub integration or execution environment; never ask
them to paste or disclose a token in chat.

Keep the draft pending while access is unavailable and offer to retry
publication after the user has configured the credential. A retry must search
for equivalent GitHub issues first, then either link the existing issue or
publish the pending draft and record its URL.

## PM grooming

PM converts one `confirmed` report at a time into the structure in
`_docs/task-template.md`. For a defect, the issue must also retain:

- the reproducible current and expected behaviour;
- evidence and environment;
- whether existing persisted data needs repair;
- regression coverage required to prove the failure and prevent recurrence.

Acceptance criteria describe observable outcomes, not a guessed code change.
Uncertain root cause remains a hypothesis. If the report cannot yet be made
verifiable, keep it in `needs-triage` instead of sending it to Engineer.

## Explicit backlog resolution

Only an explicit request to solve or implement queued defects starts code
changes. The orchestrator must:

1. Reconcile publishable local drafts with GitHub and deduplicate again.
2. Snapshot the confirmed queue and report its order. Prioritize data loss and
   security, then blocked core flows, regressions, and lower-impact defects.
3. Run PM -> Engineer -> QA separately for each item as defined in
   `_docs/process.md`.
4. Keep the issue open on QA FAIL. Close it only after QA PASS, with commands,
   results, environment, and manual checks recorded.
5. Summarize resolved, failed, blocked, and still-queued items at the end.

If GitHub remains read-only, the agent may analyze and update local drafts but
must not represent them as canonical issues or start implementation unless the
user explicitly accepts working from the identified drafts.
