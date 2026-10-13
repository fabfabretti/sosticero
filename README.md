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

For development, explicitly set `DATABASE_PATH` to an isolated temporary database. Never use the operational database for behavioral verification. `TIMETABLE_PATH` sets the initial JSON, `STATIC_PATH` the built frontend directory.

## Use and migration

Search for teachers or classes, select periods, optionally apply through an end date. Add manual availability with its campus. Click a substitution to see ranked candidates, including disabled absent/already assigned candidates. Use campus filters and the theme switch. The calendar dots mark absences/classes out.

To migrate prototype data, first export “Esporta supplenze” in the original browser/prototype, then use “Importa supplenze” here. This replaces the operational archive; export a backup first. IDs must match. There is no automatic access to another application's localStorage. JSON timetable uploads use the supplied `docenti`/`orario` format and preserve all absences, manual availability, classes out, and assignments. Teacher names may change; IDs must not be reused for different people. Missing teachers are retained as retired historical references. Invalid imports roll back completely. Existing invalid assignments are retained and explicitly flagged for review, rather than silently deleted.

Back up the SQLite database with SQLite's online backup API or stop the container before copying the local `data` folder (include WAL files if copying a running database). Archive export covers operational records; retain the timetable separately for a full restore.

### Permessi

The Permessi register records one teacher/date with selected periods and an optional request date. The form sits in the left sidebar. The daily maximum is half the scheduled periods rounded down, including every activity. Unscheduled periods show an accessible warning but can be saved within that maximum. Permit periods remain locked absences in Supplenze.

**RP — Recupero permesso** is available in otherwise unscheduled periods while a teacher has eligible hours owed. Ordinary availability (including POT, manual availability and class-out release) retains its category and does not recover permit hours. Convenient RP hours appear first; other RP hours appear last. Convenient means adjacent to teaching or inside a teaching gap. Cross-campus transfers on either side require an intervallo at 2–3 or 4–5; absence, booking conflicts and scheduled commitments remain blocked.

Each RP assignment recovers one hour from the oldest eligible permit, with a permanent link. The recovery deadline is one calendar month after the permit date, inclusive, clamped to month-end (31 January becomes 28/29 February). Eligibility uses the substitution date, allowing retrospective entry. Future assignments reserve hours immediately. The register shows deadline, recovered total, dates/periods and remaining hours, highlighting teachers with debt and labelling expired debt Scadute. Expired debt remains visible but cannot fund new RP assignments. Deleting or replacing RP restores its linked hour; review flags and timetable imports do not silently refund hours. Resolve linked assignments before deleting a recovered permit or making edits that invalidate its recovery history.

Archive **schema 2** preserves stable `permitIds` metadata and each RP assignment's `permitId`, alongside permits, request dates, settings and statistics. Schema-1 archives without recovery data remain importable and receive stable identities. Invalid references, ownership, date windows or over-recovery reject the whole import. Startup migration adds identities without changing existing operational records. Database backups include all recovery data. Older versions reject schema-2 archives: do not run an older application against the upgraded database; keep a pre-upgrade backup for rollback (restoring it loses later changes).

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
DATABASE_PATH=/tmp/sosticero-tests-module.sqlite BACKUP_ON_STARTUP=false .venv/bin/python -m unittest discover -s backend/tests -v
npm --prefix frontend test
npm --prefix frontend run build
```

Backend tests cover the real dataset, co-teaching/campus/period, absence and booking conflicts, blank/manual availability, class release, ranking and load tie breaks, transactional import rollback, archive validation, restart persistence, timetable updates and multi-day behavior. Frontend tests (`node --test`) drive the real `App` handlers with deferred fetches, covering candidate-response ordering, day-change discards, and save-closes-immediately.

Deployment binds localhost by default. There is no authentication: keep it on a trusted administrative machine/network; add an authenticated reverse proxy before wider access. Concurrent edits are safe from lost writes; screens refresh after edits/date changes, not by live push.

Verification in this environment: 16 backend tests pass (including the concurrent-assignment case) and the frontend `node --test` suite (3 cases) passes; the TypeScript/Vite build passed. The image built with Podman, and rootless Compose execution was confirmed with `podman compose up --build -d`, `down`, and restart: the app served HTTP 200 and retained `./data/supplenze.sqlite` across restarts. The browser flow (absence → candidates → assignment → reload) was checked with the supplied timetable.

### Tipi di ora

Settings → Tipi di ora lists imported sigle and derived Lezione, Compresenza ITP, Sostegno and A disposizione types. Each row independently controls **Disponibile per supplenze**, **Mostra tra i candidati**, and **Presso questa scuola**. Changes apply globally to every matching teacher/hour/date. School membership is descriptive; it does not change campus, ranking or eligibility. Unknown codes begin hidden and unavailable, with school membership marked Da verificare. GM begins outside this school; ITP and sostegno begin visible as occupied fallbacks. POT/UTC/UTS/DIS retain their initial availability.

Visible occupied candidates appear under Solo in caso di necessità and require Usa comunque confirmation. Absence, double booking and hidden/retired teachers remain blocked. Existing assignments survive policy changes. Colors are selected once and saved. Reimport the original timetable to recover codes discarded by older imports; settings and existing operational records survive reimport.

`GET /api/hour-types` returns the inventory and reimport indicator. `POST /api/hour-types` updates one row with `id`, `available`, `visible`, and `school`. Schema-1 JSON archives now include optional `hourTypes` and exceptional assignment metadata; legacy archives leave current settings unchanged. Invalid archives roll back atomically. Database snapshots include settings and colors. Older application versions may discard the new archive fields: avoid round-tripping through them.

## Statistics and uncovered periods

Stats reports absence and cover demand by Centrale, Succursale or Totale, with All, This week, This month and inclusive custom periods. Presets use Europe/Rome and a Monday-based week; future dates are excluded. All averages divide by **days with at least one recorded manual absence or permit**, not all school days. Campus views use the same dates and include campus-specific zeroes. Weekday averages and heatmap cells divide by recorded occurrences of that weekday. A period without observations has no average.

The three workload units differ: absent teachers are unique per date (their period total is expressed as giorni-docente), absent teacher-hours deduplicate manual/permit overlap, and demand counts one class/period even when several co-teachers are absent. Hours mean timetable periods, not clock hours. A teacher may count at both campuses but only once in Totale; campus teacher headcounts therefore need not add up. Unknown campus belongs only to Totale and is disclosed separately.

Supplenze offers **Scoperta** when no substitute was found. It is an explicit emergency outcome, leaves the class present and does not release other teachers. Clear it to return to pending, or replace it when cover is found. Stats distinguishes covered, uncovered, late entry, early exit and pending. Coverage is covered periods divided by total demand; pending does not imply an unsupervised class. Entry/exit periods remain in demand. Exceptional cover is a subset of covered types, not an additional total. Invalid/orphan assignments are disclosed separately and do not count as valid cover.

A versioned `statistics` SQLite document saves date-specific absence context, campus and class-period outcomes. Operational corrections synchronize facts in the same transaction; unchanged facts survive timetable replacement. Initial migration and legacy JSON imports reconstruct missing facts once using the available timetable and label them as reconstructed: this cannot prove the historical campus/timetable was identical. Absence periods with no lesson are retained with unknown campus. New absence slots added after a timetable change use that new timetable; existing slots retain their context.

Schema-2 archive exports contain `statistics` (also accepted in legacy schema-1 archives); imports validate the facts against operational records atomically. Legacy archives without this document are reconstructed. Database backups retain facts. Older application versions may discard facts or reject the UNCOVERED assignment value; keep a pre-upgrade backup and avoid archive round trips through older versions.

`GET /api/stats?campus=total&period=all` is read-only. Campus accepts `total`, `centrale`, `succursale`; period accepts `all`, `week`, `month`, `custom`. Custom requires ISO `start` and `end` dates and rejects reversed intervals. Responses include resolved bounds, recorded-day count, totals, averages, coverage percentage, daily/weekday/hour/heatmap series, coverage types, exceptional subset, class demand, worst days, global unknown-campus and assignment-issue counts, and absence-fact provenance. CSV includes the same filters, denominator, units and caveats; use Stampa report for a browser-printable report with chart values.

Stampa report first opens an on-page print preview with all numerical tables expanded and filters hidden. From there choose Stampa to open the browser print dialog, or return to the interactive dashboard.

Stats uses the same segmented controls and calendar styling as Supplenze. Daily averages lead the compact summary; period totals remain secondary. Tutto, Questa settimana and Questo mese highlight the corresponding dates. Click a first and last day for a custom inclusive range, navigating months if needed; reversed clicks are ordered automatically. All three workload measures appear together with legends: lines for the daily trend and single-series bars of class-period demand for weekday and hour averages. A visible summary note explains that absent teacher-periods include activities without classes (such as POT), while cover demand counts class-periods and merges co-absent teachers. Heatmap measures use buttons; methodology and data-quality details expand on demand and remain included in print preview.

The primary measure is labelled **Ore di classe scoperta**: class-period demand caused by absence, including periods later covered. **Senza supplente** identifies only explicitly recorded emergency uncovered outcomes. The heatmap places weekdays in columns and periods in rows.

Hover or focus a Giorno × ora cell to see the dated counts behind its average for the active campus, reporting period and measure. Included dates with zero counts appear as zero; unrecorded dates are excluded. Long lists scroll and Escape dismisses the tooltip. The Stats API exposes these values as each heatmap cell's `observations` list.
