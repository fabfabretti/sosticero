# Tasks

## 1. Backend: candidate profile data

- [x] 1.1 Keep `classe_concorso` on teacher records in `normalize_dataset` and verify a backend test asserts `teachers[id]['classe_concorso']` survives normalization
- [x] 1.2 Add the static `CDC_NAMES` code→name table in `domain.py` (29 codes, raw code fallback for unknown) and verify a test maps a known code to its name and an unknown code to itself
- [x] 1.3 Enrich teacher candidates with `role`, `cdc`, `cdcName`, `clsWeek` (sorted weekly class union), and `inClass` and verify tests cover an ITP compresenza candidate (role + concorso + name), a sostegno candidate, the in-class badge flag, and the no-badge case

## 2. Backend: entry/exit options

- [x] 2.1 Always append `ENTRA` and `ESCE` candidates with an `enable` flag and the effective-bounds `info` label and verify tests cover: first-effective-hour (entry enabled, exit greyed), last-effective-hour (exit enabled, entry greyed), mid-schedule (both greyed), and the exit chain (ESCE at hour 7 enables ESCE at hour 6)
- [x] 2.2 Reject greyed entry/exit assignments in `validate_assignment` and verify a test asserts the request fails and no assignment is stored

## 3. Backend: automatic availability

- [x] 3.1 Add the per-day auto-availability computation (all scheduled classes out for the hour, teacher not absent, not already assigned) with per-hour reasons, expose it in `GET /api/day/{day}`, and verify tests cover an entrar-dopo cause, a class-out cause, and the absent-teacher exclusion

## 4. Frontend

- [x] 4.1 Extend the TypeScript shapes (`Teacher`, `Candidate`, `Data`) with the new backend fields and verify `npm --prefix frontend run build` type-checks
- [x] 4.2 Render the candidate profile (role, concorso code+name, weekly class chips, in-class badge) and the always-visible greyed-aware entry/exit options in `CandidateDrawer`, and verify frontend tests assert the drawer props carry the profile and `enable` flags
- [x] 4.3 Merge automatic availability into the sidebar "A disposizione" list with locked/greyed hours, hover tooltips on locked hours, and manual-only edit chrome, and verify a frontend test asserts locked hours are disabled/unclickable while other hours still toggle manual availability

## 5. Integration and deployment

- [x] 5.1 Run the full backend unittest suite, the frontend `node --test` suite, and `npm run build`, and verify all pass with no regression to merged-row rendering or existing eligibility
- [x] 5.2 Document the one-time dataset refresh in README (back up first, re-upload the same timetable JSON, `state` untouched) and verify the documented commands run as written

## Workflow follow-up

- Archive the change after the project's review requirements are satisfied.
- Verify the archived result.