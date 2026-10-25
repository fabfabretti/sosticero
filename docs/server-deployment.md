# Sosticero on atlante

## One workflow

From the local project directory, first deployment and subsequent updates use the same command:

```bash
./scripts/deploy.sh
```

It targets `pietroa@atlante:/home/pietroa/server/fabs/containers/sosticero`. The operator runs the first invocation after reviewing the script. Codex has not connected to the server. Future agent-operated invocations require user-requested updates within the approved command scope.

The command packages the current application source, including intended uncommitted changes, while excluding data, credentials and caches. It transfers about 1.1 MiB of source, verifies its checksum and Compose configuration, acquires the project deployment lock, and builds the image on the server using Docker's cache. The running application stays up during the build.

Once the image is built and its source marker is verified, the command stops only Sosticero, creates and verifies a complete private recovery snapshot, persists the selected image in .env, and recreates only Sosticero. It checks the actual container image and the HTTPS environment, source marker and frontend. If backup fails, it resumes the unchanged previous container. A failure after replacement reports actual state without automatically restoring data. Other services, networks and the daemon are not restarted or pruned.

Committing and pushing source do not deploy it. A release packages the working files present when `./scripts/deploy.sh` runs, including uncommitted changes, so the Git branch and live application can differ. The last operator-confirmed release is `incoming-20261025T181639-70741`; later dialog work remains pending deployment. The server's `current-release.txt` and image source-snapshot label identify the running snapshot. Do not redeploy merely to tidy Git history.

Preview the scope locally without any connection:

```bash
./scripts/deploy.sh --dry-run
```

SSH uses the existing account, verified host keys and a temporary multiplexed connection so password authentication can be reused within one invocation. There is no dedicated deployment account, privileged helper or custom upload protocol. A key can be configured later for agent-operated updates. SSH errors are reported; configuration/security checks are not bypassed.

## One-time setup status

The operator created the project directory, copied standalone compose.server.yaml there as compose.yaml, recorded LOCAL_UID=1000 and LOCAL_GID=1000 in .env, and validated the Compose configuration without starting a service.

The operator completed the stopped-source initial data copy and first deployment on 2026-10-25, configured the HTTPS proxy, and confirmed existing data is visible in the live application. The deployment command verified its pre-start snapshot and the served release. Runtime inspection confirmed the expected data mount, UID/GID, proxy network, resource limits and security settings, with no published host ports, restarts or OOM kills. File-by-file migration comparison and a restore rehearsal have not yet been confirmed.

## Data moves once

Stop all writers to the local operational data folder before copying it. Copy the **whole** folder into the initially nonexistent server data directory, including hidden files, supplenze.sqlite, auth.sqlite, installed integration keys, generation metadata, attachments, backups and any WAL/SHM files. Use the existing operator account so server data is owned by UID/GID 1000. Keep private directory permissions and preserve the original local copy.

A manual recursive directory copy is suitable while all writers are stopped. Alternatively, scripts/installation-data.py packs a stopped installation and restores it into a new destination with content/integrity checks and overwrite refusal. We will review the exact stop/copy/verification commands one at a time. Codex will not stop local service or perform this production data move implicitly.

After cutover, server data is authoritative. Keep the old local operational app stopped to prevent divergent writes; use isolated testing databases for development. Routine deployment never uploads, mirrors or replaces local/server data. If cutover fails after the server has accepted writes, do not blindly resume an outdated local copy.

## Runtime configuration

The server's compose.yaml is standalone. Its relative ./data bind resolves beside it and refuses automatic creation of a missing directory. Required operator UID/GID match file ownership. The deployment command writes SOSTICERO_IMAGE into .env after the new image and recovery snapshot are ready.

One service/alias named sosticero uses the existing external npm_npm_proxy network, avoiding Nginx's generic app alias. No application host port is published. Nginx forwards sosticero.iamfabs.dev to http://sosticero:8000, preserving Host and using the existing wildcard certificate. APP_ORIGIN enables secure cookies and origin validation. Network access restrictions are installation-specific; deployment does not modify shared firewall or proxy-wide policy.

Runtime limits remain 1 CPU, 1 GiB RAM without extra swap, 128 processes and bounded logs. The application has a read-only root filesystem, writable temporary /tmp, dropped capabilities and no Docker socket. Builds on the server also consume temporary resources; runtime limits do not cap the build. Peak build usage has not yet been measured. Preflight reserves disk space and build failure happens before the running service is stopped.

## Recovery and backups

Complete pre-update snapshots live in snapshots/incoming-TIMESTAMP-ID beside data, with prior .env, Compose configuration, image ID and release identity when available. They contain account/session information and integration secrets: keep them private and copy verified recovery points to protected off-server storage on an operator-chosen schedule. Application backups alone are not full installation recovery. Low disk space blocks deployment; no automatic global cleanup is installed.

Never automatically restore old data or run an old image against a potentially migrated schema. Restoration requires explicit approval acknowledging lost writes, preservation of current data, and matching verified image/configuration. Report the actual image and database mount if recovery fails.

## Local verification

Run `python3 -m unittest discover -s scripts/tests -v` and `bash -n scripts/deploy.sh`. Ten focused checks cover source/data separation, snapshot identity, complete stopped-data transfer and integrity checks, configuration, dry-run with no SSH, and actual remote-shell failure handling using fake Docker and disposable directories.

Previous isolated container tests confirmed the red TESTING ribbon, import/save/readback and runtime limits with 300 teachers / 9,000 lessons (0.823-second import, about 83 MiB peak). Those were local measurements, not server build or concurrent-production benchmarks. Behavioral tests continue to use only standalone compose.testing.yaml with unique project/mktemp data and an allocated localhost port. No commit is required or authorized before the user has tried deployment.
