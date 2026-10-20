# Design

## Context

See proposal.md for motivation and the research-only scope. `timetables.dataset(history, day)` already resolves imported versions and timetable overrides into copies, retaining historical teachers as retired. Domain functions accept an explicit dataset. Recovery accounting uses teacher IDs, unique permit IDs and fixed assignment-to-permit links; it does not need a second personal ownership axis when people have different teacher IDs.

However, some API checks use raw imported versions rather than the resolved dataset: entries, inbox range validation, reference checks and permit history views are examples. Archive schema 5 validates teachers against imported history. A prototype resolver alone cannot demonstrate application-wide compatibility. Current application files also contain unrelated uncommitted changes; do not reset or edit them.

## Goals / Non-Goals

**Goals:** Test the separate-person model against actual pure scheduling/accounting functions; demonstrate a replacement lifecycle; identify exact integration gaps and historical ambiguities; give a reproducible go/no-go assessment.

**Non-Goals:** Production feature, operational data migration, frontend editing, API integration, production-ready archive schema, deployment, automatic name inference, partial timetable replacement, concurrent appointments for one source or one replacement, and replacement chains. Unsupported cases must be rejected explicitly in the prototype, not silently interpreted. These boundaries are experimental assumptions, not approved product restrictions.

## Decisions

### Isolate executable research from the application

Place all executable additions under `experiments/teacher_replacements/`. Use the standard library and existing installed backend dependencies. Use `TemporaryDirectory` for every SQLite database and backup; accept no arbitrary operational database path. Do not import fixtures by reading project data, initialize the production app, connect Google Sheets, add app imports of the experiment or monkeypatch production functions. Existing backend pure functions and the explicitly constructed temporary `Store` may be reused.

A standalone duplicate accounting engine would only prove its own assumptions. Reuse `recovery.ledger`, `eligible`, `validate`, `protect`, `summary`, and domain candidate/assignment/permit functions wherever their interfaces permit. Any additional adapter must be confined to the experiment and listed as unproven production work.

### Preserve one ID per person and one active schedule owner

Create synthetic person IDs in a namespace distinct from imported source IDs. Model an explicit source-to-original-person mapping and a separate replacement person. Do not decide whether a real imported ID belongs to the original or supplente from its label. Synthetic fixtures must exercise both mapping choices and disclose that real ownership requires review.

Use a prototype-only appointment with stable ID, source timetable ID, original person ID, replacement person ID, start and optional inclusive end. Names are editable labels, never identity. Validate references, ISO dates, collisions, overlapping appointments, cycles and accidental reuse of an already independently scheduled replacement. An empty appointment set must yield exactly the existing resolved dataset.

Start from `timetables.dataset` so existing timetable patches apply first. In a copy, map source lessons to the active person exactly once; never leave the source's same lessons on both people. Preserve room, campus, activity, disabled and class metadata. Keep inactive people addressable but unavailable for new candidate selection. Appointment expiry restores the original; it never removes the replacement's history or unpaid debt. Reuse the same replacement person ID on a later non-overlapping appointment to test debt continuity without name matching.

### Never infer historical record ownership from a changed appointment

Create synthetic permits, manual balances, absences and assignments using explicit person IDs. Preserve existing permit IDs and RP links. A name correction must not alter state or balances. Test debt before, during and after the appointment, including inclusive recovery deadlines and future reservations. Replacing a teacher does not pause or extend existing deadlines.

For backdating, shortening or removing an appointment, compute impacted dates and records before mutation. The prototype conservatively rejects changes that conflict with existing activity and returns those references; it does not rekey absences, transfer permits, repair assignments or discard evidence. Unused appointment deletion is permitted. Ending an appointment with historical records is distinct from erasing it; conflicting future assignments prevent a silent end-date change.

### Probe imports and inbox boundaries honestly

Re-resolve compatible same-source timetable imports with existing appointment IDs. Changed name/code/role metadata, missing sources, renumbered IDs and independently introduced replacements require review in this conservative experiment. No fuzzy remapping. Check changed overrides and their suspended groups before schedule inheritance.

Simulate incoming names without network access. Explicit aliases can suggest the appointment's active teacher, but a message naming the original can also describe that original person's own absence. Preserve that distinction: during an appointment, original-name submissions require explicit person confirmation; unique replacement-name submissions may resolve automatically. Colliding aliases and ranges crossing an appointment boundary require review. This deliberately questions the earlier suggestion that either name should always auto-match. Already accepted items keep their selected ID and are not reprocessed.

Record current raw-version API checks as integration gaps rather than bypassing them or claiming a prototype alias function validates the live Inbox flow.

### Separate persistence evidence from application archive compatibility

Round-trip the prototype envelope (people, mappings, appointments, imported history, overrides and operational state) through temporary SQLite storage and a clearly experimental JSON format. Validate all references and reject malformed data before transactional writes. Test a late validation error leaves stored documents unchanged. Use SQLite online backup for a temporary snapshot and verify reloaded permit IDs, ownership and balances.

Exercise the current application on a separate synthetic temporary database only if needed to reproduce a concrete API incompatibility. Do not extend its routes or archive format. A prototype round trip does not establish schema-5 compatibility; report the additional catalog, date resolution, validation and legacy-import work a production feature would require.

### Define the decision gate before running the experiment

The report must include commands, scenario results, source references, unchanged-state comparisons, adapter inventory, unresolved assumptions and a recommendation: reject, revise, or consider a separately proposed production change. A failed invariant remains visible; do not rewrite expected results to manufacture success.

Required evidence:

| Area | Decisive check |
| --- | --- |
| Baseline | No appointments yields equal datasets, candidate results, demand and accounting; unrelated teachers/dates stay unchanged. |
| Lifecycle | Before/start/end/after dates have exactly one schedule owner and correct candidate availability. |
| Accounting | Two personal permit sets and manual balances remain separate; wrong-person RP links fail; fixed links, deadlines and reservations survive renaming and reload. |
| Absences | Replacement absence creates demand once; original long absence does not duplicate demand during replacement. |
| Corrections | Conflicting backdates, deletion and expiry changes reject atomically; records are never reassigned implicitly. |
| Imports | Compatible import and timetable patches reach the active owner; missing/changed identities require review. |
| Inbox | Ambiguous original-name submissions, collisions and boundary-spanning ranges cannot silently select a person. |
| Persistence | Round trip and backup preserve identities; malformed references and late failures leave storage unchanged. |

Passing these checks establishes model feasibility only. A go recommendation must still identify all raw-version consumers and archive/UI changes, and explicitly defer production adoption to a new user decision and proposal.

## Risks / Trade-offs

- Pure-function success can conceal API incompatibility -> list current bypasses of the resolver and label simulated flows separately from actual application checks.
- The original's absence can incorrectly become the replacement's absence -> preserve person ownership; never transfer state through schedule inheritance.
- Inherited role or subject metadata may differ for the replacement -> make fixture metadata explicit and flag the production decision; do not silently copy personal qualifications.
- Historical source IDs already mix people -> test ambiguous pre-existing records and require review; no real migration in this change.
- Conservative rejection limits editing -> acceptable for research; measure the limitation rather than adding a production reconciliation system.
- An isolated successful experiment can be mistaken for rollout approval -> end with a decision report, no application hooks or deployment tasks.

## Migration Plan

None for application data. Adding and removing the self-contained experiment must leave app behavior and database format unchanged. All runtime data is temporary synthetic data, cleaned up after each run; retain only reproducible fixtures and the findings report. No containers are necessary because no served feature changes. Any later browser/container experiment would require a separate scope decision and the standalone testing Compose protections; never rebuild or recreate normal service for this research.
