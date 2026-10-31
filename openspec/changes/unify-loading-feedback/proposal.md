# Proposal

## Why

Loading feedback varies across Sosticero, leaving users unsure whether an action is underway. In Supplenze, a newly selected date can appear above the previous day's actionable rows, allowing actions against outdated data.

## What Changes

- Establish one spinner-and-label presentation for foreground loading and operations across every screen, dialog, import, attachment and export.
- Retain previous content dimmed and block affected actions while its replacement loads; keep navigation and selection controls usable where safe.
- Bind usable results to the current selection and ignore superseded responses, including rapid date changes.
- Prevent duplicate actions, premature attachment submission and exports of results belonging to an earlier selection.
- Give failures a visible error and retry path without unlocking mismatched content. Keep periodic background refresh quiet.
- Support keyboard interaction, status announcements, reduced motion and both themes.

## Capabilities

### New Capabilities

- `loading-feedback`: Consistent foreground pending feedback, scoped interaction protection, response ownership and recovery throughout the application.

### Modified Capabilities

None. The new cross-screen capability supplements existing feature requirements without changing their domain behavior.

## Impact

Frontend shared UI styles and a small shared loading presentation; main.tsx screens, Auth, PaidHours, TeacherTimetables, Stats/StatsAvailability, Inbox, HourTypes, TimetableImport, Receptions, Attachments, export panels and Display. Review useQuietRefresh integration while preserving quiet polling and edit baselines. Existing frontend tests gain delayed-response coverage. No API, database schema or dependency change is expected. Implementation verification uses an isolated testing Compose project, followed by deployment to atlante and read-only release checks.
