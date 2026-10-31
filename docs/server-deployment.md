# Sosticero on atlante

## One workflow

From the local project directory, first deployment and subsequent updates use the same command:

```bash
./scripts/deploy.sh
```

It targets `pietroa@atlante:/home/pietroa/server/fabs/containers/sosticero`. The operator runs the first invocation after reviewing the script. Codex has not connected to the server. Future agent-operated invocations require user-requested updates within the approved command scope.

The command packages the current application source, including intended uncommitted changes, while excluding data, credentials and caches. It transfers about 1.1 MiB of source, verifies its checksum and Compose configuration, acquires the project deployment lock, and builds the image on the server using Docker's cache. The running application stays up during the build.

Once the image is built and its source marker is verified, the command stops only Sosticero, creates and verifies a complete private recovery snapshot, persists the selected image in .env, and recreates only Sosticero. It checks the actual container image and the HTTPS environment, source marker and frontend. If backup fails, it resumes the unchanged previous container. A failure after replacement reports actual state without automatically restoring data. Other services, networks and the daemon are not restarted or pruned.

Committing and pushing source do not deploy it. A release packages the working files present when `./scripts/deploy.sh` runs, including uncommitted changes, so the Git branch and live application can differ. The last captured release identifier is `incoming-20261025T181639-70741`. On 2026-10-26 the operator confirmed the live server includes the + Aggiungi entry dialog. Its deployment is confirmed by that observation; a read-only HTTPS check on 2026-10-26 independently verified that the deployed application source marker matches the local application build inputs. The server's `current-release.txt` and image source-snapshot label identify the running snapshot. Do not redeploy merely to tidy Git history.

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

## Latest read-only HTTPS verification — 2026-10-26

The production environment endpoint returned testing=false. The served frontend referenced index-DZuqAXPy.js and index-BQX7lBFr.css; both assets were available over HTTPS. The deployed source marker and a fresh local source snapshot both equal `1f6a766abc5edcf14e2c9e7dacbf2f45326b0ed0722b314d517156ac517e93e6`. This verifies application build-input identity (Dockerfile, .dockerignore, backend and frontend), not deployment-script/configuration identity or database contents. No SSH connection, login, application write or redeployment was performed for this check. Live container state, resource usage and logs were not rechecked.

## Display refinement release — 2026-10-28

Deployed with `./scripts/deploy.sh` as `incoming-20261028T180524-69434`, source snapshot `d2e9914712f3f6eab18d905cb2659fde73c4dd2874f4587782bccd433bf2aa6e`. The script verified the recovery snapshot at `snapshots/incoming-20261028T180524-69434`, replacement image, production environment, source marker and served frontend. Independent read-only HTTPS checks confirmed both `/display?campus=centrale` and `/display?campus=succursale` and the minimal public response with replaced-teacher names and class entry/exit notes. No production behavioral writes or data transfers were performed.

## Cloudflare display publication

See [display-publication.md](display-publication.md) for server-only configuration, publication recovery and provider retention. Deployments can reuse a graphical-password SSH master via `SOSTICERO_SSH_CONTROL_PATH`; ordinary invocations retain their temporary private master.

## Cloudflare publication release — 2026-10-29

Deployed with `./scripts/deploy.sh` as `incoming-20261029T170739-42050`, source snapshot `c968c1c09c56c4f08880e7c23feccd4679b5daad7dc03ec5683daaefbe4e3e44`. Read-only checks verified production environment, served assets, protected publication API and server-only Cloudflare configuration. A separate Cloudflare placeholder smoke deployment verified the display shell and no-store headers in approximately 21 seconds, without teacher data. Backend regression checks (278 tests), frontend checks (25 existing test files plus the new publication checks), and deployment-script checks (10 tests) passed. The isolated testing project was stopped. No production behavioral writes or actual teacher publication were used for verification.

## Monitor rotation and assignment labels — 2026-10-29

Deployed with ./scripts/deploy.sh as `incoming-20261029T172559-54615`, source snapshot `5df56b27b1146e5fcc6f1033231df53d4d681d74203382d987677679de09fa44`. The display adds synchronized pause/resume countdown, fade on page changes, bottom-right pagination, the paper-signature reminder, and per-slot assignment types. Display/publication backend checks (20 tests), frontend display checks and the container build passed. A synthetic multi-page browser check verified countdown movement, a stationary countdown during pause, visible assignment labels and unobstructed class schedule notes. Read-only production checks verified assets and assignment-kind fields. The isolated test project was stopped. Hosted copies receive the shell and the publishing campus's new type fields on the next explicit Pubblica.

## Uniform display grid — 2026-10-29

Deployed via ./scripts/deploy.sh as `incoming-20261029T173540-58540`, source snapshot `50c1f7448bd39a3a691a2ee0f80857be8c00b8c8f99e8e3ae98c44e175d6d53b`. Display tests and isolated container build passed. Browser checks at the default viewport and 1896×881 verified identical visible row heights across tables, consistent class/type stacking, 13px replaced-name text and a separator above the whole lower band. Read-only HTTPS checks confirmed production environment and revised stylesheet. The isolated project was stopped. No teacher snapshots were published.

## Compact neutral display — 2026-10-29

Deployed via ./scripts/deploy.sh as `incoming-20261029T174356-61691`, source snapshot `c92e9cf5f6c0a074587519eb94f3c8fafe30243b4e0b1766d7ce8f37c6af5d4b`. The display now uses 15px teacher names, 16px class codes, neutral headers, unboxed assignment codes and a plain signature reminder. The isolated build and browser checks at 1896×881 and 1280×720 confirmed uniform rows and an unclipped footer. Read-only HTTPS checks verified production environment and the new stylesheet. The isolated project was stopped; no teacher snapshots were published.
