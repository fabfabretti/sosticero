# Proposal

## Why

The Permessi tab is a placeholder. The office needs to record hourly leave once and have those hours immediately affect daily substitution planning, without entering the same absence twice.

## What Changes

- Replace the Permessi placeholder with a table showing teacher, date, selected periods and Ore da recuperare; allow adding, editing and deleting one record per teacher/date.
- Limit daily permit hours to floor(all scheduled periods / 2), including lessons, POT, DIS and every other scheduled activity.
- Warn beside selected periods without scheduled activity, with an explanation on hover and keyboard focus; allow saving within the daily limit.
- Derive locked absence hours from permits in Supplenze, explain their cause and exclude absent teachers from assignments in those periods.
- Persist permits and include them in backup and validated archive import/export, preserving independent manual absences.
- Defer recovery recording, recovery candidate selection and automatic recovery accounting to a later change. For now Ore da recuperare equals the number of recorded permit periods.

## Capabilities

### New Capabilities

- `permessi`: Permit recording, daily validation, schedule warnings, persistence and derived absences.

### Modified Capabilities

- `app-shell`: Remove Permessi from the placeholder requirement while preserving navigation.

## Impact

Frontend routing, types and table/sidebar rendering in frontend/src/main.tsx; backend/main.py APIs and archive validation; backend/domain.py absence consumers; backend/storage.py state defaults; relevant backend and frontend tests. SQLite backup already copies the complete database. No new dependencies or recovery engine.
