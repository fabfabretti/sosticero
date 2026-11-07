# Tasks

## 1. Financial configuration and persistence

- [x] 1.1 Add nullable per-sede budgets/rates, stable teacher classification overrides and optional PAID pricing snapshots using integer cents; verify validation tests distinguish blank, zero, invalid booleans, negatives and unknown identities without module-import database side effects.
- [x] 1.2 Implement administrator-only financial read/save APIs with content preconditions and publication-generation protection; verify admin-only accounts can save, operators cannot, and stale saves conflict without partial changes.
- [x] 1.3 Extend archive versioning, defaults, validation and database restore compatibility; verify legacy archives load unpriced and new archives round-trip all financial data, reject malformed/nonpaid snapshots atomically and preserve retired teacher references.
- [x] 1.4 Document configuration fields, role defaults, cost persistence and legacy archive behavior in the Banca ore data documentation; verify documented names match the implemented API and schema.

## 2. Assignment costing and budget accounting

- [x] 2.1 Resolve ITP/default/override classification and snapshot the substitution sede's current rate on new paid choices inside assignment transactions; verify cross-sede rates, dated roles, future bookings, zero-rate work and unchanged metadata saves with backend tests.
- [x] 2.2 Atomically recalculate all stored paid assignment costs on each explicit financial configuration save; verify first-save costing, changed tariffs and classification overrides updating past/future costs, cleared tariffs producing unpriced hours, unchanged-save idempotence, coherent statistics and concurrent assignment creation against isolated databases.
- [x] 2.3 Derive per-sede and combined financial summaries from assignments, preserving hour-based candidate ordering; verify €59.85 against €3406.12 yields €3346.27 remaining and approximately 1.76%, plus removals, category switches, incomplete costs, zero/missing budgets and week-independent totals.
- [x] 2.4 Return authoritative advisory over-budget feedback from successful assignment writes; verify a valid €31.11 booking against €90/€100 saves and reports €21.11 overrun, while existing eligibility and campus permission failures still reject.
- [x] 2.5 Document recalculation triggers, all-record accounting and soft-limit behavior; verify examples match backend response fields and regression tests preserve author/notification data and global booking constraints.

## 3. Administration and Banca ore interfaces

- [x] 3.1 Add budget and rate controls to Amministrazione → Configurazione with optional Italian euro inputs and classification override/reset controls; verify saved values, admin-only access, inline validation, stale-draft preservation and recalculation result feedback in frontend tests.
- [x] 3.2 Add per-sede and overall financial summaries with explicit scope, incomplete-cost indicators, no fabricated percentages and uncapped overrun text; verify positive/zero/missing budgets and one-sede-only aggregate labels in frontend tests.
- [x] 3.3 Keep one detailed paid-assignment table with rate/cost or unpriced labels and remove inline teacher totals; verify existing columns, ordering, recurring grid, PDF availability export and quiet refresh remain functional.
- [x] 3.4 Surface successful assignment overrun warnings accessibly without a new confirmation step; verify save success and warning persistence are visible, including on narrow layouts and in both themes.
- [x] 3.5 Update user-facing Banca ore documentation for configuration, historical recalculation and reading usage; verify terminology matches the final screens and clearly states that future assignments count and no school-year reset exists.

## 4. Integrated verification and release

- [x] 4.1 Run relevant backend/frontend regression suites and frontend build with isolated temporary databases; verify archive compatibility, concurrent financial edits and preserved assignment workflows pass without touching operational data.
- [x] 4.2 Export a unique TEST_PROJECT and mktemp TEST_DATA_DIR; start only compose.testing.yaml using LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose -p "$TEST_PROJECT" -f compose.testing.yaml up -d --build --force-recreate. Inspect its mount and allocated non-8000 port, verify /api/environment returns testing true and the red TESTING ribbon before mutations; exercise configuration, historical pricing, overrun and single-register behavior, then stop only that project and verify cleanup.
- [x] 4.3 Deploy the verified feature with ./scripts/deploy.sh and verify release identity, served asset hash, environment and operational mount using read-only checks; do not configure sample production values or trigger pricing through deployment checks.

## Workflow follow-up

- Reconcile the superseded separate-teacher-total wording in the paid-substitutions capability when synchronizing/archiving the related changes, preserving the rest of its register contract.
- Ask the user whether to commit before creating any commit; existing unrelated work must remain intact.
