# Spec Delta

## Purpose

Keep school-wide data visible and shared while enforcing sede-specific assignment actions and Centrale-only shared configuration.

## ADDED Requirements

### Requirement: All-school visibility
Both authenticated accounts SHALL be able to open every existing page and inspect both campuses, all teachers, assignments, candidates, operational attachments and shared configuration status. Permission restrictions SHALL not hide other-campus records or teacher details. Secret credentials SHALL not be disclosed to either account.

#### Scenario: Succursale inspects Centrale
- **WHEN** a Succursale account opens Entrambe, Centrale, Orari or Settings
- **THEN** the corresponding school-wide data remains visible and only unauthorized actions are read-only

### Requirement: Assignment permissions follow the target row
Each account SHALL have exactly one sede. Assignment creation, change, removal and Comunicato SHALL require that sede to match the effective server-derived target campus. Conflict reassignment SHALL check both source and destination. Client filters and submitted campus values SHALL not grant permission. Unknown-campus assignments SHALL remain protected without a privileged web bypass.

#### Scenario: Centrale directly targets Succursale
- **WHEN** a Centrale account submits an assignment, removal or Comunicato request for a Succursale row
- **THEN** the server returns 403 without changing data

#### Scenario: Teacher comes from the other campus
- **WHEN** a Centrale account selects an eligible Succursale teacher for a Centrale row
- **THEN** the action is permitted if current global availability and travel rules allow it

#### Scenario: Cross-campus conflict move
- **WHEN** a single action tries to move an assignment between Centrale and Succursale
- **THEN** it is rejected because no account has permission for both affected rows

#### Scenario: Orphan campus context
- **WHEN** an assignment has lost its current row
- **THEN** its preserved server-side campus determines permission
- **AND** unresolved campus blocks assignment mutation until its timetable/context is resolved

### Requirement: Understandable blocked actions
Other-campus rows and candidate lists SHALL remain inspectable. Unauthorized assignment, removal, conflict-move and Comunicato actions SHALL be visibly read-only, use a prohibited cursor, and provide the reason to keyboard, mouse and touch users. Activating a blocked control SHALL not send a mutation request.

#### Scenario: Inspect another campus's candidates
- **WHEN** a Centrale account opens candidates for a Succursale row
- **THEN** teacher information is visible and save actions explain that assignment is reserved to Succursale

#### Scenario: Keyboard or touch use
- **WHEN** a user encounters a blocked action without hovering
- **THEN** its disabled state and owning sede remain understandable through accessible text

### Requirement: Shared operational editing
Both accounts SHALL add, edit and delete assenze, class-out entries, disponibilità, dated permessi and manual recupero balances, and accept/ignore Inbox items across the school. Existing record preconditions, additive Inbox acceptance and global teacher/recupero constraints SHALL remain enforced.

#### Scenario: Teacher works at both sites
- **WHEN** either account records a whole-day absence
- **THEN** it applies across the teacher's day without per-sede ownership

#### Scenario: Simultaneous shared edits
- **WHEN** both accounts replace one shared record from the same baseline
- **THEN** the later stale replacement conflicts without overwriting the first

#### Scenario: Global teacher booking
- **WHEN** both accounts assign the same teacher in one period at different sites
- **THEN** at most one assignment succeeds

### Requirement: Shared Orari editing
Both accounts SHALL edit teacher display names and manual timetable overrides, including their removal/reset, for either campus. Name preconditions and timetable basis/impact-preview checks SHALL prevent silent overwrites. Conflicts SHALL preserve the current editor for explicit reconciliation. Timetable changes SHALL preserve affected assignments and expose review issues.

#### Scenario: Competing teacher names
- **WHEN** two accounts save different names based on the same previous name
- **THEN** only the first saves and the second receives a conflict without losing its entered name

#### Scenario: Timetable changes during editing
- **WHEN** the shared timetable basis changes while an Orari edit is open
- **THEN** saving requires explicit reconciliation with the current basis and does not silently replace newer changes

#### Scenario: Reviewed impact changes
- **WHEN** an absence or assignment changes the impact between timetable preview and save
- **THEN** the older preview is rejected and a new review is required

#### Scenario: Irrelevant Inbox polling
- **WHEN** only Inbox polling status or received counts change
- **THEN** an otherwise current timetable preview remains valid

### Requirement: Centrale-only shared Settings
Both accounts SHALL see Settings, but only Centrale SHALL change shared hour-type rules, Google connection/credentials, run connection tests, publish timetable/reception imports, import/export Settings archives, or create/restore backups. Succursale SHALL retain read-only configuration and backup-list/status access, plus ordinary exports from Supplenze and Orari.

#### Scenario: Direct Settings mutation from Succursale
- **WHEN** Succursale directly submits a shared rule change, credential upload, import or restore
- **THEN** the server returns 403 and changes nothing

#### Scenario: Shared rules from two Centrale sessions
- **WHEN** two Centrale sessions change the same hour-type record from an older baseline
- **THEN** a stale write conflicts without replacing newer values, while a different type remains independent

#### Scenario: Manual Orari edit versus import
- **WHEN** Succursale saves a permitted manual Orari edit or exports its PDF
- **THEN** it remains allowed despite the restriction on Settings timetable imports

### Requirement: Browser-local preferences
Theme and the Centrale/Succursale/Entrambe view filter SHALL remain browser-local preferences stored in localStorage. Both accounts SHALL be able to change them. Server configuration and refresh SHALL not synchronize or overwrite them, and changing a filter SHALL not change assignment permission.

#### Scenario: Separate browser preferences
- **WHEN** one browser selects dark theme and Centrale view
- **THEN** another browser's theme and filter remain unchanged

#### Scenario: Accounts use the same browser
- **WHEN** a different account logs in using the same browser profile
- **THEN** that browser's stored preferences remain view preferences and the new account's server permissions still apply

### Requirement: Noninterrupting shared-view updates
Orari and shared Settings SHALL quietly discover remote changes and refresh on returning to the tab. Updates SHALL preserve scroll, focus, selected teacher/date, disclosures and entered values; affected snapshots SHALL be deferred while editing or reviewing imports. Existing Supplenze/Permessi and Inbox synchronization SHALL remain available to both accounts.

#### Scenario: Remote change during Orari work
- **WHEN** another account changes a timetable while an editor is active
- **THEN** the open editor and its baseline are preserved until explicit completion or reconciliation

#### Scenario: Succursale views changed Settings
- **WHEN** Centrale changes a shared rule while Succursale has no active interaction
- **THEN** Succursale sees the new rule without scroll/focus reset or a modal interruption

### Requirement: Coordinated global publication
Global timetable/reception/archive publication and restore SHALL exclude conflicting in-flight writes and invalidate prior operational baselines. Requests queued with an older generation SHALL fail without applying changes, even when restored content matches old record tokens. Failure SHALL release coordination and preserve operational data; retries SHALL be explicit.

#### Scenario: Waiting edit crosses a restore
- **WHEN** a shared edit waits while Centrale restores operational data
- **THEN** it cannot commit against its older displayed baseline after restoration

#### Scenario: Ordinary edit does not invalidate every browser
- **WHEN** an ordinary absence, permit, assignment or teacher-name record changes
- **THEN** it does not advance the global publication generation or invalidate unrelated record baselines

#### Scenario: Failed publication
- **WHEN** a global publication fails
- **THEN** operational records remain intact and coordination is released
- **AND** clients are told to reload if their baselines were invalidated during the attempt
