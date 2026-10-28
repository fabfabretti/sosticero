# Verification

Verified on 2026-10-28 using synthetic data only.

## Automated checks

- 30 focused backend tests passed: display projection/API, authentication, database isolation and environment status. Six display tests were rerun successfully after the final accented-name sort and unresolved-teacher assertions.
- 181 frontend tests passed using `node --test --test-isolation=none`. Includes public route isolation, row packing, 15-second rotation, Rome date/DST/midnight behavior, 30-second refresh, stale retention, late responses and the data-shrink regression.
- TypeScript and Vite production build passed in the final isolated container build. Existing bundle-size and react-router directive warnings remain.
- Strict OpenSpec validation and `git diff --check` passed.
- A broader backend discovery run reached its 90-second limit before producing a summary; it reported no failure before termination. This is not counted as a complete suite pass.

## Isolated container and browser

Used standalone compose.testing.yaml project `sosticero-display-1793207609`, with isolated `/tmp/sosticero-display-547e5W` mounted at `/data`. Inspected the mount and allocated localhost port after recreation and confirmed `/api/environment` returned exactly `{"testing":true}` before fixture changes. Browser screenshots showed the red TESTING ribbon. Normal compose.yaml, port 8000 and operational data were not used.

- Anonymous Centrale and Succursale direct links and reloads work; invalid/missing campus shows the two valid links. Succursale with no assigned teachers shows an explicit empty state. Operational Orari still opens login.
- Container request logs confirmed the public board initially requested only environment/display APIs, without session, Inbox or operational day loads.
- At 1920×1080, 15 ordinary teachers fit in one table; 28 fit in two tables. Long names and room descriptions wrap without horizontal clipping and reduce capacity. A 1280×720 resize recalculates pagination. An oversized row shows an explicit fit warning.
- A 90-teacher fixture used three pages, with actual rotation observed to page 3. A live 30-second refresh reduced the dataset to 28 teachers without reloading, correctly removed pagination and kept two assignments in the same hour visible. Table bottoms remained within the available area.
- That transition initially uncovered an old-pagination-index crash. The renderer now ignores indexes outside the current dataset while layout recalculates; the regression is covered by a test and the same live transition passed afterward, with no errors from the final release URL.
- Keyboard focus pauses rotation and reveals controls. An interaction-only pause/resume control is available alongside fullscreen.

Preview: `outputs/substitution-display-preview.png` (synthetic data, ignored build artifact).

## Cleanup and limits

The temporary browser tab was closed and viewport override reset. The isolated Compose project was shut down after verification. No deployment or commit was performed. Physical monitor viewing distance and light-theme rendering were not visually checked; practical capacity depends on content, screen size and readability.

## Display refinements

Added replaced-teacher displayed names (including co-absences) and campus-specific late-entry/early-exit summaries. The summary uses the same operational clock labels, the latest entry boundary and earliest exit boundary. Removed teacher-count/refresh-interval text and the in-app fullscreen control. AGENTS.md now requires deployment after implementing and verifying a feature.

- Eight focused display backend tests passed, including response allowlist/privacy, displayed names, co-absences, multiple periods, campus filtering and notes without substitute rows.
- All 183 frontend tests passed, including cell names, class summaries, empty summaries and existing operational entry/exit label coverage.
- A fresh standalone test project `sosticero-display-notes-1793210597` used temporary mount `/tmp/sosticero-display-notes-zeMHEs` and allocated port 37105. Mount and `testing:true` were verified before adding synthetic data.
- At 1920×1080, eight substitute rows with wrapped replaced-teacher names and both class note types fit without clipping. No count/refresh text, fullscreen button, single-page footer or browser errors appeared. The red TESTING ribbon remained visible.
- Preview: `outputs/substitution-display-notes-preview.png`. Browser viewport was reset, the temporary tab closed and this test project shut down.

Deployment completed with `scripts/deploy.sh`: release `incoming-20261028T180524-69434`, source snapshot `d2e9914712f3f6eab18d905cb2659fde73c4dd2874f4587782bccd433bf2aa6e`. The script verified its complete recovery snapshot, selected image, HTTPS production environment and frontend. Independent read-only HTTPS checks confirmed both public campus links and the updated allowlisted response fields (`replaced` names and class `changes`). Production data was not edited for verification. No commit was created.
