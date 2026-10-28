# Design

## Context

See proposal.md for motivation. Banca ore is currently a Shell placeholder. CandidateDrawer uses teacher ID for keys, current selection and assignment callbacks; domain.candidates uses ordinary eligibility OR recovery eligibility, which permits only one choice per teacher. Assignment validation also resolves by teacher alone. Those assumptions must change together.

Assignments live in state.asg and already carry category and RP links. main.assign serializes mutations with BEGIN IMMEDIATE, checks record preconditions and derives campus permission from the row. RecoveryActions provides per-row clipboard feedback and an Accettata action; paid communication needs its own Avvisato meaning. backend.availability is a theoretical timetable report using neutral daily state, not actual live capacity. Its specification currently exists under add-stats-timetable-availability rather than main specs.

## Goals / Non-Goals

**Goals:** Extend the existing assignment pipeline without a second accounting ledger; make category choice unambiguous end to end; share campus calculations across grid, candidate and report views while respecting their different daily-state semantics.

**Non-Goals:** A generic notification framework, a separate payroll subsystem, school-year partitioning or rewriting unrelated active changes. No operational database edits during development.

## Decisions

### Persist declarations; derive paid counts from assignments

Add a paidAvailability state map keyed by weekday and teacher, holding distinct periods. Validate weekdays 0–4, periods 1–7 and known teacher references; allow historical references to retired teachers but forbid new active declarations for them. Read absent legacy fields as empty. Add a paid-substitution backend module for declaration validation, campus eligibility and assignment-derived summaries. Avoid a separate ledger that can drift from Supplenze.

Use a dedicated PAID assignment category. Store assigning account identity from request authentication (currently campus accounts), notified boolean and sufficient saved row context for readable historical register entries. Keep existing assignment context mechanisms where available. Counts come from all saved PAID assignments, including review-flagged or future ones; no completion state or time-based mutation. An identical save preserves provenance and notification; a replacement resets them.

### Make category an explicit selector without changing legacy inference

Extend the candidate/callback/request contract with the selected category. UI keys and current-choice comparisons use teacher ID plus category, including consultation and candidate refresh paths. Validate an explicit PAID choice using paid eligibility, not whichever candidate with that teacher ID is found first. Existing requests without category keep ordinary/RP inference; they cannot accidentally select PAID. Preserve unchanged RP link handling and add corresponding unchanged PAID handling. A switch of category for the same teacher is a replacement, not an identical resave.

Append paid candidates independently of the ordinary-or-RP branch, so eligible RP and PAID choices can coexist. Place the paid group between favourable and other recovery groups; sort that group only by paid count, displayed name and ID. Keep the other ordering rules unchanged. Use one transaction for replacement, debt release/consumption, global teacher booking and paid metadata.

### Reuse travel rules without requiring recovery favourability

Reuse the travel checks underlying rp_context, extracting only the small shared calculation if needed. Paid eligibility checks both sides of a slot and breaks 2–3/4–5 but does not require debt or proximity. Consider lessons, receptions and, for actual assignment validation, other assignments and relevant operational state. Unknown sites produce an uncertainty marker; known travel conflicts still reject. No commitments means both campuses.

The weekly grid needs dates because timetable versions and overrides are dated. Add a reference-week selector defaulting to today in Europe/Rome, with dated weekday headers; declarations remain recurring, not week-specific. Grid and Stats use neutral operational state for timetable feasibility. Show declared but occupied/incompatible slots with a reason so users can remove declarations instead of silently losing them. Candidates use real daily state and hard restrictions.

### Keep existing permission and concurrency boundaries

Both accounts can edit shared declarations. Use per-teacher/weekday declaration tokens with the existing publication generation guard, avoiding a whole-grid last-write-wins save. Assignment mutations and Avvisato use the existing row-campus permission and assignment precondition path. Attribution is server-written; clients cannot forge it. Banca ore uses quiet refresh and preserves active edits on remote updates.

### Reuse the request interaction without conflating acceptance

Provide a small paid message formatter and paid action control using the existing clipboard/feedback and permission presentation patterns. It generates one request with payment wording, date, period, class, campus and room or a visible fallback. Expose Avvisato and the copy button only on the Supplenze table row, following the permit recovery pattern and using the saved assignment and precondition. The Banca ore register displays notification status without either action control. Avvisato is distinct from RP accepted and entry/exit communicated fields. Copying neither sends an email nor toggles notification. Follow current sender/signature conventions rather than adding settings.

### Extend theoretical Stats as a third mode

Replace the frontend recovery boolean with an explicit ordinary/recovery/paid view mode. backend.availability adds paid teacher opportunities and uncertainty/campus data alongside ordinary and recovery lists. Deduplicate by teacher identity across categories and campuses for counts, while retaining category explanations in tooltips. Existing named-campus rules remain for ordinary/RP entries; uncertain paid entries count in either campus with a warning, as they are assignable there after manual checking. Preserve the POT denominator, report date independence and print behavior; update the method text to describe theoretical paid opportunities.

### Keep storage consumers compatible

Extend state defaults, archive export/import schema and validation, concurrency snapshots, assignment validation/review, statistics category handling and typed frontend assignment/candidate contracts. New archives must round-trip PAID and its metadata; old archives remain valid. Never infer historical paid work from timetable availability. Validate all input atomically and ensure saved PAID assignments remain paid when timetable/declaration eligibility changes. Existing exports/displays that enumerate categories must render paid work coherently.

## Risks / Trade-offs

- Duplicate teacher IDs in the drawer can select the wrong category → carry teacher/category through every caller, key, current marker and refresh; regression-test both clicks and same-teacher switches.
- Timetable changes can invalidate travel → preserve accounting and show review issues; never silently refund or recategorize saved paid work.
- Unknown campus may conceal an impossible journey → retain the agreed selectable Sede da verificare warning in grid, drawer and report.
- Theoretical Stats intentionally includes absent/booked teachers → preserve the existing explanation and distinguish it from actual candidate eligibility.
- Other unarchived changes touch shared integration files → preserve their work, and add the paid Stats extension without duplicating their main capability ownership.

## Migration Plan

1. Introduce backward-compatible empty declaration defaults and PAID schema validation; preserve existing records and import-time side-effect protections.
2. Implement transaction/API and UI changes with isolated temporary databases; test archive round trips, concurrency and permission denial before browser verification.
3. Build/recreate only an isolated compose.testing.yaml project with a unique TEST_PROJECT and mktemp TEST_DATA_DIR; inspect mounts/allocated port, verify testing:true and the red ribbon before mutations, and tear down that project afterwards.
4. Deployment is a later authorized action through scripts/deploy.sh. Snapshot/restore uses existing deployment procedures. A downgrade after paid data exists must use a compatible snapshot or a paid-aware version; do not feed new paid archives to an older unaware release.
