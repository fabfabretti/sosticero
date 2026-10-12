# Supplenze

Small school substitution planner migrated from `references/`. React + TypeScript + Vite, FastAPI, SQLite, one deployment container. Italian UI, seven periods, Monday–Friday timetable.

## Run

```sh
sudo dnf install podman-compose   # the provider behind `podman compose`
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up --build -d
```

Open http://localhost:8000. The supplied timetable is imported on first startup only. All operational data and subsequent timetable imports live in `./data/supplenze.sqlite`, in the local `data` folder beside `compose.yaml`. Rebuilds, restarts, and `podman compose down` retain this folder. Back it up before deleting or replacing it. Compose runs the app with your host UID/GID so it can write the folder; these default to 1000 if omitted. The `:Z` mount option supports SELinux hosts.

`compose.yaml` targets rootless Podman: `userns_mode: keep-id` maps your host user to the same UID inside the container, which is what lets the app write `./data`. Rootful Docker rejects `keep-id`; if you use Docker instead, remove that one line and run `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) docker compose up --build -d`.

For development (Python 3.12+, Node 24):

```sh
python -m venv .venv
.venv/bin/pip install -r backend/requirements.txt httpx==0.28.1
.venv/bin/uvicorn backend.main:app --reload
# another terminal
cd frontend
npm ci
npm run dev
```

Development defaults to the same `data/supplenze.sqlite` the container uses, so entries are visible from both; set `DATABASE_PATH` to override. `TIMETABLE_PATH` sets the initial JSON, `STATIC_PATH` the built frontend directory.

## Use and migration

Search for teachers or classes, select periods, optionally apply through an end date. Add manual availability with its campus. Click a substitution to see ranked candidates, including disabled absent/already assigned candidates. Use campus filters and the theme switch. The calendar dots mark absences/classes out.

To migrate prototype data, first export “Esporta supplenze” in the original browser/prototype, then use “Importa supplenze” here. This replaces the operational archive; export a backup first. IDs must match. There is no automatic access to another application's localStorage. JSON timetable uploads use the supplied `docenti`/`orario` format and preserve all absences, manual availability, classes out, and assignments. Teacher names may change; IDs must not be reused for different people. Missing teachers are retained as retired historical references. Invalid imports roll back completely. Existing invalid assignments are retained and explicitly flagged for review, rather than silently deleted.

Back up the SQLite database with SQLite's online backup API or stop the container before copying the local `data` folder (include WAL files if copying a running database). Archive export covers operational records; retain the timetable separately for a full restore.

### Permessi

The Permessi register records one teacher/date with selected periods, an optional request date and Ore da recuperare. The form sits in a compact right sidebar beside the table. The daily maximum is half the scheduled periods rounded down, including POT, DIS and every scheduled activity. Selected unscheduled periods show an accessible warning but may be saved within that maximum. Permit hours automatically appear as locked absences in Supplenze; deleting a permit preserves any separately recorded manual absence. Recovery accounting is deferred.

Archive schema 1 includes an optional `permessi` date/teacher/periods map and `permitRequests` date/teacher/request-date map. Older archives import with an empty register. Imports validate references and periods atomically without rechecking historical entitlement against the current timetable. Database backups include permits. Older application versions can discard this field: do not round-trip new archives through them.

### Automatic backups

The app automatically creates a backup of the database on startup if no backup has been made on the same calendar day. Backups are stored in `./data/backups/` (configurable via `BACKUP_DIR`) with timestamped filenames like `supplenze-YYYY-MM-DDTHH-MM-SS.sqlite`. 

Retention policy (configurable via environment variables): backups older than `BACKUP_RETENTION_DAYS` (default: 7) are deleted unless they are among the `BACKUP_RETENTION_COUNT` (default: 10) most recent backups - whichever constraint keeps them. Automatic startup backups can be disabled with `BACKUP_ON_STARTUP=false`.

You can manage backups via:
- **Settings UI** (in the app under Settings → "Backup e ripristino"): view available backups, create manual backups, and restore from a selected backup. Restoring requires explicit confirmation via a hard confirmation dialog; this operation overwrites current data and cannot be undone.
- **API**: `GET /api/backups` lists backups, `POST /api/backups` creates a manual backup, `POST /api/backups/restore` restores from a backup (requires `{"filename": "...", "confirm": true}`).

The dataset and the operational state live in separate documents. Uploading a timetable JSON rewrites only `dataset`; absences, manual availability, classes out and assignments in `state` are never touched. To refresh the timetable after a new field becomes available (for example the `classe_concorso` names added to the candidate drawer), back up `data/supplenze.sqlite` first, then upload the **same** timetable file via “Carica database JSON”: the re-import keeps every existing entry intact.

## Rules and structure

- `backend/domain.py`: pure rules, no React, HTTP, SQLite, or storage access. Separate `eligibility`, `rank_candidate`, `validate_assignment`; centralized `PRIORITIES` and deterministic load/name/ID tie breaks.
- `backend/storage.py`: SQLite JSON documents, transactional writes. A small school does not need an ORM or a repository hierarchy. Every mutation acquires a write transaction before reading current state, avoiding lost updates and double booking.
- `backend/main.py`: validated HTTP boundaries and orchestration. `/docs` documents the API.
- `frontend/src/main.tsx` and `CandidateDrawer.tsx`: presentation and interaction; backend supplies rows, eligibility, ranking, validation, and default availability hours. Original CSS retained.

Preserved priorities: existing co-teacher; same-campus POT/manual availability/released class; UTC/UTS/DI.S; release of support co-teaching; director at central campus; entry/exit; other-campus choices; unknown campus last. Ties use assignments today, total recorded assignments, name, ID. “Total” follows the prototype's all-recorded-dates count, not a newly invented school-year boundary.

DI.S is availability. UTC is central-campus technical duty; UTS branch-campus duty. POT/DI.S with no campus remain unknown. Empty slots are not availability. Co-teaching requires the same class, period **and known campus**, correcting the prototype's class-only check. Support teachers can still be released from another class (the prototype's TC behavior). Manual availability overrides timetable duties as in the prototype, but cannot override absence or an existing assignment. Multi-day default availability is calculated separately for each date, correcting the prototype's use of the first day's schedule.

Cross-campus choices remain selectable, with muted colors; transfer times and authorization rules were not supplied. Director and entry/exit choices require human verification. Entry/exit options are always shown and each labels the class's effective entry/exit hour, but assigning them is only possible at the first/last effective scheduled class period of the selected weekday; choosing ESCE at the last hour makes it available at the previous hour too (chain). Assignments invalidated by later changes are flagged. Co-teachers absent together for the same class and period share one substitution row, since one room needs one substitute; a substitution left under a non-canonical key is flagged for review rather than migrated. Conflicting assignments must be removed or corrected; the system does not automatically rearrange them. No banked hours are implemented. Dataset anomalies are displayed; potentially duplicate people (e.g. Antonelli d003/d154) are not merged automatically.

## Verify

```sh
.venv/bin/python -m unittest discover -s backend/tests -v
npm --prefix frontend test
npm --prefix frontend run build
```

Backend tests cover the real dataset, co-teaching/campus/period, absence and booking conflicts, blank/manual availability, class release, ranking and load tie breaks, transactional import rollback, archive validation, restart persistence, timetable updates and multi-day behavior. Frontend tests (`node --test`) drive the real `App` handlers with deferred fetches, covering candidate-response ordering, day-change discards, and save-closes-immediately.

Deployment binds localhost by default. There is no authentication: keep it on a trusted administrative machine/network; add an authenticated reverse proxy before wider access. Concurrent edits are safe from lost writes; screens refresh after edits/date changes, not by live push.

Verification in this environment: 16 backend tests pass (including the concurrent-assignment case) and the frontend `node --test` suite (3 cases) passes; the TypeScript/Vite build passed. The image built with Podman, and rootless Compose execution was confirmed with `podman compose up --build -d`, `down`, and restart: the app served HTTP 200 and retained `./data/supplenze.sqlite` across restarts. The browser flow (absence → candidates → assignment → reload) was checked with the supplied timetable.
