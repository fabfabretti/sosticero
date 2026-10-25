# Tasks

## 1. Simple server configuration

- [x] 1.1 Adapt standalone Compose to the chosen folder with relative ./data, required operator UID/GID, existing proxy network, no host ports and bounded resources; verify rendered configuration and assertions.
- [x] 1.2 Remove the unused custom helper/protocol and document the operator-executed approach; verify remaining data-transfer tests pass and old client/helper references are removed.
- [x] 1.3 Preserve the approved TESTING ribbon fix and completed isolated resource rehearsal; verify 300-teacher/9,000-lesson import and save/readback under 1 CPU/1 GiB (0.823-second import, approximately 83 MiB peak, no OOM kills), with test project stopped and ordinary local service untouched.

## 2. First deployment, one step at a time

- [x] 2.1 Have the operator copy Compose into the created project folder, inspect numeric UID/GID, prepare environment values and validate Compose without starting a service; verify operator output.
- [x] 2.2 Implement source-only snapshot preparation supporting reviewed uncommitted files with content/archive identities and excluded data/secrets/caches; verify tests and actual source packaging without any server connection.
- [x] 2.3 Use scripts/deploy.sh for the first source sync and server build after one-time data migration and proxy review; verify actual Docker build and runtime source marker without switching deployment methods.
- [ ] 2.4 Guide the agreed stopped-source complete data migration using the retained tested transfer tool; verify empty-destination checks, content integrity, accounts/keys and permissions before startup.
- [ ] 2.5 Review the Sosticero HTTPS proxy entry, activate only its Compose project, and verify actual mount, production environment, selected frontend/image and HTTPS login; record off-server recovery verification.

## 3. Repeatable updates after first installation

- [x] 3.1 Implement the single reviewed source-sync/server-build/update command with installation-scoped serialization, previous image/configuration, complete verified pre-update snapshots and read-only release verification; test build/snapshot/post-start failure paths and prove dry-run never connects. First server execution passed; a later repeat-update acceptance run is not yet recorded.

## Workflow follow-up

- No commits until the user requests them; the user explicitly wants deployment tried first.
- Archive only when pending operator acceptance and update automation are complete.

## Verification notes

The previous 26-test suite included the removed custom protocol and is historical, not the current suite. The current five tests cover snapshot identity and data/secret/cache exclusions, symlink refusal, and server configuration, complete stopped-data transfer/recovery with corruption/overwrite refusal, and WAL integrity validation without source modification. Earlier isolated container/visible ribbon/resource results remain valid for unchanged application/runtime limits. The new relative mount and operator UID/GID configuration are rendered/asserted locally and were also validated successfully by the operator on Docker with UID/GID 1000:1000. No SSH connection, server installation, image/data transfer or activation has been performed by Codex.

Operator confirmed configuration copied, UID/GID 1000:1000 recorded, and Docker Compose configuration validation passed. Local build-release.py produced a reviewed working-tree snapshot without requiring a commit. Image localhost/sosticero:snapshot-920fbc500ad9800b; image ID c60dae17a4298a814fdea49fb85af8e06ed10b4f798ca0f6eef4ed5820bfadc6; archive /tmp/sosticero-release-20261025-01/image.tar (197,878,272 bytes), SHA256 b4b8073201a9eb9fde00336aa7e2080e84b070c8717a0f1cab2efa971c960faa. Built frontend and snapshot marker were checked directly in the image. No app was started against a database, normal service was not restarted, and no SSH connection was made.

The user clarified the fixed objective: one local command must sync source and rebuild on the server from the first deployment onward. The local image-export route was superseded. scripts/deploy.sh and prepare-source.py implement this workflow; ten focused tests pass, including the actual remote shell run with fake Docker against disposable installations. The real source-only package is 1,157,120 bytes (about 1.1 MiB). No SSH connection or server build has been attempted. Initial complete data transfer is a separate manual prerequisite and is never repeated by the deployment command.

## Operator acceptance — 2026-10-25

The operator completed the initial stopped-source recursive data transfer and accepted the live application with existing data visible. Release incoming-20261025T181639-70741 passed the complete pre-start snapshot check, activation and HTTPS environment/source/frontend checks. Runtime inspection confirmed the intended ./data mount, UID/GID 1000:1000, external proxy network, no published ports, 1 CPU, 1 GiB memory with no additional swap, 128 PIDs, read-only root filesystem, dropped capabilities and no-new-privileges. RestartCount was 0 and OOMKilled false. Earlier image checks failed before data activation; the final-image permissions fix resolved them.

The operator confirms their own network access restrictions; they are not a project requirement. Tasks 2.4 and 2.5 remain partially verified: file-by-file migration comparison, off-server recovery and restoration rehearsal have not been demonstrated. A repeat update has not yet been demonstrated. No server command was executed by Codex and no commit or archive was made. Earlier notes describing activation as pending are historical.

## Archive decision

Archived at the operator’s explicit request after live deployment acceptance. The two partially verified tasks remain unchecked; migration checksum comparison, off-server recovery/restore rehearsal and a repeat-update run are not claimed as passed. The server-deployment delta was synced into the main specification and both validated strictly before archiving.
