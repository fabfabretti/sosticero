# Timetable Versions

## Purpose

Preserve date-correct school timetables and safely reconcile operational records when a complete timetable changes from a selected date.

## ADDED Requirements

### Requirement: Date-effective full timetable versions
The system SHALL retain full timetable versions and select the latest version effective on or before each requested date. The initial baseline SHALL cover all earlier dates. Each version SHALL last until the next effective date, without automatic reversion.

#### Scenario: Effective date boundary
- **WHEN** a version starts on 15 October
- **THEN** 14 October uses the previous version and 15 October uses the new version
- **AND** daily rows, candidates, availability and date-dependent edits use the selected version

#### Scenario: Insertion before a scheduled version
- **WHEN** a version is inserted before an already scheduled later version
- **THEN** its interval ends immediately before that later version
- **AND** later dates remain unchanged

### Requirement: Explicit complete-file import
The app SHALL accept the existing complete timetable JSON format with an effective date selected separately, defaulting to today in Europe/Rome. Past and future dates SHALL be supported. Invalid files and duplicate effective dates SHALL be rejected without altering records. Imports SHALL NOT merge partial teacher schedules.

#### Scenario: Backdated correction
- **WHEN** a full JSON file is selected with an earlier effective date
- **THEN** the preview identifies recorded days affected from that date through the end of its interval
- **AND** application requires explicit confirmation of the historical changes

#### Scenario: Ambiguous same-date version
- **WHEN** another version already starts on the chosen date
- **THEN** the import is rejected with a clear message and existing versions remain intact

### Requirement: Reviewable import impact
Before application the system SHALL show the effective interval, affected recorded dates, changed demand and assignments needing review. Teacher additions, removals and identity changes SHALL be surfaced; identity SHALL remain based on stable IDs without automatic name matching. Preview SHALL NOT mutate operational data.

#### Scenario: Teacher IDs change
- **WHEN** the candidate file removes existing IDs and introduces new ones
- **THEN** the preview shows removals and additions and warns that saved records will not transfer automatically
- **AND** historical identities remain addressable

### Requirement: Preserve unresolved operational evidence
Applying a version SHALL preserve saved absences, permits, notes, classifications, availability, class exclusions, assignments and recovery links. Assignments SHALL be revalidated within the affected interval. Invalid or orphan assignments SHALL remain visible with original teacher, class, period and campus context for explicit review, without automatic deletion or reassignment.

#### Scenario: Assigned lesson disappears
- **WHEN** a saved assignment no longer matches a substitution row
- **THEN** the day view lists it as unresolved with its original context
- **AND** the user can explicitly remove or replace it

#### Scenario: Candidate becomes busy
- **WHEN** a saved substitute teaches another lesson under the new version
- **THEN** the assignment is flagged for review even if its row key remains unchanged

#### Scenario: Linked recovery becomes invalid
- **WHEN** an RP assignment becomes invalid under the new timetable
- **THEN** its permit link remains intact and the conflict is disclosed
- **AND** timetable import does not silently change recovered-hour accounting

### Requirement: Deliberate statistical reconciliation
Application SHALL reconcile facts only within the changed effective interval using the selected timetable. Earlier facts and dates governed by a later version SHALL remain unchanged. Unresolved assignments SHALL be disclosed and SHALL NOT count as valid coverage. Original evidence for changed facts SHALL remain recoverable.

#### Scenario: Previously entered future day
- **WHEN** a future day's saved demand refers to the previous timetable
- **THEN** the new version updates its affected demand and outcome validity
- **AND** unchanged dates retain their saved facts

#### Scenario: Backdated correction changes campus
- **WHEN** an explicitly confirmed backdated version changes a recorded lesson's campus
- **THEN** affected statistics reflect the corrected campus and original evidence remains recoverable

### Requirement: Atomic application of reviewed input
Application SHALL require confirmation bound to the previewed file, date and relevant database state. A stale preview SHALL require renewed review. Versions, conflict context and reconciled facts SHALL commit together or leave operational data unchanged on failure.

#### Scenario: Concurrent edit after preview
- **WHEN** relevant operational data changes before confirmation is applied
- **THEN** application is rejected as stale and a refreshed preview is required

#### Scenario: Reconciliation fails
- **WHEN** validation or reconciliation fails during application
- **THEN** no timetable version or operational changes are committed

### Requirement: Safe migration and archive compatibility
Migration SHALL preserve the existing timetable as baseline without changing operational records or existing facts. Version-aware archives SHALL round-trip all timetable versions and conflict context atomically. Legacy state archives SHALL remain supported against the existing timeline without inventing missing timetable history.

#### Scenario: Existing installation upgrades
- **WHEN** the installation has one timetable and saved operational data
- **THEN** migration preserves those values and creates a baseline exactly once

#### Scenario: Version-aware archive is invalid
- **WHEN** an archive contains duplicate effective dates or broken historical references
- **THEN** import rejects the entire archive without altering stored data

#### Scenario: Legacy archive lacks timetables
- **WHEN** a compatible legacy state archive is imported
- **THEN** existing timetable versions remain intact and unavailable historical context is disclosed
