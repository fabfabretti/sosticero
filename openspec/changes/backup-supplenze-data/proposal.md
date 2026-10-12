# Proposal

## Why

The operational data (supplenze assignments, absences, manual availability, classes out, etc.) lives in a single SQLite database at `data/supplenze.sqlite`. This data is crucial and must not be lost. The application is not online 24/7 and restarts happen; currently backups are manual (copying the data folder or using the export UI). We need an automated, reliable way to create snapshots to protect against accidental data loss or corruption.

## What Changes

- **Automated backup on startup**: When the application starts, automatically create a backup if no backup has been made on the same calendar day (or according to policy). Since the app isn't 24/7, a "daily" backup triggered on startup ensures each active day gets a snapshot.
- **Snapshot storage with retention**: Store backups with timestamps; implement retention to keep only recent snapshots (e.g., last N days or configurable). Include the retention date/logic so older backups are cleaned up automatically.
- **Backup format and location**: Backups should be complete and restorable (copy of the database file, preserving WAL files or ensuring a consistent snapshot). Store in a dedicated backup directory (e.g., `data/backups/`) alongside the data folder.
- **Restore mechanism**: Provide a safe way to restore from a backup (manual via API/UI or documented procedure). Restoration should be atomic and validated to avoid corrupting data.
- **Manual backup trigger**: Optionally allow manual snapshot creation via API (useful for testing and before risky operations). Not strictly required if startup backup meets the "daily snapshot" goal, but helpful.
- **Visibility/logging**: Log backup operations (success/failure) and make backup status visible in the Settings tab.
- **UI for backup management**: Add a "Backup e ripristino" section in Settings to list available snapshots, create manual backups, and restore from a selected snapshot with explicit confirmation.

## Capabilities

### New Capabilities

- `data-backup`: A system capability to create, list, retain, and restore consistent snapshots of the application database (dataset + state). This capability defines when backups occur (e.g., on startup once per day), how snapshots are stored and named, retention policy, integrity verification, and safe restore procedures.

### Modified Capabilities

- (None) - No existing spec-level requirements change. Existing export/import remain unchanged; backup is additive.

## Impact

- **Backend**: `backend/main.py`, new `backend/backup.py` module - add backup creation logic, retention, restore endpoints.
- **Frontend**: `frontend/src/main.tsx` (Settings component) - add UI to list backups, create manual backup, and restore with confirmation dialog.
- **Configuration**: May add env vars for backup location, retention count/days, and whether to back up on startup.
- **Data directory**: New `data/backups/` subdirectory; container volume mapping already covers `./data`.
- **API surface**: New endpoints for listing backups, creating manual backup, restoring from backup. These are new endpoints, no breaking changes to existing ones.
- **Deployment**: Backups remain inside the mounted data volume, so they persist across rebuilds/restarts (same as current DB). No new external dependencies required (just filesystem operations/sqlite).
