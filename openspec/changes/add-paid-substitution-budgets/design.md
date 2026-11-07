# Design

## Context

See proposal.md for motivation. `backend/paid.py` derives counts and the register from `state.asg`; `paidContext` preserves the substitution site, room and class. Assignment mutations in `backend/main.py` use serialized writes and preserve unchanged paid metadata. `backend/concurrency.py` provides content preconditions. State lives in SQLite documents, and archive export currently uses schema 10.

`frontend/src/PaidHours.tsx` renders both inline per-teacher totals and the detailed register. Its week selector controls recurring availability only; accounting already spans all saved assignments. Administration has configuration and teacher-management areas. Teacher records expose role and stable identity, not verified academic qualifications. The existing `paid-substitutions` spec is still owned by the unarchived `add-paid-hour-bank` change, including a now-superseded requirement for separate per-teacher totals.

## Goals / Non-Goals

**Goals:** Extend assignment-derived accounting with exact money, recalculable recorded costs and optional financial controls, reusing current authorization, transaction and archive boundaries.

**Non-Goals:** A second ledger, payroll calculations, statutory qualification verification, school-year entities, changing candidate fairness based on money. Existing weekly PDF remains a recurring-availability export; a financial PDF is outside this change.

## Decisions

### Store exact cents and optional settings

Add a persisted financial configuration document with per-site nullable budget and nullable laureato/diplomato rates, plus classification overrides keyed by stable teacher ID. Use nonnegative integer cents internally and over the API, rejecting booleans and invalid values. Convert locale-aware euro inputs at the UI boundary without floating-point accounting. Blank is null; zero is deliberate. This avoids rounding drift and the ambiguity of a zero default. No external dependency is needed.

Use an admin-only configuration endpoint with a configuration content precondition and publication-generation guard. Save the configuration and any initial pricing in one `BEGIN IMMEDIATE` transaction. Return a useful count of assignments priced and still unpriced. Expose the editor in the existing configuration UI and a compact classification exception editor; do not modify imported timetable roles to represent payroll exceptions.

### Store calculated money on paid assignments

Add a small optional pricing snapshot to each PAID assignment containing integer amount cents and applied classification. One assignment already means one hour, so no duration engine or separately editable cost is needed. Save it server-side using the authoritative row site and applicable teacher classification. Resolve role from the assignment's effective dated teacher dataset; use the retained identity catalog as fallback for historical teachers, and leave genuinely unresolved records unpriced.

Preserve calculated values through identical assignment saves, Avvisato/acceptance changes and timetable review. Every explicit financial settings save recalculates past and future records using current rates and classifications, as requested by the user during apply. Clearing a tariff removes the affected stored costs and marks those hours unpriced. Removing or switching away from PAID removes the contribution naturally. A replacement paid teacher/category is newly priced. Persist calculated values so archives and reports agree without database writes on reads.

### Recalculate all prices on explicit configuration saves

Inside each financial-settings/classification save, recompute every PAID assignment with resolvable site/classification and configured rate, replacing any previous amount or classification. Remove previous prices when an applicable rate or context is unavailable. This applies to all stored records, including future assignments. Zero cents is an explicit configured rate, not a missing value. No module-import, read-endpoint or background recalculation is allowed. Imported prices are preserved until the next explicit administrator settings save.

Serialize this operation with assignment creation so concurrent creation either precedes recalculation or sees the new committed settings. Configuration preconditions detect competing admin edits; assignments retain their own record preconditions. Recalculated assignments change their tokens, so a stale operational editor must reconcile. Refresh the stored statistics assignment copies within the same transaction so financial archive round trips remain coherent. Report the count of changed prices/classifications and remaining unpriced hours.

### Derive financial summaries and warnings

Extend the paid report with per-site priced costs, unpriced-hour counts, budgets and derived remaining/percentage values. Sum all stored PAID assignments, including future and review-flagged records, using saved sites. Compute once per report, outside the weekly-cell loop. Keep `paid.totals` for candidate fairness even though its inline UI disappears.

Compute percentage against positive budgets only, show two decimals and never clamp the textual value at 100%. A zero budget shows percentage unavailable and positive spending explicitly over budget; a missing budget shows unconfigured. Mark any partial priced sum as incomplete when unpriced hours exist.

When both budgets exist, combine their priced costs and budgets; when only one exists, label usage as that configured sede only and show the other's cost separately. Also retain an all-sedi priced cost total. Unpriced work must never imply a complete or zero-cost total.

Return an advisory warning from successful assignment writes using final transactional accounting whenever the resulting target site is over budget. The frontend displays it without a second approval or rejection. Preview costs can assist users but do not replace authoritative save feedback. Existing assignment eligibility and permissions remain unchanged.

### Keep one register and existing interaction patterns

Place compact budget summaries near the Banca ore heading, clearly stating all saved records are included. Keep the availability grid and one detailed paid register; delete `paid-totals` rendering, not backend fairness counts. Add monetary rate/cost or a clear unpriced label to each row. Preserve authorship and notification columns, newest-first order and existing quiet-refresh/edit preservation. Use shared configuration disclosures, local validation, accessible warning/status text, euro formatting and contained scrolling on narrow screens.

### Version portable data together

Advance the archive schema from the then-current version rather than assuming schema 10 is still latest at implementation. Include financial configuration, overrides and assignment snapshots; extend defaults, validation and backup/restore paths together. Older archives have missing settings and unpriced PAID assignments, never guessed costs or copied example defaults. Reject malformed financial metadata and pricing on non-PAID records atomically. Preserve retired identities and foreign author snapshots.

At spec synchronization, reconcile the old paid register requirement to remove its separate per-teacher-total mandate; do not archive this new capability as though the contradictory old wording were still authoritative. This dependency is explicit in the proposal; the current planning changes no other change's files.

## Risks / Trade-offs

- ITP is a role proxy rather than verified qualification → label the default and allow an admin override; preserve applied classification historically.
- Partial configuration understates known financial exposure → disclose unpriced hours prominently and mark affected totals incomplete.
- Changing budget values changes percentages retrospectively → expected because there is one current budget covering all stored work; a saved tariff change also recomputes historical assignment costs.
- Recalculation touches assignment metadata while operators edit → use shared transactions and existing content preconditions, with conflict-preserving UI.
- Many existing uncommitted changes share these files → preserve them and update only the required integration points during apply.

## Migration Plan

1. Introduce missing-as-empty financial defaults and optional pricing snapshots without mutating operational assignments at startup or import time.
2. Verify exact costing, explicit repeated recalculation, concurrency, permissions and archive compatibility against isolated temporary databases.
3. Build and recreate only a unique `compose.testing.yaml` project with a `mktemp -d` data directory. Inspect mount and allocated localhost port; verify `/api/environment` returns testing true and the UI shows the red TESTING ribbon before behavioral mutations. Never use port 8000 or restart the old local operational app; remove only this test project afterwards.
4. After implementation passes, deploy with `./scripts/deploy.sh` and verify the deployed build/environment/mount with read-only checks. Deployment does not configure example budgets or trigger recalculation; the administrator's later settings save does that.
5. Roll back with a financial-data-compatible release, or use the deployment snapshot only through an explicitly authorized restore, since restoring would discard subsequent operational writes. Do not expose financial archives to an older incompatible importer.
