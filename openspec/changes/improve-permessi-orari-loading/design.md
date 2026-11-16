# Design

## Context

See proposal.md for motivation. `/api/permessi` calls `load`, then reads history again and calls `appointments.timetable_versions`, producing full datasets at all import, appointment, absence and override boundaries. The browser selects one such dataset for teacher suggestions, scheduled-hour warnings, daily limits and sites. The table scans whole lesson maps repeatedly for those answers. Recovery summaries and concurrency tokens are separate and must remain unchanged.

Orari receives complete imported/effective datasets, builds teacher grids with `buildTeacherTimetables`, and mounts every filtered card in one render. PDF generation already consumes complete data independently of mounted tables. `useQuietRefresh` protects active drafts and runs polling; its semantics are outside this change. The existing loading-feedback change remains independently in progress.

## Goals / Non-Goals

**Goals:** Reduce permit response construction/serialization and browser lookup work while preserving every visible result. Split Orari mounting into interruptible batches without changing the complete underlying data.

**Non-Goals:** New Permessi date requests, sidebar redesign, server pagination, a new revision protocol, database migrations, changed permit rules, or shared refresh refactoring.

## Decisions

### Compact historical permit context in the existing response

Keep one consistent read transaction and one response. Read history once for this handler, resolve each distinct boundary once through the existing effective timetable resolver, project it immediately, and discard the full resolved dataset. Reuse the selected projection for current context rather than resolving today redundantly where possible. Preserve the initial boundary and appointment/absence/override start and end semantics. Do not introduce cross-request caching or a separate resolution algorithm.

The compact projection contains only teacher fields used by the screen (including displayed/search names and retired/unavailable status), scheduled hour numbers by teacher and weekday, and each teacher's weekly Centrale/Succursale site set. Include all scheduled activities exactly as the existing lesson lookup does, even if they have no class or are disabled; do not substitute candidate eligibility rules. Weekly sites must retain the existing semantics rather than accidentally becoming selected-weekday sites. The response retains the current teacher catalog for manual balances and historical display names, plus all existing permit metadata, recovery summaries and concurrency baselines.

Replace `permitDataset`, `scheduled`, `dailyMaximum`, suggestion and site consumers with compact lookups while leaving controls, pagination, edit/reset behavior and save requests intact. Full historical lesson payloads are removed from this endpoint. Inspect all endpoint consumers/tests and update them together. Historical projections still require effective resolution per boundary; this design does not claim to eliminate all historical computation. Compared with lazy date fetching, this preserves instant date switching and the agreed UI.

### Progressively mount Orari cards from complete data

Keep the API and complete grid/search model. Render a small initial prefix of the filtered list, then extend the prefix using cancellable scheduled batches that yield to browser paint and input. Use a bounded timer/frame scheduling mechanism that continues without scrolling or idle-only starvation; choose batch size from the isolated browser measurement rather than a dependency. Keep stable teacher IDs as keys and append after existing cards. Own the batch counter in a child component so progressing the prefix reuses existing card elements instead of rerendering the page. Reset progress on scope changes, including clearing a filter after a completed list.

Search always filters the complete list before batching. Reset the prefix for a different filter or date; cancel obsolete scheduled work on replacement/unmount. Preserve or increase the visible prefix for same-date refreshes rather than restarting it. Existing draft and request ownership protections remain in force. A small accessible end status indicates remaining rendering, without placing already accepted data behind the foreground loading blocker. Avoid announcing every appended teacher. Reuse existing loading styles and reduced-motion behavior.

Export continues to use the complete saved dataset and existing readiness/draft guards. The progressive list must never become the export source. Browser Find only sees mounted cards until automatic rendering completes; application search remains complete immediately. Keeping all eventual cards retains memory/DOM cost after completion, but improves initial responsiveness without virtualization's editing and scroll complexity.

### Verify equivalent results and measure actual gains

Before changes, use reproducible isolated representative data with many teachers, permits and historical boundaries to record server preparation/serialization time, plain and compressed response bytes, browser first usable content and main-thread responsiveness. Repeat under matching conditions after changes; report observed values without promising an unmeasured production speedup. Require smaller permit payloads and demonstrable early usable Orari cards with yielded work. If permit construction remains dominant, report the measured residual rather than broadening into caching or revision work.

Compare compact results against the current resolver across baseline/import/staffing/absence/override boundaries, before/after end dates, retired teachers and mixed activities. Keep recovery and concurrency regressions. Note the main permit spec's old one-month deadline text differs from the current two-month implementation and later change artifacts; this optimization preserves the current implementation and does not amend that unrelated rule.

## Risks / Trade-offs

- Missing projection fields could alter suggestions or historical warnings -> enumerate every frontend consumer and compare projected answers against existing full datasets.
- Same-date refresh or appending can disturb an active card -> preserve stable keys, mounted prefixes, draft deferral and existing scroll anchoring; verify in a browser.
- Scheduled batches can leak across selections -> cancel scheduled callbacks and guard their ownership by current list/date scope.
- Network or initial grid computation can still delay first content -> measure them separately; progressive mounting only addresses rendering after data arrives.
- Endpoint shape changes require matching frontend code -> release both together; old already-open clients need a page reload.

## Migration Plan

No data migration or data rewrite. Verify backend/frontend regressions and production build, then use a unique isolated `compose.testing.yaml` project and temporary database, verifying its mount, allocated port, testing environment and ribbon before mutations. Use synthetic fixtures or SQLite online backup into a checked new temporary destination if realistic data is needed. Stop only this test project after verification. Deploy with `./scripts/deploy.sh`, then perform read-only release/source/assets/environment checks on atlante. A code rollback requires no operational-data restoration for this change. Ask before committing.

## Initial-load correction after the first deployment

Read-only production profiling identified a cost absent from the original synthetic fixture: a nonempty staffing document makes the resolver deep-copy all lessons and then deep-copy each lesson again. Preserve fully detached results while excluding lessons from the first bulk copy, retaining the existing per-lesson copy and separate excluded-POT copy. This changes no resolution rules or cache behavior.

Representative full API measurements also include redundant generic response conversion. The two read handlers construct JSON-native values only; return an explicit JSON response so those dictionaries are encoded once, without FastAPI's recursive conversion pass. Keep authentication, headers, consistent read transactions and returned JSON unchanged. Compare complete responses on an isolated online backup, not only payload sizes.

Progressive mounting alone still eagerly constructs every card's contents in the parent. Wrap each card's render callback in a lightweight component so its contents are constructed only when that component mounts. Keep complete search/grid data and PDF projection unchanged; the existing child-local progress continues to preserve mounted card elements between appends. Verify that later teachers' cell data is not read before their batch appears.

## Approved navigation-cache follow-up

The earlier exclusion of shared refresh work is superseded only for opt-in caching on Supplenze, Permessi and Orari. Store response objects and receipt timestamps by endpoint in a bounded in-memory map. Hydrate before paint, retain cached content during stale revalidation, and measure refresh age from the last successful response rather than navigation. Share pending reads; an invalidation epoch rejects obsolete reads after writes or session changes. Preserve active-draft deferral, scope ownership and scroll restoration. Explicit refresh after saves bypasses freshness. Clear snapshots on successful mutating requests and session identity/permissions or database-generation changes; routine auth polling must not clear an unchanged session. No localStorage, backend changes or mandatory prewarming.

## Approved cache extension

Apply the existing session-memory cache to Banca ore, the main statistics report and its A disposizione report. Key each response by endpoint and all effective date/campus/period parameters (including today for relative periods). Preserve forced retries and refresh after saves. Enable 15-second quiet polling for valid statistics selections; invalid ranges remain blocked with validation feedback. Reuse existing write/session invalidation and editing protections.
