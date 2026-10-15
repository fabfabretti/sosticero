# Tasks

## 1. Effective-timetable endpoint

- [x] 1.1 Add `GET /api/orari` to `backend/main.py` returning `{effective, dataset}` for the version in effect today, falling back to the bootstrap dataset when no version history exists
- [x] 1.2 Add `backend/tests/test_orari.py` using `TestClient(create_app(tmp_path))` and `fixture()`: assert the returned `effective` and `dataset`, and that a later-dated version (via `import_version` with a future date) does not replace the current one; verify with `python3 -m unittest backend.tests.test_orari`

## 2. Timetable grid helper

- [x] 2.1 Add `frontend/src/timetables.ts` exporting `buildTeacherTimetables(dataset)`: index lessons by `(day, hour, class)`, build a 5x7 cell grid per teacher with the class, the activity code, and the other teachers' ids in a shared class-hour, and omit teachers with no lessons
- [x] 2.2 Add `frontend/tests/timetables.test.cjs` (plain `node:test`, no VM) covering a lesson cell, an activity cell, a two-teacher and a three-teacher compresenza, and omission of a teacher with no lessons; verify with `node --test tests/timetables.test.cjs` from `frontend/`

## 3. Orari screen

- [x] 3.1 Add `frontend/src/TeacherTimetables.tsx` taking an `api` prop: fetch `/api/orari` and `/api/hour-types`, render one grid per teacher as a `<table>` with day column headers and hour row headers, show the effective date, inline co-teacher names, and raw activity codes tinted with the type's `palette-<color>` class; derive through `buildTeacherTimetables` in a `useMemo` keyed on the dataset
- [x] 3.2 Add a filter that narrows grids by teacher name or code using `norm()`, showing all active teachers when empty
- [x] 3.3 Add `frontend/tests/orari.test.cjs` using the `node:vm` component harness with a fake `api`: assert every teacher renders by default, the filter narrows the set, compresenza names appear inline, an activity cell carries its color class, the effective date is shown, and only the current version's dataset is requested; verify with `node --test tests/orari.test.cjs` from `frontend/`
- [x] 3.4 Add a README section describing the Orari screen and verify it matches the shipped behavior

## 4. App shell: Orari tab

- [x] 4.1 Add `{ path: "/orari", label: "Orari" }` to `TABS` and render `TeacherTimetables` from `Shell`, passing `api`
- [x] 4.2 Update `frontend/tests/sidebar.test.cjs`: the six-tab assertion, the `screen()` route list, and the VM `require` map entry for `./TeacherTimetables`; verify with `node --test tests/sidebar.test.cjs` from `frontend/` and confirm the Orari tab is marked current when open

## 5. Styles

- [x] 5.1 Add grid layout and cell styles to `frontend/src/style.css`, laying grids one or two per row and reusing the existing `palette-<color>` classes for activity cells; verify visually in the rebuilt container in light and dark themes

## 6. Integration verification

- [x] 6.1 Rebuild and recreate the container per `AGENTS.md`, confirm `/data` mounts the project `data` directory, and verify the Orari tab renders the live timetable and the served bundle hash changed

## Workflow follow-up

- Archive the change once the project's review requirements are satisfied.
- Verify the archived result.
