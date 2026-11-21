# Proposal

## Why

The office needs to move support teaching hours and temporarily correct their class or campus without reimporting the whole timetable. Existing dated overrides already provide the required lifecycle, but currently reject ordinary class lessons, including support lessons.

## What Changes

- Extend the existing Orari editor to support class lessons belonging to teachers with the `sostegno` role.
- Move those hours within the same teacher's week to empty cells or swap with another editable hour; edit class and campus through the existing dialog pattern.
- Preserve weekly support-hour totals and lesson identity. Do not offer or accept disabling support lessons.
- Reuse inclusive validity dates, overlapping-override precedence, reset, deletion, stale-preview protection and import conflict review.
- Apply the effective schedule consistently to substitutions, compresence, availability, timetable views and exports, preserving existing assignments for review.
- Defer ordinary curricolare/ITP timetable correction, adding/removing hours, cross-teacher transfers and full timetable authoring.

## Capabilities

### New Capabilities

- `support-timetable-overrides`: Scoped support-lesson editing and its integration with the existing dated override lifecycle.

### Modified Capabilities

None. Existing substitution merging and candidate policies remain unchanged; they consume the resulting effective timetable.

## Impact

- Backend: `backend/overrides.py`, Orari preview/save orchestration in `backend/main.py`, timetable resolution and archive validation.
- Frontend: `frontend/src/TeacherTimetables.tsx` teacher role information, movement eligibility and class/campus dialog; focused backend/frontend regression tests.
- Existing override endpoints and storage should be extended rather than duplicated. No new dependency is expected.
- The earlier `edit-timetable-overrides` and `add-pot-class-compresence` changes contain the editor's planning contract but have not been consolidated into main specs. This capability explicitly adds a narrow exception to the former's fixed-class-lesson restriction; it does not unlock other roles.
- Implementation verification must use isolated test data, followed by deployment through `./scripts/deploy.sh` and read-only release checks. This proposal itself changes no runtime code or operational data.
