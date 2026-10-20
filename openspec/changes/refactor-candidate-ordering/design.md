# Design

## Context

See proposal.md for motivation and the candidate-selection delta for the behavior contract. `backend/domain.py` currently has a category/campus numeric table plus an independent sort tuple that globally demotes exceptional and blocked candidates. Custom activity codes fall through to TC priority. The drawer renders backend order but inserts headings using neighbouring types; the main-page explanation describes a different hierarchy. Policies already expose available, visible and school. CDC is currently teacher metadata, not a per-lesson field.

## Goals / Non-Goals

**Goals:** One readable backend ranking decision, consistent API/profile metadata, and frontend explanations that reflect that decision. Keep candidate eligibility, ranking and assignment validation distinct.

**Non-Goals:** A generic rules engine, configurable priorities, new dependencies, database/schema changes, school-year filtering, permit accounting changes or expansion of CDC import semantics.

## Decisions

### Use an explicit tier function and one sort key

Replace PRIORITIES and the competing outer exception/block sort with named tier values and a small pure classification function. Candidate generation carries only the effective policy facts needed for classification. Use one key: tier, RP convenience subgroup, class-or-CDC affinity, today, total, casefolded name, ID. Hard-block flags never move an entry. Avoid a second ranking implementation in React, generic rule registries or scattered numeric adjustments.

Compute workload counts once per candidate-list request if needed for the refactor; preserve their current meaning and selected-candidate validation path. Review callers and tests importing PRIORITIES rather than retaining a misleading compatibility constant.

### Keep policy application explicit

Preserve manual/automatic availability precedence, activity-code precedence and restrictive multi-code visibility/availability. Resolve visible same-class ITP/support compresenza first; other unavailable commitments require school membership and explicit exceptional confirmation. Treat the school checkbox as in-school metadata, independent of campus. For multiple unavailable activity codes, require all applicable policies to mark school membership true before offering the exceptional candidate; false or unset must not imply an in-school fallback. Disabled timetable hours remain exceptional and cannot be promoted through normal availability.

Resolve fixed locations for DIS/UTC/UTS and retain released-lesson and manual DISP location behavior. Same-campus UTC/UTS use tier 5; different-campus UTC/UTS share tier 6 with cross-campus available activities. Dirigente remains a manual tier-5 action. Unknown target campus also means an unknown campus relationship for activity classification.

### Derive affinity from the selected replacement context

Retain `inClass` from the effective week's teaching classes and add a boolean CDC match in the Candidate response/type. Compare the candidate's nonempty CDC with the teacher owning the selected substituted lesson, resolved through row ID and selected date/hour; never scan other absences to find a convenient match. In grouped co-absence rows, use the existing canonical row owner as the target rather than matching any absent CDC; this is a proposed deterministic edge-case default given that the API exposes one row key and CDC is teacher-level. Both booleans give one equal ranking preference and independently control the two labels.

### Render the backend decision

Update CandidateDrawer, Candidate type and existing styles for a small decorative star plus readable Italian labels. Keep profile details, keyboard operation, disabled reasons and confirmation behavior. Use semantic tier metadata if headings need it; keep grouping minimal and never infer RP sections solely from neighbouring `ty` values. Update the footer explanation in main.tsx. No new icon library or client sorting.

## Risks / Trade-offs

- Existing specs and tests encode conflicting legacy ordering → replace obsolete expectations with full ordered fixtures and API-level policy cases.
- Grouped rows and teacher-level CDC cannot express subject-specific lesson CDC → compare the canonical substituted teacher only; record this limitation without inventing data fields.
- Multi-code hours could depend on input token order → test restrictive policies and deterministic category selection explicitly.
- Excluding visible unavailable types without school membership changes previous visibility semantics → preserve stored assignments; apply filtering to new choices and validation only.
- Blocked entries can appear above selectable teachers → retain clear disabled reasons as explicitly requested.

## Migration Plan

No data migration. Verify pure domain/API cases against temporary databases and frontend tests/build. Behavioral container verification must use a unique TEST_PROJECT and mktemp TEST_DATA_DIR with standalone compose.testing.yaml; inspect its mount/allocated localhost port and verify /api/environment returns testing:true before mutations, plus the red TESTING ribbon. Stop only that test project afterward. Normal service must stay on data/supplenze.sqlite. Deploy an approved implementation using the repository's normal build-and-force-recreate command and read-only mount/bundle checks. Rollback is code/image rollback; never copy test data into operational storage.
