# Tasks

## 1. Dated POT associations

- [x] 1.1 Extend override validation to allow one existing class on disabled POT while conserving activities and campus; verify invalid classes, active POT associations and ordinary lesson edits are rejected in isolated backend tests.
- [x] 1.2 Preserve associations through dated edits, moves, reactivation, reset and reimport conflict review; verify date boundaries and assignment-impact preservation with override tests.
- [x] 1.3 Verify restart, archive round trip and backup/restore retain associations, and legacy association-free records remain valid, using temporary databases.

## 2. Candidate selection and absence rows

- [x] 2.1 Add normal same-class Compresenza - POT eligibility and assignment validation; verify same-class selection needs no exceptional confirmation while other-class disabled POT and hard restrictions remain enforced.
- [x] 2.2 Release class-associated disabled POT as automatic A disposizione when the class is out; verify candidate category and locked sidebar cause in backend/frontend tests.
- [x] 2.3 Generate POT-origin absence rows only when nobody remains in class and reuse merged-row identities; verify present co-teacher, lone POT, all-absent and ordinary-teacher absence cases.
- [x] 2.4 Preserve distinct POT compresence presentation in saved assignments, exports and statistics; verify reload and export fixtures do not label these as ordinary available POT and retain historical assignments for review.

## 3. Timetable editor

- [x] 3.1 Add a class selector for disabled POT with an explicit keyboard/touch action and double-click shortcut; verify opening or cancelling does not toggle availability and reactivation clears the class.
- [x] 3.2 Display POT and its class consistently in timetable cells and co-teaching information, retaining drag behavior; verify frontend tests cover moves and dated save/reload.

## 4. Integration verification

- [x] 4.1 Run relevant backend/frontend suites and the frontend production build; record successful commands and resolve failures attributable to this change.
- [x] 4.2 Build and recreate a unique isolated compose.testing.yaml project using a mktemp data directory, inspect mount and allocated port, verify testing API and red TESTING ribbon, exercise the complete association-to-substitution flow, and stop only that project.

## Workflow follow-up

- Ask the user whether to commit before committing any work.
- Deploy approved implementation through the normal build/recreate command and verify its operational data mount and served frontend using read-only checks.

## Verification record

- Backend full suite: 165 tests passed; after the additional reset/reimport test and CP statistics assertion, all 17 override API tests passed. Tests used temporary databases.
- Frontend editor: 23 tests passed; substitution export: 8 tests passed. Production TypeScript/Vite build passed, including the final container build.
- Full frontend run: 9 of 10 test files passed. The existing sidebar test `permit errors preserve form; editing supplies original identity and deletion is explicit` fails because deletion requires confirmation while its harness defaults to rejecting confirmation. The same failure was reproduced with the POT change to main.tsx removed; no unrelated permit behavior was changed.
- Unique isolated Compose project verified its temporary /data mount, allocated localhost port, testing API and red TESTING ribbon. Browser flow verified double-click class association, dated save, normal Compresenza - POT selection and persistence after container recreation. The test project was stopped.
- No behavioral tests or fixture imports targeted the operational database.
- Normal deployment rebuilt and recreated successfully. Read-only checks confirmed /data mounts /home/fabs/Desktop/sosticero/data, /api/environment reports testing=false, and the served frontend asset hash matches the isolated final build (index-CxPtdylu.js). Only the normal service remains running.
