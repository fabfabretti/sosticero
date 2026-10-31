# Publish the monitor display

On today's Supplenze screen, Pubblica publishes the logged-in account's campus,
regardless of the table filter. Centrale and Succursale publish independently to
one Cloudflare Pages project. Links retain `/display?campus=centrale` and
`/display?campus=succursale`. Open monitors poll their campus JSON every 30 seconds
without reloading or resetting rotation. Publication time is the snapshot time.

A campus never published shows unavailable. Yesterday's snapshot is cleared at
midnight Europe/Rome; publication is manual unless the daily automatic
publication is configured in Settings. Ordinary edits stay private until a
publication runs. An actually empty published day shows the normal empty state.
Atlante can be offline after publication without interrupting the monitors.

## Server configuration

Use a Direct Upload project, production branch main. The current project is
sosticero-dalcero, https://sosticero-dalcero.pages.dev. No Git integration is needed.
Set these server-side variables in the existing server `.env` (mode 600):

```
CLOUDFLARE_ACCOUNT_ID=<account id>
CLOUDFLARE_API_TOKEN=<Account / Cloudflare Pages / Edit token>
CLOUDFLARE_PAGES_PROJECT=sosticero-dalcero
CLOUDFLARE_PAGES_BRANCH=main
```

The local `.env.cloudflare` is a private operator convenience; it is ignored and
never packaged/deployed automatically. Never use a VITE variable for credentials.
Replace tokens in server configuration and recreate through the deployment script.
Do not print Compose's resolved environment or tokens to logs. Review/install
compose.server.yaml as the server's compose.yaml before deploying when it changes.
Preserve its existing data mount, resource/security settings and proxy network.
Then use `./scripts/deploy.sh`; it snapshots operational data and verifies the
application release. For a preauthenticated SSH master, set
`SOSTICERO_SSH_CONTROL_PATH=/tmp/sosticero-atlante-publish.sock` when invoking it.
The script leaves an externally supplied SSH master open.

## Automatic daily publication

Settings > Pubblicazione stores one Rome-time `HH:MM` (empty disables it). Once
that time has passed, the server publishes both campuses in one release if either
campus is not already published today at or after that time. The check runs every
30 seconds, so a restart after the hour catches up and a manual Pubblica after the
hour suppresses the automatic run. A failed attempt retries every 15 minutes and
the error appears in the Pubblica control. Automatic publication uses the saved
data without a human review step, runs every day including weekends and holidays,
and publishes the normal empty board on days without substitutions.

## Stored snapshots and failures

`/data/publication/state.json` atomically stores committed campus snapshots and any
pending attempt with mode 600. It belongs to server operational data/backups,
never the repository, frontend build or image. The publication lock covers both
campuses. Concurrent clicks return busy; retry after the running operation ends.
Each whole-site upload combines the caller's new snapshot with the other campus's
unchanged committed file. Per-campus snapshot identifiers/timestamps remain stable.

An accepted upload is not success until the stable public URL serves the exact
release manifest and both campus JSON hashes. Upload/verification requests have
bounded timeouts. Failure before activation leaves the committed state alone.
A network failure around activation can mean the new version is already public:
the UI reports an uncertain result, preserves pending data, and status checks
reconcile without uploading again. Restart recovery uses the same mechanism.
If reconciliation cannot establish an outcome, publishing remains blocked rather
than risking another campus's snapshot. Inspect Cloudflare deployment state and
the stable release.json before operator recovery; never delete pending state just
to bypass uncertainty. Restore only through intentional operational recovery.

## Provider protocol and retention

The Python adapter follows Cloudflare workers-sdk's Pages Direct Upload flow:
project upload-token, assets/check-missing, assets/upload, assets/upsert-hashes,
and multipart project deployments with manifest, branch, commit_message and
_headers. Asset keys are the first 32 hex characters of BLAKE3(base64(content) +
file extension), matching deploy-helpers/src/deploy/helpers/hash.ts. The upload
library never logs API responses. Snapshot/HTML responses use Cache-Control:
no-store. All frontend assets are prepared during the application image build.

Cloudflare keeps historical deployments accessible at deployment-specific URLs.
The app does not link to them or promise deletion when a new snapshot is published.
Operators can remove old deployments from Workers & Pages > project > Deployments;
retiring this temporary service includes deleting the project/deployments and
revoking the token. UI midnight expiry does not erase hosted JSON or provider
history. Avoid treating a replacement publication as deletion of prior data.

The initial placeholder smoke deployment used no teacher records. In the measured
run, upload plus stable-URL verification took about 21 seconds; actual latency
varies, followed by up to 30 seconds for a monitor's next poll. This is a measurement,
not a service guarantee. Automated tests mock Cloudflare; never configure real
Cloudflare credentials in compose.testing.yaml or use production for behavioral tests.

## Monitor presentation

The shared display shows a larger page indicator at the bottom right, with a
15-second filling ring synchronized with rotation and pause/resume. Page changes
fade in; reduced-motion preferences disable the fade. Class schedule changes keep
the left-hand space and a paper-signature reminder appears below. Compact badges
beside each class identify saved assignment types (C, D, POT, RP, etc.). Existing
snapshots without these fields remain supported. The next Pubblica uploads the
current static interface and that campus's current assignment types; the other
campus's saved snapshot remains unchanged until its own publication.

Display rows use a shared measured height across both visible tables. Class/type
labels stack consistently, with compact replaced-name text and a full-width
separator above the lower band. After publishing an updated display shell, reload
already-open monitors once to load new interface code; subsequent data changes
continue updating automatically without reloads.
