# Tasks

## 1. Acceptance persistence and validation

- [x] 1.1 Extend assignment request/state validation with RP-only strict boolean accepted metadata, reusing campus and concurrency checks; add backend tests for both toggle directions, missing/non-RP targets, malformed and mixed commands, stale writes and cross-campus denial. Verify the targeted backend tests pass against temporary databases.
- [x] 1.2 Preserve acceptance on unchanged RP saves and ordinary revalidation, clear it on removal/replacement, and validate archive metadata atomically; add tests for legacy absence, restart, backup/restore, archive round trip, invalid imports and unchanged recovery totals/permit links. Verify those backend tests pass without operational database access.

## 2. Request details and message generation

- [x] 2.1 Derive dated-permit date/periods or manual-balance source for each daily RP assignment using its existing permitId; extend frontend response types. Add backend tests proving oldest-linked permit resolution, manual source and unresolved-link handling; verify targeted tests pass.
- [x] 2.2 Add the pure Italian request formatter using the exact spec template and established frontend test convention. Test the full single-period message, multiple sorted periods, three-or-more periods, manual balance and missing room; verify frontend npm test passes.

## 3. Supplenze controls

- [x] 3.1 Add Accettata using existing Comunicato styles and mutation flow, with accessible pressed state and campus restriction explanations. Verify toggling and reload/shared refresh preserve the marker, unchanged saves retain it, and other-campus activation sends no mutation.
- [x] 3.2 Add the labeled copy-icon button, current-row message construction and accessible Copiato/error feedback. Verify successful copy text, clipboard denial/unavailability, unresolved metadata blocking and copying from the other campus without changing acceptance; verify frontend npm test and npm run build pass.

## 4. Isolated integration verification

- [x] 4.1 Start a unique TEST_PROJECT with a mktemp TEST_DATA_DIR using standalone compose.testing.yaml, exported variables, LOCAL_UID/LOCAL_GID and explicit -p; inspect mount and allocated localhost port, then verify /api/environment reports testing=true and the UI shows the red TESTING ribbon before mutations. Verify the RP toggle, copy text and reload behavior in that isolated UI, then stop only this project and record the outcome.
- [x] 4.2 Run the relevant backend suite using an explicit temporary database and review the final diff against the acceptance/message scenarios; verify no production data, operational compose configuration or unrelated files changed.

## Verification record

- 2026-10-28: 34 targeted backend tests passed on temporary databases; frontend npm test passed all 19 test files; npm run build passed. git diff --check passed.
- Isolated project sosticero-recovery-1793171683 mounted /tmp/sosticero-recovery-ui-gJStAj at /data, serving localhost:38291; /api/environment returned testing=true and the red TESTING ribbon was visible before fixture creation. Browser verified RP acceptance, persistence after reload, Copiato and the exact clipboard text including missing-room fallback. Project stopped and removed after verification.
- Production database and operational Compose configuration untouched. Existing changes in useQuietRefresh.ts and concurrency.test.cjs preserved. No deployment or commit.
