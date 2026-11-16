# Tasks

## 1. Dated records and persistence

- [x] 1.1 Implement the versioned student-group document, stable identities, active-date lookup and atomic validation; add unit tests for date boundaries, unknown/invalid counts, duplicate periods and unresolved references.
- [x] 1.2 Integrate storage, dated dataset composition and archive import/export without widening lesson or special-hour override schemas; verify restart, backup/restore, legacy archive preservation and atomic malformed-import rejection in temporary-database tests.
- [x] 1.3 Add office read/write endpoints with campus authorization and concurrent-save protection; verify permitted saves, forbidden campus writes and stale-edit rejection using API tests, and document the record/date/conflict contract.

## 2. Occupancy and historical accounting

- [x] 2.1 Apply group occupancy to ordinary candidates, recovery/free-hour paths and availability statistics using shared lookup; verify occupied teachers are not normally offered, source classes confer no compresence and outings do not release teachers.
- [x] 2.2 Generate separate group-absence review items and extend historical facts with optional group context; verify one absent teacher-period, no fabricated class demand, historical campus preservation and compatibility with legacy facts.
- [x] 2.3 Preserve ordinary lesson behavior for overlapping commitments and flag conflicts; add regression tests for ordinary co-absence merging, POT/ALF associations, overlaps and existing saved assignments, and document the “Da valutare” accounting boundary.

## 3. Office and timetable presentation

- [x] 3.1 Add the Orari office editor with date range, teacher, day/period, campus, room and class/count fields; verify accessible editing, validation, permission errors, stale saves and visible overlaps in frontend tests.
- [x] 3.2 Render groups consistently in teacher timetable views, portal and timetable export/PDF; verify each supplied slot appears once, unknown counts stay unspecified and classes remain provenance labels.
- [x] 3.3 Show one “Da valutare” item per absent group commitment in daily work with date/campus filters; verify mixed groups are not expanded into class rows or presented as covered/uncovered, and document the office workflow.

## 4. Integration and release

- [x] 4.1 Build an isolated fixture from the design's 15-slot checklist, excluding all seven autonomous-study entries; verify 10 Centrale/5 Succursale hours and teacher totals 5 Iorio, 6 Saccoccio, 2 Dal Cortivo, 1 Presta, 1 Corrà, including cross-module absence and availability behavior.
- [x] 4.2 Run relevant backend/frontend checks and build; then start a unique exported TEST_PROJECT and mktemp TEST_DATA_DIR using LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose -p "$TEST_PROJECT" -f compose.testing.yaml up -d --build --force-recreate. Verify that project's mount, allocated localhost port, /api/environment testing=true and red TESTING ribbon before mutations; check editor/timetable/review flow and stop only that project with its testing Compose file.
- [x] 4.3 Deploy implemented code with ./scripts/deploy.sh and verify release and production mount using read-only checks; record results without seeding or changing production group records.

## Workflow follow-up

- Before entering the supplied operational schedule, obtain the effective date and resolve teacher/class identities and overlaps against authoritative server data; do not insert fixtures or guess dates in production.
- Ask whether the user wants to commit before making any commit.
