# Design

## Context

See proposal.md for motivation. `backend/domain.py` derives availability category D and its effective origin campus from manual `disSites`, otherwise the timetable, including automatic class-out availability. Substitution rows contain the destination campus, class and room. `backend/main.py` currently restricts accepted/communicated mutations to RP, PAID and special assignments. `RecoveryActions.tsx` and `PaidActions.tsx` supply existing control and clipboard patterns; their signatures are hardcoded. Accounts already expose a validated `name` field. Concurrency currently hashes each assignment with its row context.

## Goals / Non-Goals

**Goals:** Keep eligibility, grouping and status validity authoritative on the server; make grouped updates atomic and reuse current UI conventions.

**Non-Goals:** Automatic delivery, changes to candidate ranking or campus travel rules, and notices for unassigned availability or other assignment categories.

## Decisions

### Derive notices from current assignments and effective availability

Compute eligible D assignments using the same origin-campus rules as candidate selection, without treating a saved assignment's own occupancy as ineligibility. Require two known different campuses. Group by day, teacher, origin and destination so varying origins cannot produce an inaccurate “anziché” clause. Only qualifying assigned hours belong to the notice; unused availability is excluded. Return server-derived group content and status in daily data, avoiding competing client eligibility rules.

Alternative: derive everything in the browser. Rejected because API validation and invalidation need the same definition.

### Store status with assignment records and a content fingerprint

Attach optional namespaced campus-notice metadata to participating assignments, containing the group's canonical fingerprint and its communicated/accepted booleans. The fingerprint includes sorted member keys, hours, classes, rooms and campus pair. Missing metadata means false. A status mutation identifies a member assignment, resolves the current group server-side, checks authorization and concurrency, then writes the same metadata to all members atomically.

This reuses assignment storage and backup paths without introducing a separate top-level state collection. Extend archive validation explicitly; do not broaden the existing generic flags to every D assignment. An alternative separate notice registry would require additional lifecycle and cleanup machinery.

### Invalidate on every relevant content change

Reconcile affected notices within existing state-save/revalidation flows for assignment, availability, absence, class-out and timetable changes. When fingerprints differ, clear both statuses for all remaining affected members and discard stale metadata on members that no longer qualify. Remove metadata with deleted assignments. Recreating an old group must not resurrect old acknowledgement. No-op saves retain valid metadata. Derive false on read for stale metadata as an additional safeguard.

Use a group content/status precondition in the existing concurrency snapshot mechanism, covering membership as well as rows and availability origin. Checking only the clicked row would miss additions elsewhere in the group. Resolve and validate all members within the write transaction; stale requests fail without partial writes.

### Reuse controls and format one message per group

Expose controls beside each qualifying substitution. All instances consume shared server state; status mutations refresh the daily view. Copy formats the server-derived group with sorted ordinal periods, DD/MM/YYYY, campus display names, and class/room lines. Insert the exact reminder from the spec before Cordiali saluti. Use the authenticated account's `name` as the signature and the assigned teacher's displayed name in the salutation. Pass these values to recovery and paid message controls too, so all three templates use the same sender and recipient sources. Copy success/failure never toggles status. Current destination-campus assignment permissions continue to apply.

## Risks / Trade-offs

- Changes outside assignments can alter notice content → reconcile through common save flows and include timetable/availability scenarios in tests.
- Group controls appear on multiple rows → render all from one server-derived status and refresh together after a mutation.
- Assignment reconstruction may drop metadata → explicitly preserve it for unchanged content and test no-op saves.
- Existing uncommitted loading changes overlap daily UI → keep implementation narrowly scoped and preserve unrelated work.

## Migration Plan

Optional metadata requires no operational data rewrite; existing groups start false. Verify backup round trips and older-archive reads. Implement and behaviorally verify using an isolated temporary database and `compose.testing.yaml`, then stop that test project. Deploy with `./scripts/deploy.sh` and perform read-only release/mount checks on atlante. Use the deployment snapshot and existing release rollback procedure if necessary; never copy testing data into production. Ask before committing.
