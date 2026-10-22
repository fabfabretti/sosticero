# Proposal

## Why

Two offices will use the same operational database simultaneously. Assignment and Inbox transactions already prevent several races, but stale absence and permit requests can overwrite newer edits, and the substitutions screen does not discover another browser's changes automatically.

## What Changes

- Reject stale shared-record replacements, deletions and duplicate additions atomically, without blocking unrelated records.
- Cover assenze, classi fuori, disponibilità, dated permessi, manual recupero balances and assignment edits, including range operations and metadata.
- Preserve global teacher double-booking and recupero checks inside existing SQLite transactions.
- Explain when another operator has already processed an Inbox item instead of silently implying that the second operator's choices were applied.
- Quietly refresh operational views while preserving scroll, focus, open controls and entered values; defer applying affected updates during an interaction.
- **BREAKING**: affected mutation requests must carry the displayed record's concurrency precondition; update all in-repository callers and tests together.
- Leave authentication, account permissions, database replacement/import coordination and unrelated Settings editing to separate work. No new draft workflow, collaborative text editing or database service.

## Capabilities

### New Capabilities

- `shared-record-concurrency`: atomic record preconditions and noninterrupting refresh for operational edits.

### Modified Capabilities

- `absence-inbox`: explicit already-processed outcomes while retaining atomic acceptance and absence merging.

## Impact

Backend request models and handlers in `backend/main.py`, `backend/inbox.py`, day/permit read responses, and existing Store transactions. Frontend mutation callers in `frontend/src/main.tsx`, Inbox processing and operational refresh. Backend race tests and browser interaction checks. No new runtime dependency expected; no operational data changes during implementation/testing. Implement before `add-campus-authentication`.
