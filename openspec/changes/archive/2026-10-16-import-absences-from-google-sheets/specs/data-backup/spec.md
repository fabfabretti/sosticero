# Spec Delta

## ADDED Requirements

### Requirement: Google credentials remain outside portable data
Service-account secrets SHALL be stored only under `data/keys/` with restricted filesystem permissions and explicit Git exclusion. They SHALL be excluded from database snapshots, JSON exports, downloadable backups and container images. Data restore SHALL preserve installed credentials. A fresh installation SHALL require credential upload before syncing.

#### Scenario: Export and backup
- **WHEN** users export operational data or create and download database backups
- **THEN** those artifacts contain no service-account private key

#### Scenario: Restore operational database
- **WHEN** a database backup is restored on a configured installation
- **THEN** installed key files are unchanged

#### Scenario: Move to a fresh machine
- **WHEN** operational data is restored without an installed key
- **THEN** Settings requests a credential upload and Google polling remains disabled
