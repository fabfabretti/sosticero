# Spec Delta

## Purpose

Allow the office to adjust support teaching hours through dated timetable overrides while preserving teaching commitments and operational evidence.

## ADDED Requirements

### Requirement: Scoped support lesson movement
Authorized timetable editors SHALL move class lessons of a sostegno teacher within that teacher's week into empty lesson cells or swap them with another editable support lesson or special activity. Moves SHALL preserve the lesson payload and weekly support-hour count. Curricolare and ITP class lessons SHALL remain fixed.

#### Scenario: Move support into an empty cell
- **WHEN** staff move a support lesson from Monday hour 2 to Tuesday hour 3 and save
- **THEN** the effective timetable places it only in the destination with its original class, campus and room
- **AND** the weekly support-hour count is unchanged

#### Scenario: Swap editable lessons
- **WHEN** a support lesson is swapped with another support lesson or an editable special activity of the same teacher
- **THEN** both complete lesson payloads exchange positions without duplication or loss

#### Scenario: Invalid movement
- **WHEN** a request moves a lesson to another teacher, overwrites a fixed lesson, or adds or deletes a support hour
- **THEN** it is rejected atomically

### Requirement: Support class and campus editing
In edit mode, staff SHALL edit a support lesson's class and campus through an accessible dialog. The class SHALL be one existing class and the campus SHALL be Centrale, Succursale or unspecified. Unchanged imported multi-class lessons SHALL remain valid; explicitly editing their class SHALL replace the class set with the selected single class. Other lesson fields SHALL remain unchanged.

#### Scenario: Correct a support class
- **WHEN** staff select another existing class and Succursale and save
- **THEN** the support lesson uses that class and campus during the override interval without changing its room or converting it to a special activity

#### Scenario: Cancel or invalid class
- **WHEN** staff cancel the dialog or submit an unknown or empty class
- **THEN** cancellation leaves the draft unchanged and invalid submissions cannot be saved

### Requirement: Support cannot be disabled
Support class lessons SHALL have no disable or emergency-only toggle. The server SHALL reject requests introducing a disabled state or converting support lessons to special activities. Existing special-activity editing behavior SHALL remain available unchanged.

#### Scenario: Clicking support
- **WHEN** staff click a support lesson in edit mode
- **THEN** its class and campus editor opens without changing availability

#### Scenario: Forged disable request
- **WHEN** a client submits a support lesson with disabled set to true or changes it into POT
- **THEN** the entire edit is rejected and existing data remains unchanged

### Requirement: Dated support override lifecycle
Support edits SHALL reuse inclusive start/end dates, weekly repetition, later-starting whole-teacher precedence, same-start revisions, expiry, dated reset and reviewed deletion. Imported timetables SHALL remain immutable. Drafts SHALL support cancellation and stale saves SHALL fail without overwriting committed work.

#### Scenario: Temporary support edit expires
- **WHEN** a support override ends on Friday
- **THEN** it applies through Friday and the previous applicable override or imported timetable resumes afterwards

#### Scenario: Reset and concurrent save
- **WHEN** staff reset an override from a selected date or submit a draft whose basis has changed
- **THEN** reset preserves earlier dates and stale saves are rejected with the draft available for reconciliation

### Requirement: Effective support schedule governs operational views
Substitution rows, compresence, candidates, class-out availability, timetable views and exports SHALL use the effective support schedule for the requested date, with existing role policies unchanged. Saving or deleting edits SHALL preview affected assignments, retain them and their recovery links, and flag invalid coverage for review. Independent student-group and reception records SHALL remain unchanged.

#### Scenario: Moved support changes compresence
- **WHEN** an override moves a support lesson to another class or period
- **THEN** compresence and absence rows use the new placement within its validity interval
- **AND** no support compresence remains at the old placement solely because of the imported lesson

#### Scenario: Existing assignment becomes invalid
- **WHEN** an override changes the validity of a saved assignment
- **THEN** the issue is previewed before confirmation and the saved assignment remains available for review afterwards

#### Scenario: Independent overlapping records
- **WHEN** a support lesson is moved into a cell with a reception or student-group record
- **THEN** that independent record is retained and its existing overlap indication remains visible

### Requirement: Validated portable support overrides
Support overrides SHALL survive restart and supported archive and backup round trips. Legacy special-only records SHALL remain valid. New timetable imports SHALL suspend an entire affected move or swap when its source, destination or support-role eligibility becomes incompatible and SHALL report the need for review.

#### Scenario: Import changes one side of a support swap
- **WHEN** a new import changes one of the original lessons or changes the teacher's role away from sostegno
- **THEN** the incompatible edit is suspended as a whole and the imported schedule is shown with a review indication

#### Scenario: Archive round trip
- **WHEN** support and legacy special-hour overrides are exported and restored
- **THEN** their effective dates, lesson fields and review evidence are preserved
