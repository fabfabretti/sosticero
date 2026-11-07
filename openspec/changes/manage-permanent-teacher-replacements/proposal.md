# Proposal

## Why

A combined timetable identity such as Sicoli/Gambato makes Gambato's personal permit debt appear to belong to Sicoli. The office needs full-cattedra replacements and prolonged absences without duplicating substitution demand or mixing people's records.

## What Changes

- Manage people, prolonged absences and dated full-cattedra replacements in Amministrazione with admin-only controls and inheritance previews. Display their effects in Orari with explicit labels, greyed absent teachers, struck-through original names beside clear replacement names, and crossed-out non-inherited POT.
- Separate stable person identity from the imported timetable source; successive replacements cover the same source and retain separate personal records.
- Inherit every scheduled hour except POT; excluded POT creates neither inherited availability nor uncovered demand during replacement.
- Hide a covered original teacher from daily Supplenze absence tables. Only the replacement's own absences generate demand while coverage is active.
- Generate daily absences automatically for an uncovered absent for a prolonged period teacher, including Ianzano.
- Keep permits, manual debt and RP links personal across replacements, returns, renames and imports.
- Keep school-specific legacy ownership repairs outside the product interface. Existing correctly attributed records remain unchanged; any one-time operational repair is reviewed separately.
- Extend effective-date resolution, import review and archives to preserve these identities and periods.

## Capabilities

### New Capabilities

- `teacher-appointments`: Person identity, timetable ownership, prolonged absences, replacement lifecycle, Amministrazione management and Orari visibility, import reconciliation and persistence.

### Modified Capabilities

- `permessi`: Explicit person ownership without debt transfer.
- `absence-entry`: Derived prolonged absences, covered-original suppression and locked source hours.
- `candidate-selection`: Effective replacement availability, exclusion of absent/inactive people and removal of inherited POT.

## Impact

Backend timetable resolution, domain demand/eligibility, recovery validation, API reference checks, Inbox matching, receptions, paid availability, statistics, PDF/public display consumers, archive validation and concurrency controls; frontend Amministrazione, Orari, daily entry and permit timetable consumers. Use existing SQLite document storage and existing dependencies. Upgrade archive format with legacy compatibility; old clients cannot represent new appointment data. No operational data edits occur while proposing. Implementation includes isolated verification and deployment through the existing script, with read-only release checks.

The older `prototype-dated-teacher-replacements` research plan is context, not a prerequisite or evidence of proven compatibility; leave it untouched. Partial-cattedra replacement, automatic name-based ownership inference and broad personnel/contract management are out of scope.
