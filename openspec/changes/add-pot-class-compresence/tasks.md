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

## Follow-up fixes

- POT cells now open class/campus editing on click or double-click only in timetable edit mode. Availability uses a separate button; timing-based toggles were removed.
- Future overrides are expanded and remain visible while editing. Deletion confirms draft discard and uses the existing preview/token flow.
- POT campus changes support Centrale and Staccata; other special activities retain their campus conservation rules. Invalid campus values are rejected.
- Verification: 169 backend tests, 24 timetable frontend tests and the frontend/container production builds passed. Isolated browser verified the expanded future history in edit mode; native confirmation blocked further browser automation, so future deletion was verified through the isolated API and interaction handlers through frontend tests.
- Test project stopped. Normal service rebuilt and recreated with both required flags; read-only checks confirmed the project data mount, testing=false and updated bundle index-Cu_S7cSM.js.

## ALF follow-up

- Investigation of the reported teacher found single-code ALF hours, which the original POT-only editor excluded. The office explicitly approved extending the same behavior to ALF.
- ALF now supports class/campus editing and separate availability controls, automatic class-out release and conditional absence rows. Same-class coverage uses CA / Compresenza - ALF through assignment display, PDF export and statistics.
- Verification: 33 targeted backend tests, 25 editor tests, 9 export tests and production builds passed. On an isolated synthetic ALF timetable, actual browser double-click opened the class/campus editor without reactivating the hour, then saved class 1A and Staccata successfully. The isolated project was stopped; no fixture or behavioral writes targeted operational data.
- Normal service rebuilt and force-recreated after the ALF fix. Read-only checks confirmed /data mounts the project data directory, localhost:8000 reports testing=false and serves index-BNLiEIn_.js. Only the normal service remains running.

## Activity editor UX follow-up

- Replaced expanding in-cell controls with a compact native dialog outside the grid. Class input reuses Supplenze suggestion styling and normalized filtering, with arrow/Enter selection and explicit clearing. Campus uses three mutually exclusive selected-style buttons.
- Native modal focus containment and Escape are supported; class search receives focus on opening and the originating cell receives focus on closing. Cancel changes only the dialog draft; applying updates the timetable draft.
- Verification: 26 editor tests passed, including suggestions, single selected campus, cancellation and dialog placement outside cells. Final container production build passed. Isolated browser verified typing/selecting a class, selecting Staccata, applying, Escape and focus restoration. Measured grid width/height were identical before and after opening (564.67 × 374.40 px). Test project stopped after verification.
- Normal service rebuilt and force-recreated. Read-only checks confirmed the project data directory remains mounted at /data, testing=false and served bundle index-Bmr3VBhv.js; only the normal service remains running.
