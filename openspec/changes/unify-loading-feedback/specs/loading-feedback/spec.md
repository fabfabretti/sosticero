# Spec Delta

## Purpose

Provide consistent feedback and safe interactions while application data loads or user-requested operations complete, preventing actions against outdated or incomplete results.

## ADDED Requirements

### Requirement: Consistent foreground feedback
Foreground asynchronous work SHALL display a shared spinner-and-short-label style in the affected region or initiating control. Initial loads SHALL show loading rather than an empty-result message. The style SHALL cover all application screens, authentication, settings sections, dialogs, file preparation, attachments and exports.

#### Scenario: Open a screen without data
- **WHEN** a screen or settings section is waiting for its first response
- **THEN** its content region shows the loading indicator until success or failure
- **AND** it does not report that there are no records before loading succeeds

#### Scenario: Start a foreground operation
- **WHEN** the user starts saving, importing, restoring, generating an export, logging in or logging out
- **THEN** an indicator identifies the pending operation in the initiating control or affected region
- **AND** conflicting and duplicate actions remain unavailable until that operation settles

### Requirement: Dim and protect previous content
When a selection requires replacement data, previous content SHALL remain visible but dimmed and unavailable for interaction until matching data succeeds. Safe navigation and selection controls SHALL remain usable. With no previous content, the affected region SHALL show the shared loading indicator.

#### Scenario: Change the Supplenze day
- **WHEN** a user selects another day and its data is pending
- **THEN** previous rows, summaries and entry lists are dimmed and their actions are blocked
- **AND** adding entries and exporting for that day are unavailable
- **AND** the calendar and application navigation remain usable

#### Scenario: Change a reporting selection
- **WHEN** a user changes the Banca ore week, Orari date, Stats period or campus, availability week, or Inbox pending/history selection
- **THEN** any previous results remain dimmed and noninteractive until matching results arrive
- **AND** printing, exporting or editing those previous results is unavailable

### Requirement: Only current results become actionable
A response SHALL unlock or replace content only when it belongs to the current selection and is still authoritative for that operation. Actions SHALL reject stale or unavailable data even if invoked outside normal pointer interaction. Pending protection SHALL begin with the selection change, without a frame of actionable mismatched content.

#### Scenario: Responses arrive out of order
- **WHEN** a user selects day B and then day C while day B is still loading
- **AND** day B completes after day C
- **THEN** only day C can become the visible actionable result
- **AND** completion or failure of day B cannot clear day C's pending state or replace its error

#### Scenario: Invoke an action during a transition
- **WHEN** an action is attempted by keyboard or an existing event handler while its data does not match the selected context
- **THEN** no mutation or stale export is submitted

### Requirement: Pending file preparation is protected
Reading or preparing selected files and pasted images SHALL show the shared pending feedback and prevent dependent submission until preparation succeeds. Superseded or removed files SHALL not become the saved attachment or imported content when their reads finish later.

#### Scenario: Save while a pasted image is being read
- **WHEN** an image read is in progress in an entry, permit or Inbox attachment field
- **THEN** the dependent save or accept action remains unavailable
- **AND** read failure shows an error and permits retry without silently submitting an incomplete attachment

#### Scenario: Replace a file during preparation
- **WHEN** another file supersedes the file being read or the owning form is closed
- **THEN** the old read cannot apply its result to the new selection or another form

### Requirement: Foreground failure preserves safe recovery
Failure SHALL end the pending indicator and show a visible error with a retry path. Previous content for a different selection SHALL remain dimmed and blocked until matching data succeeds. Failed mutations SHALL preserve editable user input where recovery is possible, without claiming success or blindly repeating a potentially completed mutation.

#### Scenario: Selected day fails to load
- **WHEN** the newly selected day's request fails
- **THEN** an error and retry control appear outside the blocked previous content
- **AND** previous rows remain unavailable
- **AND** the user can retry, select another day or navigate away

#### Scenario: Save succeeds but reloading fails
- **WHEN** the server accepts a save but the following refresh fails
- **THEN** the UI explains the refresh failure without inviting an automatic duplicate save
- **AND** recovery reloads the saved state

### Requirement: Quiet background refresh
Periodic refreshes SHALL preserve usable content without foreground spinners, dimming, focus movement or interrupted drafts. Existing protections for active edits, session expiry and public-display freshness SHALL remain effective.

#### Scenario: Poll while editing
- **WHEN** an automatic poll completes while the user edits a form
- **THEN** the loading presentation does not appear and the user's draft, focus and edit baseline remain intact

#### Scenario: Public display refresh
- **WHEN** the public display refreshes usable current-day data
- **THEN** its existing display and failure behavior remain uninterrupted
- **AND** its first load uses the shared loading presentation

### Requirement: Accessible pending feedback
Loading feedback SHALL remain legible in both themes, expose an accessible status and busy state, and respect reduced-motion preferences. Blocked content SHALL be protected from keyboard and pointer activation. Indicators and recovery controls SHALL remain outside inert content, and focus SHALL not be unnecessarily moved or lost.

#### Scenario: Reduced motion and keyboard use
- **WHEN** a keyboard user with reduced motion enabled triggers a load
- **THEN** the pending label remains visible without requiring spinner animation
- **AND** stale actions cannot receive activation while safe navigation and recovery controls remain accessible
