# Proposal

## Why

When two co-teachers (compresenza) are absent for the same class in the same period, the substitution table shows one row per absent teacher and asks the office to choose two supplenti for a single room. This duplicates work and can double-book two substitutes into one class that needs only one adult.

## What Changes

- Group substitution rows by (period, class): every absent teacher who shares a class and period collapses into a single row.
- The "Docente assente" label lists all absent teachers in the group, joined in name order (e.g. `Domaschi Alberto / Savelli Luca`).
- A merged row carries exactly one substitution. The candidate list excludes every absent teacher in the group, not only one of them.
- Merging covers 2 or more teachers and includes curricolare, ITP and sostegno absences. Sostegno merges for now; a future change can split support cover out.
- Row identity stays `<canonical-teacher>|<period>|<class>`, where the canonical teacher is the lowest id in the group. The archive export/import format is unchanged. An assignment saved under a now non-canonical key is surfaced for review instead of being migrated.
- A single absence behaves exactly as today; the absent teacher's present co-teachers remain Compresenza candidates.

## Capabilities

### New Capabilities
- `substitution-rows`: how daily substitution rows are generated and how the candidate list is derived for each row, including grouping co-teachers who are absent together.

### Modified Capabilities
<!-- none: the project has no specs yet -->

## Impact

- `backend/domain.py`: row generation (`rows`) and candidate exclusion (`eligibility`).
- `backend/tests/test_app.py`: new coverage for co-absence merging and candidate exclusion.
- `frontend/src/types.ts`, `main.tsx`, `CandidateDrawer.tsx`: row label and drawer text use the full list of absent teachers.
- `frontend/tests/sidebar.test.cjs`: coverage for the merged label.
- `README.md`: behavior note.
- No storage or archive-format change; `data/supplenze.sqlite` layout is untouched.
