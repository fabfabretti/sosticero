# data-backup Specification

## Purpose
Provide automated, consistent, and restorable snapshots of the application database (dataset + state) so that critical operational data is not lost, with configurable retention and safe restore procedures.

## Requirements

### Requirement: Automated daily backup on startup
The system SHALL automatically create a database backup when the application starts if no backup has been created on the same calendar day. The backup SHALL be a consistent snapshot of the current database (including WAL data as needed) stored in a dedicated backups directory.

#### Scenario: First backup on a day
- **WHEN** the application starts and no backup exists for today's date
- **THEN** the system creates a new timestamped backup file in the backups directory

#### Scenario: Skip if already backed up today
- **WHEN** the application starts and a backup already exists for today's date
- **THEN** the system does not create a new backup

#### Scenario: Backup succeeds even if WAL files exist
- **WHEN** the database has active WAL/SHM files at startup
- **THEN** the system creates a consistent snapshot of the database

### Requirement: Timestamped backup storage
The system SHALL store each backup with a unique timestamp in its filename and maintain them in a dedicated backups directory (default `data/backups/`). Backup filenames SHALL be sortable by creation time.

#### Scenario: Backup filename format
- **WHEN** a backup is created
- **THEN** the filename includes the creation timestamp (e.g., `supplenze-YYYY-MM-DDTHH-MM-SS.sqlite` or ISO8601)

#### Scenario: Backups stored in dedicated directory
- **WHEN** a backup is created
- **THEN** it is written to the backups directory alongside the data directory

### Requirement: Configurable retention policy
The system SHALL automatically remove old backups according to a configurable retention policy (default: keep last 7 days or last 10 backups, whichever is greater). Retention SHALL run after creating a new backup.

#### Scenario: Retain recent backups
- **WHEN** retention runs and there are fewer backups than the retention limit
- **THEN** no backups are deleted

#### Scenario: Delete backups older than retention window
- **WHEN** retention runs and backups exceed the retention limit
- **THEN** the system deletes the oldest backups beyond the limit

### Requirement: Safe restore from backup
The system SHALL provide a mechanism to restore the database from a selected backup. The restore operation SHALL be atomic (either fully succeeds or leaves the database unchanged), SHALL validate the backup integrity before restoring, and SHALL require explicit confirmation before execution (e.g., a confirmation flag in the restore request). The user interface SHALL present a hard confirmation dialog showing which backup will be restored and warning that current data will be overwritten.

#### Scenario: Restore replaces database with backup content
- **WHEN** a valid backup is selected for restore with explicit confirmation
- **THEN** the system replaces the current database with the backup contents

#### Scenario: Restore rejects corrupted backup
- **WHEN** attempting to restore from a corrupted or invalid backup
- **THEN** the system rejects the restore and does not modify the current database

#### Scenario: Restore requires explicit confirmation
- **WHEN** a restore is requested without confirmation
- **THEN** the system rejects the restore and does not modify the current database

### Requirement: Manual backup creation
The system SHALL allow manual creation of a backup via API (for testing and before risky operations). A manually created backup SHALL follow the same naming, storage, and retention rules as automatic backups.

#### Scenario: Manual backup via API
- **WHEN** a manual backup is requested via API
- **THEN** the system creates a new timestamped backup

#### Scenario: Manual backup triggers retention
- **WHEN** a manual backup is created
- **THEN** retention policy is applied

### Requirement: Backup integrity and visibility
The system SHALL log all backup and restore operations (success/failure with timestamps) and SHALL be able to list available backups with their metadata (timestamp, size, path, created_at). The backup process SHALL not interfere with normal application operation. The Settings tab SHALL display available backups in a chronological list (newest first) with their creation timestamp and size, allow creating a manual backup, and allow selecting a backup for restore with a hard confirmation dialog.

#### Scenario: List available backups
- **WHEN** backups are requested
- **THEN** the system returns a list of all available backups with metadata (filename, size, created_at, path)

#### Scenario: Log backup operations
- **WHEN** a backup operation completes (success or failure)
- **THEN** the operation is logged with relevant details

#### Scenario: Non-blocking backup
- **WHEN** a backup is created on startup
- **THEN** it does not block the application from serving requests after initialization (or completes before serving if critical)

#### Scenario: Settings UI shows backup list
- **WHEN** the user opens the Settings tab
- **THEN** the UI fetches and displays available backups with timestamp and size, sorted newest first

#### Scenario: Manual backup from Settings UI
- **WHEN** the user clicks "Crea backup manuale" in Settings
- **THEN** the system creates a new backup and the list refreshes to include it

#### Scenario: Restore with confirmation dialog
- **WHEN** the user selects a backup and confirms restore in the hard confirmation dialog
- **THEN** the system restores from that backup and reports success or failure
