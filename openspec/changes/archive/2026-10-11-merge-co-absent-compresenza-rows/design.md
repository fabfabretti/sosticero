# Design

## Context

See `proposal.md` for motivation. The current `rows()` in `backend/domain.py` emits one row per (absent teacher, period, class), with key `k = "<teacher>|<period>|<class>"`. Every substitution is stored in `state.asg[day][k]`, and `import_state()` validates saved keys against that exact form. The frontend renders `name(row.id)` and the drawer shows `name(open.id)`. A period-plus-class with an absent curricolare and an absent ITP therefore produces two independent rows and two independent substitutions.

Constraints: the archive format (`Esporta`/`Importa supplenze`, `schema=1`, `datasetId` over teacher ids) is a compatibility promise in `README.md`; it must keep accepting old exports.

## Goals / Non-Goals

**Goals:**
- One row per (period, class) for any number of co-absent teachers.
- Preserve the archive key form so old exports import unchanged.
- Keep candidate correctness: an absent teacher must never be offered as the substitute.

**Non-Goals:**
- Separating sostegno cover from class cover (explicitly deferred; sostegno merges for now).
- Migrating or rewriting already-stored substitutions.
- Changing the storage layout or export schema.

## Decisions

- **Group by (period, class), not by teacher.** A class in a period occupies one room and needs one adult, so the coverage unit is the class-period, not the teacher. Alternative (status quo, group per teacher) is exactly the reported bug.
- **Merged row carries an `ids` list plus a canonical id.** `rows()` keeps `id` as the canonical teacher for compatibility and adds `ids` (all absent teachers, name order). The frontend label and drawer use `ids`; nothing else needs the full list. Alternative: key the row by class+period (`3FB|7`) is cleaner but breaks `import_state()` and every existing export; rejected.
- **Canonical teacher = lowest id in the group.** Deterministic and independent of insertion order. Alternative: first by name is equally displayable but couples identity to display ordering; a timetable-first teacher keeps the key stable even when that teacher is present, but then the key names a non-absent teacher, which is confusing. Lowest id is the smallest stable choice.
- **Label joins names in the existing name order** (`r.ids.map(name).join(" / ")`), matching the current sort.
- **Candidate exclusion covers the whole group.** `eligibility()` skips every id in `row.ids` instead of only `row.id`, so a co-absent teacher cannot appear as a Compresenza candidate for the row they are absent from.
- **Sostegno and ITP merge too, for now.** The prototype deliberately kept their absences visible; merging still shows every name, so visibility is kept, but one substitute covers the room. If the office later needs separate support cover, a role-based split is a follow-up change.
- **Orphaned substitutions are flagged, not migrated.** If the canonical teacher's absence is removed while another co-absent teacher remains, the stored key no longer matches a row and surfaces through the existing "Assegnazione da verificare" path. This matches the app's existing stance on invalidated assignments.

## Risks / Trade-offs

- One substitute covers a sostegno absence → the office may want a dedicated support substitute. Mitigation: decision recorded here; a role filter is the natural follow-up.
- Canonical key changes when the lowest-id co-teacher becomes present → the stored substitution is flagged for review rather than preserved. Mitigation: existing issue UI makes it visible; no silent loss.
- Co-absent lessons could disagree on room/site (data anomaly) → the merged row shows the canonical teacher's lesson room/site. Acceptable: it is a single row for a single room; the anomaly stays a dataset issue.
- An existing database might already hold two substitutions for a paired key → after merging, the non-canonical one is flagged. No data is deleted.

## Migration Plan

No database migration and no archive change. Behaviour changes on deploy: existing marked absences re-render as merged rows immediately, and any now-orphaned substitution appears in the review list. Rollback is reverting the code; stored state is unaffected.

## Open Questions

None that affect the specs or approach.
