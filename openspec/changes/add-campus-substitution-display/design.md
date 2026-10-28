# Design

## Context

See proposal.md for motivation. `frontend/src/main.tsx` uses HashRouter and wraps Shell in Auth. Shell mounts navigation and Inbox polling. `backend/main.py` serves static files with StaticFiles rather than a general SPA fallback; `/display` therefore needs an explicit entry route. Daily data combines effective timetables, displayed teacher names, derived rows and saved assignments. `/api/day/{day}` includes private state and must remain protected. `backend/auth.py` coordinates reads with publication using a shared gate. `useQuietRefresh` polls at 15 seconds and swallows errors, so using it unchanged would violate the display refresh contract.

## Goals / Non-Goals

**Goals:** A minimal public projection, predictable unattended operation and legible viewport pagination without operational writes.

**Non-Goals:** Replacing routing, changing existing refresh behavior, exposing the day API, introducing a publication state or persisting display settings.

## Decisions

### Dedicated direct entry

Serve the existing frontend entry HTML explicitly at `/display` before the static mount. Select the display from the browser pathname before mounting Auth/Shell, parsing the outer query string. Preserve all existing hash routes. Missing/invalid campus shows a clear configuration message with the two valid links and makes no data request. This avoids a router migration or new top-bar affordance.

### Server-owned minimal projection

Add GET `/api/display?campus=centrale|succursale`. The server selects today's date in Europe/Rome; no arbitrary historical-date option. In one read snapshot, reuse effective dataset loading, presented teacher names and derived `rows`, then join saved assignments by row key. Include only real teacher assignments attached to current rows whose target campus matches the query; do not filter by the substitute's home campus, Comunicato or acceptance flags. Exclude orphan assignments, DIR/UNCOVERED, and teachers without qualifying assignments from teacher rows. Project valid ENTRA/ESCE assignments separately as class schedule changes, grouped by class and action; use the latest ENTRA period and earliest ESCE period, as the operational UI already does. Sort names alphabetically in Italian order and group each teacher's assignments into hours 1–7; preserve multiple classes in a slot without overwriting.

Return only date, campus, snapshot timestamp, displayed substitute and replaced-teacher names, period/class/room data and class schedule changes, plus a non-sensitive incomplete-data indication when unresolved assignments exist. No full dataset/state, private notes, attachments, reasons, recovery details or internal diagnostics. Use an explicit allowlist of response fields. Missing room uses `Aula n.d.`. Empty days return an empty board; missing timetable returns a clear unavailable response.

Permit only GET of this exact API without a session, preserving shared publication coordination and `Cache-Control: no-store`. All existing routes keep their protections. A public frontend must use a read fetch that does not trigger operational session/login handling. No database migrations or write endpoint.

### Fit measured content, then paginate

Use a viewport-height board with compact campus/date/update context and teacher rows with seven period columns. Begin with one table; use two side by side if a single table exceeds available height. Use readable type and measured rendered row heights, including wrapped class/room and replaced-name text, to pack whole rows. Keep a teacher row together, repeat column headings, and recompute on resize/font readiness/data change. Do not use fixed row-count estimates as acceptance criteria or shrink the entire board to force a fit. Use the existing shared entry/exit clock labels for a compact class schedule section below the grid, even when there are no substitute teachers. Its measured height reduces the space available for teacher rows. Do not show teacher counts, refresh-interval text or an in-app fullscreen button; browser fullscreen remains available. A page indicator and interaction-only pause control appear only when pages rotate.

If two tables still overflow, paginate alphabetically and advance every 15 seconds with visible page count. Preserve the current page across unchanged refreshes, clamp it after changes and stop the rotation timer for a single page. If one row alone cannot fit, show an explicit fit warning rather than silently clipping content. Empty board says there are no assigned substitutions today for this campus.

### Explicit unattended lifecycle

Fetch immediately, then every 30 seconds, and refresh on returning to the tab. Avoid overlapping fetches and discard superseded/unmounted responses. Use Europe/Rome date handling regardless of monitor timezone. At local-school midnight clear yesterday's board and fetch the new day immediately; recheck date on wake/visibility return. A failed same-day refresh retains the last snapshot with a prominent stale warning and its successful timestamp; initial failure shows unavailable. Never relabel yesterday's data as today's or mark a failed refresh successful.

## Risks / Trade-offs

- Public names and assignments are visible to anyone able to reach the host → intentional user-approved scope; strict field allowlist and regression checks for protected APIs.
- Displaying saved assignments includes uncommunicated/unaccepted ones → consistent with the agreed scope; no new publication workflow.
- Real monitor size and viewing distance determine practical capacity → validate at 1920x1080 with long names, rooms and multiple assignments; 20–25/40–50 remain estimates.
- Unresolved or special-action rows are not teacher assignments → do not invent matches; show a generic incomplete-data warning for unresolved saved assignments.
- Browser suspension can delay timers → fetch and re-evaluate date on visibility return.

## Migration Plan

No schema/data migration. Verify using an isolated database and standalone compose.testing.yaml project, including public deep-link reloads and the TESTING ribbon. Stop that project afterward. Deploy only after a separate authorized implementation/deployment request using scripts/deploy.sh; rollback uses the prior release without modifying operational records.

## Open Questions

No blocking product choices. Exact type sizes and row capacity are implementation-time visual calibration on a 16:9 viewport, followed by checking the physical monitor if available.
