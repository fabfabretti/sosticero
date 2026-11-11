# Proposal

## Why

Assigning an available teacher to another campus requires a campus-change notice, but these assignments currently lack communication and acceptance tracking. Office staff need one copyable notice covering the affected hours and a reliable indication that it was communicated and acknowledged.

## What Changes

- Show Comunicato, Accettata and Copy for manual or automatic A disposizione substitutions at a different known campus.
- Group notices by day, teacher, origin campus and destination campus, sharing communication and acceptance status across the affected hours.
- Reset both statuses when the notice's assignment content changes.
- Copy an Italian message listing affected hours and substitutions chronologically, signed with the current user's full name, including the reminder to check the substitution board and sign completed substitutions.
- Personalize the greeting with the assigned teacher name and use the logged-in user signature in all three teacher-message templates.
- Preserve existing RP, paid and entry/exit status tracking behavior.

## Capabilities

### New Capabilities

- `availability-campus-communication`: Grouped notices and acknowledgement for cross-campus A disposizione assignments.

### Modified Capabilities

None.

## Impact

Daily substitution UI and clipboard formatting; backend assignment APIs, state persistence, archive validation and concurrency handling; current-account signature data. No new external service or automatic message delivery. Implementation verification uses isolated test data, followed by normal atlante deployment and read-only release checks.
