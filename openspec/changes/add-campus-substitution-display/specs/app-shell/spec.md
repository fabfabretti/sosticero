## MODIFIED Requirements

### Requirement: Persistent application bar
Every operational screen SHALL render a top bar containing the Sosticero brand with a
glasses icon and the navigation tabs. The bar SHALL stay visible while the
screen's content scrolls.

#### Scenario: Bar present on every screen
- **WHEN** any tab is open
- **THEN** the top bar shows the Sosticero brand, the glasses icon, and all configured tabs, including Inbox

#### Scenario: Bar stays visible while scrolling
- **WHEN** the open screen's content is scrolled
- **THEN** the top bar remains visible

#### Scenario: Standalone public display
- **WHEN** the public `/display` page is opened
- **THEN** it omits the top bar and editing controls, and no display button is added to operational navigation

### Requirement: Noninterrupting global Inbox notice
Every operational screen SHALL expose pending Inbox items through a persistent notice linking to Inbox. Background updates SHALL change only Inbox status and count, without navigation, focus movement, form reset or modal interruption. The notice SHALL use accessible status announcements and existing visual tokens in both themes.

#### Scenario: New response during data entry
- **WHEN** unseen responses arrive while the user fills an absence or permit form
- **THEN** the notice and badge update while all entered values, selection and focus remain intact

#### Scenario: Explicit navigation
- **WHEN** the user activates Apri Inbox
- **THEN** the app navigates to Inbox in the current browser tab

#### Scenario: Public display excludes Inbox
- **WHEN** the standalone public display is open
- **THEN** no Inbox notice, Inbox polling or submission chime is mounted
