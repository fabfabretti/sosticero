# Spec Delta

## ADDED Requirements

### Requirement: Match teacher name overrides
Pending Inbox submissions SHALL match imported names, explicit current names, original-professor names and effective display labels using trimmed whitespace and case-insensitive comparison. Matches SHALL be deduplicated by teacher ID. Exactly one matching ID permits automatic resolution; zero or multiple IDs require manual selection. Existing date/activity validation SHALL still apply.

#### Scenario: Match either explicit name
- **WHEN** a pending submission names Spillari Davide or Savelli and either alias uniquely identifies d134
- **THEN** preview selects d134 without creating a different teacher or recoverable permit

#### Scenario: Ambiguous aliases
- **WHEN** a name matches aliases belonging to two different IDs
- **THEN** Inbox requires manual teacher selection even if one match is an imported name

#### Scenario: Accepted records retain identity
- **WHEN** an override changes or is removed after a submission was accepted
- **THEN** its saved teacher ID, accepted status and recorded absence remain unchanged
