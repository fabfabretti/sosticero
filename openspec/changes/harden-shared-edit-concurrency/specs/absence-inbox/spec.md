# Spec Delta

## ADDED Requirements

### Requirement: Explicit already-processed outcome
A repeated accept or ignore action SHALL report that the item was already processed and return its saved status without applying the second request's teacher, classification, note or attachment. Competing accept and ignore actions SHALL retain conflict handling. The browser SHALL refresh the item and explain the saved outcome without implying that unused choices were applied.

#### Scenario: Second acceptance has different choices
- **WHEN** two operators accept the same pending submission with different teacher or metadata choices
- **THEN** only the first acceptance changes operational data
- **AND** the second operator is told that the item was already accepted and their choices were not applied

#### Scenario: Competing decisions
- **WHEN** an operator accepts an item another operator has ignored
- **THEN** the server reports a conflict and the browser displays the saved ignored status

#### Scenario: Inbox merges while manual editing is stale
- **WHEN** Inbox acceptance adds hours to an absence while a manual editor still holds its earlier state
- **THEN** acceptance preserves its additive behavior and a later stale manual replacement conflicts
