# Design

## Context

See `proposal.md` for motivation. Current state that shapes the approach:

- Timetables are imported as versioned datasets (`timetables.versions`, each with
  an `effective` date) and read through `timetables.version(history, day)` /
  `timetables.dataset(history, day)`. The office imports a new JSON from
  Settings; the active version is the latest with `effective <= today`.
- `dataset.lessons` is keyed `teacher|day|hour` and holds
  `{classes, room, site, special, activities, activityLabels}`. Days are
  `lun..ven`, hours `1..7`. A lesson has zero or one class.
- The import source carries a `compresenze` field listing co-teachers, but
  `normalize_dataset()` drops it. It is not in the live database and cannot be
  shown without a schema/import change and a reimport.
- Activity codes (POT, DI.S, UTC, …) are already inventoried with labels and
  colors by Settings → *Tipi di ora* (`GET /api/hour-types`, `code:<CODE>` keys).
- The frontend is a React SPA with `HashRouter`; `Shell` renders one screen at a
  time, so screens unmount when the user switches tabs. Component tests run the
  real component in a `node:vm` with a mocked React and deferred `fetch`.

Measured against the live database (version `2026-10-16`): 155 teachers, 2657
lessons, 5425 grid cells, 639 shared class-day-hour slots, 1314 teacher-cells
involved in a shared slot.

## Goals / Non-Goals

**Goals:**

- Show the effective timetable as weekly grids, one per teacher, filterable.
- Derive compresenza from data already stored, with no schema change.
- Keep the derive cheap and always consistent with the imported timetable.

**Non-Goals:**

- Manual overrides (enable/disable/move hours) — the screen is read-only.
- Resolving room/articolazioni ambiguity in compresenza detection.
- Browsing historical or future versions.

## Decisions

### Derive compresenza from shared class-hour, client-side

Index all lessons by `(day, hour, class) -> teacherIds`. A slot with more than
one teacher is a compresenza; each teacher's cell lists the others. Verified
against the dropped source field: every one of the 762 source-marked slots is
also derived (0 lost), and derivation finds 552 more, overwhelmingly
`ITP + curricolare` — exactly the `Compresenza ITP` case `domain.eligibility`
already recognises.

*Alternatives:* preserve the source `compresenze` field. Rejected — it changes
the stored dataset, `validate_dataset`, export schema and import path, and needs
a reimport, for a *smaller* result than derivation gives. Deriving from lessons
touches no stored data and works on the live database today.

### New read-only `GET /api/orari`

Returns `{effective, dataset}` for the version in effect today, falling back to
the bootstrap dataset when no version history exists (mirroring `main.load`).
It returns the version's own dataset, not `timetables.dataset()`, so historical
retired teachers do not appear as empty grids.

*Alternatives:* reuse `GET /api/day/{today}` (also computes and returns today's
substitution rows — unrelated data) or `GET /api/permessi` (returns every
version, ~855 KB). A small dedicated endpoint matches the screen's concept and
is where the future override layer will hang.

### Derive per mount with a pure helper; no cache, no startup precompute

The screen builds its grids in a `useMemo` keyed on the fetched dataset, via a
pure `buildTeacherTimetables(dataset)` in its own module so it is unit-testable
with plain `node --test`. Deriving on mount keeps the screen consistent with a
newly imported JSON for free: the Settings import happens on another tab, tabs
unmount, so returning to Orari refetches and the memo recomputes.

*Alternatives:* precompute once at startup or in a shared store. Rejected — it
adds cache invalidation with no benefit; the derive is ~14 ms.

### Render all teachers; no virtualization, no minimum query length

155 grids × 35 cells = 5425 cells. Measured: `JSON.parse` ~7 ms, derivation
~14 ms; the React render (est. ~50–150 ms) dominates but stays well under a
second, and filtering only shrinks the set. A minimum query length would hide
the default "show everything" behaviour the office asked for.

*Alternatives:* virtualize or paginate. Rejected as more complexity than the
sub-second render justifies.

### Presentation

Inline co-teacher names in the cell (a list, so two or three render), raw
activity codes tinted with the hour-types color, one or two grids per row. Each
grid is a `<table>` with day column headers and hour row headers for keyboard and
screen-reader access.

## Risks / Trade-offs

- **Room conflicts / articolazioni** → the shared-class-hour rule ignores rooms;
  ~16 live slots have teachers in the same class/hour but different rooms and may
  be split groups or support outside the classroom. Accepted for now (explicitly
  out of scope); the stricter rule (same room, or either room unknown) is
  deferred to a later change.
- **Render time is estimated, not measured** → confirm by opening the real page
  after the build. Fallback if it ever lags: gate rendering on a query length.
- **New endpoint surface** → small and read-only; no migration, no stored-data
  change.
- **Tab count changes app-shell** → covered by the `app-shell` delta in this
  change.

## Migration Plan

Additive and deployable on its own: backend endpoint + frontend screen + tab.
No data migration and no reimport. Rollback is reverting the code; stored data is
untouched either way.

## Open Questions

- Exact compresenza rule for room-conflicting slots (leave as-is, require same
  room, or require either room unknown) — deferrable, does not change the specs,
  approach or tasks.
