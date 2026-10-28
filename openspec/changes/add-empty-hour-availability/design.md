# Design

## Context

See proposal.md for motivation. `frontend/src/main.tsx` already renders seven hour sections and detects empty hours after campus filtering. Its `choose` flow calls `/api/candidates` with a real row key. The endpoint rejects missing rows, while `backend/domain.py:candidates` assumes an absent teacher and target class and appends manual assignment options. `CandidateDrawer` already supports a read-only permission reason but its heading and controls assume a real substitution.

## Goals / Non-Goals

**Goals:** Reuse eligibility rules and drawer presentation while keeping consultation independent of persisted substitution rows.

**Non-Goals:** No invented absence, persisted placeholder, class suitability inference, new assignment path, database migration, new dependency, PDF layout change or availability editor.

## Decisions

1. Add an authenticated read endpoint `/api/availability` taking `day`, hour 1–7 and campus (`centrale`, `succursale`, or `all`). Register it alongside existing authorized reads in `backend/auth.py`. Keep `/api/candidates` and assignment validation bound to actual rows. This avoids weakening their existing contract.

2. Reuse `eligibility` and `rp_candidate` for a transient consultation context containing the requested hour/campus, no absent ids, no class or room and a non-assignment key. Do not call the full `candidates` function with an invented teacher: it dereferences the absent teacher's subject and adds manual options. Add only the small shared computation needed for teacher profile information. Retain candidates only when normally available, without absence/double-booking reasons or exceptional status. Resolve teacher display-name overrides as the existing endpoint does.

3. For `all`, evaluate each known campus independently so RP feasibility is checked against each destination; group results by campus. A teacher available for multiple destinations can appear in each labelled group. Known-campus non-RP availability appears only in its actual effective campus. Unresolved non-RP availability gets a separate unknown-campus group in `all`; it is excluded from individual campus views. Do not assign a campus to unresolved teachers or infer class/co-teaching matches. Use existing category ordering where meaningful and displayed name as a stable tie breaker.

4. Add a consultation mode to the existing drawer, using an explicit day/hour/campus context rather than fabricating a frontend `Row`. Reuse the existing profile and type presentation, focus handling and Escape support, keeping the existing aria-disabled buttons and readOnlyReason guard with a “Solo consultazione” notice, so activation cannot assign. Use a consultation title and hide absent-teacher/class headers and manual options. Preserve normal drawer behavior and campus permission handling for actual substitutions.

5. Add the action beside the existing empty-hour message using the current filtered `rs`. Pass the current tab directly. Reuse the candidate request sequence guard to prevent stale results after date, campus or request changes; show loading, errors and an explicit empty state. Closing or switching context must not retain an obsolete consultation.

## Risks / Trade-offs

- Generic availability cannot determine class-specific compresenza or subject match → do not display those claims; real substitution selection remains authoritative.
- Diverging eligibility implementations could mislead staff → reuse existing domain rules and test policy, absence, assignment, effective-date and RP cases.
- RP eligibility depends on destination → evaluate both destinations separately in Entrambe, with explicit labels rather than an assumed campus.
- Reusing the drawer could accidentally expose a write action → consultation reuses guarded read-only teacher buttons; API stays read-only and assignment endpoint still requires a real row.

## Migration Plan

No data migration. Verify backend and frontend checks against isolated temporary data, then use only `compose.testing.yaml` with a unique project/data directory for behavioral checks. Verify the testing environment and ribbon before interaction and stop that project afterwards. Any later authorized deployment uses `./scripts/deploy.sh`; rollback is the previous release without data conversion.
