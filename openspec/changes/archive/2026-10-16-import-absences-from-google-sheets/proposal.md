# Proposal

## Why

The office already submits teacher absences through Google Forms. Reading its response sheet into a review Inbox avoids retyping while keeping a person in control of calendar changes.

## What Changes

- Configure a private Google Sheet and upload service-account credentials in Settings; store secrets under gitignored `data/keys/`, excluded from exports and backups.
- Check the sheet every 30 seconds on the backend and persist all responses on first connection, then unseen submissions, without modifying Google data.
- Add an addressable Inbox and persistent, noninterrupting global notification/count and short new-entry chime using the existing visual design.
- Accept or ignore submissions; acceptance unions absence hours with existing entries, preserves metadata, appends the import provenance note once, and commits processing status atomically.
- Support whole-day, inclusive weekday ranges, and nonrecoverable hourly absences; surface invalid data and unresolved teachers for review.
- Use compact rows with names first, conditional teacher reassignment, original submission times and existing hour-chip styling; refresh badge counts immediately with the list.
- Retain processing history across restarts and source-row deletions; manual calendar corrections remain authoritative.

## Capabilities

### New Capabilities

- `absence-inbox`: Private Sheets connection, polling, durable submission review and safe acceptance into absences.

### Modified Capabilities

- `app-shell`: Add Inbox navigation, stable route and global background notification without disturbing active forms.
- `data-backup`: Keep Google credentials outside database backups and exports, preserving installed credentials during restore.

## Impact

Backend factory lifecycle, storage, absence mutation/statistics, settings and new Inbox APIs; frontend shell, Settings, Inbox and existing styles; backend Google authentication dependency and tests; explicit key-directory ignore rule. Existing manual entry semantics stay compatible. No Google writes, OAuth login, automatic acceptance, source-edit synchronization or deployment changes are included.
