# Design

## Context

See proposal.md for motivation. `backend/overrides.py` accepts only special activities; its signature comparison conserves activity payloads while permitting selected class/campus changes. `groups`, `propose` and detached archive validation have no general support-role edit context. The Orari UI similarly infers editability from activity codes rather than teacher role. Timetable resolution applies overrides before appointments and independent student-group projection. Existing tests cover temporal precedence, stale previews, archive validation and atomic import conflicts.

The original fixed-class-lesson rule lives in the unarchived `edit-timetable-overrides` delta. This new capability provides a specific support-role exception, without changing substitution policies. Existing unrelated worktree modifications must be preserved during implementation.

## Goals / Non-Goals

**Goals:** Extend one override pipeline, enforce support-specific invariants on the server, and separate movement, field editing and disable permissions in the UI.

**Non-Goals:** A timetable generator, cross-teacher lesson transfer, new support availability policies, room editing, or changes to appointment inheritance and independent group/reception scheduling.

## Decisions

1. **Role-aware edit context rather than fake activity codes.** Resolve support eligibility from the authoritative imported teacher for the override basis. Thread that context through proposal, validation and reconciliation. Add role to the frontend dataset type. Never trust client-supplied role or turn support lessons into POT. An activity-code shortcut would silently change candidate and absence semantics.

2. **Separate capabilities.** Distinguish movable lessons, class/campus-editable lessons and disableable activities; use those distinctions in drag, keyboard, touch, dialog and server checks. Reuse the activity dialog presentation for support with suitable labels and no availability toggle. Preserve current special-activity behavior and fixed curricolare/ITP lessons.

3. **Conserve support payloads independently of special activities.** Extend normalized signature accounting only for support class lessons: class and site may change, but room and other immutable payload fields must be conserved, as must total support-hour count. Validate one known class on explicit class edits; retain untouched imported multi-class lessons. Reject disabled support and changes of lesson kind. Preserve the existing special-activity accounting separately so support cannot be converted into another type.

4. **Keep atomic dependency groups.** Normalize support signatures consistently for conservation and grouping. Ensure a class/site correction still links the original and edited lesson, and a swap containing support and a special activity stays one dependency group. Preserve source/destination basis checks; additionally suspend support edits if later imports remove support-role eligibility. This prevents partial swaps and accidental modification of ordinary lessons after a role change.

5. **Reuse storage, API and evidence.** Retain weekly cell patches and existing preview tokens, reset/deletion logic and assignment evidence. Extend archive validation with role context from the appropriate original version; do not rely on whichever teacher version is found first. Validate detached originals without weakening the support-role restriction. Preserve all legacy special records. No schema bump is planned because the record shape is unchanged; old binaries cannot validate new support payloads.

6. **Preserve projection ownership.** Edit imported timetable owners as the current override pipeline does. Appointment-generated replacement timetables continue inheriting the resulting schedule; do not add a separate editor for managed replacements. Student groups and receptions remain independent records, with existing overlap presentation. Existing campus and exceptional-candidate policies continue to apply.

## Risks / Trade-offs

- Signature normalization could allow dropped or duplicated hours → test counts, mixed swaps, immutable room fields and forged type conversion.
- Role or timetable changes could invalidate saved edits → check role eligibility alongside source/destination payloads during reconciliation and archive restore.
- Identical lessons can connect multiple edits conservatively → retain atomic grouping rather than inventing persistent lesson IDs.
- A moved support lesson can change substitution row identity → reuse impact preview and retained evidence; do not auto-delete or reassign coverage.
- Independent receptions/groups can overlap a move → preserve and display them using existing overlap behavior; this change does not introduce global timetable conflict solving.

## Migration Plan

No operational record backfill is required. Verify old archives and new support round trips before release. Run focused backend/frontend checks and a built isolated test project using `compose.testing.yaml`, unique TEST_PROJECT, mktemp TEST_DATA_DIR and allocated localhost port; inspect its mount and verify testing mode and the red ribbon before mutations. Stop that project after verification. Deploy with `./scripts/deploy.sh` and verify the release read-only on atlante. Ask before committing.

Rollback must account for support patches being unreadable by old binaries: prefer a forward fix, or export evidence and use reviewed override deletion before reverting code. Never silently discard overrides or restore a snapshot over later operational records.
