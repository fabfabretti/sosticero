# Tasks

## 1. Create Backup Module

- [x] 1.1 Create `backend/backup.py` module with functions to manage backups (create_backup, list_backups, prune_backups, restore_backup, _is_valid_sqlite). Use SQLite backup API via `sqlite3.connect().backup()` for consistency. Verify by importing the module successfully.

- [x] 1.2 Implement backup filename formatting with timestamp (ISO8601-like, use hyphens instead of colons for filesystem compatibility, e.g., `supplenze-2026-10-12T15-42-18.sqlite`). Include helper to parse/compare backup timestamps. Verify by creating a backup and checking filename format.

- [x] 1.3 Implement retention logic: delete backups older than retention_days AND also enforce retention_count (keep most recent N; allow older backups to be kept only if they are among the N most recent - apply both constraints as designed). Verify logic with test cases (edge: fewer than count, more than count, mixed ages).

## 2. Integrate Backup with Storage/App

- [x] 2.1 Add backup configuration via environment variables in main.py: BACKUP_DIR, BACKUP_RETENTION_COUNT (default 10), BACKUP_RETENTION_DAYS (default 7), BACKUP_ON_STARTUP (default 'true'). Resolve paths consistently with DATABASE_PATH logic. Verify env vars are read correctly with defaults.

- [x] 2.2 Add startup backup logic in `create_app()` - after setting up store but before serving, check if backup needed for today and create if so. Create backup directory if it doesn't exist. On failure, log error but don't prevent app from starting. Verify by starting app with fresh state and checking backup is created.

- [x] 2.3 Ensure backup works with WAL mode database (use backup API which handles WAL properly; test with DB that has WAL files). Verify backup is consistent by opening restored backup.

## 3. Add Backup API Endpoints

- [x] 3.1 Add `GET /api/backups` endpoint to list available backups with metadata (filename, size, created_at, path). Sort by creation time descending. Verify returns correct list format.

- [x] 3.2 Add `POST /api/backups` endpoint to create manual backup. Returns created backup info. Triggers retention after creation. Verify manual backup is created and appears in list.

- [x] 3.3 Add `POST /api/backups/restore` endpoint to restore from backup. Require request body with `filename` and `confirm: true` (for safety). Validate backup integrity before restore, do atomic replacement, clean up old WAL/SHM files. On success return ok; on failure return 422 with error. Verify restore works correctly and rejects invalid/corrupted backups or missing confirmation.

- [x] 3.4 Add proper error handling and logging for all backup operations (success/failure with timestamps). Follow existing error handling patterns in main.py (return 422 for validation errors). Verify errors are logged and returned appropriately.

## 4. Testing and Validation

- [x] 4.1 Write backend unit tests for backup module (`backend/tests/test_backup.py`) covering: filename formatting, retention logic (various scenarios), backup creation, list/prune/restore operations. All tests must pass with `python -m unittest discover -s backend/tests -v`.

- [x] 4.2 Add integration test for startup backup behavior (e.g., verify backup created on first start of day, skipped on second start same day). Update existing tests or add new one. Verify all backend tests still pass.

- [x] 4.3 Test restore preserves data integrity - create a backup, make changes, restore, verify state matches. Verify all backend tests pass after changes.

- [x] 4.4 Verify frontend build still works (`npm --prefix frontend run build`) and existing frontend tests still pass (`npm --prefix frontend test`). Ensure no breaking changes to existing functionality.

## 5. Frontend UI for Backup Management

- [x] 5.1 Add backup management UI to Settings tab in `frontend/src/main.tsx`: create a "Backup e ripristino" section that fetches backups from `GET /api/backups`, displays them sorted newest first with timestamp and size, includes "Crea backup manuale" button, and allows selecting a backup to restore with a hard confirmation dialog. Follow existing UI patterns and styling.

- [x] 5.2 Implement restore confirmation dialog showing which backup will be restored and warning that current data will be overwritten (non-reversible). On confirm, call `POST /api/backups/restore` with `{"filename": ..., "confirm": true}`. On success, show success message and refresh backup list/data as appropriate. On failure, show error. Verify UI behaves correctly.

- [x] 5.3 Add basic styling for backup list and dialog if needed to match existing design. Ensure UI is responsive and consistent with existing sections.

## 6. Documentation

- [x] 6.1 Update README.md to document the new backup functionality: where backups are stored, how automatic startup backups work, retention policy, how to manually create/list/restore backups via API and UI, and restore safety notes (hard confirmation, non-reversible). Keep documentation concise and consistent with existing style.

- [x] 6.2 Add code comments in backup module explaining the retention logic and SQLite backup usage. Verify comments are clear and not redundant.
