# Design

## Context

See proposal.md for motivation. Timetable history already stores immutable imported datasets and resolves them by date in backend/timetables.py. Domain functions consume resolved datasets; import planning already previews impact and preserves conflicting assignment context. SQLite stores JSON documents. Archives currently use schema 4. TeacherTimetables currently fetches today's imported version directly and has no editing state. Existing type policies and CandidateDrawer already support exceptional assignment.

The completed, unarchived view-teacher-timetables change specifies read-only grids and type-based activity colours. This change explicitly supersedes those two behaviors with editing and campus styling; its remaining filtering, class labels, compresenza and accessibility requirements remain. Its capability is not yet a main spec, so this proposal declares the new durable timetable-overrides capability rather than targeting a nonexistent main capability. Reconcile that older delta when archiving changes; do not silently overwrite its artifacts during implementation.

## Goals / Non-Goals

**Goals:** One effective-date resolver, lossless original imports, atomic special-hour edits and swaps, deterministic import compatibility, recoverable historical evidence.

**Non-Goals:** A class timetable solver, class-linked activity movement, cross-teacher moves, campus editing, automatic assignment repair or new global hour-type settings.

## Decisions

### Store per-teacher dated patches in a separate document

Use a schema-tagged override document, separate from imported history, with stable record IDs, teacher ID, start/end, revision and reset records. Each saved revision describes the teacher's complete intended patch relative to its imported base, not a full copied timetable. Store original cell values/fingerprints and replacement values, including explicit emptied cells and disabled metadata. Preserve superseded revisions as evidence. Same-start editing creates a replacement revision rather than competing records. Empty patches do not create misleading MODIFICATO badges.

A connected set of touched cells is an atomic edit group: swap endpoints, move source/destination and subsequent dependent moves belong together. Compare all original cells, including empty destinations, when rebasing. This prevents half-swaps and duplicate activities. Independent toggles/moves remain independent groups. Full timetable copies would hide unrelated import changes; replaying raw drag gestures would make validation and rebase less predictable.

### Resolve imports first, then one applicable teacher patch

Extend the shared dated resolution boundary: select imported version, select the latest-start applicable override for each teacher, apply compatible groups to a copy, attach separate override metadata. Do not mutate imported datasets or teach import validation to accept arbitrary new lesson fields. A later overlapping teacher override replaces the earlier patch as a whole; expiry resumes the prior patch. Initialize a new draft from the effective view at its start date, capturing all intended differences from that date's imported base. Reset is a durable boundary suppressing earlier overrides from its date onward, including after temporary overrides expire.

Start defaults to today in Europe/Rome; end is optional and inclusive. Add an Orari view-date selector and fetch the resolved schedule and status for that date. Opening an edit at another start date reloads its applicable basis; never silently transplant a dirty draft. Future, active, ended and review-needed records remain discoverable through date selection and a compact per-teacher override list. Header status distinguishes a scheduled override from one in force.

### Server validates proposed edits and optimistic revisions

Add read-only preview and atomic apply operations for a teacher override/reset, and a dated Orari read. Preview validates ISO dates, teacher identity, allowed day/hour, activity-only sources, empty/special destinations, preserved activity payloads and revision fingerprints. Reject ordinary/class-linked lesson changes, duplicates, cross-teacher moves and stale bases. A preview token covers timetable history, overrides, relevant operational state, policies and facts; saving rechecks inside a transaction. The UI submits an intended patch, never a replacement imported dataset. Cancel and pointer dragging remain local. Use existing API protection/error conventions.

### Disabled is a commitment-level restriction

Pass disabled metadata from resolved schedules into eligibility without changing global type policies. Apply it before manual-availability precedence: a disabled visible activity remains exceptional even with manual availability. All activity visibility checks and hard restrictions still apply; disabled commitments cannot become RP free periods. Reuse exceptional confirmation and ordering, adding a specific disabled reason. Moving retains campus and disabled state, and all dated consumers, including RP context and exports, resolve the same effective positions.

### Reconcile every affected date without rewriting assignments

Preview override save, revision and reset over affected dates already represented in state/facts, reporting changed eligibility and saved assignments. Reuse timetable correction evidence and statistics reconciliation while retaining assignment values, permit links and accounting. Record pre-change context and flag newly invalid coverage for review. Clip reconciliation to the actual effective intervals, including later overrides, resets and imported versions; ordinary unrelated dates retain existing snapshot semantics.

During import preview, evaluate affected groups against the proposed imported versions. Compare normalized scheduling fields (classes, activities, campus, room and original labels), excluding presentation-only metadata. Suspend a conflicting group for the affected version interval; use imported cells for that group and retain the proposed edit as review evidence. Compatible groups still apply. Keep unresolved review flags durable; do not silently revive a suspended edit when a subsequent import happens to match. Explicit review rebases or discards it. Include compatibility results in the existing import confirmation token. Missing teacher identities suspend their edits rather than matching names or remapping IDs.

### Compact cards with accessible editing

Reuse campus colours already defined in style.css; replace standalone chips with an integrated outlined/filled session rectangle. Retain class and activity text, C/S/?, and existing compresenza help. Unknown campus uses neutral styling. Treat only activity-only cells as filled editable special hours; class-linked activities remain fixed and show both class and activity labels. Put dates and Save/Reset/Cancel in one compact toolbar, with MODIFICATO status in the card header. Use existing application button styles and a campus legend above the grids. Disabled cells are muted/crossed out with accessible text.

Use pointer dragging with an activation threshold, a clear legal-drop affordance and a floating copy under the pointer, a highlighted target, and Alt+arrow keyboard movement; a completed drag suppresses click toggling. Avoid adding a drag library unless existing platform handling proves insufficient. Save previews internally, applying directly when no new assignment issues arise and otherwise showing a compact confirmation with collapsed details for newly affected assignments; Cancel discards drafts, and leaving a dirty editor warns about unsaved work.

### Archive and backup compatibility

Introduce the next archive schema including override revisions, resets and conflict evidence. Validate all references, dates, patch conservation and revision relationships before writing. Legacy schemas retain current overlays and reconcile them against any restored timeline; disclose conflicts in restore preview rather than dropping overlays. SQLite backups naturally include the new document. Initial absence of overrides means an empty overlay document, created only by explicit initialization or save; imports remain side-effect free. Reuse the existing guarded online-backup mechanism before confirmed changes that reconcile saved operational records.

## Risks / Trade-offs

- An incomplete resolver audit could make Orari disagree with candidates or statistics → cover direct raw-version consumers, dated exports, archive restore and startup reconstruction.
- Dependent moves can make patch rebasing tricky → persist atomic connected groups and test changed source, destination, teacher removal and repeated imports.
- Backdated changes can invalidate existing coverage → preview impact, preserve evidence and require explicit confirmation; never repair assignments automatically.
- Overlapping teacher snapshots replace whole patches → show the full effective week before save and test expiry resumption and reset boundaries.
- Existing uncommitted changes touch the same frontend/backend → preserve them and integrate against current files, without resetting or committing others' work.

## Migration Plan

1. Add additive override storage and archive compatibility; verify fresh/legacy databases in temporary directories without changing originals.
2. Test boundary dates, overlaps, resets, grouping, disabled precedence, import review, stale writes, archives and recovery preservation using isolated databases.
3. Build a unique standalone compose.testing.yaml project with mktemp TEST_DATA_DIR, exported TEST_PROJECT and explicit -p. Inspect its mount and allocated localhost port; verify /api/environment reports testing true and the red TESTING ribbon before mutations. Never use port 8000 for behavioral tests.
4. Verify dense cards, both themes, pointer/keyboard edits, future previews and review flows; stop only that test project.
5. After implementation and deployment approval, rebuild/recreate normal compose.yaml against the existing project data directory and verify mount and served asset hash read-only. Preserve a verified pre-change backup; restoring operational data requires explicit authorization. Do not run old code against an archive/storage format it cannot safely preserve.
