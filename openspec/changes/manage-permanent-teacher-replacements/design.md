# Design

## Context

See proposal.md for motivation and specs/ for the behavioral contract. `backend/timetables.py:dataset` already resolves date-effective imports and overrides and retains historical teachers. `backend/recovery.py` already owns permits by teacher ID and protects fixed RP links. The identity error comes from imported teacher IDs serving simultaneously as people and timetable sources; `teacher_names.py` only changes presentation.

Persistence is SQLite's existing JSON document store, not a normalized personnel schema. Current archive export is schema 9. Some consumers bypass the effective dataset: permit history returns raw versions, reference checks use raw imported teachers, and Inbox validates date ranges independently. Appointment resolution must reach these paths, not just the daily view. Existing uncommitted application work must remain untouched during planning and be preserved during implementation.

The earlier prototype change has no implemented harness or findings. Its proposed constraints are not product restrictions and its proposed inheritance of all activities is superseded here by the agreed POT exclusion. This change does not alter or archive that research plan.

## Goals / Non-Goals

**Goals:** One stable person ID throughout existing operational state; independently dated source coverage and absence; one effective schedule owner; history-safe corrections; no separate accounting engine.

**Non-Goals:** Partial-cattedra assignments, a general employment/contract system, medical-reason storage, fuzzy identity merging or an application-wide SQL normalization project. No dependency on running the earlier experiment.

## Decisions

### Keep person IDs in operational records and introduce a small ownership document

Add a versioned `teacherAppointments` document in the existing store containing:

- `people`: stable IDs with names and personal profile fields used by existing candidate logic.
- `sources`: mappings from stable timetable-source IDs to original person IDs and explicitly reconciled imported teacher identifiers.
- `absences`: stable record IDs, person ID, start date, optional inclusive end date.
- `appointments`: stable record IDs, source ID, replacement person ID, start date, optional inclusive end date.

For ordinary imports, preserve existing teacher IDs as person IDs and establish identity source mappings. New replacement people receive generated IDs. Gambato can retain the legacy combined ID as her personal ID, with Sicoli assigned a new ID; the imported combined row becomes a source, not a second person. An already correct replacement such as Benedetti retains the existing person ID and all existing records. Do not invent a second original person for every combined-looking name.

State keys (`abs`, `permessi`, `manualPermits`, `asg` substitute values and related metadata) continue to mean person IDs. Source IDs stay inside timetable/import/appointment documents. This avoids adding an independent owner field to every permit or duplicating recovery calculations. A single renamed teacher record was rejected because it preserves the conflation; replacing IDs on every appointment was rejected because it loses personal continuity.

Validate ISO dates, person/source references, unique IDs, interval boundaries, coverage overlaps and conflicting independently scheduled people. An appointment is a direct source-to-person relationship; a successor covers the same source, not the previous replacement. Ending an appointment leaves its historical record and all people's data intact. Prolonged absence is independent, so adding or ending coverage never implicitly ends the original's absence.

### Resolve one effective schedule before daily logic

Extend the shared date resolver: choose imported version, apply source timetable overrides, map sources to people, apply active appointments and remove inherited POT. Preserve class/room/campus and non-POT activities, and keep original and former people addressable with explicit daily eligibility flags. Do not overload historical `retired` state to represent every reason for temporary ineligibility.

For a mixed activity period remove the POT component, preserving any non-POT activity and its class context. If nothing remains, omit the inherited period. POT must be identified through canonical activity codes, not display labels or broad removal of PE. Source originals retain their original schedule outside replacement periods; POT is suppressed only in replacement inheritance.

All reads and validations must use the same resolver: daily rows, candidate profiles and ranking, manual/paid/automatic availability, permit limits, timetable displays/prints, reference checks, saved-assignment review and statistics. Newly created people must be valid catalog members independently of raw imported versions. Legacy records remain readable, and a plain archive without appointment data resolves exactly as before.

### Derive prolonged absence without materializing daily state

Compute scheduled absence periods for uncovered absent for a prolonged period people in the requested day's view. Union them with existing personal absence/permit sources. Show derived hours locked with a prolonged-absence explanation; use programmed classification unless an existing last-minute source wins. Do not write thousands of daily absence records or accrue permit debt from prolonged absence.

When a source has an active replacement, suppress its original from daily absence tables and source demand even if the original has retained personal permits/manual absences. Only the replacement's own sources create demand against the inherited schedule. The original's ledger remains available in Permessi. An uncovered Ianzano retains his schedule and receives derived absences. On appointment expiry while absence continues, uncovered demand resumes. On absence expiry without coverage, the original becomes available again. Coverage itself remains effective until its own end.

Keep resolved daily absence and eligibility logic shared across all demand, validation, display and statistics paths; filtering a sidebar alone would leave duplicate demand and unsafe assignments.

### Manage in Amministrazione and display in Orari

Add a clearly named admin-only management area within Amministrazione with “Assenza prolungata” and “Supplenza di cattedra” actions, selected-date status, start/end controls and an existing-person picker plus a minimal new-person form. Allow personal name, role and classe di concorso to be reviewed rather than silently treating the original's personal qualifications as the replacement's.

Preview the inherited weekly timetable, omitted POT, affected activity and upcoming ownership transition within Amministrazione before applying; administrators must be able to complete the workflow without access to Orari. Orari presents the selected-date results without staffing management controls: greyed absent-original cards, a struck-through original name beside the replacement name in clear text, and crossed-out source POT with “POT non ereditato”. Original cards remain discoverable with “Assenza prolungata” and “Coperto da …”; replacement cards show “Supplente di …” and their own effective schedule. Retain enough source context to display excluded POT without adding it back to effective commitments, availability, permit limits or demand. Pair colour and strikethrough with readable status labels. Daily Supplenze omits the covered original entirely. Keep people selectable for history inspection in Permessi even if not eligible for new daily work.

Use existing authentication and role patterns: only administrators create people and manage prolonged absences and appointments. Enforce this on the server for preview/apply management routes, not only in navigation. Operational accounts inspect resolved status in Orari and daily views, without staffing write controls. Preserve the administrator's existing default navigation; do not require or add Orari access to make administration work. A document revision plus activity/import fingerprints protects preview-and-apply against concurrent writes; transactions recheck all dependencies before committing.

### Protect existing activity before changes

Creation, backdating, shortening, ending and deletion run an impact preview over affected saved dates and future assignments. Reject unresolved conflicts with references; never rekey daily absences or assignments as a side effect of changing coverage. Permit ownership and fixed RP links do not change. An unused appointment can be removed; one with conflicting history must be ended or corrected through explicit record resolution. Recompute affected statistical facts consistently while preserving existing historical correction evidence.

Appointment/absence eligibility must also constrain paid declarations and assignments, manual availability and exceptional choices. Invalid future declarations or assignments appear in the impact preview and block silent application. Existing history remains inspectable rather than erased.

### Reconcile imports, Inbox and archives explicitly

Compatible imported identifiers retain source mappings and active coverage. Preview renumbered/missing sources, sources reintroduced under the replacement's own imported ID, and conflicting mappings; require explicit choices before applying rather than matching names automatically or duplicating timetables. Apply source-level overrides before person ownership so they follow the cattedra. Show suspended override conflicts in the existing import review.

Inbox and reception name matching use a person catalog with explicit aliases. Original and replacement names are distinct people. A submission naming the original during coverage cannot be blindly redirected. Ambiguity and date ranges crossing coverage boundaries require review; accepted items retain their recorded person. Existing paid declarations, receptions and independently personal records do not transfer just because the timetable does.

Increment the archive schema and include the ownership document. Validate it with imported history and all state before a transaction writes anything. Continue accepting supported legacy schemas with identity mappings and no inferred appointments. Export must preserve stable IDs, periods, metadata and permit links. SQLite backups already capture documents; verify the new document and attachment references through restoration tests.

### Keep operational repairs outside the product

The Sicoli/Gambato case is a one-time installation repair, not a reusable user workflow. Ship no reconciliation or source-mapping sections in Gestione docenti. A separately reviewed maintenance transaction can retain the existing ID and permits for Gambato and add Sicoli later, after actual IDs, dates and linked assignment ownership are inspected. This UI correction performs no operational repair and adds no maintenance script.

### Present prolonged absences as the primary workflow

Gestione docenti opens on Assenze prolungate: the current list shows teacher, dates, replacement status and an Assegna supplente action for uncovered absences. Future and past absences remain available separately. Nuova assenza prolungata only selects the absent person and dates; no operation selector or replacement inputs. Assegna supplente starts from the selected absence, so the original cattedra is already known. Use the established six-suggestion teacher search with explicit selection and arrow/Enter keyboard behavior; allow a new replacement person inline. A separate Docenti view contains Nuovo docente. Classe di concorso search shows canonical code and description together using the existing server lookup, and stores the selected code. Preview and save belong to the current operation rather than a global multi-operation draft. Retain revision/token checks and conflict review.

## Risks / Trade-offs

- Raw-version consumers can ignore new people -> route catalogs and dated validation through the shared resolver and test API boundaries, not only pure functions.
- Removing POT may change permit limits and RP convenience -> verify canonical POT versus PE and mixed activity handling on effective schedules.
- Backdated coverage changes can invalidate saved work -> fingerprinted impact preview, transactional conflict checks and explicit record resolution.
- Ambiguous existing assignment ownership -> reviewed reconciliation; no inferred historical transfers.
- Derived absences can diverge between UI and statistics -> share the same daily source composition and test public/PDF/statistical outputs.
- One additional document increases archive coupling -> versioned validation and legacy identity-mapping regression tests; no parallel person ledger.

## Migration Plan

1. Implement against synthetic temporary databases. If realistic data is needed, create a fresh temporary copy using SQLite online backup; production remains authoritative and untouched by behavioral checks.
2. Make missing appointment documents behave as identity mappings; initialize additive identity metadata idempotently without changing operational record owners. Archive legacy import has the same fallback.
3. Verify generic ownership and atomic staffing edits using isolated fixtures. A one-time school-specific repair is separate maintenance work and requires actual IDs, dates and reviewed ownership; it is not a shipped screen.
4. Rebuild and recreate only a unique `compose.testing.yaml` project with a mktemp data directory, inspect its mount/allocated port, verify `/api/environment` reports testing=true and the red ribbon, and run browser acceptance covering separate admin management and operational read-only timetable views. Stop that project afterward; leave the old local operational app stopped.
5. Deploy the implemented and verified feature with `./scripts/deploy.sh`, preserving its production snapshot workflow, then verify the deployed release using read-only checks. Deployment itself must not auto-apply Sicoli/Gambato reconciliation or create Ianzano's operational absence; those are explicit reviewed user actions with actual dates.
6. Preserve current data before any recovery. Do not automatically restore a prior snapshot or run an older build against a new archive/document schema. If release fails, report actual release and database mount; recovery follows the documented explicit approval procedure.

Ask whether the user wants a commit before committing implementation work. Planning does not authorize implementation, deployment or operational reconciliation.
