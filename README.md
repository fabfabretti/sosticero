# <img src="frontend/public/favicon.svg" width="36" height="36" alt=""> Sosticero

A local web app for planning teacher substitutions, tracking short leave and recovery hours, and understanding where cover is needed. Built for an Italian school with two campuses, a Monday–Friday timetable, and up to seven periods a day. The interface is in Italian. My desperation is Italian as well.

> [!NOTE]
> **This project was vibecoded.** It also contains some fixes specific to this school, at the moment. I hope to be able to generalize this once my desperation will slow down. Thank you for your time.

## Screenshots

Dark mode, using fictional teachers and records created in an isolated demo database.

**Daily substitution planner**

![Dark-mode planner showing fictional absences, campuses, and substitute assignments](docs/screenshots/planner-dark.jpg)

**Statistics and coverage**

![Dark-mode statistics showing demand, coverage, trends, and heatmap for fictional records](docs/screenshots/stats-dark.jpg)

## What you can do

### Plan the school day

- Browse dates in a calendar and search for teachers or classes.
- Select a teacher, review compact options, then add with **Aggiungi** or Enter. Record a whole-day absence or select individual periods; options stay set for the next entry.
- Optionally mark absences **Programmata** or **Last minute**. The sidebar groups planned, unclassified and last-minute absences; a last-minute absence or permit takes precedence for that teacher and date.
- Record classes that are away, making their teachers available where appropriate.
- Add manual teacher availability and choose its campus.
- See the classes needing cover, grouped by period, with room and campus information.
- Filter between Centrale, Succursale, or both campuses.
- Treat several absent co-teachers in the same class and period as one cover requirement.

### Find and assign substitutes

Open a cover requirement to see ranked candidates, their timetable context, teaching subject, campus, and recorded substitution workload. The ranking is currently fixed, but I hope to make it flexible in the future.

Absent or already assigned teachers are blocked. Candidates at the other campus are distinguished, and occupied teachers can appear as exceptional choices when the configured rules allow them. Exceptional assignments require confirmation. A blank timetable slot alone does not make a teacher available for ordinary cover.

You can assign a substitute, record late entry or early exit at the class’s effective timetable boundary, or explicitly mark a period **Scoperta** when no substitute was found. Existing assignments that become inconsistent after an edit are flagged for review. The app suggests choices; the person planning cover makes the final decision.

### Manage short leave and recovery

The **Permessi** register records a teacher’s leave date, selected periods, and optional request date and planned/last-minute classification. Leave automatically appears as a locked absence in the substitution planner. The advisory daily limit is half the teacher’s scheduled periods, rounded down; exceeding it shows warnings but does not prevent saving. Dates use `dd/mm/yyyy`, with new leave and request dates defaulting to today.

**Saldo manuale senza data** records outstanding hours from earlier periods without creating a dated absence in the substitution planner. Enter a teacher and total hours; manual balances have no automatic expiry and show their linked recoveries and remaining hours. Dated permits are recovered first. A balance with linked recoveries cannot be deleted or reduced below the hours already recovered.

**RP — Recupero permesso** offers eligible teachers for otherwise unscheduled periods when they owe recovery hours. Each RP assignment pays back one hour from the oldest eligible permit. The register shows recovered hours, remaining debt, recovery assignments, and expired debt. The recovery window is one calendar month, inclusive, with month-end dates clamped to the last day of the following month. Adjacent lessons, gaps, and cross-campus travel restrictions affect RP eligibility. (Obviously, this is tailored to this specific school at the moment. Hope to generalize this as well).

### Understand demand and coverage

**Stats** offers totals, daily averages, trends, weekday and period comparisons, and an interactive day-by-period heatmap. Filter by campus and by all recorded dates, this week, this month, or a custom range. Export CSV or open a printable report.

Statistics distinguish absent teachers, absent teacher-periods, and class-periods needing cover. They also distinguish substitute cover, explicit uncovered outcomes, late entry, early exit, and pending decisions. Averages use **days with recorded absences or permits**, not every school day. “Ore di classe scoperta” measures cover demand, including periods subsequently covered;

### Configure and protect your records

- Import your timetable as JSON; no real timetable or school database is bundled.
- Configure each hour type’s availability, visibility among candidates, and school membership.
- Switch between light and dark themes.
- Export and import the operational archive as JSON.
- Create database backups, view available snapshots, and restore one from Settings.
- Keep automatic startup backups, with configurable retention.
- Authenticate... no, not yet. But I'll add it. Soon. I promise..... (Same for concurrent use...)

Timetable updates preserve operational records. Keep teacher IDs stable: an existing ID must continue to identify the same person. Removed teachers remain as historical references. Archive import replaces operational records; backup restore replaces the database. Back up before either operation.

## Deploy on Windows

No Python, Node, Docker, or WSL required. Download the latest `Sosticero_<date>.exe` from the repository's **Actions → Windows exe** artifacts (built automatically on every push to `main`, or manually from the Actions tab), put it in a normal folder such as `Documents\Sosticero`, and double-click it.

- Put it **outside `Program Files`** (that folder is read-only, and the app stores its data beside the exe).
- A console window opens and your browser opens **http://localhost:8000**. Closing the console stops the app.
- If Windows shows "Windows protected your PC", click **More info** → **Run anyway**; the app is unsigned.
- Everything the app saves lives in a `data` folder beside the exe, backups included. To update, replace the exe and keep that folder.

Then go to **Settings** and choose **Carica database JSON** to upload your timetable.

## Deploy on Linux

Clone this repository and run the commands below from its root. Open **http://localhost:8000**, go to **Settings**, and choose **Carica database JSON** to upload your timetable.


### Podman

Install Podman and a Compose provider (`podman-compose` or another provider supported by your distribution), then:

```sh
mkdir -p data
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate
```

The supplied `compose.yaml` supports rootless Podman and SELinux. Data stays in `./data`, outside the container. To stop: `podman compose down`. To update: pull the new code and repeat the command above.

### Docker

Install Docker Engine, then:

```sh
mkdir -p data
docker build -t supplenze .
docker run -d --name supplenze --restart unless-stopped \
  --user "$(id -u):$(id -g)" \
  -e APP_ENV=production \
  -p 127.0.0.1:8000:8000 \
  -v "$PWD/data:/data:Z" \
  supplenze
```

Use `sudo` for Docker commands if your installation requires it. To update, rebuild the image, run `docker rm -f supplenze`, and repeat the `docker run` command. The mounted data directory survives container removal.

The supplied Compose file uses Podman’s `userns_mode: keep-id`; Docker users should use the commands above. (I'll add Docker Compose at some point. Sadly I am now a Fedora girl, so my lovely Docker is on pause until further setups on my end.)

### Without containers

Install Python 3.12+ with virtual environment support and Node.js 24 with npm, then:

```sh
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
npm --prefix frontend ci
npm --prefix frontend run build
mkdir -p data
APP_ENV=production DATABASE_PATH="$PWD/data/supplenze.sqlite" \
  .venv/bin/uvicorn backend.main:create_app --factory --host 127.0.0.1 --port 8000
```

Keep the terminal open, or run that final command through your usual service manager. This serves the built frontend and API together. To update, install dependencies and build again, then restart the server.

## Timetable format

Upload a JSON object containing `docenti` (teachers) and `orario` (weekly timetable entries). Here is a minimal fictional example:

```json
{
  "docenti": [
    {
      "id": "teacher-1",
      "nome_originale": "Docente Esempio",
      "ruolo": "curricolare",
      "classe_concorso": "A026"
    }
  ],
  "orario": [
    {
      "docente": "teacher-1",
      "giorno": "lun",
      "ora": 1,
      "classi": ["1A"],
      "sede": "centrale",
      "aula": "101"
    }
  ]
}
```

Days are `lun`, `mar`, `mer`, `gio`, and `ven`; periods are integers from 1 to 7. Campus values are `centrale` or `succursale`; omit the field when unknown. Each teacher needs a unique, stable ID, and each teacher/day/period combination can appear only once. List multiple classes in one entry where needed. Optional `attivita_riconosciute` (an array of codes) and `attivita_originale` (text) describe timetable activities. Review imported hour types in Settings before using candidate recommendations.

There is no spreadsheet or Untis file importer: convert your timetable to this JSON structure before uploading it.

## Data and backups

The default database is **`data/supplenze.sqlite`**. Container deployments store everything under the mounted `./data` directory, including backups in `data/backups/`; the prebuilt Windows app keeps the same files in a `data` folder beside the exe. Restarting or rebuilding the container keeps these records; deleting the directory does not.

Archives include optional `absenceKinds` and `permitKinds` maps keyed by date and teacher, with values `planned` or `last_minute`. Missing entries are unclassified; existing data is not backfilled. Older archives remain importable, but editing or importing through an older app version may discard classification metadata.

An automatic backup is created at startup when none exists for that calendar day.

Optional environment variables:

| Variable | Purpose | Default |
| --- | --- | --- |
| `DATABASE_PATH` | SQLite database location | `data/supplenze.sqlite` (containers: `/data/supplenze.sqlite`) |
| `BACKUP_DIR` | Snapshot directory | `backups/` beside the database |
| `BACKUP_ON_STARTUP` | Enable startup backups | `true` |
| `BACKUP_RETENTION_DAYS` | Retention age in days | `7` |
| `BACKUP_RETENTION_COUNT` | Minimum recent snapshots to keep | `10` |
| `TIMETABLE_PATH` | Optional local JSON to seed a new database | Unset; upload through Settings |
| `STATIC_PATH` | Built frontend directory | `frontend/dist` |

Set these in your shell for a native deployment, with `-e` for Docker, or through an explicitly selected Compose configuration for Podman.

## Development and limitations

React + TypeScript + Vite frontend; FastAPI backend; SQLite storage. No cloud account or external database is required. The API documentation is available at `/docs` while the app is running.

> [!Important] The rules reflect one school’s workflow, rather than every contract or institution. Campus transfers, exceptional cover, and entry/exit decisions need human review. Dataset anomalies are shown for review; potentially duplicate people are not merged automatically. Screens refresh after edits and date changes; there is no live synchronization between browsers. Concurrent database writes are transactional, but users may need to refresh to see another person’s edits.

To run the tests after installing the dependencies above:

```sh
.venv/bin/pip install httpx==0.28.1
APP_ENV=testing DATABASE_PATH="$(mktemp -d)/tests.sqlite" BACKUP_ON_STARTUP=false \
  .venv/bin/python -m unittest discover -s backend/tests
npm --prefix frontend test
```

Always use an isolated database for development. See [AGENTS.md](AGENTS.md) for this repository’s data protection and deployment rules. Planning documents and detailed behavior specifications live under [openspec/](openspec/).

## License

Copyright © 2026 fabfabretti. Licensed under the **GNU Affero General Public License, version 3 only** (`AGPL-3.0-only`). See [LICENSE.md](LICENSE.md) for the full terms.

Optional plain-text **Note** fields are available before saving in all three creation flows: adding an absent teacher in **Supplenze**, adding a dated permit in **Permessi**, and adding a **Saldo manuale senza data**. Edit saved absence notes through **⋯**, and permit/balance notes through their edit actions. Hover or focus **(i)** beside a teacher in either Permessi table to read that record’s note; dated absence and permit notes also appear together on the daily Assenze row, labelled **Assenza** and **Permesso**. Clearing the text removes the note. Successful creation, cancellation and switching form modes clear the draft; failed saves retain it. Both Permessi tables use compact spacing and inline period warnings while keeping all columns and full recovery details.

### Isolated test deployments

Normal `podman compose up` keeps the real database on port 8000. Run browser tests
in a separate project, with a separate image, temporary data directory, and an
automatically allocated localhost port:

```sh
export TEST_DATA_DIR=$(mktemp -d /tmp/sosticero-test-XXXXXX)
export TEST_PROJECT="sosticero-test-$(basename "$TEST_DATA_DIR" | tr '[:upper:]' '[:lower:]')"
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose -p "$TEST_PROJECT" -f compose.testing.yaml up -d --build --force-recreate
podman compose -p "$TEST_PROJECT" -f compose.testing.yaml port app 8000
```

Open the printed localhost port. Verify the container's `/data` mount points at
`$TEST_DATA_DIR` and `/api/environment` returns `{"testing":true}` before testing.
Tests start with an empty database. If realistic data is needed, use SQLite's
online backup API to create a fresh copy in the test directory before startup;
never copy live SQLite files directly. Each agent must create its own directory
and project. Never combine `compose.testing.yaml` with `compose.yaml`.

Stop only your own test deployment when finished:

```sh
podman compose -p "$TEST_PROJECT" -f compose.testing.yaml down
```

A red **TESTING** corner ribbon appears on every test screen, including dialogs.
The label refreshes every 15 seconds and defaults to TESTING if the environment
cannot be verified. It identifies configuration; always verify the actual mount.
Testing mode refuses the project's operational database and any data directory
marked `.sosticero-production`. Production startup creates that marker. Keep it.
Backend imports do not open a database; startup requires an explicit database
path. Production timetable uploads require confirmation before replacement.
