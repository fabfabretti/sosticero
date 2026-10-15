# Design

## Context

See proposal.md for motivation. Supplenze and Permessi live in frontend/src/main.tsx. Daily manual hours use state.abs, permits use state.permessi; backend.domain.absences merges them. Existing permit request dates and availability campuses demonstrate optional per-date/per-teacher metadata. State is JSON in SQLite documents; archive import validates each state group explicitly. The current entry endpoint already supports single-date updates and optional ranges. The working tree contains unrelated edits that must be preserved.

This design is needed because the change spans forms, API update semantics, persisted metadata and archive compatibility.

## Goals / Non-Goals

**Goals:** Extend the current storage and UI patterns with a small amount of optional metadata; separate selecting a person from saving; keep input controls compact and keyboard accessible.

**Non-Goals:** Inferring classification from dates, backfilling history, changing substitution or recovery rules, adding statistics breakdowns, replacing the form framework, or removing backend range support. Removing Più giorni affects only the daily entry UI.

## Decisions

### Store classifications separately for each source

Add absenceKinds and permitKinds maps keyed by date and teacher, storing only planned or last_minute values; absence of a key means unspecified. Keep hour arrays intact to preserve all existing domain calculations. A single shared teacher/day field was considered, but separate source metadata lets permit edits and deletion behave correctly while deriving one display group.

Normalize missing maps on load, include them in EMPTY and response types, and add explicit archive validation branches. Check values and source references. A metadata value requires its corresponding manual entry or permit; do not infer or manufacture sources. No SQLite table migration or archive schema bump is needed for additive optional maps; compatibility is guaranteed for older archives imported by the updated app, not for classification retention through older application versions.

### Preserve metadata during hour-only changes

Extend Edit and Permit with an optional classification field and distinguish omission from explicit null via Pydantic field-presence tracking. Omission preserves metadata; null clears it. The UI sends the classification explicitly when creating or editing that choice. Entry deletion cleans up absenceKinds; permit deletion and valid moves clean up or move permitKinds in the same transaction, preserving permit identities and recovery protections. Classification-only edits use existing save paths. Reject classification on availability/classes rather than silently storing it.

### Derive grouping from current sources

For each teacher in the union of manual absences and permits, resolve Last minute first, then Programmata, then unspecified. Render the existing combined hour row once, preserving locked permit hours, manual controls and removal behavior. Recompute on every refreshed state, never store a second effective classification. Keep existing name ordering within groups. Omit empty group sections for density. Keep class absences in a compact separate Classi assenti section before A disposizione.

Manual classification editing uses a compact inline control revealed on demand in the saved row; permit classification is edited in Permessi. No LM/P badges or main-table changes.

### Keep draft and submission distinct

Store the selected person separately from search text and keyboard highlight. Clicking a suggestion fills the selection; Aggiungi and Enter call one submission path. Editing search text invalidates the selected identity. Preserve arrow navigation and Escape behavior; do not submit during IME composition or twice while busy. Clear search only after success, preserving all option toggles, partial-hour choices and campus. Retention is page-session state, not browser persistence; initial defaults apply on remount.

Replace some with positive wholeDay state. When off, show the existing compact hour buttons in the form and disallow empty selection. Whole-day manual absences/classes use all supported periods; availability retains the existing default_availability behavior. Keep wholeDay, availability and classification settings while switching modes; hide and omit classification for availability/classes. Remove multi/until UI state and always add for the selected day.

### Keep the form narrow

Place search and Aggiungi together, use small wrapping toggle rows, expose hours only for partial entry and campus only for availability. Add the same two optional classification toggles to Permessi using existing compact controls. Expose pressed state and accessible labels; preserve readable focus indicators and usable controls on narrow screens. When editing a permit, load its saved classification; keep the new-entry preference separately so finishing/cancelling an edit does not overwrite the next-entry default.

## Risks / Trade-offs

- Metadata lost during routine hour changes → distinguish omitted values from explicit clearing and test both paths.
- Legacy import or permit moves leave orphan metadata → validate source references and move/delete metadata transactionally.
- A teacher changes groups when a source is removed → derive grouping each refresh and verify mixed-source removal scenarios.
- Dense controls become hard to use → inspect desktop and narrow layouts with keyboard interaction; retain focus and pressed states.
- Existing unrelated edits overlap main.tsx and tests → inspect the working diff before implementation and preserve those changes.

## Migration Plan

1. Run backend and frontend checks against temporary isolated databases; absent maps normalize to empty without classifying existing records.
2. For container behavior checks, create a disposable /data directory and explicitly selected temporary Compose override replacing the entire mount. Use SQLite online backup only if realistic data is needed, and verify the container mount before writes.
3. Rebuild and force-recreate with the explicit test override, supplying LOCAL_UID and LOCAL_GID. Verify forms, grouping and served bundle.
4. Restore the normal compose.yaml deployment with --build --force-recreate and verify its /data mount points to project data and its frontend asset hash is current using read-only checks.
5. Before rollback, retain a database backup. Older code ignores the new maps but may discard them during edits/import; rollback is not a classification-preserving workflow. Operational hours and permit/recovery data retain their existing format.
