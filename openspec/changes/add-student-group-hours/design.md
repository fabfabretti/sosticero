# Design

## Context

See proposal.md for motivation. `domain.rows` expands lesson classes into whole-class substitution rows and candidate checks infer compresence from shared classes. `statistics.sync` independently expands absence-slot classes into demand. Merely inserting several classes into a lesson would therefore create false demand in both paths. The existing special-hour override editor conserves imported activities and permits only a single POT/ALF class association. Receptions demonstrate an existing separate dated source composed into timetable presentation. This change crosses those boundaries and needs an explicit design.

## Goals / Non-Goals

**Goals:** Represent group occupancy separately, preserve ordinary class semantics and make uncertainty about absence handling visible.

**Non-Goals:** Student rosters, attendance, automatic cover assignment, return-to-class decisions, a new activity-policy engine, arbitrary editing of imported lessons, or operational entry before the effective date and references are confirmed.

## Decisions

1. Persist a separate versioned `studentGroupHours` document using existing storage and archive mechanisms. Records contain stable id, teacher id, weekday, hour, campus, room, source classes with nullable positive counts, start and optional end. Compose applicable records into effective dated datasets alongside lessons; never put source classes into ordinary lesson `classes`. This follows the reception integration pattern without giving group hours reception availability rules. Rejected alternatives: synthetic classes pollute class-out and reports; ordinary multi-class lessons duplicate demand; POT/ALF overrides cannot safely add these commitments.
2. Use one office editor associated with Orari, reusing teacher/class catalogs, campus permissions and generation-based concurrent-save checks. Show explicit date ranges and validate duplicates/overlaps, dates and counts atomically. For overlaps with existing lessons, special activities or receptions, preserve both and show a conflict; never silently replace or disable imported cells. Existing ordinary lesson consequences remain intact until an office correction resolves the overlap.
3. Add a shared read-only active-group lookup used by candidate selection, availability statistics, timetable presentation and service/absence-hour context. Check group occupancy before ordinary free-hour and co-teaching classification. Source classes confer no compresence and their outings do not cancel the commitment. Existing exceptional-assignment mechanisms, if invoked explicitly, retain their occupied-hour warning; group occupancy never makes a teacher an ordinary eligible candidate.
4. Compute separate dated `groupReviews` for absent group teachers, keyed by date and stable group identity and labelled “Da valutare”. Show these beside the day's substitution work with campus/date filters. Keep them outside `rows`, class assignments and ordinary demand totals. No resolution workflow or automatic assignment is introduced in this phase; discovering the school's procedure can motivate a later change.
5. Extend stored absence facts with optional group context and historical campus/room/source snapshots. A unique teacher-period contributes at most once even when manual absence, permit, ordinary lesson and group records overlap. Build ordinary demand only from ordinary lessons; do not feed group source classes into the current expansion loop. Older facts remain readable, and subsequent timetable edits do not rewrite recorded historical group context. No retrospective group facts are invented before the effective date.
6. Extend archive and backup handling with optional group data and atomic validation. Legacy imports without that field preserve existing group records. Reimports retain stable group ids and report unresolved teacher/class references rather than guessing mappings. Do not widen the existing override schema. Timetable PDF/export and teacher portal displays use the same group metadata and pupil-count conventions; an incomplete total is not displayed as a complete group total.

## Supplied schedule checklist

Transcription from the two user-supplied images. Parentheses indicate pupil counts; “unspecified” is not zero. Match names/classes against the server catalog before entry; do not infer an activity subject from the pictures.

| Campus | Day | Period | Teacher | Source classes | Room |
|---|---|---:|---|---|---|
| Succursale | Monday | 2 | Corrà | 2DST (unspecified) | Aula magna |
| Succursale | Tuesday | 4 | Dal Cortivo | 3AM (5) | Aula Magna |
| Succursale | Thursday | 3 | Dal Cortivo | 3CI (5) | Aula Magna |
| Succursale | Friday | 3 | Saccoccio | 3DI (7), 5EI (3) | Aula Magna |
| Succursale | Friday | 4 | Saccoccio | 5BM (1), 4CI (6) | Aula Magna |
| Centrale | Monday | 4 | Presta | 2AC (2), 5BE (4) | Aula Lingue |
| Centrale | Monday | 5 | Iorio | 1AST (10), 2CE (5) | Aula 20 |
| Centrale | Tuesday | 4 | Saccoccio | 4CE (6) | Piano seminterrato |
| Centrale | Tuesday | 5 | Saccoccio | 4BE (5) | Aula Lingue |
| Centrale | Wednesday | 2 | Iorio | 4AC (4), 3DE (9), 1FST (14) | Aula 1FST |
| Centrale | Wednesday | 3 | Iorio | 1EST (5), 2BE (10) | Aula 20 |
| Centrale | Thursday | 3 | Saccoccio | 1CST (9) | Aula 20 |
| Centrale | Thursday | 5 | Saccoccio | 3FB (6), 3AES (6) | Aula 20 |
| Centrale | Friday | 2 | Iorio | 1GST (9) | Aula Lingue |
| Centrale | Friday | 5 | Iorio | 1BE (10) | Aula Lingue |

The transcription contains **15**, not 14, slots: Centrale 10 and Succursale 5. Totals: Iorio 5, Saccoccio 6, Dal Cortivo 2, Presta 1, Corrà 1. The earlier conversational count of 14 incorrectly summed the five teacher totals. Use 15 as the fixture and entry-checklist total. Exclude all seven autonomous-study entries (Succursale 3, Centrale 4).

## Risks / Trade-offs

- Independent occupancy consumers can disagree → reuse a shared active-group lookup and verify candidate lists, availability, exports and historical facts together.
- Conflicting imported activity may already occupy a requested slot → retain data, visibly flag the overlap and resolve against authoritative server data before entry.
- Unknown institutional absence procedure → retain “Da valutare”; do not present these items as covered or uncovered.
- Dated identity changes or incompatible archives → validate references, preserve recorded facts and reject malformed imports atomically.

## Migration Plan

Add an empty backward-compatible document on demand without operational seed data or destructive migration. Verify unit/API/frontend behavior on temporary databases and one unique isolated compose.testing.yaml project; confirm mount, allocated port, testing API and red ribbon before mutations, and stop that project afterward. Deploy implemented code using ./scripts/deploy.sh and verify the release read-only. Before any operational schedule entry, obtain the effective date and resolve the checklist against actual teachers, classes and overlaps. Use supported office editing rather than startup seeding. Rollback restores a compatible build and preserves records/backups; an older build must not overwrite new archive data.

## Open Questions

The user confirmed start date 2026-11-16; no end date was supplied, so the requested entries remain open-ended. The school's absence procedure remains deliberately unresolved under the agreed “Da valutare” behavior.

## Confirmed operational entry — 16 November 2026

Start 2026-11-16, no end date supplied. Wednesday period 3 is 1EST (5). The user confirmed catalogue mappings 1GST → 1GS and 3AES → 3AE. Production entries are explicitly authorized after implementation and deployment.
