# Proposal

## Why

An operator reported an assignment disappearing after saving and had to reinsert it. Existing HTTP logs cannot identify the affected record or distinguish a later deletion from a failed save or changed row visibility; the cause remains unproven. Both assignment removal controls currently delete immediately.

## What Changes

- Add a server-only diagnostic journal for assignment changes (including communication and acceptance), absences, class-out entries and manual availability/site changes. Record attributable, allowlisted before/after values atomically with committed changes, including changes made through bulk operations.
- Correlate failed or rejected mutation requests with sanitized diagnostic records, separately from committed changes.
- Require a short contextual confirmation for explicit assignment removal from the daily table and review issues. Shift+click bypasses only this confirmation, never authorization or concurrency checks.
- Document read-only investigation, retention and backup/restore limitations. No journal viewer, notifications, automatic undo or historical reconstruction is included.

## Capabilities

### New Capabilities

- `operational-audit`: Durable, attributable server-side evidence of operational record changes and sanitized failed mutation diagnostics.

### Modified Capabilities

- `substitution-rows`: Contextual confirmation of explicit assignment removal, with a discoverable Shift+click shortcut and preserved edit preconditions.

## Impact

Backend storage, request attribution and every writer of the operational state document in `backend/main.py` and `backend/inbox.py`; existing authentication, backup and restore coordination must remain intact. Frontend changes are limited to the two removal entry points in `frontend/src/main.tsx` and their tests. Additive SQLite schema only; no new service or dependency and no change to portable JSON archive formats. Existing uncommitted loading/cache work must be preserved. Implementation verification uses isolated testing data and the eventual release follows the existing deployment script with read-only production checks.
