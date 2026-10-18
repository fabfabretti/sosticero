# Spec Delta

## Purpose

Allow staff to make dated changes to special timetable hours while preserving imported schedules, historical records and clear campus identification.

## ADDED Requirements

### Requirement: Compact campus presentation
Orari SHALL retain teacher filtering, class and activity labels, compresenza information and accessible headers. Ordinary lessons SHALL use compact unfilled rounded rectangles outlined by campus; special hours SHALL use campus-coloured filled rectangles. Both SHALL show campus-coloured C or S inside; unknown campus SHALL show ? with neutral styling. Compresenza markers SHALL sit inside the rectangle. Separate campus/activity chips SHALL be removed.

#### Scenario: Lesson and activity at different campuses
- **WHEN** a teacher has a lesson in centrale and POT in succursale
- **THEN** the class appears in a centrale-outlined rectangle with C and POT appears in a succursale-filled rectangle with S
- **AND** padding and gaps are reduced from the existing Orari cells and remain readable in light and dark themes

### Requirement: Readable timetable rows and campus legend
Rows SHALL expand to contain their rectangles without clipping labels or compresenza information. A campus colour legend SHALL appear above the grids and name Centrale, Succursale and unknown campus.

#### Scenario: Crowded shared lesson
- **WHEN** a shared lesson contains several class labels
- **THEN** the row grows to fit the labels and Comp. stays inside its rectangle
- **AND** the legend identifies the campus colours above the timetables

### Requirement: Explicit per-teacher editing
Each teacher header SHALL offer Edit in the existing application button style. Edit mode SHALL expose start date, optional inclusive end date, Save, Reset and Cancel in one compact toolbar. Edits SHALL remain local until saved; cancelling SHALL discard them. Viewing a selected date SHALL show the applicable schedule and distinguish active, scheduled and review-needed overrides beside the edit control.

#### Scenario: Future override
- **WHEN** staff save an override beginning next Monday
- **THEN** today's schedule remains unchanged and the header identifies the scheduled change as MODIFICATO · dal followed by its start date
- **AND** staff can preview that Monday's resulting schedule

#### Scenario: Invalid range or failed save
- **WHEN** the end precedes the start or saving fails
- **THEN** a clear error is shown, no partial change is stored, and the draft remains available

### Requirement: Special-hour moves and swaps
Only activity-only hours with no classes SHALL be movable or disableable. Staff SHALL drag special hours within the same teacher's week into empty cells or swap with another special hour. Ordinary lessons, including class-linked activities, SHALL remain fixed. Moves SHALL preserve activity codes, campus and disabled status. Dragging SHALL show a floating copy and highlight the destination. Keyboard users SHALL have equivalent move, swap and toggle controls without separate visible move buttons.

#### Scenario: Special-hour swap
- **WHEN** POT is dropped onto STAFF for the same teacher
- **THEN** their positions swap and both retain their original campus and availability status
- **AND** releasing a drag does not also toggle the hour

#### Scenario: Invalid drop
- **WHEN** a special hour is dropped on a class lesson or another teacher's timetable
- **THEN** the move is rejected without changing either hour

### Requirement: Special-hour disable toggle
In edit mode, clicking a special hour SHALL toggle emergency-only availability without deleting the commitment. Disabled hours SHALL appear muted and crossed out with a textual accessible state. Re-enabling SHALL restore normal type policy, and viewing mode SHALL not toggle hours.

#### Scenario: Disable and restore
- **WHEN** staff disable POT, save, then later re-enable it in a saved override
- **THEN** the respective date intervals use emergency-only and normal type availability while the activity remains in the timetable

### Requirement: Dated immutable overlays
Imported timetables SHALL remain unchanged. Overrides SHALL repeat weekly within start/end dates inclusive, using the applicable imported timetable for each date. Later-starting overlapping overrides for a teacher SHALL take precedence as a whole; after expiry the previous applicable override or imported timetable SHALL resume. Same-start revisions SHALL replace the effective revision while retaining earlier evidence.

#### Scenario: Temporary overlapping override
- **WHEN** an ongoing override begins on October 19 and another runs October 26 through October 30
- **THEN** the second applies on October 30 and the first resumes on October 31
- **AND** neither changes October 18

### Requirement: Dated reset
Staff SHALL be able to select Ripristina originale from a chosen date. Reset SHALL use the imported timetable from that date, suppress earlier overrides thereafter, and preserve previous dates. Later explicitly saved overrides SHALL still be possible.

#### Scenario: Reset during an ongoing override
- **WHEN** staff reset from November 2
- **THEN** earlier dates retain their overrides and November 2 onward uses the imported timetable until a later override applies

### Requirement: Import compatibility and review
Import preview SHALL identify overrides that carry forward and edits requiring review. An edit SHALL carry forward only when its affected imported source and destination hours remain unchanged. A conflicting move or swap SHALL be suspended as a whole, showing newly imported hours for all its cells; independent compatible edits SHALL remain applied. Review status SHALL persist until staff explicitly review and save or discard the affected edit.

#### Scenario: Import changes one side of a swap
- **WHEN** a new timetable changes either original hour involved in an override swap
- **THEN** neither half of the swap is applied against that version, the new imported hours are shown, and the conflict is reported in preview and Orari
- **AND** unrelated compatible edits remain applied

#### Scenario: Minor unrelated import change
- **WHEN** an import changes an unrelated teacher or untouched hour
- **THEN** the existing override continues without requiring recreation

### Requirement: Preserve operational evidence
Saving, revising, resetting or reconciling overrides SHALL preserve existing assignments and permit recovery links. The system SHALL report affected dates and assignments before confirmation and flag invalid coverage for review without silently reassigning, deleting or refunding it. Date-based eligibility, location checks, statistics and exports SHALL use the same effective schedule while preserving historical evidence.

#### Scenario: Disable an already assigned POT hour
- **WHEN** staff confirm an override making a saved normal POT assignment exceptional
- **THEN** the assignment is retained and flagged for review, and its prior context remains recoverable
- **AND** unrelated dates and recovery balances are unchanged

### Requirement: Persistent validated overrides
Overrides, date ranges, resets and review evidence SHALL survive restart, backup/restore and archive round trips. Invalid or stale edits SHALL fail atomically. Legacy archives SHALL remain importable without silently deleting current overrides, with incompatible retained overrides reported for review.

#### Scenario: Concurrent editing
- **WHEN** a user saves a draft based on a timetable or override revision that has changed
- **THEN** the save is rejected with a reload/review prompt and neither editor's committed work is overwritten

#### Scenario: Archive round trip
- **WHEN** an archive containing overrides is exported and restored
- **THEN** the same date-based schedules, disabled status, reset boundaries and review evidence are restored
