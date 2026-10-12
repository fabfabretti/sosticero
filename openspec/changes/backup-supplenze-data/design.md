# Design

## Context

The application stores all operational data (dataset + state) in a single SQLite database at `data/supplenze.sqlite`. Backups are currently manual (copying the data folder or using the export UI). The app runs in a container, restarts, and may not run 24/7 - so a startup-triggered daily snapshot is appropriate. We need automated backups with retention, safe restore capability, and visibility without disrupting normal operation. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**
- Create consistent SQLite backups on startup (once per calendar day)
- Store timestamped backups in `data/backups/` with configurable retention
- Support manual backup creation via API
- Support listing backups and viewing metadata
- Support safe restore from a backup (atomic, validated)
- Log all backup/restore operations
- Work with existing SQLite setup (WAL mode) without external dependencies

**Non-Goals:**
- Cloud storage/backups (only local filesystem)
- Real-time replication
- Automatic restore on corruption detection
- UI changes for backup management (can be added later; API is sufficient for now)
- Authentication/authorization beyond existing app model (app has no auth; follow existing pattern)

## Decisions

**Decision 1: Use SQLite backup API (`sqlite3.connect().backup()`) for consistency**
- **Rationale**: SQLite's backup API creates a consistent snapshot even when the source has active connections/WAL files. This is safer than copying the file directly while the DB is in use.
- **Alternatives considered**: `VACUUM INTO` (creates a compacted copy; also safe), file copy (risky with WAL/SHM unless quiesced). Backup API is clear and efficient.
- **Chosen**: Use `sqlite3.connect().backup()` to copy the live database to a new backup file.

**Decision 2: Trigger backups on app startup**
- **Rationale**: App is not 24/7, so "daily snapshot" means create backup on first start of the day. Startup is a natural hook and doesn't require a scheduler/cron inside the container.
- **Alternatives considered**: Background scheduler (APScheduler) - adds dependency and complexity; or manual only. Startup trigger meets the core requirement simply.
- **Chosen**: Run backup check at app initialization (in `create_app()` before serving requests). To avoid blocking startup, do it synchronously but quickly; if needed can be made async, but DB ops are fast.

**Decision 3: Store backups in `data/backups/` with timestamped filenames**
- **Rationale**: Keeps backups alongside data volume (persists across restarts/rebuilds). Timestamped names are sortable and unambiguous. Example: `supplenze-2026-10-12T15-42-18.sqlite`.
- **Alternatives considered**: Date-only names like `supplenze-2026-10-12.sqlite` - but requirement says "daily snapshot" and also allows manual backups; with multiple startups/manual backups same day, we need timestamps or incrementing. Better to include time.
- **Chosen**: ISO8601-like timestamp in filename (`YYYY-MM-DDTHH-MM-SS`), no colons for filesystem compatibility.

**Decision 4: Retention policy - keep last N backups (configurable)**
- **Rationale**: Simple and effective. Default to 7 days/10 backups as stated in spec (use "last 10 backups or last 7 days, whichever is greater" as a safe default). Configurable via env vars: `BACKUP_RETENTION_COUNT` (default 10), `BACKUP_RETENTION_DAYS` (default 7).
- **Alternatives considered**: Only by count, or only by age. Keeping both ensures we don't lose backups if activity is sparse, and don't accumulate too many if frequent.
- **Chosen**: After creating backup, delete backups older than `retention_days` AND keep only the most recent `retention_count` (i.e., apply both constraints - delete anything beyond count that's also older than threshold; or simply sort by time desc, keep top N by count and also ensure we don't delete very recent? Or more simply: keep backups where age < retention_days OR index < retention_count? The spec says "last N days or last M backups, whichever is greater" - meaning ensure at least M backups are kept even if older than N days? Or ensure we keep backups from last N days and also up to M total? Commonly "keep last 7 days and up to 10 backups" - but clearer: keep all backups from the last 7 days, plus up to 10 most recent total? Or simpler: delete backups older than 7 days, then if still > 10, delete oldest to get down to 10. That satisfies "keep last N days OR last M backups, whichever is greater" in practice? Maybe interpret as: retain a minimum of max(retention_days worth conceptually, retention_count). Easiest to implement: sort by mtime/filename; keep the most recent `retention_count` backups; also delete any backups older than `retention_days`. So a backup older than 7 days is only kept if it's among the 10 most recent - that gives flexibility.
- **Chosen**: Apply both rules: (1) never delete backups newer than `retention_days` old, (2) always keep at least `retention_count` most recent backups even if older than days (to preserve history), but also prune if there are way more than count? Or simpler: keep all backups with age < retention_days; if that leaves more than retention_count, that's fine? No - better to have a clear rule. Let us follow: "keep last N days OR last M backups, whichever is greater" - meaning minimum retention is the larger of (all backups from last N days) and (last M backups). So we must keep at least M backups total (even if some are older than N days), and also keep all backups from last N days (so if many in last N days, keep them all). That’s a bit complex; implement practically: get all backups sorted desc by time; keep index < retention_count OR age_days < retention_days. That satisfies "whichever is greater" - we keep everything that qualifies under either rule.
- **Chosen**: Retention logic as above.

**Decision 5: API design for backup management**
- **Rationale**: Expose endpoints for listing backups, creating manual backup, and restoring. Follow existing API patterns (FastAPI, return JSON, validate inputs). Keep it simple.
- **Endpoints**:
  - `GET /api/backups` - list backups with metadata (filename, size, created_at, path)
  - `POST /api/backups` - create manual backup (returns created backup info)
  - `POST /api/backups/restore` - restore from backup; body needs filename/path confirmation. For safety, require explicit filename.
- **Alternatives considered**: UI-only (but UI doesn't exist yet). API allows programmatic access and testing.
- **Chosen**: Add these endpoints in backend/main.py, following existing style.

**Decision 6: Safe restore implementation**
- **Rationale**: Restoring overwrites the live database. Must be atomic and validated. Use backup API to copy from backup to temp location and verify, then replace.
- **Implementation**: When restoring, first validate the backup file is a valid SQLite DB (open and query `sqlite_master`). Then copy backup to a temp file and verify integrity. Finally, replace the live DB file(s) - but we also need to handle WAL/SHM. Easier: close connections, copy backup over the main DB file (and remove WAL/SHM if they exist from old state), then reopen. Since we use transactions and connections are short-lived in request handlers, but Store holds connections? Store.connect() creates new connections per request - so no long-lived connections outside request scope. But the app might be handling requests; better to do restore in a transaction or ensure no writes during restore? The spec says "atomic (either fully succeeds or leaves database unchanged)". Doing the file replacement carefully: write to temp, then rename - but across files (db, wal, shm). Alternatively, after validation, copy backup to the main DB path (overwriting). That’s simple and atomic enough if done right.
- **Chosen**: Validate backup is readable SQLite. Then do: close any open connections (but none held long-term), copy backup to database path (overwrite). Also remove any old WAL/SHM files for a clean state. Log the operation. Return success/failure.
- **Safety note**: This is destructive; the API should be used carefully. In production without auth, it's as safe as other operations (also destructive like import). The spec states "require explicit confirmation/authorization in production contexts" - this is a requirement; implementation can add a confirmation flag in request body even without full auth.

**Decision 7: Backup module organization**
- **Rationale**: Keep backup logic separate and testable. Could add `backend/backup.py` with functions: `backup_database()`, `list_backups()`, `prune_backups()`, `restore_backup()`.
- **Alternatives considered**: Put all in main.py or storage.py. Better separation of concerns.
- **Chosen**: Create `backend/backup.py` as a new module with pure functions (accept paths, return results). main.py calls it.

**Decision 8: Non-blocking startup backup**
- **Rationale**: Backup is fast (small DB), but better to not block app from starting if backup takes time? The spec says "SHALL not interfere with normal application operation" and "does not block the application from serving requests after initialization". Doing it in `create_app()` before returning means requests don't come in until done - that satisfies "after initialization" (initialization completes after backup). That’s fine and simple.
- **Chosen**: Run backup during `create_app()` initialization; if it fails, log and continue (don’t prevent app from starting - better to have app running without backup than not running at all).

**Decision 9: Configuration via environment variables**
- **Rationale**: Consistent with how DATABASE_PATH, STATIC_PATH, TIMETABLE_PATH are handled.
- **Env vars**:
  - `BACKUP_DIR` (default: `data/backups/` relative to repo root; resolved same way as DB)
  - `BACKUP_RETENTION_COUNT` (default: 10)
  - `BACKUP_RETENTION_DAYS` (default: 7)
  - `BACKUP_ON_STARTUP` (default: `true` - allows disabling if needed)
- **Chosen**: Use these env vars with sensible defaults.

## Risks / Trade-offs

**[Risk] Restore is destructive** → Mitigation: Validate backup integrity before restore, require explicit confirmation in API (e.g., `{"filename": ..., "confirm": true}`), and log all restore operations. Also document the procedure.

**[Risk] Backup during heavy writes could cause issues** → Mitigation: Use SQLite backup API which is designed for live DBs; also app uses transactions and short-lived connections. The backup captures a consistent snapshot at the time backup() is called.

**[Risk] Disk space exhaustion from too many backups** → Mitigation: Retention policy prevents accumulation. Default limits are conservative.

**[Risk] WAL/SHM files not included in naive copy** → Mitigation: Use backup API or ensure we copy in the right order; backup API handles WAL properly.

**[Risk] Startup backup blocks first request** → Mitigation: Acceptable for small DB; can make async later if needed. The current DB is small (school data), so backup is instant.

**[Risk] No auth on backup endpoints** → Mitigation: App has no authentication currently; this is consistent with existing endpoints (export/import also powerful). Document that it should run on trusted network as per README. The spec says "require explicit confirmation/authorization in production contexts" - we can add confirmation flag now.

**[Trade-off] Timestamp in filename uses filesystem-safe format** → Using `T` separator replaced with `-` (or just keep as-is but avoid colons) - e.g., `2026-10-12T15-42-18` becomes `2026-10-12T15-42-18` is fine in most filesystems; colons in some (Windows) but this runs in Linux container. Still better to use `-` instead of `:` for safety: `2026-10-12T15-42-18` → `2026-10-12T154218` or `2026-10-12T15-42-18` with hyphens. The design shows `supplenze-2026-10-12T15-42-18.sqlite` - use hyphens as separators in time part.

**[Trade-off] Backup on every startup if we want "daily" - but multiple restarts same day create one backup** → The "once per day" check prevents duplicates as specified.

**[Decision 10: Settings UI for backup management]**
- **Rationale**: User requested visual feedback in Settings tab. The UI should list backups (newest first) with timestamp and size, provide "Crea backup manuale" button, and allow restore via selection with hard confirmation dialog. Follow existing UI patterns in Settings (simple sections, buttons, error display).
- **UI elements**: New "Backup e ripristino" section in Settings. Shows loading state, backup list, manual backup button, and confirmation dialog on restore. After restore, may need to reload app data; refresh the page or refetch data as appropriate.
- **Restore flow**: Click restore on a backup → show modal/dialog with message "Ripristinare il backup <filename>? I dati attuali verranno sovrascritti. Questa operazione non è annullabile." → confirm → call POST /api/backups/restore with {"filename": ..., "confirm": true} → show result.
- **Chosen**: Add backup UI section to Settings component in `frontend/src/main.tsx`, styled consistently with existing sections.
