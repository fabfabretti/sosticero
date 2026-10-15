# Data Backup Delta

## ADDED Requirements

### Requirement: Recoverable pre-timetable-import snapshot
Before applying a confirmed timetable import, the system SHALL create a consistent, uniquely named backup of the pre-import database, including operational records, statistics and timetable history. Backup failure SHALL prevent application. The import result SHALL identify the backup; preview alone SHALL NOT create one.

#### Scenario: Backup fails
- **WHEN** the pre-import backup cannot be created or verified
- **THEN** the timetable import fails without modifying operational data

#### Scenario: Two imports within one second
- **WHEN** two confirmed timetable imports create backups within the same second
- **THEN** each backup has a distinct filename and neither overwrites an existing backup

### Requirement: Restore complete timetable history
A database backup SHALL include all timetable versions and preserved conflict evidence. Confirmed restore SHALL restore the timeline, operational records and statistics consistently under the existing safe restore rules.

#### Scenario: Restore before an incorrect import
- **WHEN** the user confirms restoration of the pre-import backup
- **THEN** timetable selection, assignments, recovery links and statistics match the pre-import snapshot
