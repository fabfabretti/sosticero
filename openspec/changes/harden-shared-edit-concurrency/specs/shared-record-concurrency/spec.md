# Spec Delta

## Purpose

Allow simultaneous operational edits without losing another operator's saved changes or interrupting ongoing work with background refreshes.

## ADDED Requirements

### Requirement: Atomic shared-record preconditions
Operational replacements and deletions SHALL require a precondition representing the displayed record. The server SHALL compare it with current state atomically before writing. A mismatch SHALL return a conflict without partial changes. Covered records SHALL include absences, class-out entries, availability, dated permits, manual recupero balances and assignments.

#### Scenario: Two absence hour clicks from the same state
- **WHEN** two browsers submit different hour lists based on the same absence and one saves first
- **THEN** the second request is rejected without removing the first request's hours

#### Scenario: Metadata or deletion from a stale screen
- **WHEN** another operator changes a record's hours, note, classification, campus or attachment before its replacement or deletion
- **THEN** the stale action conflicts and leaves the newer record intact

#### Scenario: Unrelated records
- **WHEN** another operator changes a different record
- **THEN** an otherwise valid save succeeds without a concurrency warning

#### Scenario: Missing precondition
- **WHEN** a covered mutation omits its concurrency precondition
- **THEN** the server rejects it without changing data

### Requirement: Protected creation and range operations
Creation SHALL require the target to remain absent. Moves SHALL check both the original record and destination. Range and future-date actions SHALL check every affected record and the affected date set before committing; a conflict SHALL reject the entire operation.

#### Scenario: Duplicate manual absence creation
- **WHEN** a browser adds an absence that another operator has already created
- **THEN** creation conflicts without replacing the existing absence or its metadata

#### Scenario: Permit move races with destination creation
- **WHEN** a permit's destination teacher/date becomes occupied before a move saves
- **THEN** the move fails and both records remain intact

#### Scenario: A range contains a newer record
- **WHEN** one affected date changes after a range action's baseline was captured
- **THEN** none of the range's dates are changed

#### Scenario: Future record set changes
- **WHEN** another operator adds an applicable future record before a future-date action saves
- **THEN** the action conflicts rather than silently including an unseen record

### Requirement: Shared constraints use current state
Teacher availability, global double booking, campus travel restrictions and recupero capacity SHALL be checked against current state atomically with saving. Later absence or availability changes SHALL preserve existing assignments and expose invalid assignments for review on refresh.

#### Scenario: Same teacher at two campuses
- **WHEN** simultaneous requests assign one teacher in the same period at different campuses
- **THEN** at most one succeeds and the other receives the current unavailability reason

#### Scenario: Last recupero hour
- **WHEN** simultaneous requests consume the final eligible recupero hour
- **THEN** at most one succeeds without over-recovery

#### Scenario: Substitute becomes absent
- **WHEN** an absence is added for an already assigned substitute
- **THEN** the assignment is preserved and the refreshed day reports the conflict

### Requirement: Quiet operational refresh
Supplenze and Permessi SHALL discover remote changes in the background and on returning to the browser tab. Applying updates SHALL preserve scroll, focus, entered values, selected date, filters and open controls. Polls without actionable conflicts SHALL not show dialogs, chimes or repeated alerts. Refresh failures SHALL retain the last usable view and retry without repeated interruption.

#### Scenario: Update while scrolled
- **WHEN** a remote change is fetched while the user is viewing a scrolled page without an active editor
- **THEN** the data updates without resetting scroll or remounting the page

#### Scenario: Interaction underway
- **WHEN** a refresh arrives during an open candidate drawer, metadata editor or partially filled entry form
- **THEN** affected updates are deferred without closing controls, changing focus or replacing entered values
- **AND** deferred updates are applied after the interaction ends

#### Scenario: Poll crosses a day change or mutation
- **WHEN** an older background request completes after a day change or successful mutation
- **THEN** it cannot replace the newer view

### Requirement: Actionable save conflicts
A rejected save SHALL explain that the target changed or the selected teacher is unavailable. The UI SHALL refresh the relevant server baseline without silently replaying the rejected action or discarding existing form values. Immediate-save controls SHALL show the saved state and allow an explicit new action. Candidate failures SHALL retain the existing candidate-reload behavior.

#### Scenario: Stale absence hour click
- **WHEN** an immediate hour edit conflicts
- **THEN** the user sees an explanation and current saved hours, and no automatic retry overwrites them

#### Scenario: Stale permit form
- **WHEN** a permit form conflicts with a newer edit
- **THEN** entered values remain available and saving again requires deliberate reconciliation with current state
