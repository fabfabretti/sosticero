# Proposal

## Why

Replacing the single weekly timetable changes past daily views and can disconnect saved substitutions from their original lessons. Staff need to import changed sostegno timetables without losing history or silently altering operational records.

## What Changes

- Import a complete timetable JSON (`docenti` and `orario`) with an effective date selected in the app, defaulting to today in Europe/Rome.
- Retain immutable full timetable versions; each applies until the next effective date. Preserve the existing timetable as the initial baseline.
- Allow past, present and future effective dates, with an impact preview and explicit confirmation of changes to recorded dates.
- Preserve saved entries and assignments, revalidate affected dates, and expose conflicts and orphan assignments with their original context for review.
- Reconcile affected dated statistical facts explicitly while preserving facts outside the changed interval and retaining unresolved evidence.
- Require a consistent pre-import backup and atomic application, including stale-preview protection and stable teacher identity checks.
- Preserve timetable history through database backups and version-aware state archive round trips; accept legacy archives without inventing historical versions.

## Capabilities

### New Capabilities

- `timetable-versions`: Date-effective timetable selection, safe import preview and application, preservation of affected records and statistical reconciliation.

### Modified Capabilities

- `data-backup`: Pre-import consistent backups and restoration of complete timetable history.

## Impact

Backend storage/init migration, date-dependent domain callers, daily and permit endpoints, statistics, recovery validation, timetable import, state archive validation/export and backup helpers; frontend Settings import workflow, daily conflict review and types; backend and frontend tests and user documentation. No new dependencies are expected. The timetable JSON file format stays unchanged; the import API gains effective-date and preview confirmation requirements.

The completed but unarchived `implement-stats-page` change already specifies durable statistical facts. This change extends that behavior through explicit dated timetable correction, rather than weakening preservation on ordinary imports. Coordinate overlapping implementation or archival work before applying.
