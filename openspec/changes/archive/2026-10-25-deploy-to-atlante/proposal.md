# Proposal

## Why

Sosticero needs a persistent deployment reachable at https://sosticero.iamfabs.dev through the user's existing Nginx Proxy Manager setup. Development should remain local, with repeatable updates that do not disturb the sensitive server's other services or overwrite live data.

## What Changes

- Add a standalone Docker server Compose configuration running the amd64 image built on the server, persistent data, and the existing external proxy network, without published host ports.
- Provide a user-executed first-install runbook with exact commands, safe initial data migration, HTTPS verification, using the existing operator account.
- Add one local command to transfer a source-only snapshot, build on the server, and deploy that Codex can run for user-requested updates after the remote command scope has been reviewed and approved.
- Keep release identity, bounded resource usage, serialized deployments, protected recovery snapshots, and explicit recovery instructions.
- Preserve local Podman deployment and isolated development/test workflows.

## Capabilities

### New Capabilities

- `server-deployment`: Reviewed first installation and repeatable, scoped remote releases with persistent data and recovery.

### Modified Capabilities

None. Existing application backup/export behavior is unchanged; private whole-installation recovery is an operator concern and must not expose account or integration secrets through downloadable backups.

## Impact

New server Compose configuration, local deployment scripts and checks, and operator documentation. Uses existing Dockerfile, authentication origin configuration, and proxy network. No new application service, registry, public host port, database synchronization, or unattended deployment. The same source-sync/server-build workflow is used from the first deployment onward, following a separate one-time manual data transfer. First installation is performed by the user; later automation follows the verified manual commands under reviewed authorization. No dedicated account, privileged helper or custom upload protocol is required. The user chose /home/pietroa/server/fabs/containers/sosticero and explicitly wants to try a reviewed working-tree snapshot before committing. Existing unrelated local changes are excluded from planning edits and must be explicitly accounted for when selecting a release source.
