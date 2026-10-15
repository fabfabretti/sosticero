# Spec Delta

## ADDED Requirements

### Requirement: Optional permit note
Both the dated permit and Saldo manuale senza data forms on the Permessi page SHALL visibly offer one optional plain-text Note field during initial creation and editing. Users SHALL be able to enter, change and clear notes. Editing SHALL load the saved note. A new-entry or cancelled-edit form SHALL NOT reuse another record's note. Dated permit notes SHALL also appear in the Assenze row's information tooltip; all permit and balance notes SHALL be edited from Permessi.

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

### Requirement: Manual balance note lifecycle
Undated manual balance notes SHALL survive reload, backup and archive round trips independently of dated permit notes. Missing fields SHALL preserve notes; null or blank values SHALL clear them. Hour changes SHALL preserve omitted notes and existing recovery identities. Deleting a balance SHALL remove its note; rejected edits SHALL leave it unchanged. Invalid note types or orphan metadata SHALL reject writes/imports atomically.

#### Scenario: Create and edit an undated note
- **WHEN** a user creates a manual balance with a note and opens it for editing
- **THEN** the saved note is loaded and can be changed or cleared
- **AND** successful save, cancellation or switching form modes clears the creation draft while failed saves retain it

#### Scenario: Recovery and deletion
- **WHEN** hours are validly edited without supplying a note
- **THEN** the note, stable balance identity and recovery links remain intact
- **AND** a rejected protected edit preserves the original note
- **AND** valid deletion removes only the deleted balance's note

#### Scenario: Portability and legacy data
- **WHEN** an archive or database backup containing manual balance notes is restored
- **THEN** notes remain associated with their original balances
- **AND** older data without notes loads with no notes

#### Scenario: Invalid undated note metadata
- **WHEN** a note has an invalid type or an archive note references a missing manual balance
- **THEN** the operation fails atomically without changing existing data

### Requirement: Note tooltips in permit tables
Dated Permessi and Saldi manuali rows SHALL show an (i) beside the teacher when their own record has a nonempty note. Hover or keyboard focus SHALL reveal that record's plain-text note with readable wrapping and viewport bounds. Rows without notes SHALL omit the note icon. Dated notes SHALL also remain available in daily Assenze; undated notes SHALL NOT create a daily absence.

#### Scenario: Read notes in both tables
- **WHEN** a dated permit or undated balance has a saved note
- **THEN** its table row shows (i) and hover or focus reveals that note without opening the edit form
- **AND** another record's note is not substituted for it

#### Scenario: Clear a table note
- **WHEN** a user clears a record's note
- **THEN** that row's note icon disappears while existing period warning icons remain

### Requirement: Compact permit tables
The dated permit and manual balance tables SHALL use tighter cell spacing, compact actions and inline period warnings. Ordinary single-line rows SHALL be shorter than the existing layout without shrinking current text sizes. All columns, sorting, numeric balances, expiry markers and full recovery details SHALL remain available. Keyboard focus and warning tooltips SHALL remain usable on desktop and narrow screens.

#### Scenario: Ordinary and warning rows
- **WHEN** permits with and without unscheduled-period warnings are listed
- **THEN** rows without warnings reserve no empty warning strip
- **AND** warning icons sit inline with their periods without overlapping text or controls

#### Scenario: Recovery details and narrow screens
- **WHEN** a row has multiple recovery entries or the viewport is narrow
- **THEN** complete recovery dates and periods remain readable with natural row growth and horizontal table scrolling where necessary
- **AND** note tooltips remain accessible without increasing row height for note text
