# Design

## Context

See proposal.md for motivation. SQLite currently stores JSON documents, including `state.permessi[date][teacher] = periods`, optional request-date maps and assignments keyed by date and substitution row. Assignment records already preserve category `t`. Assignment and permit writes use `BEGIN IMMEDIATE`; statistics are synchronized in the same transaction. Imports explicitly enumerate supported state groups. The working tree also contains the statistics feature, which must be preserved and integrated rather than overwritten.

## Goals / Non-Goals

**Goals:** Stable accounting under edits, concurrency, retrospective entry and timetable replacement; backward-compatible operational data; reuse existing SQLite transaction boundaries.

**Non-Goals:** General payroll accounting, monetary conversion, automatic assignment, deadline extensions, and a full relational database rewrite.

## Decisions

### Retain period maps and add stable identity metadata

Keep the existing permit period and request-date maps to avoid disrupting derived absences and existing clients. Add `permitIds[date][teacher] = stable-id`, managed together with the existing maps, with one unique ID per permit. Move that ID on valid date edits. Store `permitId` on RP assignment records only. This is a narrow extension of current document storage; a new permit object schema or SQL tables would require broader changes without improving transaction safety here. Centralize validation of map consistency, ID uniqueness, link ownership and capacity.

The deadline is derived with calendar arithmetic, clamping the day to the target month's length; do not persist a redundant deadline. The valid window uses the permit date through the deadline inclusive. Date-level eligibility permits recovery on the permit date in a different, otherwise eligible hour.

### Assignment links are the recovery ledger

Count one hour per stored RP assignment linked to a permit. Derive per-permit recovered, remaining, dated details and teacher-level summaries in the backend. Do not maintain mutable balance counters or dynamically redistribute historical links. Oldest-first applies only to new assignments; adding a backdated permit cannot rewrite history. Future assignments reserve capacity immediately and remain clearly dated in the register; there is no separate completion workflow in the app.

Compute a permit usage index once per candidate-list request rather than rescanning every assignment for every teacher. Dates determine eligibility; the current Rome date is used only for register expiration presentation. All existing reservations count toward capacity, including future dates.

### Validate replacement against released capacity

Inside the existing immediate transaction, temporarily exclude the assignment being replaced when checking available capacity, validate the replacement, then save and synchronize statistics. Rollback restores everything on failure. Preserve the permit link for an unchanged RP assignment. New assignments receive a server-selected link; clients cannot choose arbitrary permits. Existing-assignment validation uses its stored category and linked permit, excludes itself from consumption checks, and preserves historical eligibility captured by statistics. A review flag does not alter accounting.

Protect linked permits against deletion, teacher changes, insufficient capacity and date edits excluding a linked recovery. Do not silently move recoveries to another permit. Explain how the office can resolve the affected assignments first.

### RP supplements free hours

Try existing normal eligibility first. RP applies only when the timetable has no activity at that hour and no manual or automatic availability category applies. A hidden or unavailable scheduled activity cannot become RP. Add explicit RP label and styling, eligible-hour information and a convenience explanation to the drawer; RP is computed behavior, not an imported activity or an hour-type setting.

Use ordered groups: convenient selectable RP, existing choices in their existing order (including occupied exceptions), then other RP. Keep existing load/name/ID tie breakers within RP groups. Disabled candidates do not outrank selectable choices. The exceptional heading must remain attached only to exceptional candidates when RP follows them.

### Convenience and travel are distinct checks

Teaching periods with classes establish adjacency or an internal gap; other scheduled activities do not create good-hour anchors. Use that day's effective teaching, excluding absences and released classes. Existing substitutions and scheduled activities are commitments for travel validation, even when they do not create convenience. Check the nearest preceding and following commitments around the requested period. Different known campuses require a break boundary `b` in `{2, 4}` with `earlier <= b < later`. Both transfers must pass. Missing site information cannot establish a convenient RP classification; retain explanatory uncertainty rather than inventing a campus.

Examples are specified in the candidate-selection delta. An RP hour on a day without teaching remains a bottom-list option. Existing substitutions constrain travel but do not extend the teaching-based good-hour window.

### Portable state with validated links

Add identity metadata to `EMPTY`, load/migration and import/export paths. New exports carry a distinct archive version for recovery-aware data so older application versions reject rather than silently discard identity metadata. Continue accepting current schema-1 archives without recovery data; assign IDs transactionally after full validation. Reject RP records without valid links instead of guessing history. Validate reference integrity, capacity and recovery windows independently of today's timetable; preserve historical RP assignments after timetable imports.

## Risks / Trade-offs

- Parallel metadata maps can drift → one migration/validation helper and transactional mutations for all permit paths.
- Last-hour recovery appears unavailable during revalidation → distinguish saved-assignment validation from new candidate eligibility and exclude self.
- Future booking consumes capacity before work happens → display substitution dates and release reservations on explicit cancellation; no separate completion state in this scope.
- Cross-date balances affect other candidate lists → refresh summaries after edits and always recheck server-side on save.
- Old application loses new metadata → version new exports; prohibit rollback writes against recovery-aware data.

## Migration Plan

1. Verify migration and behavioral tests on a fresh isolated database and legacy fixtures. Migration creates missing stable IDs once, preserves all periods/request dates/assignments, and creates no RP recoveries.
2. Exercise backup/archive round trips, invalid-link rejection, protected edits, replacement and concurrent final-hour requests.
3. Build and run an explicitly selected temporary Compose override replacing the entire `/data` mount. Verify the mount before behavioral checks. Use SQLite online backup if realistic data is required.
4. Restore the normal deployment with build and force-recreate, verify the project data mount and updated served asset hash using read-only checks.
5. Preserve a pre-upgrade backup for rollback. Restoring it loses subsequent edits and requires explicit authorization; do not run an older writer against the upgraded database.
