# Spec Delta

## Purpose

Provide reviewed installation and repeatable releases of Sosticero on a shared server while preserving live data and the availability of unrelated services.

## ADDED Requirements

### Requirement: Reviewed remote execution
First installation SHALL be performed by the operator using documented commands. Subsequent remote deployment SHALL require an explicitly approved command scope and a user-requested release. Possession of an SSH address or credentials SHALL NOT authorize general remote administration.

#### Scenario: Initial installation
- **WHEN** first-install instructions are prepared
- **THEN** the operator can review and execute the exact commands without granting the assistant an unrestricted remote shell

#### Scenario: Requested update
- **WHEN** the user requests an update under an approved deployment scope
- **THEN** the pipeline runs only the approved deployment operations and stops before any operation outside that scope

### Requirement: Scoped service deployment
Deployment SHALL target only Sosticero and SHALL NOT restart, remove, prune, or reconfigure unrelated containers, networks, the container daemon, or proxy service. The running application SHALL have explicit CPU and memory limits. A single local deployment command SHALL transfer source and build the application image on the server for both first installation and later updates.

#### Scenario: Updating a shared server
- **WHEN** Sosticero is updated
- **THEN** only its application container is recreated and its configured resource limits remain applied

### Requirement: HTTPS proxy routing
The server deployment SHALL serve the configured HTTPS origin through the existing proxy without publishing an application host port. Network access restrictions SHALL remain installation-specific and outside the application deployment requirements.

#### Scenario: Proxy access
- **WHEN** a client permitted by the installation’s access policy opens the configured origin
- **THEN** the proxy routes to Sosticero and authentication uses secure cookies with the configured origin

#### Scenario: Installation-specific access restrictions
- **WHEN** an operator applies a network access policy
- **THEN** deployment preserves that policy and does not modify shared network configuration

### Requirement: Persistent operational data
Releases SHALL preserve the server data directory and SHALL NOT upload local development data. Initial migration SHALL transfer a consistent complete installation into an empty destination while source writes are stopped. Test data SHALL never replace operational data.

#### Scenario: Initial migration
- **WHEN** the operator migrates an existing installation
- **THEN** databases, accounts, installed integration credentials, and required metadata are preserved with restricted permissions and an existing destination is not overwritten

#### Scenario: Routine update
- **WHEN** a new application image is installed
- **THEN** the existing server data directory remains authoritative and no local data directory is synchronized to it

### Requirement: Identifiable serialized releases
The pipeline SHALL identify the reviewed source revision and image, verify the transferred artifact, serialize releases, and stop on build, validation, transfer, or preflight failure before replacing the running service. An explicitly reviewed uncommitted snapshot SHALL be supported and SHALL NOT be represented as a committed revision.

#### Scenario: Failed preparation
- **WHEN** the image build or artifact verification fails
- **THEN** the running service is left untouched and failure is reported

#### Scenario: Concurrent release
- **WHEN** another deployment holds the installation's deployment lock
- **THEN** a second deployment does not modify that installation

### Requirement: Recovery and release verification
Before replacing an existing release, deployment SHALL retain the previous image and configuration and create a protected consistent recovery snapshot covering databases, credentials, and metadata. It SHALL verify the served release and environment using read-only checks. Failure SHALL report actual service state without silently restoring data or claiming success.

#### Scenario: Snapshot failure
- **WHEN** a required recovery snapshot cannot be completed or verified
- **THEN** the new release is not started and the previous release is resumed if it was stopped for the snapshot

#### Scenario: Failed release check
- **WHEN** the new release fails readiness or origin checks
- **THEN** deployment reports failure, retains recovery artifacts, and provides reviewed recovery commands without automatically overwriting data

#### Scenario: Schema-sensitive recovery
- **WHEN** rollback could require replacing data or discard writes
- **THEN** recovery requires explicit operator approval and preserves a copy of the current data first

### Requirement: Isolated verification and private backups
Behavioral verification SHALL use isolated testing data and leave normal service untouched. The operator runbook SHALL describe protected off-server recovery copies separately from downloadable application backups; secrets SHALL NOT enter images, release bundles, logs, or public backup endpoints.

#### Scenario: Deployment rehearsal
- **WHEN** the deployment workflow is tested
- **THEN** unique test resources and disposable data are used and only those test resources are cleaned up

#### Scenario: Installation recovery copy
- **WHEN** a full recovery snapshot is copied off-server
- **THEN** account and integration secrets remain access restricted and excluded from ordinary application exports
