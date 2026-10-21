# Design

## Context

See proposal.md for motivation. The app stores JSON documents in SQLite. Teaching timetables have effective dates and manual overrides. Settings already implements a preview/token/confirmation import flow; Orari builds teacher grids from effective lessons. `domain.rp_candidate` currently checks empty lesson slots, while `rp_context` distinguishes teaching adjacency from travel commitments. `availability.report` independently enumerates empty slots and calls the same context helper, so both paths need reception data.

The supplied workbook has one Table1 sheet and 140 rows, with docente, giorno, ora, orario, filtro_plesso, num_genitori, luogo and classi_docente. Its 134 blank locations and four remote entries cannot establish a campus. Some reception time ranges cover only part of a lesson period; the numbered period is authoritative for whole-period RP exclusion.

## Goals / Non-Goals

**Goals:** Keep receptions independent of imported lessons, resolve by date and stable teacher identity, share RP rules across consumers, and expose uncertain data for review.

**Non-Goals:** Minute-based recovery, parent booking management, changes to daily permit limits, automatic teacher creation, or treating R as a configurable available activity. Non-RP substitution policy stays unchanged; overlapping commitments are displayed rather than silently overwriting lessons.

## Decisions

### Independent dated reception document

Store reception versions in a dedicated SQLite document. Each version contains an effective date and a complete weekly set of teacher ID, weekday, period, original source name/time/location and confirmed campus. Resolve the latest effective version on or before the selected date; no receptions precede the first version. Imports replace the snapshot at a matching effective date and otherwise end at the next reception version. An empty confirmed snapshot clears receptions prospectively. Deduplicate identical teacher/day/period entries and reject conflicting duplicates. This avoids coupling reception updates to teaching timetable replacement or manual lesson overrides.

### Parse XLSX on the backend and reuse import safeguards

Use a pinned XLSX reader in read-only/data-only mode, with bounded upload and row counts; do not execute formulas or process external links. Require recognized headers rather than fixed column offsets. Normalize weekdays and integer periods, using source row numbers in errors. Ignore unrelated booking/class columns. Prefer a maintained reader over a bespoke ZIP/XML parser; no browser spreadsheet dependency is needed.

Provide preview and confirmation endpoints patterned after timetable import. Preview accepts the file, effective date, explicit teacher selections/skips and optional campus overrides; return row-level results and assignment impact. Bind the confirmation token to normalized rows, mappings, effective date and relevant current data. Recheck these inside the save transaction; use existing verified-backup safeguards before mutation. Preserve assignments and recovery links while surfacing new RP conflicts.

### Conservative matching and location handling

Compare normalized full names using imported and overridden names, collapsing whitespace, case, accents and punctuation. Only a unique full-name identity is selected automatically. Approximate matching can rank suggestions but cannot silently choose one. Every uncertain row requires a searchable teacher selection or explicit skip. Never infer identity from surname alone. Stable IDs survive later display-name changes. Existing choices are carried in preview state; a permanent alias subsystem is unnecessary.

Normalize explicit centrale/sede centrale and succursale locations. Blank and a distanza retain null campus and original text. Allow optional manual campus confirmation in preview. Nearby lessons can be a labelled suggestion only; no automatic confirmation.

### Reception overlay and shared RP context

Resolve receptions independently for each date and pass them explicitly into domain selection/validation and availability reporting. Do not synthesize lessons: doing so would change permit limits, substitution demand and activity totals. Exclude the R slot before RP selection, independently of manual availability. Keep ordinary substitution rules unchanged.

Extend RP context with reception commitments for travel checks and immediate adjacency anchors, preserving teaching-only internal gap rules. A relevant unknown reception on either side prevents confirmed convenience even if teaching adjacency exists. Known infeasible transfers still block; unknown location alone yields a selectable non-confirmed candidate. Return structured potential-adjacency/uncertainty information for the drawer explanation. Preserve existing ordering, with confirmed favorable RP first and uncertain opportunities in the non-favorable RP group. Availability statistics count only confirmed opportunities and never count R as teaching or disposable time.

In Orari, overlay R with accessible details and a distinct label. Display both R and the underlying lesson on overlap. Teaching-grid edit operations continue to affect only lessons. Settings presents the imported schedule and optional location selections through preview/reimport.

### Portable data and existing installations

Missing reception storage resolves to an empty schedule without rewriting teaching records. Extend archive validation/export/import with optional reception versions and identity checks; an older archive restores no receptions. Database snapshots already capture the new document. Validate all portable data before transactional restoration. Revalidate affected scheduling issues without deleting RP attribution or silently refunding debt.

## Risks / Trade-offs

- Unknown locations reduce confirmed favorable suggestions → display potential adjacency explicitly and allow optional campus confirmation.
- Similar names can attach commitments to the wrong teacher → restrict automatic matching to unique normalized full names and show source versus selected identity.
- Separate selection and statistics paths can drift → share date resolution and RP eligibility/context logic and add cross-consumer regression coverage.
- Historical imports can invalidate saved RP → preview affected dates, retain links and flag review rather than changing recovery balances.
- Spreadsheet times can be shorter than a period → preserve time text for display but block the numbered period in full.

## Migration Plan

1. Introduce optional reception storage and archive fields with empty defaults; no operational import runs during startup.
2. Verify import, matching, overlays, RP rules, statistics and round trips against isolated temporary databases.
3. Exercise the built frontend through a uniquely named standalone testing Compose project, verify its mount, allocated port, testing API and ribbon, then stop only that project.
4. Any later approved normal deployment uses the normal Compose database and read-only checks. Importing the supplied file into operational data remains a separate explicit action.
5. Before rollback, preserve a verified current database backup. Older binaries can ignore the separate reception document but cannot enforce reception constraints; restore compatible code before resuming reception-dependent planning.
