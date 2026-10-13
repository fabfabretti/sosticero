# Design

## Context

See proposal.md for motivation. The FastAPI backend normalizes imported JSON into SQLite documents; normalization currently reduces activities to one of four special codes. Eligibility uses hard-coded categories and priorities, and assignment validation recomputes candidates. React Settings already manages timetable/state imports and backups, while CandidateDrawer hard-codes category colors. Existing tests exercise category ordering, compresenza campus constraints, class-out release and hard restrictions.

This requires a design because it crosses normalization, persistence, assignment validation, archive compatibility and UI.

## Goals / Non-Goals

**Goals:** Keep one server-owned policy per normalized type, use the same effective-policy calculation for display and validation, and preserve existing operational records.

**Non-Goals:** New per-teacher/date/hour overrides, editable priorities, arbitrary type creation/deletion, timetable editing, automated semantic guessing, or changes to Banca ore/Stats. Existing manual A disposizione behavior remains; this change adds no new individual overrides.

## Decisions

### Preserve source activities and separate policy keys

Extend normalized lessons with original activity labels and a deduplicated list of canonical activity codes instead of replacing the existing special field immediately. Preserve existing known-code normalization (case, dots and whitespace) and retain original labels for explanations. Keep imported keys and derived keys in separate namespaces to avoid collisions. Derive Lezione from class teaching, Compresenza ITP from an ITP sharing the hour/class with another teacher, and Sostegno from the teacher role. Class-out release and existing manual availability take precedence as A disposizione; explicit activity codes otherwise precede derived types.

An hour with multiple distinct codes combines their rules conservatively: all must allow visibility for the candidate to appear, and all must allow availability for normal assignment. Explain all contributing labels; use a stable primary label for the badge. This avoids an arbitrary first token making an other-school commitment available. Original free-text activity labels remain available for review rather than being silently discarded; do not infer school semantics from text.

Alternative: extending the four-code whitelist would lose future types again. Storing only a single activity would lose information needed to explain conflicting codes.

### Store shared policies in a SQLite document

Use a separate hour-types document keyed by canonical type ID, with label, availability, visibility, school membership and a palette color ID. School membership starts null for unfamiliar types and becomes a boolean when selected by the office; its UI displays Da verificare until then. This is preferable to silently claiming an unknown code belongs to this school. Known GM starts false/false/false; Lezione false/false/true; Compresenza ITP and Sostegno false/true/true. Existing POT, UTC, UTS and DIS start available and visible with existing site semantics. Existing derived A disposizione starts available/visible/at-school. New unknown codes, including PE/RIT/CPO, start unavailable/hidden/unreviewed until the office configures them.

Merge newly discovered types on timetable import without resetting existing policies or removing temporarily unused types. Offer explicit read/update endpoints for settings, validate fields on the server, and update one type transactionally. Reuse current SQLite document storage rather than introduce tables or a client-only store. Global edits take effect on the next candidate fetch; candidate submission always checks current server policy. Report a stale-policy rejection and refresh candidates.

### Separate policy occupancy from hard restrictions

Eligibility returns type identity, policy availability, visibility and exceptional status separately from hard reasons such as absence or double booking. Keep existing category/rank data for legacy types; extend ranking safely for new codes at the potenziamento tier. Preserve row-specific compresenza checks and campus constraints; showing all types in Settings does not make every teacher a candidate for every hour. Lezione candidates only arise from actual timetable lessons when explicitly made visible.

Occupied visible candidates go after normal choices in Solo in caso di necessità. Their action is Usa comunque and opens confirmation naming teacher/hour/type. Extend assignment requests with an explicit exceptional flag, revalidate current policy and hard restrictions, and store exceptional metadata with new assignments. Absence, already assigned, retired, or hidden status cannot be overridden. Keep existing entry/exit validation and manual options.

Alternative: disabling every occupied candidate would prevent the requested rare compresenza use. Making them ordinary selectable entries would obscure the exceptional nature.

### School membership is descriptive

Presso questa scuola records institution membership, independent of centrale/succursale. It does not filter, rank or release teachers in this change. All three settings remain independent, so changing school membership alone cannot change candidate eligibility.

### Reuse the existing UI and save colors once

Add a Tipi di ora section to Settings with the badge and three labelled control columns. Use existing CSS variables, surfaces, borders, spacing and focus styling; ensure narrow layouts retain labels and keyboard access. Save each toggle through the API with pending/error feedback and restore the displayed saved value on failure.

Randomly choose a color from a bounded palette with tested light/dark foreground/background pairs when creating a type; persist the palette ID rather than generate colors at render time or accept arbitrary CSS. Use that ID in Settings and CandidateDrawer. Random selection can repeat if the number of types exceeds the palette; distinct labels remain authoritative. Do not add a color editor in this scope.

### Backward-compatible archive evolution

Extend the current schema-1 portable archive with an optional hourTypes payload and optional exceptional assignment metadata. Validate settings and operational state before writing either in one transaction. Legacy archives omit settings and preserve the current policy document. New archives restore included settings/colors. Existing database snapshot backups naturally include the policy document; test restore with the new document. No existing assignment is retroactively deleted or rewritten when policies change.

Alternative: embedding policies in date-keyed state conflicts with current state import validation and makes global rules look like daily entries.

## Risks / Trade-offs

- Previously discarded codes cannot be reconstructed from normalized lessons → preserve supported existing fields on upgrade and explain in Settings that reimport of the original timetable is needed for a complete inventory.
- Global edits affect all matching hours → state this explicitly above the table; individual overrides remain deferred.
- Unknown codes start hidden → mark new/unreviewed rows visibly so the office can configure PE/RIT and other local codes.
- A type change can make an open drawer stale → validate on submission and refresh with the actual error.
- More candidates appear when Lezione is made visible → keep hidden by default and separate occupied fallback choices.
- Settings can contradict human expectations about school membership → keep metadata independent and avoid automatic eligibility effects.

## Migration Plan

1. Read legacy datasets and archives without requiring new fields; seed derived and previously recognized types and preserve assignments.
2. Add settings storage/API and discovery, then policy-aware candidates and exceptional validation, then Settings and drawer rendering.
3. Verify legacy and new archive round trips and database backup restore, including colors and exceptional metadata.
4. Rebuild/recreate the Podman service with both required flags and verify the served asset hash. Reimport the source timetable when needed to recover formerly discarded codes.
5. Rollback: restore a predeployment database snapshot and previous image together; a source rollback alone could lose new policy information on subsequent writes.

## Deferred TODO

- Future change: teacher/date/hour availability overrides, including their precedence over global type rules and how those exceptions appear in the UI. This is recorded for later and is not an implementation task in this change.
