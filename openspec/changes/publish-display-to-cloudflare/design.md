# Design

## Context

See proposal.md for motivation. backend/display.py already provides a minimal projection; backend/main.py reads it in a SQLite transaction. Display.tsx and display.ts implement campus selection, layout measurement, 15-second rotation, 30-second polling and Rome midnight handling. The completed add-campus-substitution-display change contains the authoritative unarchived display requirements; main user-auth specs still lack its public exception. Preserve that existing delta rather than duplicating or reverting it.

The runtime image is Python-only. The local .env.cloudflare is ignored by Git and Docker; it is not automatically installed on atlante. Routine deployment refuses unexpected Compose changes and deliberately excludes secrets and operational data.

## Goals / Non-Goals

**Goals:** Reuse the same display renderer and behavior; independently serve explicitly published snapshots; keep ordinary publication independent of Git and frontend rebuilding.

**Non-Goals:** Live streaming of operational edits, new public columns, publishing the operational app, GitHub data commits, public historical browsing, automatic scheduled publication, or domain/DNS migration.

## Decisions

### Shared display renderer, dedicated static build

Produce a dedicated static entry using Display.tsx, its CSS and shared display logic, selecting the snapshot transport at build/entry level. Keep the live transport unchanged. Package the publication shell during the application build, not on each button press. Avoid a copied HTML implementation because it would drift from /display. Serve the existing /display path and query links, with suitable static routing. Include no operational API client or runtime secrets in the public build.

### Two campus files in one Cloudflare site

Keep centrale.json and succursale.json in a private persistent publication directory on atlante, outside source/build inputs. Each campus snapshot has its own Rome day, captured timestamp and opaque snapshot identifier. A release manifest identifies the complete Cloudflare deployment and the expected hash/identifier of each campus file. The public /display reads only its selected campus file. Apply no-store headers to snapshot files, manifest and entry HTML, and no-store/cache-busting fetches; hashed assets can remain cacheable. Keep the common renderer and rotation timer intact.

A Centrale publication captures only Centrale's current saved projection. Build a candidate release from that new file and Succursale's last verified published file, byte-for-byte; never regenerate the other campus from operational data. A Succursale publication reverses this. Upload the whole static site to the existing sosticero-dalcero project. This follows Cloudflare's whole-site deployment model while preserving independent publication. A campus never yet published has an explicit unavailable sentinel, not a fabricated empty-day snapshot. An actual published empty day remains a valid empty state. Old dates on the other campus remain unchanged and are rejected by that monitor's existing Rome-date check.

### Account-scoped asynchronous publication

Both Centrale and Succursale accounts can publish, but only their own campus. The server derives campus from the authenticated identity, never from a table filter or caller-supplied override; reject attempts to name a different campus. Add status GET and publication POST endpoints under existing session/CSRF protection. The POST validates today against server Rome time and starts bounded work; the UI shows the target campus explicitly and polls status. Capture saved server data, not browser state.

Use one process-independent publication lock: reject overlapping attempts as busy so a second click can be retried against the latest published files. Under the lock, reconcile any uncertain prior deployment, read committed campus files, capture the caller's campus in a read transaction and stage a complete candidate. Do not hold the database transaction during network calls. Persist pending candidate files and attempt metadata before upload. After verifying the stable public manifest and both file hashes, atomically promote the candidate publication state and advance only the initiating campus's last-success time. Preserve the other campus's file, identifier and timestamp.

On upload failure before activation, discard the candidate and keep committed snapshots. If activation may have happened or the process restarts, preserve the pending candidate and reconcile its release identifier against Cloudflare before allowing another upload. Never rebuild from uncertain state or silently advance success metadata. Bound network work and do not automatically replay writes. A request crossing Rome midnight must not be reported as a new-day publication; monitor date validation prevents showing yesterday's data as today.

### Direct Cloudflare API integration

Use a Python uploader against the documented Pages Direct Upload API, reproducing the required asset hashing, missing-asset upload and manifest-based deployment steps. Confirm the current API contract during implementation with a harmless fixture deployment; pin the contract in adapter tests. This avoids adding Node/Wrangler to the running Python image. Use Cloudflare's atomic deployment activation rather than per-file public mutation. A git-triggered build was rejected because snapshots must bypass GitHub and ordinary source commits must not publish data.

Bound request sizes, network deadlines and verification polling. Treat upload acceptance separately from verified public success. Verify the stable configured URL and the release manifest and both campus file hashes against the candidate release, not a preview URL alone. If activation succeeded but verification times out, record uncertainty and reconcile before a later attempt; never claim the previous release necessarily remains active in this case.

### Configuration and staging

Read account id, API token, project and production branch from server-only environment/configuration. Target sosticero-dalcero, main, https://sosticero-dalcero.pages.dev. Validate configuration without echoing secrets. Store upload bundles in private temporary directories and clean them after resolution; retain durable pending candidates only while needed for crash/uncertainty recovery. Never place snapshots under tracked paths, source archives or image layers. Keep .env.cloudflare outside build context; install its replacement token securely on atlante and explicitly wire server environment. Do not use VITE-prefixed credential variables. Unit/container tests mock uploads and never target the real project.

## Risks / Trade-offs

- Provider caching/propagation delay → explicit headers, release verification and measured latency; no promise of seconds before measurement.
- Previous deployments may remain accessible through provider preview URLs → no archive links in the product; document Cloudflare retention and cleanup before rollout.
- Upload API complexity → a narrow adapter with recorded harmless fixtures and explicit error handling; no ad hoc untested protocol guesses.
- Network failure after activation → uncertain state plus reconciliation, preserving last verified success metadata.
- Existing unrelated loading-feedback edits → integrate against current shared renderer without overwriting them.

## Migration Plan

1. Implement and verify entirely with isolated databases and mocked provider calls, then perform a harmless provider smoke deployment before any teacher publication.
2. Install server secrets separately from source deployment; verify production Compose/env wiring with no secret output. Keep the old local operational app stopped.
3. Run ./scripts/deploy.sh and read-only deployed release checks. Do not publish teacher data as a deployment verification action; first real publication is the user's explicit button action.
4. Roll back the application release through documented deployment recovery if necessary. Leave the last hosted snapshot intact; it expires visually at Rome midnight. Retiring the workaround later includes removing hosted deployments and revoking the token.
