# Spec Delta

## Purpose

Track communication and acknowledgement of campus changes for teachers assigned to substitutions during their hours at disposal, with one copyable notice per affected group.

## ADDED Requirements

### Requirement: Cross-campus availability communication controls
The system SHALL show Comunicato, Accettata and Copy on A disposizione substitution assignments when the effective availability campus and substitution campus are both known and different. Manual and automatic availability SHALL qualify. Same-campus or unresolved-campus assignments SHALL NOT qualify.

#### Scenario: Assigned at another campus
- **WHEN** a teacher available in Centrale is assigned in Succursale
- **THEN** their substitution row exposes all three controls

#### Scenario: Same or unknown campus
- **WHEN** either campus is unknown or both campuses are the same
- **THEN** the row does not expose campus-change communication controls

### Requirement: Grouped communication and acceptance
The system SHALL group qualifying assignments by date, teacher, origin campus and destination campus. Comunicato and Accettata SHALL be independently toggleable shared statuses across all rows in a group, persisted across reloads. Copy SHALL NOT change either status. Existing campus authorization SHALL govern status changes.

#### Scenario: Two hours covered by one notice
- **WHEN** an authorized user marks Comunicato or Accettata on either of two grouped rows
- **THEN** the corresponding status changes on both rows and survives reload
- **AND** the other status is unchanged

#### Scenario: Copy without communication
- **WHEN** the user copies a group's message
- **THEN** neither status changes

#### Scenario: Unauthorized campus
- **WHEN** a user without assignment permission for the destination campus attempts to change a status
- **THEN** the server rejects the change without modifying the group

### Requirement: Changed notice requires renewed communication
The system SHALL reset both group statuses when its membership, hours, classes, rooms or campuses change. Unchanged saves and unrelated assignments SHALL preserve status. Removed groups SHALL NOT retain acknowledgement that can reappear when recreated. Concurrent stale status changes SHALL be rejected without partial updates.

#### Scenario: Assignment added or edited
- **WHEN** an acknowledged group's assignment is added, removed, replaced or changes message content
- **THEN** both statuses reset on all remaining affected rows

#### Scenario: Unrelated change or unchanged save
- **WHEN** an unrelated assignment changes or the same assignment is saved without changing notice content
- **THEN** the group's statuses remain unchanged

#### Scenario: Stale acknowledgement
- **WHEN** another user changes a group's assignments before a pending status update is saved
- **THEN** that stale update is rejected and current data can be refreshed

### Requirement: Italian campus-change message
Copy SHALL produce the Italian template below, substituting sorted affected periods, date, origin and destination campus, chronological substitution lines with hour, class and room, and the logged-in user's full name. Missing rooms SHALL read “aula da verificare”. Clipboard failures SHALL show feedback without changing status.

#### Scenario: Complete notice
- **WHEN** a user copies a qualifying group's message
- **THEN** the message follows this template, with the reminder before the closing and with no hardcoded sender name:

```text
[Ore a disposizione] Cambio sede disposizione per le ore <ore>

Gentile Professore/Professoressa <nome del docente>,

la contatto in quanto, per necessità organizzative dell'Istituto, per le sue ore a disposizione <ore> del giorno <giorno> è richiesta la sua presenza in sede <destinazione>, anziché <origine>.

Al momento le sono state assegnate, in ordine, le seguenti supplenze:
<ora> — classe <classe>, aula <aula>

Ricordo, per favore, di verificare le sostituzioni effettivamente assegnate sul tabellone delle sostituzioni, e di firmare quelle svolte.

Cordiali saluti,
<nome completo dell'utente>
```

#### Scenario: Clipboard unavailable
- **WHEN** clipboard access fails
- **THEN** a visible error explains that copying failed and both statuses remain unchanged

### Requirement: Compatibility with existing communication tracking
Existing RP, paid and entry/exit communication controls SHALL retain their behavior. Existing archives without campus-change metadata SHALL remain readable, with qualifying groups initially uncommunicated and unaccepted. New communication state SHALL survive supported backup export and restore.

#### Scenario: Load older data
- **WHEN** an existing archive without this feature's metadata is loaded
- **THEN** qualifying groups start with both statuses false and other communication statuses are preserved

#### Scenario: Backup round trip
- **WHEN** data with an acknowledged campus-change group is exported and restored
- **THEN** unchanged notice content retains both statuses

### Requirement: Personalized teacher message greeting and signature
All teacher-facing clipboard messages for campus changes, recupero permesso and paid substitutions SHALL greet the assigned teacher as “Gentile Professore/Professoressa <nome>,” using their displayed name, and sign with the currently authenticated user's full name. Copying SHALL leave communication and acceptance status unchanged.

#### Scenario: Copy any teacher request
- **WHEN** a logged-in user copies a campus-change, recupero permesso or paid-substitution message
- **THEN** the salutation contains the assigned teacher's displayed name and the signature contains the logged-in user's full name
- **AND** neither communication nor acceptance status changes
