---
fingerprint: tags-duplicate-normalized-name
status: published
github_issue: https://github.com/mariete1223/proyecto-ai/issues/46
first_seen: 2026-10-11
last_seen: 2026-10-11
---

# Defect: a normalized tag appears twice

## Observed behaviour

The voice-capture result shows `Etiquetas (2)` and two `#Urgente` chips for a
single logical tag.

## Expected behaviour

The result shows `Etiquetas (1)` and one `#Urgente` chip.

## Reproduction

1. Use the web and Expo clients with the same demo user and backend.
2. Synchronize data that contains local `Urgente` tag records with different
   identifiers.
3. Open the voice-capture result and observe two equivalent tags.

Frequency: observed at least once; exact recurrence conditions need a
regression test.

## Environment

- Client: web/Expo synchronization scenario
- Device or browser: not recorded
- Backend or build: local development backend

## Evidence

- User-provided screenshot in the 2026-10-11 conversation showing
  `Etiquetas (2)` and duplicate `#Urgente` chips.

## Triage

- Classification: confirmed
- Impact: duplicate metadata is visible and clients may not converge cleanly.
- Facts: two visually equivalent tags are rendered for one capture result.
- Hypotheses: historical local records with different UUIDs survive
  synchronization even though their normalized names match.
- Missing information: exact creation sequence and whether existing tag-entry
  relationships require data repair.
- Possible duplicates checked: GitHub issue search was attempted previously;
  issue creation returned `403` and no equivalent issue was identified.

## Publication history

- 2026-10-11: GitHub creation returned `403`; local fallback created.
- 2026-10-11: Published as GitHub issue #46 after credentials were updated.
