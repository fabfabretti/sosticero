# Proposal

## Why

The office picks a substitute with too little context: the drawer shows only a name and an eligibility tag, the "A disposizione" sidebar hides teachers who become available automatically when a class enters late or leaves early, and the entry/exit options only surface when the hour happens to be a boundary, with no sense of the class's real hours.

## What Changes

- **Candidate profile in the drawer**: every teacher candidate shows their role (`curricolare` / `ITP` / `sostegno`), their classe di concorso code and Italian name, and the list of classes they teach across the week as compact chips. The class being covered is highlighted with an "già in <classe>" badge when the candidate already teaches it.
- **Automatic "A disposizione" in the sidebar**: teachers whose scheduled classes are all out for an hour (because of an ENTRA/ESCE assignment or a class-out entry) are listed in the sidebar's "A disposizione" section with those hours selected but locked/greyed, plus a hover explanation of the cause. Other hours on the same teacher remain normally editable as manual availability.
- **Entry/exit options always visible**: the "Entra dopo" and "Esce prima" options are always shown in the drawer, each labelled "La classe <classe> entra alle X ed esce alle Y" using the effective boundaries (scheduled hours minus hours already made out). An option is greyed out when the row's hour is not that boundary; assigning a greyed option is rejected server-side.
- **Timetable data**: the dataset keeps each teacher's `classe_concorso`, and a static code→name table supplies Italian names.
- No change to ranking priorities or to substitution-row merging.

## Capabilities

### New Capabilities
- `candidate-selection`: how the office picks a substitute for a row — the candidate profile shown in the drawer (role, classe di concorso, weekly classes, in-class badge), the always-visible entry/exit options with effective boundaries and their server-side validation, and the automatically-computed availability surfaced in the sidebar.

### Modified Capabilities
<!-- None: row identity/merging (substitution-rows) is untouched; ENTRA/ESCE continue to mark the class "out" for that hour exactly as before. -->

## Impact

- `backend/domain.py`: keep `classe_concorso` on teacher records in `normalize_dataset`; add the code→name table; enrich teacher candidates with role/concorso/weekly-classes/in-class badge; always emit ENTRA/ESCE candidates with effective boundaries and an applicable flag; compute per-day automatic availability with reasons; reject inapplicable entry/exit options in `validate_assignment`.
- `backend/main.py`: expose the automatic availability (and any day context the frontend needs) in `GET /api/day/{day}`.
- `frontend/src/types.ts`: extend `Teacher`, `Candidate`, and `Data` shapes.
- `frontend/src/main.tsx`: merge automatic availability into the sidebar's "A disposizione" list with locked hours, tooltips, and manual-only editing.
- `frontend/src/CandidateDrawer.tsx`: render the candidate profile (role, concorso, weekly class chips, badge) and the always-visible greyed-aware entry/exit options.
- Tests: unit tests in `backend/tests/test_app.py` and `frontend/tests/sidebar.test.cjs`.
- **Deploy note**: existing databases store teacher records without `classe_concorso`; after deploying, back up (archive export / SQLite backup) and re-upload the same timetable JSON to refresh the dataset. The operational `state` document is untouched by a re-upload.