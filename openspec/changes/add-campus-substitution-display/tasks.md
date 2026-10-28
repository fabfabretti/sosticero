# Tasks

## 1. Minimal public data

- [x] 1.1 Add the server-owned today/campus display projection using effective timetable loading, displayed teacher names, current derived rows and saved assignments; test campus isolation, substitute versus target campus, ordinary/empty slots, multiple classes, displayed names, missing rooms, special actions, orphan assignments and no qualifying teachers using isolated database fixtures.
- [x] 1.2 Expose only GET `/api/display` through a narrow session exemption while retaining shared publication coordination, no-store responses and existing API protections; test invalid campus, missing timetable, explicit response-field allowlist, private data absence, rejected writes and anonymous denial for existing operational data/exports/attachments. Verify requests do not mutate stored records.
- [x] 1.3 Document the public response contract and intentional reachability of names/assignments, with the two campus links and no login/publication prerequisite; verify the documentation matches the tested endpoint.

## 2. Standalone monitor screen

- [x] 2.1 Serve the frontend entry at `/display` before the static mount and select the public display before Auth/Shell without changing existing hash routes or top-bar tabs; verify both direct links and reloads anonymously, invalid-campus guidance without data fetch, no session/Inbox requests and preserved operational login behavior.
- [x] 2.2 Add the daily teacher-by-hours grid with class/room-only cells, blank ordinary lessons, campus/date/update context, empty/unavailable states and interaction-only fullscreen control; verify long displayed names, multiple assignments per cell, missing rooms and the TESTING ribbon in testing mode.
- [x] 2.3 Implement content-aware one-table/two-table layout and whole-row pagination without scrolling or silent clipping, plus a visible fit warning for an oversized row; check deterministic packing boundaries with a focused test and render at 1920x1080 using ordinary, long-content and overflow fixtures, including resize/font readiness.
- [x] 2.4 Add 15-second rotation only for multiple pages with a visible page count, stable current page on unchanged refresh and clamped page index after changes; verify with controlled timers that every teacher appears once per cycle and single-page boards stay still.

## 3. Unattended refresh

- [x] 3.1 Add immediate and 30-second public polling plus visibility-return refresh, non-overlapping requests and stale-response/unmount protection; verify timing and out-of-order response behavior with controlled timers or an assert-based harness, without changing existing operational polling.
- [x] 3.2 Add Europe/Rome midnight rollover, previous-day clearing, same-day stale retention and successful-snapshot timestamps; verify a device in another timezone, suspended-tab date change, initial failure, failed refresh and midnight failure without yesterday's assignments.
- [x] 3.3 Document monitor setup/fullscreen, invalid-campus handling, stale warnings, rare overflow rotation and physical-screen calibration; verify setup instructions against both public links and the rendered board.

## 4. Integration verification

- [x] 4.1 Run focused backend/frontend checks and the frontend build; verify the auth and route regression checks pass and no operational database is opened or modified by tests.
- [x] 4.2 Rebuild only a unique standalone compose.testing.yaml project using exported TEST_PROJECT and mktemp TEST_DATA_DIR; inspect its mount and allocated localhost port, confirm `/api/environment` returns testing true before fixture changes, and verify the TESTING ribbon, both public direct-link reloads, 16:9 layouts, refresh and overflow behavior. Stop only this test project afterward and record verification results and physical-monitor limitations.

## 5. Staff-room display refinements

- [x] 5.1 Add displayed replaced-teacher names and deduplicated campus-specific entry/exit boundaries to the public projection; verify co-absences, displayed names, consecutive periods, campus filtering, empty teacher boards and the updated public-field allowlist with isolated backend tests.
- [x] 5.2 Reuse shared operational clock labels in the class-change summary, show replaced names in cells and remove teacher-count/refresh text and fullscreen controls; verify frontend behavior, long content and existing operational entry/exit labels.
- [x] 5.3 Update setup/privacy documentation and the AGENTS.md post-feature deployment rule; rebuild a unique standalone testing project, verify testing mode/mount/port before synthetic fixtures, inspect a 16:9 board with notes and long names, stop that test project and record checks.
- [x] 5.4 Deploy the verified update with scripts/deploy.sh and confirm the production release and both public display links using read-only checks.

## Workflow follow-up

- Implementation and server deployment require a later request. Deploy an authorized update with `./scripts/deploy.sh`, using read-only production verification.
- Ask the user whether to commit before creating a commit.
