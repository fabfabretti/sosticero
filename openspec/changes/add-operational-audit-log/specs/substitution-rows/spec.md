# Substitution Rows Spec Delta

## ADDED Requirements

### Requirement: Confirm explicit assignment removal
The daily-table removal control and assignment-review Rimuovi control SHALL request a brief confirmation identifying the assignment, date, period and class. Cancellation SHALL send no mutation. This confirmation SHALL apply to pointer, touch and keyboard activation and SHALL not add prompts to communication flags or ordinary saves.

#### Scenario: Remove an assigned teacher
- **WHEN** the operator activates removal of Ghellere Laura in 5CE at period 4 on 13 November
- **THEN** the confirmation identifies those details with Annulla and Rimuovi choices
- **AND** the assignment is removed only after acceptance and a successful server response

#### Scenario: Cancel removal
- **WHEN** the operator cancels or dismisses confirmation with Esc
- **THEN** no mutation request is sent and the assignment remains

#### Scenario: Review an orphaned assignment
- **WHEN** the operator selects Rimuovi for an assignment requiring review
- **THEN** the same confirmation applies using preserved context or stable identifiers when labels are unavailable

### Requirement: Discoverable Shift click removal shortcut
Shift+pointer-click on either removal control SHALL bypass only the confirmation. The shortcut SHALL be discoverable through control help text, and removal controls SHALL have descriptive accessible names. Ordinary touch or keyboard activation, including Shift+Enter or Shift+Space, SHALL still require confirmation.

#### Scenario: Shift click deletes directly
- **WHEN** an authorized operator Shift+clicks an enabled removal control
- **THEN** the normal removal request is sent without confirmation
- **AND** the committed deletion receives the same audit evidence as a confirmed deletion

#### Scenario: Keyboard activation is protected
- **WHEN** a removal control is activated from the keyboard with or without Shift
- **THEN** contextual confirmation is required

### Requirement: Confirmation preserves the displayed edit baseline
Confirmed and shortcut removal SHALL retain existing authorization, readiness and busy checks. The request SHALL use the assignment preconditions and global generation captured from the displayed record before confirmation, not a newer refreshed baseline. A conflict SHALL preserve the server's newer assignment and show existing conflict feedback.

#### Scenario: Remote replacement during confirmation
- **WHEN** another account replaces the assignment while a removal confirmation is open
- **THEN** accepting the old confirmation cannot delete the replacement
- **AND** the server rejects the stale request and the interface reports the conflict

#### Scenario: Unauthorized or busy removal
- **WHEN** an operator lacks permission or a save is already in progress
- **THEN** normal activation and Shift+click cannot send another removal mutation

#### Scenario: Restore while confirmation is open
- **WHEN** a coordinated restore invalidates the displayed generation before removal is submitted
- **THEN** confirmed or shortcut removal cannot mutate the restored assignment from that obsolete baseline
