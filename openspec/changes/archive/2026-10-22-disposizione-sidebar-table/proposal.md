# Proposal

## Why

The teacher-oriented A disposizione sidebar makes it difficult to see who is available in each hour and campus. An hour-by-campus table makes that comparison immediate while keeping already assigned teachers visible.

## What Changes

- Replace teacher rows with seven hour rows and Centrale / Succursale columns, with alphabetically ordered names and an em dash for empty cells.
- Show a Sconosciuto column only when at least one displayed teacher-hour has no known campus.
- Strike through names only in hours where the teacher is already assigned; retain readable information indicators and assignment details.
- Preserve click-to-open information, automatic availability causes, attachments and manual availability editing through a teacher-name action.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `candidate-selection`: Specify the sidebar availability table and replace the old selected-hour presentation requirement, including retention of assigned teachers.

## Impact

Frontend availability rendering in `frontend/src/main.tsx`, table/editor styles in `frontend/src/style.css`, and existing sidebar tests. Reuse `RecordInfo` and existing entry mutations. No database migration, new dependency or candidate ranking change is required. Existing unrelated working-tree changes must be preserved.
