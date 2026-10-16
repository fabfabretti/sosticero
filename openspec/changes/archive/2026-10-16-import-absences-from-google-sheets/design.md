# Design

## Context

See proposal.md for motivation. The app is a FastAPI factory serving a React HashRouter frontend, with SQLite JSON documents and a shared transactional save path that updates timetable-derived statistics. Manual absence writes currently replace the teacher/day hour list. Whole-day entry uses all seven supported periods. Timetables are versioned by effective date; range entry already skips weekends and limits ranges to one year. The persistent shell is the appropriate home for Inbox status without refetching active forms. Existing shell specs lag implemented Orari and Stats behavior; preserve those screens while extending navigation.

## Goals / Non-Goals

**Goals:** One private source, durable review shared by all clients, additive calendar acceptance and no interruptions during entry. Reuse existing storage and absence validation/statistics rather than building a parallel calendar.

**Non-Goals:** Google writes, domain delegation, OAuth consent flows, automatic approval, generic sheet-column designer, source edit reconciliation, or infrastructure beyond the existing container.

## Decisions

### Connection and secrets

Settings accepts source URL/ID, worksheet, credential upload and a Test connection action. Store nonsecret configuration in SQLite. Seed the UI fields when unset with spreadsheet `1lgAmKTn4S5GfiOI6WPT4Onsesb4RsDiqhAGaDi6UBmA` and worksheet `Risposte del modulo 1`; do not auto-connect before explicit configuration save. Use the service-account email in uploaded JSON as the displayed identity rather than hardcoding it.

Store the key at a server-chosen filename under the selected database directory's `keys/` (normal deployment: `data/keys/`). Reject client paths, bound upload size, validate service-account type and required key/email/token fields, and load the key with Google's maintained authentication library. Restrict token exchange to Google's expected endpoint rather than trusting an uploaded arbitrary URL. Use the read-only Sheets scope and a small pinned google-auth transport dependency, not hand-rolled JWT signing or the full discovery client. Read values over Google's fixed HTTPS Sheets endpoint with timeouts; never fetch a user-supplied arbitrary URL.

Create the directory with mode 0700 and key with 0600, replacing atomically only after validation; leave a working key on malformed replacement. Explicitly ignore `/data/keys/` even though `/data/*` is already ignored; `.dockerignore` already excludes data. Key material never enters SQLite, API responses, exports, logs or error bodies. Existing SQLite backups therefore exclude keys naturally and restore leaves them intact. Configuration tests must not ingest rows. No new authentication system is introduced: credential upload has the same trust boundary as existing Settings writes, on the existing localhost service.

### Lifecycle and polling

Use one cancellable background task started by FastAPI lifespan, not module import. Immediately check after successful configuration and on startup when configured, then every 30 seconds. Run blocking Google I/O outside the event loop; do not hold a SQLite transaction across network requests. Cancel on shutdown, prevent overlapping runs, bound requests and back off failures up to five minutes, resetting after success. Existing one-worker deployment needs no queue service. Tests inject a fake fetcher; isolated tests never inherit or read operational keys.

Each client polls only local Inbox summary/status every 30 seconds. Multiple browser clients must not multiply Google reads. Show last successful sync and safe error in Settings/Inbox without repeatedly raising disruptive alerts. Keep old results when a check fails.

### Source layout and identity

Read the bounded used response range as a matrix, preserving column positions and duplicate headers. Validate expected header order before importing; map case, teacher, timestamp, single-day date, inclusive start/end, hourly date, and selected hours to their supplied positions. Unexpected layouts stop discovery with a schema error rather than guessing. Parse Italian DD/MM/YYYY dates, timestamps with dot-separated clock fields, and comma-separated integer periods. Use Europe/Rome for submission-time interpretation; retain original values for review. Existing maximum date-range and hour validation applies. Wholly blank rows are skipped; malformed nonblank rows are retained as blocked items.

Re-read the response range rather than rely on an append cursor: deletion of test rows shifts positions. Identify a submission using source ID + worksheet + a hash of canonicalized full row values. Store row number only as diagnostic metadata. For identical full rows, persist occurrence ordinals and ingest only additional occurrences; never reduce observed counts when rows disappear. This preserves distinct identical submissions while tolerating row deletion/reordering. A deleted response already ingested stays pending/history and must be ignored or corrected manually. Arbitrary source edits are outside scope and would be new content; explain this in Settings help. Changing the configured source keeps old history and namespaces the new source separately.

### Storage and acceptance

Use a separate SQLite Inbox table with a unique source/submission identity, source values, parsed representation, status, selected teacher override and processing timestamps. Add it through normal initialization without touching operational records. Nonsecret configuration can use Store documents. Database snapshots include Inbox/configuration; ordinary operational JSON export remains compatible and excludes integration state as well as secrets. Restoring an old snapshot can rewind Inbox decisions consistently with its calendar; warn users and refresh polling state after restore instead of retaining stale in-memory decisions.

Resolve teacher labels uniquely against date-effective timetables, allowing explicit selection when unresolved/ambiguous. Do not use fuzzy auto-matching. Build an acceptance preview with affected weekdays, requested hours and existing overlap (including permit-derived absence information). Whole-day submissions request HOURS 1–7, following manual entry semantics. A weekday-free range cannot be accepted and shows that it has no applicable dates.

Acceptance receives the item ID and optional teacher override. In BEGIN IMMEDIATE, re-read status and current timetable/state; validate every date, union requested hours into manual absences and preserve metadata. Reuse the shared save_state/statistics path, then mark accepted in the same transaction. Refactor only the minimal shared validation if needed; do not change replace semantics for existing manual clients. Append `imported from sheet` as a separate note line once for every affected teacher/date, preserving existing note text; even when all hours already exist, persist a missing marker. Previously accepted items are not backfilled. Treat permit-derived overlap as visible existing absence without creating or changing recovery obligations; union the requested hours into manual absence state so later permit edits cannot erase an approved independent submission. Repeated acceptance returns the already processed result. An ignored item cannot be accepted through stale requests. Any failure rolls back everything.

### UI and APIs

Add same-browser-tab route `#/inbox`; preserve every current destination. Add pending count and a compact global status/link in Shell, isolated from page data state. No automatic navigation, modals, focus movement or form reload. Use existing CSS variables, tables, buttons and responsive patterns with keyboard controls, aria-live polite, and both themes.

Provide focused endpoints for connection configuration/credential upload and test, Inbox summary/list (pending/history), preview, accept and ignore. Never include the key in config GET. Inbox shows timestamp, original/resolved teacher, case, date range, hours, overlap and blocking issues; individual actions show busy/error state. Display a link to the relevant Supplenze date after success if existing routing supports it; do not expand routing just for that optional convenience.

### Follow-up presentation and notification decisions

Use a compact row: teacher text first, absence date/range and Supplenze-style static hour chips, original first-column submission time, actions, and expandable details. Show original name → selector only for unknown/ambiguous names, retaining the original label after manual resolution. Errors remain visible.

Pending-list refresh dispatches its count to status consumers immediately; revision tracking rejects older in-flight summary responses and queues a fresh request when needed. Summary includes total received rows, so a new entry can trigger a chime even when simultaneous acceptance leaves pending count unchanged. Only the persistent Shell enables audio; page-specific status consumers stay passive. A 250 ms Web Audio tone is unlocked by click/keypress, with silent initial load and no repeated sound for unchanged totals. Audio failure cannot prevent visual count updates.

## Risks / Trade-offs

- Full-range reads grow with form history → request only the response columns and avoid cell formatting; revisit incremental reads only if actual sheet size warrants it.
- Identical response deletion/recreation cannot be distinguished without a form response ID → preserve the highest occurrence count; document this limit rather than write identifiers into Google.
- Test lines deleted after ingestion remain visible → ignore them; accepted test absences require manual correction.
- Historical teacher names can be inactive → block acceptance and offer explicit valid selection; never silently skip dates.
- Existing service has no user authentication → retain localhost deployment and existing Settings access boundary; do not expose it publicly as part of this feature.
- Restoring backups rewinds processed history → refresh after restore and explain that submissions newer than the restored snapshot can return for review.

## Migration Plan

Additive schema/config initialization only; no automatic source connection, calendar mutation or credential installation. Test with fixtures and mocked Google against temporary databases, then run the standalone isolated Compose test project, verify its mount/allocated port and testing indicator before behavioral writes, and clean up only that project. Container image rebuild is required for UI verification. Normal service stays untouched during tests. Any later approved normal deployment uses the prescribed rebuild/recreate command and read-only verification of operational mount and asset hash. Rollback stops polling with old code; existing absence data stays compatible and the additive Inbox table/key files can remain.
