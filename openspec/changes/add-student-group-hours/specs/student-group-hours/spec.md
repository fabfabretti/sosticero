# Student Group Hours

## Purpose

Represent teacher-led activities involving pupils from one or more source classes without treating those groups as whole classes or presuming an absence coverage policy.

## ADDED Requirements

### Requirement: Dated weekly group commitments
Authorized office users SHALL manage weekly group commitments with stable identity, teacher, weekday, period, campus, room, effective start and optional end date, and one or more source classes with optional positive pupil counts. Unknown counts SHALL remain unspecified. Autonomous study without a teacher SHALL NOT create a commitment.

#### Scenario: Mixed group
- **WHEN** an authorized user records Iorio on Monday period 5 with 1AST (10) and 2CE (5), Centrale, Aula 20
- **THEN** one group commitment is recorded with 15 pupils and both source classes

#### Scenario: Unknown count and excluded study
- **WHEN** the supplied schedule has Corrà with 2DST without a count and a separate autonomous-study slot
- **THEN** Corrà's count remains unknown and the autonomous-study slot is excluded

#### Scenario: Effective range
- **WHEN** a viewed date falls outside the commitment's inclusive effective dates
- **THEN** the commitment does not occupy that day's timetable

### Requirement: Safe authorized editing
Writes SHALL enforce existing authentication, campus permissions and concurrent-edit protection. Invalid references, dates or counts and duplicate active teacher-period commitments SHALL be rejected atomically. Conflicts with existing lessons or activities SHALL be exposed and SHALL NOT silently replace them or make a teacher available.

#### Scenario: Stale or unauthorized edit
- **WHEN** a user saves stale data or edits a campus outside their permissions
- **THEN** the save fails without changing stored commitments

#### Scenario: Overlapping ordinary lesson
- **WHEN** a group commitment overlaps an imported lesson
- **THEN** both are preserved, the conflict is shown and the teacher remains occupied

### Requirement: One teacher-hour without whole-class effects
Each active teacher-period SHALL count once as service and, if absent, once as an absent teacher-hour, regardless of source-class count or overlapping records. Group commitments SHALL block ordinary substitution availability and SHALL NOT establish whole-class occupancy, same-class compresence or release through source-class outings.

#### Scenario: Source class is out
- **WHEN** one or all source classes are marked out during a group commitment
- **THEN** the teacher remains occupied and no automatic group cancellation is inferred

#### Scenario: No false co-teaching
- **WHEN** a group includes pupils from a class with its own ordinary lesson
- **THEN** the group teacher is not offered as a co-teacher for that whole-class lesson

### Requirement: Separate absence review
An absent group teacher SHALL produce one dated group activity labelled “Da valutare” per commitment-period, showing teacher, source classes, known counts, room and campus. It SHALL remain separate from ordinary substitution demand and assignments. The system SHALL NOT infer a substitute, cancellation or return to source classes.

#### Scenario: Absent mixed-group teacher
- **WHEN** Iorio is absent for the group containing 1AST and 2CE
- **THEN** one “Da valutare” item appears and no two class-substitution rows are generated from that group

#### Scenario: No presumed cover outcome
- **WHEN** reporting includes an unresolved group absence
- **THEN** its teacher-hour is included once and it does not inflate ordinary demand, covered or uncovered totals

### Requirement: Consistent presentation
Timetable views and timetable exports SHALL identify group commitments separately from whole-class lessons, including campus, room, source classes and known counts. Daily review SHALL respect date and campus filters and clearly state that coverage needs evaluation.

#### Scenario: View or print a teacher timetable
- **WHEN** the user views or exports a week containing a mixed-group hour
- **THEN** it appears once with its group details and without invented pupil counts

### Requirement: Persistent historical compatibility
Commitments and recorded group-absence context SHALL survive restart and supported archive round trips. Legacy archives SHALL remain readable without erasing existing group data. Invalid group payloads SHALL fail atomically. Timetable reimports or later edits SHALL preserve recorded historical context and expose unresolved references rather than silently reassigning identities.

#### Scenario: Reimport loses a teacher reference
- **WHEN** a later timetable no longer contains the referenced teacher
- **THEN** the group record is retained and flagged for review without guessing another teacher

#### Scenario: Historical campus and archive
- **WHEN** a recorded group absence is followed by a campus edit and archive round trip
- **THEN** the original absence campus and single teacher-hour remain intact

#### Scenario: Legacy and malformed archives
- **WHEN** an archive omits group data or contains malformed group data
- **THEN** an otherwise valid legacy archive preserves current group records, while malformed group data rejects the entire import
