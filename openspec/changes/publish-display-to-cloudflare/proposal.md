# Proposal

## Why

School monitors need today's substitution display while the operational app remains hosted on atlante. An explicit publication to Cloudflare Pages provides this temporary public service without putting teacher snapshots in the public GitHub repository.

## What Changes

- Add a top-right Pubblica action aligned with the date title on today's Supplenze view, publishing only the logged-in account's campus, independently of the table filter.
- Publish the existing /display presentation and the account campus's snapshot directly from atlante to Cloudflare Pages.
- Keep one Cloudflare project with centrale.json and succursale.json; preserve the other campus’s last published file on every upload.
- Preserve automatic refresh, layout, campus links and pagination without reloading open monitors.
- Show publishing progress, failures, per-campus last verified publication time and public links.
- Keep credentials server-side and snapshots out of Git, source archives and image layers; document installation and recovery.

## Capabilities

### New Capabilities

- `display-publication`: Explicit publication, delivery and monitoring of a static copy of today's display.

### Modified Capabilities

None. The existing live /display remains available with its current contract; this introduces a separate snapshot-backed delivery mode.

## Impact

Frontend Display.tsx/display.ts and its build entry, Supplenze controls in main.tsx, backend display projection and authenticated publication endpoints, Cloudflare upload integration, persistent publication metadata and server configuration/deployment documentation. Cloudflare project: sosticero-dalcero. The current image has no Node runtime, so uploading must use a Python-compatible integration or a deliberately packaged standalone tool. Existing display change artifacts are completed but not yet archived and must be respected. No implementation or deployment is part of this proposal.
