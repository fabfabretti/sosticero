# Spec Delta

## ADDED Requirements

### Requirement: Optional permit note
The dated permit form on the Permessi page SHALL allow entering, editing and clearing one optional plain-text note per record. Editing SHALL load the saved note. A new-entry or cancelled-edit form SHALL NOT reuse another record's note. Supplenze SHALL display the note through the Assenze row's information tooltip; permit notes SHALL be edited from Permessi.

#### Scenario: Create and edit
- **WHEN** a user saves a dated permit with a note and later opens it for editing
- **THEN** the form shows the saved note and permits changing or clearing it
- **AND** the saved note is visible on the corresponding Assenze row, including permit-only rows

#### Scenario: Independent drafts
- **WHEN** a user saves a permit or cancels editing and starts a new record
- **THEN** the new record's note starts empty

### Requirement: Permit note lifecycle
Valid permit moves SHALL move the note with the record and preserve stable identity and recovery links. Deleting a permit SHALL remove its note without removing any manual absence note. Rejected edits SHALL leave notes unchanged. Notes SHALL NOT affect permit validation, recovery accounting or absence calculations.

#### Scenario: Move a permit
- **WHEN** a valid edit changes a permit's date or teacher without supplying a replacement note
- **THEN** its note moves to the destination with no note left at the old source
- **AND** existing identity and recovery protections remain effective

#### Scenario: Protected edit
- **WHEN** an edit or deletion is rejected by recovery protections
- **THEN** the permit and its original note remain unchanged

#### Scenario: Remove only the permit
- **WHEN** a permit is deleted while a manual absence note exists for the same teacher/date
- **THEN** the permit note disappears and the manual absence note remains
