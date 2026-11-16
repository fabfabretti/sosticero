# Proposal

## Why

Operators can record communication and acceptance but cannot record a professor's refusal. Replacing an assignment loses that context and risks contacting the same professor again.

## What Changes

- Add Rifiutata alongside Comunicato/Accettata for RP, paid substitutions and grouped cross-campus A disposizione notices.
- Record the refusing professor durably and release the affected assignment atomically; a grouped campus notice releases all its member assignments.
- Show a small red textual note beneath the substitution selector, including when unassigned or assigned to another professor.
- Preserve refusal history across reloads and supported backup/restore. Refused assignments no longer consume paid budgets or permit recovery hours.
- Keep existing entry/exit communication controls unchanged. Refusal history is informational and does not automatically prohibit reassignment.

## Capabilities

### New Capabilities

- `substitution-refusals`: Persistent row-level refusal history, atomic release and visible professor notes for RP and paid assignments, with shared rules for grouped notices.

### Modified Capabilities

- `availability-campus-communication`: Add refusal of the entire current campus-change notice with atomic release and per-row history.

## Impact

Assignment API, state storage/validation, concurrency tokens, portable archive compatibility, derived recovery/paid totals, and the daily substitution controls in frontend/src/main.tsx, RecoveryActions, PaidActions and CampusNoticeActions. No new service or dependency. Coordinate with the separately proposed operational audit log without depending on it. Preserve unrelated working-tree changes. Implementation uses isolated testing data, then deployment through scripts/deploy.sh and read-only production checks.
