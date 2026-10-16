# absence-inbox Specification

## Purpose

Let the office review Google Form absence submissions in a durable Inbox before safely adding them to the existing absence calendar.

## Requirements

### Requirement: Private sheet connection settings
Settings SHALL accept a spreadsheet URL or ID, worksheet name, and service-account JSON upload, offer a connection test, and show account email and connection status. Google access SHALL be read-only. Invalid credentials SHALL leave the installed credentials unchanged. Secrets SHALL never be returned to the browser or exposed in logs or error details.

#### Scenario: Configure the response sheet
- **WHEN** valid credentials and the response spreadsheet with worksheet `Risposte del modulo 1` are configured and tested
- **THEN** Settings reports whether the worksheet is readable without changing its content

#### Scenario: Reject invalid upload
- **WHEN** an oversized, malformed or invalid service-account upload is supplied
- **THEN** the app reports a safe error and preserves the previously installed credentials

### Requirement: Durable response discovery
While configured and running, the backend SHALL check for responses every 30 seconds without overlapping checks. First connection SHALL ingest all existing responses, including past dates; later checks SHALL add unseen submissions. Discovery SHALL survive restarts and source-row deletions without depending on row position alone or removing already discovered items.

#### Scenario: Initial connection
- **WHEN** the first successful check returns historical and future submissions
- **THEN** all submissions appear for review and no calendar entries are created

#### Scenario: Delete test rows and restart
- **WHEN** source test rows are deleted, new responses append, and the app restarts
- **THEN** remaining known submissions retain their status and only unseen submissions create new items

#### Scenario: Network failure
- **WHEN** Google is unavailable or denies access
- **THEN** existing items remain available, a safe stale/error status is visible, and later checks retry with bounded backoff

### Requirement: Interpret form branches
The app SHALL distinguish the three supplied case labels and their date columns, including the two identical day headers. Single-day cases SHALL request the whole day; ranges SHALL include both endpoints but record Monday–Friday only. Hourly cases SHALL parse selected period numbers as nonrecoverable absences. Invalid cases, dates, ranges or hours SHALL be visible and blocked from acceptance.

#### Scenario: Duplicate day headers
- **WHEN** a submission selects the hourly case and contains a date in the second day column
- **THEN** the preview uses that date and the selected hours rather than the single-day branch column

#### Scenario: Two-week absence
- **WHEN** a valid consecutive range spans weekends
- **THEN** the preview includes only weekdays within the inclusive range

#### Scenario: Invalid response
- **WHEN** a row has an unknown case, missing required value, reversed or excessive range, or hours outside supported periods
- **THEN** Inbox displays the source values and a reason why acceptance is unavailable

### Requirement: Teacher resolution
The app SHALL match form teacher names to database teachers without guessing between ambiguous matches. Unknown or ambiguous names SHALL require explicit teacher selection before acceptance. Acceptance SHALL validate teacher availability against the timetable effective for every affected date.

#### Scenario: Name no longer matches
- **WHEN** an imported timetable no longer resolves a submitted teacher name uniquely
- **THEN** Inbox requires selection of a valid teacher and leaves the calendar unchanged until successful acceptance

### Requirement: Inbox review and history
Inbox SHALL show submission time, teacher, case, dates, hours, validation issues and processing status. Pending items SHALL offer Accetta and Ignora. Accepted and ignored items SHALL remain in history across restarts. Ignoring or deleting source rows SHALL not delete calendar records. Polling SHALL not reapply accepted items after manual calendar edits.

#### Scenario: Ignore a test response
- **WHEN** a pending test submission is ignored
- **THEN** it leaves the pending list, remains in history and never changes absences

#### Scenario: Correct an accepted absence manually
- **WHEN** an accepted absence is edited from Supplenze and the same submission is fetched again
- **THEN** that manual correction is preserved and the submission stays accepted

### Requirement: Atomic additive acceptance
Acceptance SHALL preview affected dates and overlaps, add only missing hours, and preserve existing hours, notes, classifications and attachments. Absence changes, derived state and accepted status SHALL commit atomically. Repeated or concurrent acceptance SHALL have at most one effect. Hourly submissions SHALL never create recoverable permits.

#### Scenario: Partial overlap
- **WHEN** an hourly submission requests periods 1, 2 and 3 while periods 2 and 4 already exist
- **THEN** acceptance records periods 1, 2, 3 and 4 and preserves existing metadata

#### Scenario: Fully recorded absence
- **WHEN** every requested hour already exists
- **THEN** acceptance marks the item accepted without changing existing hours and adds the import note only if missing

#### Scenario: Failure on one date
- **WHEN** validation fails for any date in a range
- **THEN** no dates or processing status are partially changed

#### Scenario: Concurrent acceptance
- **WHEN** two clients accept the same item
- **THEN** only one atomic operation changes state and both clients can observe its accepted status

### Requirement: Compact review rows
Each Inbox item SHALL show the teacher first as text, absence date or range, selected hour chips for hourly cases, the original form submission timestamp and Accetta/Ignora actions. Unknown or ambiguous names SHALL instead show the original text followed by a teacher selector. Extra timestamps and overlap details SHALL remain expandable; blocking errors SHALL stay visible.

#### Scenario: Matched teacher
- **WHEN** a response name uniquely matches a teacher
- **THEN** its row shows the name as text without a teacher selector and shows the sheet submission time rather than notification time

#### Scenario: Resolve an unmatched name
- **WHEN** a response name is unknown or ambiguous
- **THEN** the row shows original name → selector and acceptance stays disabled until resolved

### Requirement: Import provenance note
Acceptance SHALL append the exact note `imported from sheet` once per teacher and affected date, preserving existing note text. This SHALL also apply when requested hours already exist. Repeated imports SHALL not duplicate the marker. Previously accepted records SHALL not be backfilled automatically.

#### Scenario: Existing note
- **WHEN** an imported absence is accepted for a date with a manual note
- **THEN** the manual text remains and `imported from sheet` is added as a separate line exactly once

#### Scenario: Range and repeated imports
- **WHEN** a multi-day absence or another submission for an already imported date is accepted
- **THEN** every affected weekday has the marker and no date receives duplicate marker lines
