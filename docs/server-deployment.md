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

## Named accounts and protected administrator upgrade

The new release classifies Settings authority by administrator permission, not campus.
Before stopping the existing service, deploy.sh runs the new image's read-only
`backend.admin_upgrade --check` against installed identities. For the original
installation it requires the explicitly verified accounts `centrale / Centrale /
centrale` and `succursale / Succursale / succursale`. Different legacy installations
must use local bootstrap and verify/map legacy users explicitly; no automatic guessing.

After the complete stopped-data recovery snapshot, the script runs the same upgrade
without `--check`, migrates identities preserving IDs/password hashes/enabled states,
records historical campus mappings and creates `admin / Amministratore` with no
substitution grants. Its random initial password is written exclusively to
`data/keys/admin-initial.txt` with mode 0600, never to logs or command arguments.
Existing Centrale users do not gain administrator privileges. Legacy sessions are
revoked. The app refuses production activation without an enabled protected admin.

Retrieve the initial credential file privately and reset the admin password from
Amministrazione after first login. Remove the initial file once credentials are
safely retained. Password recovery remains available through the local `backend.auth
reset admin` command (or the account's current username). Do not commit credentials.

Interrupted identity preparation can be retried: the schema and legacy mapping are
idempotent, and a valid private initial credential file is reused rather than replaced.
Already initialized installations keep the existing protected account and credentials.
A deployment failure reports state without automatically restoring data. If recovery
requires rollback, use the previous image and complete coordinated installation snapshot
through an explicit recovery procedure; never run old code against a migrated store by
assumption or overwrite newer operational records automatically. Production release
checks remain read-only; account behavior is verified on isolated testing projects.

### User administration release verification — 2026-11-03

Deployed with `./scripts/deploy.sh` as `incoming-20261103T131722-147243`.
Source snapshot: `594e538a36e8dea80d27dea450d630e4aad8681a1a14890676e732d57223a40e`.
Independent HTTPS checks confirmed testing=false, the exact local source marker,
served `index-B3c425mg.js`, anonymous denial of account/operational APIs and both
public display endpoints. Read-only inspection confirmed the production mount,
protected admin-only account, original campus grants and 77 historical author snapshots.
Fingerprints matched operational records (excluding intentionally migrated authors),
attachments, original account IDs/passwords and other documents; only background
`googleSheetsStatus` changed. No production behavioral tests or test-data transfers ran.

Verification included the 299-test backend suite; its sole remaining failure was
an unsupported-schema fixture still using the newly supported version 9. Updating
that fixture to version 10 passed all 12 attachment tests. The subsequently added
effective-timetable Settings-summary regression also passed. All 30 frontend test
files, five focused publication checks, ten deployment checks and production builds
passed. The unique isolated container verified admin/operator/no-role behavior,
author snapshots and Settings access; browser checks covered full-name display,
protected controls, direct routes and desktop/mobile layouts in both themes.
The isolated Compose project was stopped afterward.

### Current account names correction — 2026-11-03

Deployed as `incoming-20261103T132953-153063`, source `6ac25abbf96a9e38a50e5f82923e4b722505166d8c32bc531f1172ab3a85d84a`.
Permessi, Banca ore and Inbox now resolve current names/usernames by account ID
for display, with stored snapshots as missing-account fallbacks. The 66 related
backend tests passed; an isolated container/browser reproduced Centrale renamed
to Fabiola Fabretti and verified the updated Inserito da label. Stored snapshots
and concurrency tokens stayed unchanged. The test project was stopped. Read-only
production fingerprints confirmed all operational documents, authors, attachments
and account records unchanged (excluding background Google-sync status). The
deployed resolver matched Fabiola Fabretti for the existing linked permit record;
HTTPS environment, exact source marker, frontend and authentication checks passed.

### Permit deadlines and register — 2026-11-03

Deployed with `./scripts/deploy.sh` as `incoming-20261103T142823-164418`, source
`bff42a5c2e06b6562cec75324e90c083968422396fdd0feb4d9308ea3bc52f37`.
Dated permits now expire after two calendar months, clamped to the target month's
last day. The register shows sortable days remaining, highlights outstanding rows
under 30 days and filters by author account identity. Nine recovery tests, the
register tests and production builds passed. The frontend suite passed 29 files;
the remaining sidebar file exposed two outdated permit fixtures/assertions, which
were corrected and its focused permit checks then passed. The isolated container's
mount, allocated localhost port, testing environment, red TESTING ribbon and served
bundle were checked; the project was stopped afterward. Deployment and independent
read-only HTTPS checks confirmed the expected source marker and testing=false.
No production behavioral writes were used.

### Administration configuration navigation — 2026-11-03

Deployed with `./scripts/deploy.sh` as `incoming-20261103T222228-23950`, source
`0d30f9043292e5edcf307a73f4b74f380b86104ecdcff044ae734689dfd6b452`.
Shared configuration groups now live under Amministrazione → Configurazione;
Impostazioni retains personal appearance and build information. All 30 frontend
test files and production builds passed. The unique isolated container verified
its temporary mount, allocated port, testing environment and red TESTING ribbon;
browser checks confirmed both menu destinations. The test project was stopped.
Deployment checks verified the recovery snapshot, production mount and HTTPS
release. Independent read-only HTTPS checks confirmed testing=false, the exact
source marker and served frontend. No production behavioral writes were used.

### Statistics tabs and absence breakdowns — 2026-11-04

Deployed with `./scripts/deploy.sh` as `incoming-20261104T124419-146290`, source
`08437cbd6b75310c93b60c419c9f2938bc4a80cc66ed70f1fc104c5cd2b45978`.
Statistiche now groups historical analyses, weekly availability and class/teacher
summaries into remembered tabs, with contextual metric help and absence-type
percentages based on teacher-hours. CSV and full print preview include the new
breakdowns; availability retains its independently selected week.

The 34 focused backend tests and all 31 frontend test files passed, along with
production builds. Final focused checks also covered name overrides, teachers
removed from later timetables and the pie legend. The unique isolated project
verified its disposable mount, allocated port, testing environment and red ribbon;
browser checks covered tab persistence, future-week preservation, empty historical
periods, both themes, narrow-screen help and complete preview chart dimensions.
The test project was stopped. Deployment verified the existing production mount,
complete recovery snapshot, expected replacement image and HTTPS release.
Independent read-only HTTPS checks confirmed testing=false, the exact source
marker and available `index-zjN6TU02.js` / `index-CesPA8lM.css` assets. No production
behavioral writes or test-data transfers were performed.

## Teacher portal

The personal portal is served at `/docenti`; its independent cookie is scoped to `/api/teacher`, with a twelve-hour absolute lifetime. It never grants office permissions. Teacher login uses manually configured institutional email identifiers and generated eight-digit PINs; no email service or Google configuration is required. Configure access in Amministrazione → Gestione docenti → Docenti (see `docs/gestione-docenti.md`).

Teacher credentials/session tables are additive in `auth.sqlite`, remain outside portable school-data archives, and are covered by the installation's protected identity-store backup procedure. Deployment creates no enabled teacher account. Do not copy testing identities to production. Person links unresolved after school-data restore fail closed rather than matching names or timetable sources.

Before non-loopback use, configure the existing trusted `APP_ORIGIN` to the actual HTTPS origin; cookies then use Secure. Same-origin checks apply to login/logout and teacher unsafe requests require their own CSRF token. Do not use arbitrary forwarded headers to establish trust. Teacher login temporarily limits failures to five per normalized identifier and thirty per client source in fifteen minutes, with bounded attempt storage; there is no permanent lockout. PIN/email/status changes revoke prior sessions. Private API responses use `Cache-Control: no-store`; do not configure a proxy/CDN to cache authenticated teacher endpoints. The timetable-only portal has no notification or publication integration.

## Teacher portal release — 2026-11-06

Deployed with `./scripts/deploy.sh` as `incoming-20261106T091706-82086`, source snapshot `25b09ea2e95f181fd9a126ac3727c422aa90ab1b2b6b701823f80188a1ae8fd5`. The script verified the recovery snapshot, replacement image, production environment, source marker and frontend. Independent read-only HTTPS requests verified `/docenti`, the expected snapshot, both served assets and 401 responses for anonymous personal timetable/session and teacher-administration requests. No production teacher accounts were configured or activated by verification.

Verification included 347 passing backend tests, the complete passing frontend suite, a successful build, and isolated container/API/browser checks with synthetic identities (including distinct personal timetables and PIN-reset revocation). Desktop administration and a 390px teacher timetable were visually checked. The uniquely named testing project was stopped after verification; operational local Compose was not started.

## Paid substitution budgets — 2026-11-06

Deployed with `./scripts/deploy.sh` as `incoming-20261106T093054-87493`, source
snapshot `7d9c4d5f2a63a72e437c7654a4439f411194c13b54ec9ca361d8e652650e4d5a`.
The script verified the recovery snapshot, selected image, operational mount,
production HTTPS environment, source marker and frontend. Independent read-only
HTTPS checks confirmed testing=false, the matching snapshot, served assets
`index-CDW5uJFU.js` / `index-D5uRROGh.css`, and authentication on `/api/paid-finance`.

Backend regression: 349 tests passed. Frontend regression: 254 tests passed,
followed by 76 targeted checks including the added drawer budget-warning test.
The isolated container verified initial pricing and repricing of existing paid
assignments on a second tariff save, per-sede/combined usage, mobile layout,
light/dark themes and successful over-budget assignment with visible feedback.
The isolated project was stopped. Production checks made no financial settings
changes and created no operational records; budgets and rates remain optional
until configured by an administrator.

## Teacher-access UX correction

Teacher administration now separates a persistent email-editing toolbar from immediate access actions. Administrators can activate one teacher, selected teachers or all eligible teachers with saved email addresses. Activation atomically creates only missing PINs and preserves existing PINs; deactivation revokes sessions immediately. Generated codes remain in a one-time in-memory copy/download panel until explicitly dismissed. See `docs/gestione-docenti.md` for the revised setup workflow.

Production login investigation was read-only: the reported account was enabled, its supplied PIN matched the stored hash and its person existed in the current teacher catalog. Five failed requests were recorded; the original entered values could not be reconstructed from logs, which do not store credentials. No production PIN was reset and no attempt counter was changed. Teacher login now trims surrounding pasted whitespace and provides an explicit PIN visibility control; office and teacher entry controls are visually distinct. Generic credential failures and temporary limits remain enforced.

### UX correction deployment — 2026-11-06

Deployed `incoming-20261106T194509-34560` with source snapshot `cf55fd263914d9d7bb5d8bea9805a38a69bd54688356d109f1eaabf795dd088b` using `./scripts/deploy.sh`. The deployment verified the recovery snapshot and live image; independent HTTPS checks verified testing=false, the expected source marker, `/docenti`, served assets and anonymous API denial. A final read-only account check confirmed the reported teacher remained enabled at revision 3 with a PIN and no active account-level temporary limit. Credentials and attempt counters were not changed by diagnosis or verification.

All 352 backend tests, the full frontend suite, focused interaction tests and the production build passed. Isolated API checks covered bulk first activation, distinct personal logins, padded PIN input, immediate deactivation/revocation and reactivation without resetting the PIN. Browser checks covered email mode, desktop/mobile layouts and pasted-PIN login. The unique testing project was stopped; normal local Compose remained stopped.
