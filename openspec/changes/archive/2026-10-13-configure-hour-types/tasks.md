# Tasks

## 1. Type discovery and persisted policy

- [x] 1.1 Extend timetable normalization to preserve source activity labels and canonical codes, and derive distinct teaching types; verify tests for GM/PE/RIT/CPO, UTC aliases, multi-code hours, ITP compresenza and sostegno, including legacy normalized datasets.
- [x] 1.2 Add the hour-types document with conservative defaults, unreviewed school membership and persisted random palette IDs; verify tests for default values, import merging, reload stability and collision-free imported/derived keys.
- [x] 1.3 Add validated settings read/update APIs with transactional per-type updates; verify API tests for independent controls, global effects, invalid values and unchanged state after failed updates.
- [x] 1.4 Document global rule scope, default policies, school metadata and the reimport requirement for discarded codes in README; verify the instructions match actual API and Settings labels.

## 2. Candidate rules and exceptional assignments

- [x] 2.1 Apply effective type policies to eligibility and ordering, preserving manual/class-out availability and campus constraints; verify tests for all availability/visibility combinations, multi-code restrictions, independent school metadata and normal legacy ranking.
- [x] 2.2 Add explicit exceptional confirmation to assignment requests and store exceptional metadata; verify API tests reject unconfirmed occupancy, absence, double booking, hidden and retired candidates, including policy changes between candidate fetch and submit.
- [x] 2.3 Preserve existing assignments and teacher profiles when rules change, and retain Dirigente/entry/exit behavior; verify regressions covering assigned hidden types, effective boundaries and class-out release.

## 3. Settings and candidate presentation

- [x] 3.1 Extend frontend types and add the Tipi di ora table with the three independent controls, unreviewed-school indicator and saved-state/error feedback; verify focused interaction tests for persistence and failed saves, and keyboard/narrow-screen behavior.
- [x] 3.2 Reuse persisted color IDs in Settings and candidate badges and preserve existing typography/surfaces; verify visually in light and dark themes, including readable labels and distinct ITP/sostegno entries.
- [x] 3.3 Add Solo in caso di necessità and Usa comunque confirmation with current restriction feedback and drawer refresh after stale policy rejection; verify interaction tests for confirm/cancel, hidden types, hard blocks and preserved profiles.

## 4. Archive compatibility

- [x] 4.1 Extend JSON export/import with optional hour-type settings and exceptional metadata, validating all input before atomic writes; verify legacy import preserves current settings, new round trips preserve policies/colors, and malformed archives change nothing.
- [x] 4.2 Verify database backup/restore includes policies, colors and exceptional assignments using existing backup tests; update README archive compatibility notes and check examples against exported data.

## 5. Integration verification

- [x] 5.1 Run the backend test suite and frontend checks/build; verify existing permits, substitution rows, class-out availability and entry/exit tests pass alongside the new policy tests.
- [x] 5.2 Rebuild and recreate using `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate`; verify successful build/start and the new served asset hash without reading minified bundles.
- [x] 5.3 Exercise GM hidden/outside-school, PE availability changes, ITP/sostegno fallback and hiding, school metadata independence and reload persistence in the running UI; verify old assignments and existing data/backup controls remain intact.

## Future TODOs (outside this change)

- Add availability overrides for a particular teacher, date and hour, with explicit precedence over global type rules. Do not implement or count this as an incomplete task for this change.

## Workflow follow-up

- Ask the user whether to commit before committing completed work, as required by AGENTS.md.
- Archive this change only after implementation and review are complete.
