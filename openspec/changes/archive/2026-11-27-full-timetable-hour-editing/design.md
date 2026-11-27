# Design

## Context

See proposal.md. The current override pipeline stores dated per-teacher cell patches against immutable imported versions. `backend/overrides.py` enforces conservation and role-specific restrictions; preview in `backend/main.py` reconciles affected assignments. Orari already has a draft, date toolbar, activity dialog, drag/keyboard movement and conflict review. Existing completed but unarchived override specs require fixed ordinary lessons and conserved support hours; this change supersedes those restrictions and their deltas must be reconciled when archived.

## Goals / Non-Goals

**Goals:** Extend the existing resolution and review path to arbitrary valid cell edits, retaining operational evidence and coherent UI behavior.

**Non-Goals:** Generate timetables, transfer hours across teachers, alter teacher roles, automatically repair assignments, or edit independent receptions and student groups.

## Decisions

1. **Extend cell patches.** Continue storing before/after cells and date boundaries, permitting validated additions, removals and type conversions instead of conserving signatures. Validate server-side against known kinds, classes, campuses and allowed slots; retain unchanged imported fields and multi-class payloads. Treat directly edited cells independently unless linked by moves or swaps; keep linked cells atomic. Full timetable copies would hide unrelated later import changes.

2. **Preserve import and archive safeguards.** Compare each group's original cells, including empty cells, against later imported versions and suspend conflicts as a whole. Adapt detached archive validation and versioning as needed without weakening validation of legacy records. Test compatibility and rollback: older binaries may reject or mishandle new patches, so use a forward fix or a reviewed migration, never silently discard them.

3. **Resolve kind and availability through existing policies.** Represent edited hours in the same normalized lesson shape consumed by the shared dated resolver. Apply the configured type policy and retain the existing per-hour enable/disable control for POT only; retain legacy disabled flags when editing or moving an existing hour, and clear them on an explicit type change; do not derive teacher role from the chosen hour kind. Audit class-linked activity and disabled precedence throughout candidate selection and absence rows, since current behavior restricts class association when enabled.

4. **Reuse impact and overlap reporting.** Preview changes against affected operational dates, preserve saved assignments and prior evidence, and flag new issues using existing reconciliation. Include independent reception and student-group overlaps in the preview as warnings that do not block saving or alter those records. Reuse optimistic basis and preview tokens to avoid stale writes.

5. **Extend the existing editor.** Open the existing accessible dialog from occupied and empty cells, with searchable kind and class selectors, campus and a clear removal action. Reuse established autocomplete, campus controls, dates, buttons, confirmation, focus handling, visual styles and drag/keyboard patterns. Preserve untouched multi-class values without requiring a new multi-class picker. Existing special-hour click/toggle interaction must be adjusted so opening the dialog does not accidentally toggle availability.

## Risks / Trade-offs

- Changed kinds and class associations affect substitution rows and eligibility → test the resolved schedule across operational consumers and preserve historical evidence.
- Arbitrary additions and deletions complicate atomic grouping and import rebase → cover empty destinations, edits after moves, mixed swaps and later imports.
- Newly written patches may be incompatible with older releases → validate archive round trips and plan rollback around data compatibility.
- Separate commitments can overlap without blocking → show clear warnings and retain both in all existing overlap views.

## Migration Plan

Keep existing imported and override records intact; migrate or version only if required by validation and document compatibility. Run focused tests and an isolated `compose.testing.yaml` project with a unique project and temporary database, verifying its mount, testing endpoint and ribbon before behavioral checks. Stop the isolated project, deploy using `./scripts/deploy.sh`, and verify the release read-only. Never use production records for behavioral tests or restore data as a rollback shortcut.
