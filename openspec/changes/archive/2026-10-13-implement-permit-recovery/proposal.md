# Proposal

## Why

Permessi currently record hours owed but cannot recover them through substitutions. The office needs convenient RP candidates and reliable, dated recovery accounting before each permit's one-month deadline.

## What Changes

- Offer Recupero permesso (RP) during otherwise free periods when the teacher has eligible outstanding permit hours.
- Rank convenient RP periods first and other RP periods last, respecting campus transfers and existing hard restrictions.
- Link each RP substitution permanently to the oldest eligible permit and derive balances from these links.
- Show recovered totals, recovery dates/periods, deadlines, and highlighted outstanding or expired debt in Permessi.
- Introduce stable permit identities with backward-compatible migration and validated archive portability.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `permessi`: Deadline, recovery accounting, stable references, protected edits, and register presentation.
- `candidate-selection`: RP eligibility, convenience ranking, and atomic assignment validation.

## Impact

Backend domain rules, permit and assignment APIs, state migration/storage, archive validation, and statistics assignment validation; frontend Permessi and candidate drawer; backend and frontend tests. Existing operational data must be preserved. No new external service is needed.
