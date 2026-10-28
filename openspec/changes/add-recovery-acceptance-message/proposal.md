# Proposal

## Why

The office needs to distinguish confirmed permit recoveries from unanswered requests and prepare consistent email requests without manually collecting substitution and permit details.

## What Changes

- Add a reversible, persistent Accettata toggle beside each assigned RP substitute, following the existing Comunicato interaction.
- Add an accessible copy-icon button that copies the agreed Italian subject and body, with success and failure feedback.
- Describe all original permit periods when there are several; use a generic outstanding-balance phrase for manual permits without a date.
- Keep acceptance independent of clipboard use and existing recovery accounting; no email sending or individual original-hour allocation.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `permessi`: Track recovery acceptance and copy a request based on the linked permit and current substitution details, preserving existing accounting and campus permissions.

## Impact

Assignment request validation, persistence and archive validation in backend/main.py; daily response metadata derived from backend/recovery.py; frontend assignment types, Supplenze controls and styling. Existing concurrency and campus authorization apply to acceptance updates. Backend and frontend tests cover state portability and message generation. No new dependencies or operational data changes.
