# Design

## Context

See proposal.md for motivation. The React frontend has local busy flags, ad hoc loading text and several useQuietRefresh consumers. Supplenze retains data while changing day; loadedDay currently guards export but not all other actions. Stats and Orari often clear data rather than retain it. Settings archive operations lack a busy flag. AttachmentField reads images asynchronously without communicating pending preparation to its parent. Existing tests use node:test and lightweight transpiled component/hook harnesses.

## Goals / Non-Goals

**Goals:** Reuse local request ownership and existing controls; introduce the smallest shared visual presentation and scoped pending protection that cover the full inventory. Preserve quiet polling, concurrency preconditions, drafts and safe navigation.

**Non-Goals:** No global request interceptor, query-library migration, new dependency, backend contract change, artificial delay, progress percentage or general UI redesign. Purely synchronous filters, clipboard copying and browser-native download completion need no fabricated loading state.

## Decisions

### Shared presentation with local ownership

Use one small shared status presentation and CSS tokens in ui.css for spinner, label and dimmed content; support compact button use. Keep operation ownership in the owning screen rather than adding a global network counter: one request can affect only part of a screen and background polling must remain quiet. Indicators appear immediately and carry Italian context labels such as Caricamento…, Salvataggio… and Elaborazione…. No minimum spinner duration.

### Keep previous content, separate selectors from protected regions

Retain the last successful snapshot on selection changes and render it dimmed in a protected content region. Keep date/campus/range navigation outside that region. Guard all dependent actions, including Add, export, table links and detached dialogs. Use inert/disabled semantics plus handler preconditions; CSS pointer blocking alone is insufficient. Loading and error/retry content sits outside the inert region. Initial loads have no stale snapshot to dim.

Derive usability from snapshot context matching the selection, not just an effect that eventually sets loading. Tag accepted data with its day/week/filter/request scope and reuse existing request generations or cancellation checks. Superseded requests must not alter data, pending status or errors. For user mutations, keep dependent controls blocked through authoritative reload; distinguish mutation failure from reload failure so retry does not repeat a successful write. Existing concurrency tokens remain authoritative.

### Foreground and background paths stay distinct

Keep useQuietRefresh polling silent, including active-edit deferral. Explicit initial loads, selection changes and reload buttons own foreground state. Any hook adjustment must preserve generation invalidation, edit baselines and scroll behavior; do not infer foreground busy from every API request. Auth session polling and global Inbox counts stay quiet. Public display retains its current-day freshness/error handling.

### File preparation belongs to the owning form

AttachmentField reports preparation state to entry, permit and Inbox forms, which disable dependent save/accept until reading settles. Reading, replacement, removal and unmount invalidate older callbacks. File imports use the same local ownership approach for text/array-buffer reads before preview. Native image loading gets a visible placeholder/status and error handling without globally blocking unrelated controls. Long synchronous PDF generation may require yielding a paint before computation for feedback to be visible; do not add worker infrastructure unless measurement demonstrates a need.

### Coverage inventory

| Owner | Required foreground paths |
| --- | --- |
| main.tsx / Supplenze, CandidateDrawer, PaidActions, RecoveryActions | Initial/day load; candidates and consultation; add/edit/remove; assignments and communication flags; conflict reload; dependent copy/action guards |
| main.tsx / Permessi | Initial load; permit/manual-balance save/delete; conflict reload; attachment preparation |
| PaidHours.tsx | Initial/week load; edit/save availability; explicit reload |
| TeacherTimetables.tsx | Initial/date/history load; editing baseline load; name save/remove; override preview/save/delete; PDF generation |
| Stats.tsx, StatsAvailability.tsx | Campus/period/week load and retry; CSV/print readiness for matching selections |
| Inbox.tsx | Initial/pending/history load; teacher preview; accept/ignore and reload; settings configuration load, credential upload, save/test |
| TimetableImport.tsx, Receptions.tsx | File preparation; preview; matching verification; confirmed import and refresh |
| HourTypes.tsx | Initial inventory and rule saves |
| main.tsx / Settings, BackupSection | Section summaries; archive export/read/preview/restore; backup list/create/restore; post-operation refresh |
| Auth.tsx | Initial session; login; logout, including duplicate protection |
| Attachments.tsx and its parents | Pasted-image preparation; preview load/failure; dependent submit readiness |
| SubstitutionExportPanel.tsx | PDF preparation; current data guards; existing result links invalidated on scope change |
| Display.tsx / display.ts | Shared first-load indicator; preserve quiet polling and freshness behavior |
| Shared presentation, useQuietRefresh, UI styles | Accessible scoped busy state, reduced motion, both themes, generation and focus invariants |

## Risks / Trade-offs

- Retained results can be mistaken for current results → dim and block the entire dependent region, including summaries and exports, with a clear pending/error label.
- Inert regions can hide feedback or lose focus → keep selectors/status/recovery outside them and verify keyboard focus through delayed transitions.
- Overlapping requests can clear newer busy state → pending and error completion must check ownership just like data acceptance.
- Save success followed by refresh failure can cause duplicate writes → track the completed save separately and offer reload recovery.
- Existing tests include source assertions → add behavioral deferred-response checks for state and interaction correctness instead of relying on text matches alone.
- Current checkout contains unrelated BuildInfo changes → preserve them and review overlapping main.tsx/style edits before implementation.

## Migration Plan

No database migration. Implement and verify using an isolated temporary database and unique compose.testing.yaml project; confirm testing environment, mount, allocated port and red ribbon before mutations. Exercise delayed/out-of-order/failing responses locally. Stop only that project afterward. Deploy the completed feature with ./scripts/deploy.sh and verify release/assets and mount read-only on atlante. Use the documented previous release rollback if necessary; never promote test data. Ask before committing.
