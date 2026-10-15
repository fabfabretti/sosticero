# Verification

Verified on 15 October 2026. No operational database was imported, restored or changed by behavioral tests. Initial behavioral verification left normal service untouched; the subsequently approved deployment is recorded below.

- Backend: 113 tests passed (`.venv/bin/python -m unittest discover -s backend/tests`). Coverage includes idempotent baseline migration, effective-date boundaries, future activation, bounded backdated insertion, per-date availability/permits, retired IDs, non-mutating preview, stale confirmations, write-lock timeout, backup failure, transactional rollback, orphan context, RP accounting, archive corruption rejection and restoration into an empty installation.
- Frontend: 53 tests passed (`npm --prefix frontend test`), including full JSON preview/confirmation/cancel/stale-response flows and permit warnings using the timetable effective on the selected date. Existing notes, images, sidebar, recovery and statistics tests pass.
- Final image built successfully with `npm ci` and `npm run build` inside the Dockerfile. Served frontend asset: `/assets/index-BfMAKQUK.js`. Build retained the existing large-chunk warning.
- Standalone project `sosticero-timetable-1792072887-141405` used `/tmp/sosticero-timetable.KDe2xX:/data` and automatically allocated localhost ports (35095, then 44979 after recreation). Both runs used `--build --force-recreate`. `/api/environment` returned exactly `{"testing":true}` before behavioral writes; the UI exposed TESTING and the new import controls.
- Container checks passed on the final image: unchanged earlier daily view, new future demand, retained original orphan context, pending invalid coverage, exact archive round trip, validated explicit assignment move and complete pre-import backup restoration.
- Browser inspection verified the JSON preview and affected assignment count. Native confirmation dialog automation stalled, so application and restore were verified through the isolated container API and component confirmation tests instead. No end-to-end browser confirmation success is claimed.
- A synthetic school-sized check used 200 teachers, 7,000 weekly lessons, 40 recorded dates and 1,200 absence slots. Preview/reconciliation took 1.470 seconds on this host; history evidence and reconciled facts validated. This was synthetic data, not a performance measurement against operational records.
- Normal container ID and project-data mount matched before and after testing. The isolated project was stopped; no Compose override or test database became the default.

Limits: a timetable overwritten before baseline migration cannot be reconstructed automatically. Stable teacher IDs and a complete JSON file remain required. Runtime checks emitted existing dependency deprecation/resource warnings; no test failures remained. Deployment and committing were subsequently authorized by the user.

## Approved normal-service deployment

Deployed with `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate`. The normal service is running with `/home/fabs/Desktop/sosticero/data:/data`, reports `testing: false`, and serves `/assets/index-BfMAKQUK.js`. Read-only SHA-256 comparisons confirmed every pre-existing document and attachment remained unchanged. The migration created one baseline timetable version with no effective date. No timetable was imported and no behavioral test was performed against normal service.
