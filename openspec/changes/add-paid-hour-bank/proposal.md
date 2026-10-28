# Proposal

## Why

The office needs recurring paid substitution availability and a reliable record of assigned paid hours. Teachers must be selectable explicitly for pay or permit recovery, with fair ordering and visibility of the extra staffing capacity.

## What Changes

- Replace the Banca ore placeholder with an editable Monday–Friday, periods 1–7 grid showing computed campuses for each teacher-slot.
- Add a paid assignment register beneath the grid, including substitution details, assigning account, per-teacher totals and notification status. Avvisato and the copyable request email button SHALL appear only in the Supplenze table, following the permit recovery pattern.
- Count each saved paid assignment immediately, including future dates; removal or replacement adjusts totals automatically.
- Add Disponibile a pagamento immediately after favourable permit recoveries. A teacher can appear in both sections; the clicked option determines accounting. Sort paid choices by ascending paid assignments across all current data.
- Add Reperibili + Pagamento to Stats, preserving theoretical weekly semantics and deduplicating teachers.
- Infer campuses using existing permit recovery travel rules; unknown feasibility remains selectable with Sede da verificare.
- Exclude school-year management, payroll/rates, automatic email sending, grouped requests and a separate completion workflow.

## Capabilities

### New Capabilities

- `paid-substitutions`: Recurring paid availability, computed campuses, assignment accounting, register, notification and theoretical paid capacity in Stats.

### Modified Capabilities

- `candidate-selection`: Explicit teacher-and-category selection, paid candidates, ordering and atomic switching between paid and recovery assignments.

## Impact

Backend assignment validation, API models, storage/archive validation, concurrency snapshots, timetable review, statistics and campus authorization integration; frontend Banca ore route, candidate drawer/callers, assignment actions and Stats availability views. Reuse the existing SQLite transaction, authentication, travel rules, accessible controls and clipboard patterns; no new dependency or production data operation is required. Stats availability currently lives in an unarchived change rather than a main capability, so this change specifies only the new paid extension and preserves the existing report behavior.
