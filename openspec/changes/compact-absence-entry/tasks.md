# Tasks

## 1. Persist optional source classifications

- [x] 1.1 Add absenceKinds and permitKinds defaults, optional API fields and response types; verify isolated backend tests cover initial unspecified state, accepted values, rejected invalid values, explicit clearing and omission-preserves behavior.
- [x] 1.2 Update manual entry and permit lifecycle operations to preserve metadata on hour changes, move permit metadata with valid edits and remove it on deletion; verify tests cover moves, removals, failed transactions and unchanged permit identities/recovery balances.
- [x] 1.3 Extend archive validation and export for both maps; verify tests cover legacy import, round trips, invalid/orphan metadata and atomic rejection. Document the optional maps and older-version compatibility limitation in the existing archive/API documentation if present.

## 2. Compact daily entry

- [x] 2.1 Separate suggestion selection from submission and add Aggiungi alongside search; extend frontend handler tests to verify click-select, Enter-submit, arrow selection, invalidation after typing, busy protection and retained draft on failure.
- [x] 2.2 Replace Alcune ore with initially enabled Tutto il giorno, reveal inline partial-hour choices and conditional campus, remove Più giorni UI and preserve current options/hours/campus after successful addition; verify frontend tests cover repeated additions, empty partial selection rejection and unchanged full-day availability defaults.
- [x] 2.3 Add optional mutually exclusive classification toggles for manual teacher absences, hiding and omitting them for classes/availability while retaining their draft preference; verify frontend tests cover selecting, switching, clearing and consecutive entries.

## 3. Grouped sidebar and permits

- [x] 3.1 Render each teacher once under the ordered classification groups using last_minute over planned over unspecified; retain unioned hours, permit locks, class absences and availability. Verify frontend cases for both directions of mixed manual/permit classifications, legacy data and regrouping after source deletion.
- [x] 3.2 Provide compact on-demand editing of manual classification in saved sidebar rows; verify changing/clearing classification preserves hours and permit metadata and updates the group.
- [x] 3.3 Add classification toggles to permit creation/editing, loading saved values and preserving the separate new-entry preference after create/edit/cancel; verify frontend tests cover all three choices and backend persistence after reload.
- [x] 3.4 Apply compact responsive styling to the daily form and permit choices; inspect desktop and narrow layouts to verify conditional controls, readable focus/pressed states, keyboard operation and no LM/P badges.

## 4. Integration and deployment verification

- [x] 4.1 Run the backend unittest suite with DATABASE_PATH in a fresh temporary directory and BACKUP_ON_STARTUP=false, plus frontend npm test and npm run build; verify all checks pass without operational database writes.
- [ ] 4.2 Rebuild and force-recreate the container with LOCAL_UID/LOCAL_GID and an explicit temporary Compose override replacing the entire /data mount; verify the mount before behavioral writes, then exercise consecutive entry, mixed-source grouping and permit editing on isolated data.
- [ ] 4.3 Restore normal compose.yaml service with LOCAL_UID/LOCAL_GID and --build --force-recreate; verify the running /data mount is the project data directory and the current frontend asset hash is served using read-only checks.

## Workflow follow-up

- Ask the user whether to commit before creating any commit.
- Archive only when implementation and verification are complete and the user requests it.

## Repository reconciliation — 2026-10-25

Classification requirements were synchronized into the main permessi/absence-entry specs, then the implemented entry-dialog delta replaced the inline form contract. Earlier unchecked container tasks remain historical and are not claimed as passed; their Compose override instructions are superseded by current AGENTS.md. Keep the old local operational app stopped. The successor dialog has isolated test evidence and was confirmed live on atlante by the operator on 2026-10-26. Full equivalence between the running snapshot and the current Git revision remains unverified.
