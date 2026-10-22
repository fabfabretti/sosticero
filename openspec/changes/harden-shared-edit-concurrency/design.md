# Design

## Context

See proposal.md for motivation. `Store` stores JSON documents; operational handlers use `BEGIN IMMEDIATE`, load current state, mutate it and commit. This preserves unrelated server-side records, but `/api/entries` replaces an entire hours list supplied by a stale browser. Permit handlers protect identity/recovery constraints but do not compare the displayed record. Assignment validation and Inbox processing are already transactional. Inbox merges absence hours and refreshes every 30 seconds. Supplenze refreshes on day changes and local mutations. Existing UI includes immediate buttons plus explicitly saved notes/attachments and permit forms; preserve these interactions.

## Goals / Non-Goals

**Goals:** Reject stale destructive writes at the record boundary, retain existing business validation, and discover remote changes without interrupting interaction.

**Non-Goals:** Login, campus authorization, a generic collaboration framework, websocket infrastructure, new draft screens, and coordination of global database restore/import with live editing. Administrators must perform global replacement operations outside active editing until separately hardened.

## Decisions

### Compare displayed record state inside the existing write transaction

Return opaque per-record tokens in operational reads. Compute tokens from canonical persisted record state, including existence, hours and metadata; include stable permit identity where present. Do not hash derived recupero totals or global state: unrelated assignments must not invalidate an otherwise valid permit edit. Compare the supplied expected token after `BEGIN IMMEDIATE` and before attachments or state are changed. Use HTTP 409 with a structured code and affected record reference; missing required preconditions return 428. A token for an absent record is explicit, never inferred from an omitted field.

Content equality is intentional: changing away and back to identical content need not conflict. Tokens are concurrency checks, not authorization credentials. For assignment actions include the current row identity and campus/context as well as stored assignment so a stale row cannot be silently reused. Revalidate all live availability constraints even when the token matches. Keep transactions rather than introducing a second locking layer or changing databases.

### Cover each operation's actual write set

Treat an entry as group/date/teacher-or-class plus its note, classification, attachment and availability site. Permits use identity plus persisted editable fields; manual balances use teacher and stable balance identity. Deletion checks the complete record. Moves check original and destination. Range actions compare all target tokens; future actions additionally compare the applicable target date set so concurrent additions cannot join unseen. Use the already loaded full state to capture the baseline before dispatch; do not fetch a new baseline immediately before saving an old edit.

Update every caller, including candidate assignments, removal, communicated toggles, conflict reassignment, inline classification/site edits, metadata saves, range/future actions and permit/manual-balance forms. Internal Inbox acceptance remains an additive transaction, not an external replacement requiring a browser absence token; its result naturally invalidates stale manual tokens. Preserve existing permit protection and attachment rollback/pruning.

### Poll operational screens without replacing active interactions

Use bounded non-overlapping polling (proposed interval 15 seconds) plus visibility-return refresh, with cleanup on unmount. Perform day/permit reads in consistent read transactions. Reuse request sequence guards and add a mutation generation check so an older poll cannot overwrite a newer mutation or date selection. Compare incoming state before applying it; unchanged polls do not trigger unnecessary rendering.

Maintain stable component keys and DOM identity. Hold the latest incoming snapshot while a candidate drawer, metadata editor or nonempty entry/permit form is active; apply it when that interaction finishes. Do not queue every response. Polling must not change existing form state, loading flags or errors. Preserve scroll offsets when list-height changes would otherwise move the viewport, including sidebar scroll containers. Save validation remains authoritative while a snapshot is deferred.

On an immediate-action conflict, show current saved controls and an inline explanation. On a form conflict, keep entered values and mark it conflicted; show current saved values and require an explicit reload/reconciliation before supplying a new baseline. Never attach a fresh token to unreconciled stale values automatically. Reuse the candidate drawer's existing failure reload path. No automatic replay of failed requests.

### Keep Inbox processing idempotent but make its result honest

Return a distinct already-processed flag/status from the existing transaction. Do not compare or apply a second payload. Retain 409 for an incompatible saved decision. Refresh Inbox after either outcome and show one inline explanation. Preserve existing poll overrides and metadata inputs rather than remounting item rows.

## Risks / Trade-offs

- Deferred snapshots can leave a long-running interaction stale -> transactional validation blocks invalid saves; apply the latest snapshot when it closes.
- Record-level checks can reject independent changes to one record -> prefer explicit reconciliation over a merge engine for rare collisions.
- Full operational reads are larger than a change feed -> use existing endpoints and modest polling for two offices; add a feed only if measured cost justifies it.
- Legacy clients omit tokens -> update all repository callers/tests together and require browser reload on deployment.
- Global import/restore can change the entire baseline -> explicitly outside active editing; do not claim live restore coordination in this change.

## Migration Plan

No operational record rewrite or database migration is required for content-based tokens. Deploy backend and frontend together; old clients fail safely on missing preconditions. Test against temporary databases and isolated `compose.testing.yaml` projects, checking testing environment, mounts and allocated ports before mutations. Verify two-browser races and scroll/focus preservation. Normal service stays untouched during tests. Roll back code only if needed; no test data is copied back. Obtain approval before deploying to normal service, and ask before committing.
