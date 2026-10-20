# Proposal

## Why

Candidate ordering combines category priorities, exception flags and RP convenience in ways that disagree with the displayed explanation. The office needs one predictable hierarchy with class/CDC affinity and fair workload tie-breakers.

## What Changes

- Replace overlapping priorities with explicit tiers: same-class ITP/support compresenza; entry/exit; DISP/DI.S; same-campus available activities; Dirigente and same-campus UTC/UTS; other-campus available activities including UTC/UTS; unknown-campus available activities; RP; visible unavailable in-school commitments; Scoperta.
- Keep absent and double-booked candidates in their ordinary tier, disabled with a reason.
- Rank within tiers by class-or-CDC match, fewer assignments today, fewer total assignments, name and stable ID. RP convenience precedes those tie-breakers inside RP only.
- Display star labels “Insegna nella classe” and “Insegna la stessa CDC”, independently when both apply.
- Make type policies, campus resolution, drawer headings and explanatory copy consistent with this ordering.
- Preserve assignment safeguards, permit recovery accounting and existing current-year workload totals.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `candidate-selection`: explicit tier ordering, policy-aware fallback eligibility, stable blocked positions and class/CDC indicators.

## Impact

Backend domain candidate generation/ranking and its callers/tests; frontend Candidate types, CandidateDrawer, styles, explanatory text and tests. No new dependencies, database migration, operational data edits or workload date filtering.
