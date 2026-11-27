# timetable-hour-editing Specification

## Purpose

Allow staff to maintain dated teacher timetable hours and use the resulting schedule consistently throughout the application.

## Requirements

### Requirement: Edit any teacher's hours
In teacher timetable edit mode, staff SHALL create an hour by selecting an empty cell and edit or remove an existing hour for any teacher, including curricular, ITP and support teachers. Edits SHALL allow kind, class and campus changes and SHALL remain drafts until saved.

#### Scenario: Convert an ITP lesson
- **WHEN** staff change an ITP teacher's curricular hour to POT and save
- **THEN** that hour becomes POT in the effective timetable and the teacher's role and other hours remain unchanged

#### Scenario: Create and remove
- **WHEN** staff create an hour in an empty cell or remove an existing hour and save
- **THEN** the effective schedule reflects the addition or removal for the selected interval
- **AND** cancelling the draft leaves the saved timetable unchanged

### Requirement: Class association is editable
Staff SHALL add or remove a class on an hour. Substitution-available activity kinds SHALL permit a class or no class. Existing imported multi-class values SHALL remain intact unless staff explicitly change the class association.

#### Scenario: POT with and without class
- **WHEN** staff save a POT hour with a class and later remove its class
- **THEN** both forms are accepted and the effective timetable reflects the selected association

#### Scenario: Preserve imported classes
- **WHEN** staff edit the campus of an imported hour with multiple classes without changing its class association
- **THEN** all its imported classes remain associated with the hour

### Requirement: Administrative availability policy
The timetable editor SHALL retain the existing per-hour enable/disable control for POT, without providing such controls for other types. Availability follows administrative type policy; a disabled POT retains its emergency-only behavior. Existing disabled flags remain effective and are preserved during moves and edits that do not change the type.

#### Scenario: Change the type of a previously disabled hour
- **WHEN** staff explicitly change the type of an hour with a legacy disabled flag
- **THEN** the new type follows its administrative policy and the earlier saved override remains in history

### Requirement: Move and swap hours
Staff SHALL move or swap hours within the same teacher's weekly timetable using pointer and keyboard interactions, preserving their fields. Moves SHALL NOT silently overwrite another hour.

#### Scenario: Move an ordinary lesson
- **WHEN** staff move a curricular lesson to an empty cell and save
- **THEN** it appears at the destination with its fields preserved and is absent from the source

### Requirement: Dated override lifecycle
Edits SHALL reuse inclusive start and optional end dates, weekly repetition, precedence, revisions, reset, deletion and stale-write protection. Imported timetables SHALL remain unchanged.

#### Scenario: Temporary edit expires
- **WHEN** a new hour is saved for a bounded interval
- **THEN** it applies only within that interval and the previous applicable schedule resumes after it

### Requirement: Effective hours drive operations
Sostituzioni, candidate eligibility, class coverage, timetable views, statistics and exports SHALL use the effective edited hour for the requested date and its configured kind policy.

#### Scenario: Converted lesson in Sostituzioni
- **WHEN** an ITP lesson is changed to POT for a date
- **THEN** Sostituzioni displays and evaluates that hour as POT on that date

### Requirement: Preserve operational records and warn about overlaps
The system SHALL preview newly affected saved assignments and retain them for review. It SHALL warn about overlaps with independent reception or student-group commitments and allow saving while retaining and displaying both commitments.

#### Scenario: Overlapping reception
- **WHEN** staff add an hour over an existing reception
- **THEN** the overlap is shown before saving, saving is allowed, and both commitments remain visible

### Requirement: Compatible imports and portable edits
Overrides SHALL survive supported backup and archive round trips. A later import that changes an edited cell's original basis SHALL suspend the affected atomic edit for review without silently discarding it; unrelated compatible edits SHALL remain effective.

#### Scenario: New imported hour conflicts with a manual addition
- **WHEN** an import fills a cell that was empty when a manual hour was added
- **THEN** the conflicting edit is suspended for that imported version and reported for review

### Requirement: Coherent accessible editor
The editor SHALL reuse established Orari controls, dialog, visual language and interaction patterns, with labelled controls and keyboard access. It SHALL clearly distinguish editing, deletion and save/cancel actions.

#### Scenario: Keyboard editing
- **WHEN** staff navigate to an empty or occupied cell in edit mode using a keyboard
- **THEN** they can open the appropriate editor, make or cancel changes, and return focus to the timetable
