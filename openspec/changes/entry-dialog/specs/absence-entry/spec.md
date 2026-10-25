# Spec Delta

## MODIFIED Requirements

### Requirement: Explicit compact entry
The daily sidebar SHALL offer one Aggiungi control that opens the entry dialog for the selected date. The dialog SHALL combine teacher/class search, suggestions and a single submit action. Clicking a suggestion SHALL select it without saving. Enter SHALL submit the selected teacher/class or the highlighted suggestion. Invalid or missing selections SHALL NOT save. A successful save SHALL clear the person search and keep the dialog open. A failed save SHALL retain the draft and show the error inside the dialog.

#### Scenario: Review before adding
- **WHEN** the user clicks a teacher suggestion
- **THEN** the teacher is selected without creating an entry
- **AND** clicking Aggiungi saves with the current options

#### Scenario: Keyboard shortcut
- **WHEN** a valid suggestion is highlighted and the user presses Enter
- **THEN** that teacher or class is added with the current options

#### Scenario: Failed save
- **WHEN** saving an entry fails
- **THEN** the error appears inside the dialog
- **AND** the selected person and options remain available for correction or retry

### Requirement: Compact persistent options
The entry dialog SHALL initially show Tutto il giorno on and A disposizione off. Turning Tutto il giorno off SHALL reveal inline hour buttons; a partial entry SHALL require at least one hour. Active toggles SHALL visibly light up and expose their pressed state. After successful submission, options and chosen partial hours SHALL stay set for the next entry during the mounted page session. The dialog SHALL NOT expose Più giorni.

#### Scenario: Consecutive partial entries
- **WHEN** a user disables Tutto il giorno, selects hours 2 and 3 and adds a teacher
- **THEN** the next entry retains that mode and those hours

#### Scenario: Full day and availability
- **WHEN** Tutto il giorno is on
- **THEN** manual absences cover all supported periods
- **AND** A disposizione uses the existing default availability hours and reveals its campus choice

## ADDED Requirements

### Requirement: Dialog shows the entry date
The dialog SHALL name the date selected in the sidebar calendar, and every entry it saves SHALL apply to that date. The dialog SHALL NOT change its own date.

#### Scenario: Date is visible before saving
- **WHEN** the user opens the dialog for a date selected in the calendar
- **THEN** the dialog shows that date
- **AND** the saved entry belongs to that date

### Requirement: Dialog dismissal discards the draft
The close control, Escape and a backdrop click SHALL close the dialog. Closing SHALL discard an unsaved draft, leave saved entries unchanged, and return focus to the Aggiungi control. While the dialog is open the rest of the screen SHALL NOT be interactive.

#### Scenario: Escape discards a draft
- **WHEN** the user has selected a teacher and typed a note, then presses Escape
- **THEN** the dialog closes without saving
- **AND** reopening shows an empty search and note

#### Scenario: Backdrop click discards a draft
- **WHEN** the user clicks the backdrop with a draft open
- **THEN** the dialog closes without saving

#### Scenario: Focus returns
- **WHEN** the dialog closes by any path
- **THEN** focus returns to the sidebar Aggiungi control
- **AND** the calendar and lists are interactive again

### Requirement: Success feedback inside the dialog
A successful save SHALL show an inline confirmation inside the dialog naming the added teacher or class, announced as a status message, and the dialog SHALL stay open.

#### Scenario: Confirmation after adding
- **WHEN** an entry saves
- **THEN** the dialog names the added teacher or class as a status message
- **AND** the dialog stays open for the next entry

### Requirement: Conflict recovery inside the dialog
A save conflict SHALL present the currently saved values and a reload action inside the dialog. Reloading SHALL clear the draft and keep the dialog open.

#### Scenario: Concurrent change
- **WHEN** the entry is rejected because the day changed elsewhere
- **THEN** the dialog presents the saved hours, note and campus
- **AND** offers a reload action that keeps the dialog open

### Requirement: Availability campus defaults to the account campus
New availability entries SHALL preselect the signed-in account's campus. The user SHALL be able to choose either campus, and that choice SHALL persist for subsequent entries in the page session.

#### Scenario: Succursale account
- **WHEN** a user assigned to Succursale opens the dialog with A disposizione on
- **THEN** Succursale is preselected

#### Scenario: Explicit change
- **WHEN** the user selects Centrale and adds an entry
- **THEN** the next entry keeps Centrale preselected

### Requirement: Duplicate entry prevention
The dialog SHALL refuse to add a teacher or class that already has an entry for the selected date, SHALL disable submission, and SHALL state that the teacher or class is already recorded.

#### Scenario: Already recorded
- **WHEN** the user selects a teacher already present for that date
- **THEN** submission is unavailable
- **AND** the dialog explains that the teacher is already recorded
