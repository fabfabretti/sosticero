# Design

## Context

See proposal.md for motivation and the delta specs for behavior. State is stored as a JSON document in SQLite with date/teacher maps for manual absences and availability. Domain rules read state['abs'] directly in rows, eligibility and automatic availability. Import validates each state group; export expands the whole state under schema 1. Backups copy SQLite. The frontend has a Permessi stub and existing manual/automatic hour controls.

## Goals / Non-Goals

**Goals:** Introduce one authoritative permit record per teacher/date, preserve manual absence provenance and reuse the existing scheduling and issue flows.

**Non-Goals:** Recovery events, candidate rankings for recovery, allocation rules, annual quotas, legal-policy lookup, or a generic accounting framework.

## Decisions

### Store permits separately, derive effective absences

Add a `permessi` date/teacher/periods map to stored state; absence state continues to mean manual absences only. Normalize missing permessi to an empty map when loading old state. A small shared domain helper returns the union of manual and permit periods; use it for every absence consumer. Do not persist the derived union: synchronizing two stored representations would make deletion and overlap unsafe. No recovery fields or separate SQL tables are needed now.

Day responses expose permits alongside manual state. Sidebar rendering combines teacher identities and locks permit periods, while manual toggles, whole-day controls and removal send only manual values. Explain locked periods via a focusable wrapper or equivalent accessible help, since disabled buttons alone cannot receive keyboard focus. Keep manual overlaps until the user explicitly edits them.

### Dedicated permit operations and validation

Provide GET /api/permessi for the register and teacher/schedule context and POST /api/permessi for one teacher/date record (periods to save; null to delete). Follow existing transaction and error conventions. Reject unknown teachers, invalid dates, empty or duplicate period lists, boolean/noninteger or out-of-range values. Count schedule entries for the date's weekday, regardless of activity or classes, and enforce integer half of that count on creation and edits. Unscheduled selected periods count toward that limit and produce warnings, not additional errors. Zero scheduled periods imply zero entitlement.

Use teacher/date as record identity, retaining the smallest existing map pattern. Changing either field is an atomic move: include the original identity, reject an occupied target and validate before deleting the source. A new record for an occupied identity returns an edit-existing error; edits explicitly identify their source. Existing assignment issues are retained and surfaced through current validation rather than silently cleared.

### Archive compatibility and historical data

Extend schema 1 with the optional permessi map, importing missing data as empty. Add explicit structural/reference validation instead of letting the new group fall into assignment validation. Reject malformed imports atomically. Do not reapply the current timetable's daily limit on import: valid historical records may predate timetable changes. Database backups naturally include the new state. Older application versions do not understand permits and must not be used to round-trip new exports.

Keep retired teacher references for existing records as timetable import already does. New records select active teachers; existing historical records remain readable. Schedule warnings use the currently loaded timetable; there is no historical timetable snapshot in this release.

### Small register UI

Use the existing app grid with the table centered in the remaining space and a compact entry sidebar on the left; stack it on smaller screens. Reserve an hour-warning strip and a fixed feedback area to prevent control shifts. Store optional request dates in a parallel permitRequests date/teacher map, validating and moving or deleting them atomically with the permit; absent metadata remains compatible with older records. Reuse existing API handling, teacher naming and period button styles. Show records by descending date, then teacher name. Provide a teacher/date/period form with the same type-to-search suggestions and keyboard selection as Supplenze, accessible labels, the daily maximum, immediate over-limit warning triangles and inline save errors. Position hour warnings below the buttons without shifting the row. Use compact existing controls, pencil edit icons and the existing × removal control instead of a separate card style. Each row offers edit/delete and displays the selected periods and their count as Ore da recuperare. No recovery columns with inactive controls.

## Risks / Trade-offs

- Timetable replacement can change entitlement and warnings for historical dates → preserve stored records and apply the current limit only to explicit saves; import validates structure only.
- Manual absence controls can accidentally copy computed hours → keep their payloads manual-only and cover overlap, whole-day toggles and removal in tests.
- A permit can invalidate an existing assignment or merged row key → retain assignments and reuse the existing review warnings.
- Existing app-shell spec incorrectly describes implemented Settings as a placeholder → delta preserves that unrelated requirement; do not regress Settings or rewrite its spec in this change.
- Schema 1 extension is compatible with old archives entering the new app, but older apps can discard unknown fields → do not roll back while permits exist without restoring a pre-change database backup.

## Migration Plan

No destructive migration: initialize missing permit state on load and persist with the next write. Verify legacy archive import and permit export/import plus SQLite backup/restore. Before showing or testing the implemented feature, rebuild and recreate the container with `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate`. Roll back using the prior image and pre-change backup only after preserving any newly recorded data.
