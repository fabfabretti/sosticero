# Proposal

## Why

Banca ore counts paid substitutions but cannot show their financial cost or how much of each sede's funding has been committed. Administrators need optional budgets and automatic hourly pricing, while operators need a clear register without duplicated inline summaries.

## What Changes

- Add administrator-managed optional budgets and laureato/diplomato hourly rates for Centrale and Succursale under Amministrazione → Configurazione.
- Default ITP teachers to diplomato pricing and other teachers to laureato pricing, with an administrator classification override for exceptions.
- Store each assignment’s calculated rate and recalculate all stored paid assignments whenever an administrator saves rates or classification settings. Clearing an applicable rate makes those assignments unpriced.
- Derive costs from saved paid assignments, including future ones, charging the substitution's sede. Budgets cover all stored records, with no school-year model or reset.
- Warn when assignments exceed a budget, but allow them.
- Show committed cost, remaining budget and uncapped usage percentages per sede and overall in Banca ore. Clearly distinguish unconfigured budgets and unpriced assignments.
- Keep one detailed paid-assignment table with monetary values; remove the repeated inline teacher totals.

## Capabilities

### New Capabilities

- `paid-substitution-budgets`: Optional campus budgets, rate classification and snapshots, initial pricing, soft overspending warnings, financial summaries and a single financial register.

### Modified Capabilities

None in the main spec inventory. The existing `paid-substitutions` capability currently lives in the unarchived `add-paid-hour-bank` change. This change depends on that implemented behavior and explicitly supersedes its requirement to show separate per-teacher totals; implementation must reconcile that register wording when the capabilities are synchronized, without editing the unrelated change during this planning step.

## Impact

Backend paid accounting, assignment transactions, configuration authorization/concurrency, state persistence and archive validation; frontend administration configuration, teacher classification controls, assignment feedback and Banca ore. Existing paid-hour counts, candidate fairness, notification metadata and campus permissions remain applicable. No payroll integration, school-year tracking, automatic resets or new external dependencies. The example €3.406,12 budget and €31,11/€28,74 rates are configurable examples, not production defaults.
