# Tasks

## 1. Override model and compatibility

- [x] 1.1 Extend server validation and atomic grouping for adding, removing, converting, moving and swapping hours for all teacher roles; verify valid edits, rejected malformed requests, preserved fields and multi-class values with focused tests.
- [x] 1.2 Adapt import rebase and archive validation for new patches while retaining legacy records; verify conflicts involving originally empty cells, linked moves, archive round trips and legacy fixtures.
- [x] 1.3 Verify dated precedence, expiry, reset, deletion and stale previews with the new edit types using focused backend tests.

## 2. Operational behavior

- [x] 2.1 Make effective edited kinds and class associations drive Sostituzioni, eligibility and other dated consumers; test ITP-to-POT, class-linked and classless activities, and legacy disabled-hour compatibility.
- [x] 2.2 Extend impact preview to warn about independent reception and student-group overlaps without blocking save; test preserved commitments, assignment evidence and review flags.

## 3. Timetable editor

- [x] 3.1 Extend the existing Orari dialog and empty-cell interaction for kind, class, campus, creation and removal, reusing established components and styles; verify drafts, cancellation, validation and multi-class preservation in frontend tests.
- [x] 3.2 Provide move/swap interactions for all lessons and retain per-hour POT enable/disable without extending it to other types; verify class retention, pointer and keyboard behavior, focus and accessible labels.
- [x] 3.3 Present overlap and assignment impacts through existing review patterns; verify warnings allow saving and remain readable in existing themes and narrow layouts.

## 4. Integration and release

- [x] 4.1 Run focused backend and frontend tests and the production build; resolve failures attributable to this change.
- [x] 4.2 Build a uniquely named isolated `compose.testing.yaml` project with a temporary data directory; inspect mount and allocated port, verify testing endpoint and red ribbon, then exercise creation, conversion, conflicts and dated behavior; stop only that project.
- [x] 4.3 Deploy using `./scripts/deploy.sh` and verify the release and production mount with read-only checks; record results and ask the user before any commit.
