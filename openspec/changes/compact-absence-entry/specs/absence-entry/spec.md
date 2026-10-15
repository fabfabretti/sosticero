# Absence Entry Delta

## Purpose

Let users record daily manual absences and availability through a compact form and understand absence timing through grouped sidebar lists.

## ADDED Requirements

### Requirement: Explicit compact entry
The daily sidebar SHALL offer search and an Aggiungi submit button in one compact row when space permits. Clicking a suggestion SHALL select it without saving. Enter SHALL submit the selected teacher/class or highlighted suggestion. Invalid or missing selections SHALL NOT save. Failed saves SHALL retain the draft and show an error; successful saves SHALL clear the person search.

#### Scenario: Review before adding
- **WHEN** the user clicks a teacher suggestion
- **THEN** the teacher is selected without creating an entry
- **AND** clicking Aggiungi saves with the current options

#### Scenario: Keyboard shortcut
- **WHEN** a valid suggestion is highlighted and the user presses Enter
- **THEN** that teacher or class is added with the current options

#### Scenario: Failed save
- **WHEN** saving an entry fails
- **THEN** the selected person and options remain available for correction or retry

### Requirement: Compact persistent options
The form SHALL initially show Tutto il giorno on and A disposizione off. Turning Tutto il giorno off SHALL reveal inline hour buttons; a partial entry SHALL require at least one hour. Active toggles SHALL visibly light up and expose their pressed state. After successful submission, options and chosen partial hours SHALL stay set for the next entry during the mounted page session. The form SHALL NOT expose Più giorni.

#### Scenario: Consecutive partial entries
- **WHEN** a user disables Tutto il giorno, selects hours 2 and 3 and adds a teacher
- **THEN** the next entry retains that mode and those hours

#### Scenario: Full day and availability
- **WHEN** Tutto il giorno is on
- **THEN** manual absences cover all supported periods
- **AND** A disposizione uses the existing default availability hours and reveals its campus choice

### Requirement: Optional manual absence classification
Manual teacher absences SHALL accept Programmata, Last minute or unspecified. The two choice buttons SHALL be mutually exclusive; pressing the active choice SHALL clear it. The choice SHALL persist for subsequent additions and remain editable on saved manual absences. Classification controls SHALL be hidden for availability and absent classes, which SHALL NOT receive this metadata.

#### Scenario: Clear and reuse a choice
- **WHEN** the user selects Programmata and adds a teacher
- **THEN** Programmata remains selected for the next teacher
- **AND** clicking it again returns to unspecified

#### Scenario: Edit a saved absence
- **WHEN** the classification of a saved manual absence is changed or cleared
- **THEN** its sidebar group updates without changing its hours or permit record

### Requirement: Single grouped teacher row
Teacher absences SHALL appear once per date in sidebar groups ordered Assenze programmate, Assenze non classificate, Assenze last minute, before A disposizione. Any Last minute manual absence or permit SHALL place the teacher in Last minute; otherwise any Programmata source SHALL place them in Programmate; otherwise they SHALL be non classificate. Each row SHALL show the union of absent hours, preserving permit locks. No LM/P badges SHALL be used.

#### Scenario: Mixed sources
- **WHEN** a teacher has a programmed permit and a last-minute manual absence that day
- **THEN** they appear once in Assenze last minute with all their absent hours

#### Scenario: Unspecified and programmed sources
- **WHEN** a teacher has an unspecified manual absence and a programmed permit
- **THEN** they appear once in Assenze programmate

#### Scenario: Source removed
- **WHEN** the only last-minute source is removed or reclassified
- **THEN** the teacher is regrouped according to the remaining sources

#### Scenario: Absent classes
- **WHEN** an absent class is added
- **THEN** it remains visible as a class absence outside the classified teacher groups

### Requirement: Classification compatibility
Manual classifications SHALL survive reload, database backup and archive round trips. Missing metadata SHALL mean unspecified without backfilling or date-based inference. Invalid classification values or metadata without a corresponding manual teacher absence SHALL reject API writes or archive import atomically. Hour-only updates SHALL preserve classification; deleting a manual entry SHALL remove its metadata.

#### Scenario: Legacy archive
- **WHEN** an archive without classification metadata is imported
- **THEN** its teacher absences remain valid and unclassified

#### Scenario: Invalid metadata
- **WHEN** an archive contains an unknown classification or an orphan manual classification
- **THEN** import fails without changing saved state

#### Scenario: Hour editing
- **WHEN** the user changes only the hours on a classified manual absence
- **THEN** the classification remains unchanged after reload
