## MODIFIED Requirements

### Requirement: Login protects operational data
A valid session SHALL be required for all operational APIs, exports and attachments except the minimal read-only public display projection. Public access SHALL be limited to static assets, the standalone display entry, GET `/api/display`, login/session bootstrap and non-sensitive environment status. Invalid credentials SHALL produce a generic error without revealing account existence. No default or hardcoded credentials SHALL be provided.

#### Scenario: Anonymous direct access
- **WHEN** an unauthenticated client requests day data, Orari, Inbox, Settings data, exports or attachments
- **THEN** the server returns 401 without operational data

#### Scenario: Successful login
- **WHEN** valid enabled-account credentials are submitted
- **THEN** a fresh session is issued and the requested application route becomes available

#### Scenario: Narrow public display exception
- **WHEN** an anonymous client requests GET `/api/display` with a valid campus
- **THEN** only the minimal display projection is returned without a session
- **AND** existing day, Orari, Inbox, export and attachment APIs remain protected

#### Scenario: Public display grants no write permission
- **WHEN** an anonymous client attempts a mutation through the display path or an existing operational endpoint
- **THEN** no operational data is changed and no write authority is granted
