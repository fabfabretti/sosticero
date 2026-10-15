# Tasks

## 1. Storage, validation and record lifecycle

- [x] 1.1 Add the SQLite attachment table and normalized source reference maps; add tests proving legacy databases initialize without record changes and module imports do not open a database.
- [x] 1.2 Add Pillow and shared PNG/JPEG validation with strict base64, 5 MiB byte and 25-megapixel limits; test valid images, malformed/truncated/animated content, wrong media types and boundary sizes against temporary databases.
- [x] 1.3 Extend entry/permit payloads and transactions for omitted/preserve, null/remove and replacement semantics, range sharing, permit moves and unreferenced blob cleanup; test overlapping sources, hour/site edits, source deletion and recovery-protected rollback.
- [x] 1.4 Add referenced-image retrieval and metadata-only responses; test correct content type, inline disposition, nosniff, private no-store headers, missing/unreferenced 404s and absence of bytes in daily/Permessi responses.

## 2. Portability

- [x] 2.1 Export schema-3 images and references in a consistent read transaction and import them atomically with existing state validation; test round trips, corrupt images, dangling/unreferenced IDs, unsupported schema versions and attachment-bearing schema-1/2 rejection.
- [x] 2.2 Retain schema-1/2 import without attachments and verify it removes current associations; test online backup/restore preserving shared blobs and references and historical attachments surviving timetable replacement.
- [x] 2.3 Document supported formats, limits, database/backup growth and schema-3 rollback compatibility in project documentation; verify documentation matches the API tests and no separate attachment directory is required.

## 3. Paste and editing interface

- [x] 3.1 Build a shared labelled paste/preview/remove field and wire creation/editing for absences, dated permits and manual dispositions; verify local preview cleanup, successful/cancel/source-switch resets, failed-save draft retention and normal text paste with focused UI checks and a successful frontend build.
- [x] 3.2 Add attachment metadata types and day-specific disposition editing without exposing controls for automatic availability, class-out entries or undated manual balances; verify all three supported creation and edit paths and range behavior in isolated browser checks.
- [x] 3.3 Add an accessible record-information popover retaining notes and permit information, with separately labelled source links and new-tab viewing; verify keyboard focus, Escape/focus return, outside dismissal, pointer/touch use and narrow-screen layout in daily rows and the dated permit register. Preserve existing warning tooltips.

## 4. Integration verification

- [x] 4.1 Run relevant backend suites on temporary databases and frontend tests/build; verify lifecycle, recovery, archive and backup regressions pass without operational database access.
- [x] 4.2 Create a unique TEST_PROJECT and mktemp TEST_DATA_DIR, export both, and build/recreate only standalone compose.testing.yaml using LOCAL_UID/LOCAL_GID and -p; inspect its mount and allocated port, confirm testing:true and the red TESTING ribbon before behavioral testing.
- [x] 4.3 Verify real screenshot paste in the user's desktop browser, preview/replace/remove, save/reload, all three sources, overlapping links, range sharing, new-tab rendering, export/import and rejected saves on the isolated project; record results and stop only this test project.

## Verification record

- Backend: 99 temporary-database tests passed; frontend: all four test files passed, including paste draft and popover checks. Container frontend build passed.
- Unique test project: sosticero-attachments-1792067882, isolated /tmp/sosticero-attachments.AObyvL, allocated ports 38939 / 40913 / 33541 across rebuilds. Mounts and testing:true were confirmed, with the red TESTING ribbon before behavioral tests.
- In-app Chromium: actual screenshot clipboard paste; PNG/JPEG validation failure with retained draft; creation of absence, dated permit and manual disposition; preview/removal/replacement; independent overlapping links; reload; new-tab image rendering; keyboard Tab/Escape/focus return; outside click; standard text paste; unsupported clipboard feedback; responsive single-column layout. Physical touch hardware and other browsers were not exercised.
- Final rebuilt test container: schema-3 archive round trip, rejected corrupt import with unchanged state, shared date-range image references, and online backup/restore all passed. Test project stopped after verification. Operational records were not used for behavioral tests.

- Deployment: normal service rebuilt and force-recreated; read-only checks confirmed /home/fabs/Desktop/sosticero/data mounted at /data, testing:false, and served frontend /assets/index-BYcqadfU.js. Pre-upgrade online backup: supplenze-2026-10-15T14-48-09.sqlite. No commit made.

- Follow-up correction: all information (i) icons now share one style and native click toggle, with no hover/focus opening. Popover insets are reset and geometry verified beside the trigger (6 px gap). All frontend tests and the container build passed; isolated browser checks confirmed repeated-click closing, keyboard activation, and matching 14 px icons for daily/automatic availability and dated/undated Permessi. Test project sosticero-info-click-1792068959 used /tmp/sosticero-info-click.ZhgeOE on port 46799 and was stopped. Physical touch devices and other browser engines were not tested.

## Workflow follow-up

- Present completed implementation and ask whether the user wants to commit before committing.
- Deploy only an approved code change using LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate; verify operational /data mount, testing:false and updated frontend asset hash through read-only checks. Keep behavioral checks on isolated data.
- Archive after implementation and review are complete; retain a pre-upgrade database backup for rollback.
