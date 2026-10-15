# Spec Delta

## Purpose

Let office staff record plain-text context for manual teacher absences and read all applicable absence and permit notes from the daily absence row.

## ADDED Requirements

### Requirement: Edit manual absence notes
Users SHALL be able to add, edit and clear one optional plain-text note per manual teacher absence/date through the row's existing edit controls. Saving a note SHALL preserve absence hours and classification. Notes SHALL NOT apply to class absences or availability.

#### Scenario: Save and clear a note
- **WHEN** a user saves a note from a manual absence row's edit controls
- **THEN** the saved text appears after reload without changing hours or classification
- **AND** saving an empty or whitespace-only value clears the note

### Requirement: Combined daily information tooltip
Each teacher's Assenze row SHALL show one (i) trigger whenever it has permit information or a nonempty source note. Hover and keyboard focus SHALL reveal existing permit information and all available notes, labelled Assenza and Permesso by source. Text SHALL render literally and wrap within the viewport.

#### Scenario: Both sources have notes
- **WHEN** a teacher has both a manual absence note and a permit note on the selected date
- **THEN** hovering or focusing the row's (i) shows both labelled notes and existing permit information

#### Scenario: Manual note only
- **WHEN** a manual absence has a note and no permit
- **THEN** its row has an (i) showing the absence note
- **AND** clearing the note removes the trigger

#### Scenario: Permit information without notes
- **WHEN** a teacher has a permit with no notes
- **THEN** the existing permit explanation remains available through (i)

#### Scenario: Plain text and long content
- **WHEN** a note contains markup characters or long text
- **THEN** the tooltip displays literal text with readable wrapping, without executing markup or clipping against sidebar overflow

### Requirement: Note persistence and source lifecycle
Notes SHALL survive reloads, database backups and archive round trips. Older records and archives SHALL remain valid without notes. Omitted note fields SHALL preserve saved notes; null or blank values SHALL clear them. Hour-only changes SHALL preserve notes, and deleting a source SHALL remove only its note. Invalid note types or orphan note metadata SHALL reject writes or imports atomically.

#### Scenario: Independent source removal
- **WHEN** a manual absence is removed while a permit remains for the teacher/date
- **THEN** only the manual note is removed and the permit note remains visible

#### Scenario: Hour-only edit
- **WHEN** hours are changed without a note field
- **THEN** the existing note remains unchanged

#### Scenario: Archive compatibility
- **WHEN** an archive with notes is exported and reimported
- **THEN** notes retain their source, date, teacher and text
- **AND** archives without note metadata import as having no notes

#### Scenario: Invalid metadata
- **WHEN** a request supplies a non-string non-null note or an archive associates a note with a missing source
- **THEN** the operation fails without changing existing records
