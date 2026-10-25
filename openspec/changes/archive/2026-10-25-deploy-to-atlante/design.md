# Design

## Context

The user explicitly simplified the original design: operator-executed first deployment, one explained command at a time, using the existing password-authenticated account and existing Docker project layout. No commits until deployment has been tried. Previous custom privileged helper/client and protocol were removed locally before any installation.

Atlante is amd64 with Docker Compose 5.1.0 and Python 3.12.3. The selected project folder is /home/pietroa/server/fabs/containers/sosticero; the user created it. Nginx runs on npm_npm_proxy and the existing certificate covers sosticero.iamfabs.dev. Other services must remain untouched.

## Goals / Non-Goals

**Goals:** One local command for source sync and server builds, reviewed manual installation, persistent server data, recovery copies and repeatable requested updates.

**Non-Goals:** Dedicated deployment accounts, forced-command helpers, custom upload protocols, registries, local image exports, data mirroring, automatic data rollback or zero downtime.

## Decisions

- Copy standalone compose.server.yaml into the chosen folder as compose.yaml. Bind ./data beside it; refuse automatic creation of a missing data directory. Require actual LOCAL_UID/LOCAL_GID and a selected prebuilt SOSTICERO_IMAGE. Keep ordinary local deployment files unchanged.
- Use service/alias sosticero on the existing external npm_npm_proxy network, avoiding Nginx's app alias. Publish no host port. Set the exact HTTPS APP_ORIGIN and preserve the original Host header at the proxy.
- Retain verified resource limits (1 CPU / 1 GiB / no additional swap), bounded logs and existing container security settings. No permissions on existing parent directories are changed.
- scripts/deploy.sh is the single entry point for first installation and updates. prepare-source.py packages a content-identified snapshot of current application files, including intended uncommitted code, excluding data/secrets/caches. Transfer this small source archive with SSH/SCP, verify its checksum, and build on the server under a deployment lock. Keep the old application running until the new image is built and checked. Record source/image identity without pretending the snapshot is a Git commit.
- Data moves once, manually, before first deployment. Stop source writers and copy the complete data folder into the empty server destination, including accounts, keys and hidden metadata, or use the retained tested installation-data.py transfer tool. Keep the local source stopped after cutover. The routine deployment command requires existing operational databases and never uploads local data.
- The same deployment script uses the existing account for reviewed operations: preflight, unique source staging, checksum/config validation, serialized Docker build, complete verified stopped-data snapshot, and recreation of only Sosticero. It persists the selected image in .env, preserves prior configuration and image identity, and checks the container plus HTTPS environment/source marker/frontend. Snapshot failure resumes the unchanged old service; post-start failure reports state without automatic restore. Codex runs future requested updates only within the approved scope. SSH multiplexing permits one password login per invocation; a key can follow for agent-operated updates.
- Recovery that replaces data requires explicit approval and preservation of current data. Select protected off-server backup storage and retention with the operator.

## Risks / Trade-offs

- The operator account's Docker access is powerful: execute only reviewed scoped commands; a key can be added later without inventing another privilege system.
- Network access restrictions are installation-specific and are not a project requirement; shared network policy is outside deployment scope.
- Snapshot/recreation briefly interrupts Sosticero: build and transfer first, and leave unrelated services running.
- Old images may not accept migrated data: preserve complete recovery state and never automatically restore data.

## Migration Plan

Prepare and copy Compose first; then inspect numeric identity and validate configuration; migrate consistent data once; run the single source-sync/server-build deployment command; review HTTPS proxy routing; activate only Sosticero and perform read-only checks. Every server step is operator executed and explained before proceeding.

Server builds consume transient CPU/RAM in addition to runtime limits. Their peak usage is not measured yet; the script checks free disk and builds before stopping the existing application, but does not claim build-resource isolation.
