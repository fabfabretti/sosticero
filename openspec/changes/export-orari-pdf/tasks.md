# Tasks

## 1. Complete export data

- [x] 1.1 Preserve room and disabled-activity metadata in frontend timetable types/projection without altering screen rendering; verify existing timetable tests and add room-preservation coverage.
- [x] 1.2 Add a pure export projection from the saved selected-date dataset, including all eligible teachers, displayed partner names, locations and receptions; verify alphabetical ordering, three-way/deduplicated compresenze, reception-only teachers, unknown locations and saved overrides with focused fixtures.

## 2. Fixed-layout PDF

- [x] 2.1 Implement the dedicated jsPDF renderer with two stacked grids per A4 landscape page, uniform body cells, repeated date/legend and page numbers; verify page count and fixed geometry for one, two and five teachers.
- [x] 2.2 Add wrapping and measured fit checks with a 7 pt minimum and clear teacher/slot errors on overflow; verify long names, multiple partners, reception overlaps, general-purpose activity colors and omitted substitution flags and deliberate overflow without silent omissions.

## 3. Orari download integration

- [x] 3.1 Add “Scarica PDF completo” using the unfiltered saved snapshot and dated filename, with loading/editing/empty/busy guards and accessible error feedback; verify filtered export includes all teachers and drafts cannot be exported through component tests.
- [x] 3.2 Handle stale date/data results and object URL cleanup; verify date changes and repeated downloads do not retain stale results or URLs, and document the button, selected-date semantics and layout in README.md.

## 4. Integration verification

- [x] 4.1 Run the relevant frontend tests and production build, confirming existing timetable and substitution export coverage passes.
- [ ] 4.2 Build and recreate a unique standalone compose.testing.yaml project with a mktemp data directory and allocated localhost port; inspect mount, `/api/environment` testing=true and red TESTING ribbon before behavioral checks. Verify download with a search active and a selected-date override, then stop only that test project.
- [x] 4.3 Generate and render a representative multi-page PDF from isolated fixtures; visually inspect both grids, repeated legend, long compresenza names, aula/campus, reception overlaps, uniform cells and the odd final page. Record results and any limits in verification.md.

## Workflow follow-up

- Ask the user whether to commit before making any commit.
- Deploy an approved code change using the normal rebuild/recreate command in AGENTS.md; verify the project data mount and updated served asset hash with read-only checks. Keep behavioral tests isolated.
