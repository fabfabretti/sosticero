# Proposal

## Why

Settings has accumulated unrelated layouts, spacing, controls and feedback styles, making routine configuration difficult to scan and future restyling expensive. Group the existing functions into a compact accordion page with a single reusable visual language aligned with the rest of the app.

## What Changes

- Group settings into Orari e ricevimenti, Regole supplenze, Collegamenti, Dati e backup and Aspetto.
- Use one reusable accordion pattern, initially collapsed and independently expandable, with descriptions and useful read-only status summaries.
- Unify section contents as well as their containers: shared fields, action rows, button variants, notices, tables and confirmations.
- Centralize compact spacing, sizing and surfaces in shared CSS classes and Settings variables derived from existing app tokens; remove replaced section styles and inline presentation CSS.
- Preserve drafts and previews when sections close, maintain keyboard accessibility, and support narrow screens and both themes.
- Keep existing import, backup, policy and integration safeguards and the Settings footer.

## Capabilities

### New Capabilities

- `settings-page`: Grouped configuration navigation, consistent compact presentation, reusable styling and state-preserving disclosure behavior.

### Modified Capabilities

None. Existing app-shell, hour-type, reception, integration and backup behaviors remain available within the new grouping.

## Impact

Frontend Settings composition in main.tsx; TimetableImport, Receptions, HourTypes, SheetsSettings and BackupSection; shared CSS and frontend tests. User and styling documentation will describe grouping and extension conventions. No new UI framework, backend API or data migration is required. Implementation verification includes an isolated testing deployment followed by rebuilding and recreating the normal service as required by AGENTS.md; production checks remain read-only.
