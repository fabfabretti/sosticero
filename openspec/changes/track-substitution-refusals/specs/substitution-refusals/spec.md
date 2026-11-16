# Spec Delta

## Purpose

Retain the professors who refused a substitution so operators can choose replacements without losing the history of previous requests.

## ADDED Requirements

### Requirement: Refusal releases the assigned professor
RP and paid substitution controls SHALL offer Rifiutata alongside Comunicato and Accettata. An authorized refusal SHALL atomically record the current professor and remove the assignment, including its acceptance and communication statuses. Entry/exit controls SHALL remain unchanged.

#### Scenario: Refuse a recovery assignment
- **WHEN** an authorized operator marks an assigned RP professor as Rifiutata
- **THEN** the row becomes unassigned and retains that professor's refusal
- **AND** the associated recovery hour becomes available again without changing the original permit

#### Scenario: Refuse a paid assignment
- **WHEN** an authorized operator marks a paid substitution as Rifiutata
- **THEN** its professor is recorded and its assignment is removed
- **AND** it no longer contributes to paid records, budget use or assignment statistics

### Requirement: Visible history survives replacement
Each substitution row SHALL show its refusing professors in a small red textual note below the assignment selector, whether unassigned or reassigned. History SHALL survive reloads, replacement, assignment removal and unrelated edits. It SHALL identify professors independently of the current assignment and retain a readable name when a professor is no longer resolvable.

#### Scenario: Select a replacement
- **WHEN** Rossi refuses and Bianchi is subsequently assigned to the row
- **THEN** the note still identifies Rossi, not Bianchi, as having refused

#### Scenario: Multiple professors refuse
- **WHEN** Rossi and then Bianchi refuse the same row
- **THEN** the note lists both professors once each

#### Scenario: History after removal
- **WHEN** the replacement assignment is removed or the page is reloaded
- **THEN** the row's refusal note remains visible

### Requirement: Refusals remain informational and contextual
Refusal history SHALL apply only to its substitution date and row. It SHALL NOT block deliberate reassignment of a refusing professor or count as an active assignment. Reassignment SHALL start with fresh communication and acceptance statuses and SHALL preserve history. Disappearing rows SHALL NOT transfer history silently to a different row.

#### Scenario: Reconsidered refusal
- **WHEN** an operator assigns a professor who previously refused the row
- **THEN** the assignment is allowed subject to normal eligibility and permissions
- **AND** previous refusal remains visible with fresh assignment statuses

#### Scenario: Another day or row
- **WHEN** the same professor is considered for a different date or substitution row
- **THEN** the earlier refusal does not appear as a refusal of that different substitution

### Requirement: Authorized atomic refusal under concurrent edits
The server SHALL derive the refusing professor from the current assignment and enforce campus permissions and current edit preconditions. Stale, repeated or invalid refusal requests SHALL NOT remove a replacement, duplicate history or partially change state. History creation and assignment release SHALL commit or fail together.

#### Scenario: Another operator replaces the professor
- **WHEN** a refusal request uses preconditions from an assignment that has since been replaced
- **THEN** it is rejected and the replacement and history remain unchanged

#### Scenario: Unauthorized refusal
- **WHEN** an operator without the row's campus assignment permission attempts refusal
- **THEN** neither the assignment nor refusal history changes

#### Scenario: Request retried after successful refusal
- **WHEN** the same refusal is submitted again after the assignment was released
- **THEN** no duplicate record or further assignment removal occurs

### Requirement: Compatible persistent refusal history
Refusal history SHALL survive application restarts and supported archive export/restore. Existing data without history SHALL remain valid and start with no refusal notes. Invalid imported history SHALL be rejected without partially restoring data. Absence or timetable changes SHALL NOT erase stored history merely because its row is temporarily absent.

#### Scenario: Archive round trip
- **WHEN** data with refusals is exported and restored
- **THEN** all recorded professors and their row/date context are retained

#### Scenario: Legacy archive
- **WHEN** an archive without refusal history is restored
- **THEN** it remains usable without fabricated refusals

#### Scenario: Row temporarily disappears
- **WHEN** a row with refusal history disappears and later returns with the same identity
- **THEN** its stored refusal history is shown again
