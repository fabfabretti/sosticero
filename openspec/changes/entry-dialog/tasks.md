# Tasks

## 1. Dialog shell and trigger

- [x] 1.1 Add an `entryOpen` flag and a quiet full-width `+ Aggiungi` button under the sidebar calendar; opening it closes the substitute sheet and opening the sheet closes it. Verify the sidebar test renders the button, finds the dialog only after clicking it, and asserts both overlays are never open together.
- [x] 1.2 Include `entryOpen` in the `.app` inert condition and in the quiet-refresh pause condition. Verify the sidebar test asserts `inert` while the dialog is open and that no day refresh is requested until it closes.
- [x] 1.3 Move the entry form into a centred dialog rooted in `ui-page`/`ui-surface` with a date header, keeping search, suggestions, Tutto il giorno/A disposizione, hours, classification, note, attachment and campus. Verify the sidebar test finds the same controls inside the dialog and that the sidebar itself no longer contains the form.
- [x] 1.4 Close the dialog with the close control, Escape and the backdrop; move focus to the search field on open, restore it to the trigger on close, and trap Tab inside the dialog. Verify the sidebar test exercises each close path and asserts the draft is empty after reopening.
- [x] 1.5 Style the dialog and backdrop in `supplenze.css`, retargeting the retired `.daily-entry` compact rules, with a scrolling body and a full-width presentation on narrow screens. Verify with `npm run build` and a visual check at desktop and narrow widths in the test container.

## 2. Entry behavior inside the dialog

- [x] 2.1 Keep the existing save path and add the inline success confirmation naming the added teacher or class as a status message, with the dialog staying open and options retained. Verify the sidebar test asserts the confirmation text and that toggles and hours survive a consecutive entry.
- [x] 2.2 Prevent submitting a teacher or class that already has an entry that day, and explain it in the dialog instead of returning silently. Verify the sidebar test asserts the submit action is unavailable and the explanation is shown.
- [x] 2.3 Initialize the campus from the signed-in account and keep an explicit choice for later entries in the session. Verify the sidebar test covers a succursale account and a manual switch to Centrale.
- [x] 2.4 Render save errors and the conflict's saved values plus reload action inside the dialog, and keep the existing main-column notice for conflicts raised elsewhere. Verify the sidebar test covers a failed save and a 409, asserting the message is inside the dialog and reload clears the draft without closing it.

## 3. Tests and documentation

- [x] 3.1 Update `frontend/tests/sidebar.test.cjs`: replace the `daily-entry` form lookup with an open-the-dialog step and keep the existing entry scenarios (selection without saving, Enter, retained options, classes without classification) passing. Verify with `npm test` in `frontend/`.
- [x] 3.2 Update the README entry instructions to describe opening the dialog with Aggiungi instead of the inline sidebar form. Verify the described steps match the rendered controls.

## 4. Integration verification

- [x] 4.1 Run the frontend test suite and build together and confirm no `.daily-entry` selector or stale sidebar-form reference remains. Verify both commands succeed.
- [x] 4.2 Verify behavior in a container against an isolated database per the project testing rules: consecutive entries, Escape and backdrop dismissal, campus default and a forced conflict, with the TESTING ribbon visible. Verify each scenario in the browser without touching operational data.
- [x] 4.3 Verify the operator-deployed dialog is live on atlante and the operational mount is correct. The operator confirmed the live + Aggiungi dialog on 2026-10-26; the earlier read-only container inspection confirmed `/data` mounts the server project data directory. Keep the old local operational app stopped. A read-only HTTPS source-marker comparison on 2026-10-26 independently confirmed matching local and deployed application build inputs.

## Workflow follow-up

- The compact-entry predecessor and dialog delta are folded into the durable absence-entry spec. Historical pending container checks on the predecessor are not claimed as passed.
- Ask the user whether to commit before creating any commit.
- Archive only when implementation and verification are complete and the user requests it.

## Verification notes (2026-10-25)

- All 156 frontend tests passed (`node --test --test-isolation=none`); production frontend build passed. All 10 deployment-script checks passed, as did shell syntax and `git diff --check`.
- Isolated Podman project `entry-dialog-1792966326` used `/tmp/sosticero-entry-WFOQyn`, with its mount inspected and `/api/environment` confirmed as `{"testing":true}` before creating synthetic records. Browser verified the TESTING indicator, centered desktop/narrow layouts, account campus default, consecutive entries (click and Enter), Escape/backdrop dismissal and focus restoration, a genuine 409 showing saved hours/note with reload inside the dialog, and Tab wrapping from the attachment paste area on the final rebuilt image. The isolated project was stopped and removed afterward; operational databases were untouched by behavioral tests.
- AGENTS.md and this change's deployment step now follow the established atlante workflow and keep the old local operational service stopped.
- Deployment was attempted with `./scripts/deploy.sh`, but SSH required the operator password. The waiting connection was cancelled before upload or server changes. That attempt did not establish deployment. This historical result is superseded by the operator’s live-dialog confirmation below. No commit or archive was created during that attempt.

## Repository reconciliation — 2026-10-25

The dialog and its quiet-refresh pause support are included in the shared operational UI commit. The complete frontend test suite and production build pass. The operator subsequently confirmed the dialog is live on atlante (2026-10-26); the earlier pending-deployment statement was stale. Committing or pushing alone does not establish what is deployed. This change remains active; the compact-absence-entry predecessor and dialog delta are now reconciled in the main absence-entry spec. Feature deployment is accepted from operator observation plus the existing mount inspection; application build-input identity was independently verified over HTTPS on 2026-10-26 (see docs/server-deployment.md).
