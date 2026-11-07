## MODIFIED Requirements

### Requirement: Persistent application bar
Every screen SHALL render a top bar containing the Sosticero brand with a
glasses icon and the navigation tabs. The bar SHALL stay visible while the
screen's content scrolls.

#### Scenario: Bar present on every screen
- **WHEN** any tab is open
- **THEN** the top bar shows the Sosticero brand, the glasses icon, and all tabs permitted for the account, including Inbox for operational accounts

#### Scenario: Bar stays visible while scrolling
- **WHEN** the open screen's content is scrolled
- **THEN** the top bar remains visible

### Requirement: Tab navigation
For operational accounts the bar SHALL offer tabs — Supplenze, Permessi, Banca ore, Orari, Stats, Inbox and
Settings — and selecting a tab SHALL show that tab's screen and mark it as the
current tab. Administrators SHALL additionally receive Amministrazione. Admin-only accounts SHALL receive Amministrazione and Impostazioni without operational tabs. Exactly one available tab SHALL be current at a time.

#### Scenario: Selecting a tab opens its screen
- **WHEN** the user selects "Banca ore"
- **THEN** the Banca ore screen is shown and its tab is marked current

#### Scenario: Only one tab is current
- **WHEN** any tab is current
- **THEN** no other tab is marked current

#### Scenario: Supplenze is home
- **WHEN** an operational account first opens the app with no tab specified
- **THEN** the Supplenze screen is shown and its tab is marked current

### Requirement: Addressable tabs
Each tab SHALL have a stable URL. Opening that URL directly, or reloading while
it is open, SHALL show the same screen, and browser back and forward SHALL move
between previously visited tabs. A URL that matches no available tab SHALL fall back to the account’s permitted home.

#### Scenario: Reload keeps the screen
- **WHEN** the user reloads the app while the Settings tab is open
- **THEN** the Settings screen is shown again

#### Scenario: Back and forward move between visited tabs
- **WHEN** the user visits Permessi then Settings and presses back
- **THEN** the Permessi screen is shown

#### Scenario: Unknown URL falls back to Supplenze
- **WHEN** the app is opened at a URL that matches no tab
- **THEN** the account’s permitted home is shown

### Requirement: Noninterrupting global Inbox notice
Every operational screen SHALL expose pending Inbox items through a persistent notice linking to Inbox. Background updates SHALL change only Inbox status and count, without navigation, focus movement, form reset or modal interruption. The notice SHALL use accessible status announcements and existing visual tokens in both themes.

#### Scenario: New response during data entry
- **WHEN** unseen responses arrive while the user fills an absence or permit form
- **THEN** the notice and badge update while all entered values, selection and focus remain intact

#### Scenario: Explicit navigation
- **WHEN** the user activates Apri Inbox
- **THEN** the app navigates to Inbox in the current browser tab

### Requirement: New submission chime
The operational shell SHALL play one brief chime when newly discovered submissions increase the total received count. Initial loading, repeated polls and accept/ignore actions alone SHALL stay silent. Sound SHALL require browser audio availability after user interaction, and audio failure SHALL not interrupt visual notifications or form entry.

#### Scenario: New response while another is processed
- **WHEN** the received total increases while the pending count stays unchanged
- **THEN** an audio-enabled shell plays one chime

#### Scenario: Initial load and repeat polling
- **WHEN** the app first loads existing items or polls without new submissions
- **THEN** no chime plays

## ADDED Requirements

### Requirement: Administration navigation
Administrators SHALL have an Amministrazione top-bar tab and a left sidebar initially containing only Amministrazione account. The account subpage SHALL have a stable URL, retain browser history/reload behavior, and use accessible responsive navigation in both themes. Nonadministrators SHALL NOT access this page by direct URL.

#### Scenario: Administrator opens accounts
- **WHEN** an administrator opens or reloads the account administration URL
- **THEN** Amministrazione is current in the top bar and Amministrazione account is current in the left sidebar

### Requirement: Permission-aware shell lifecycle
Admin-only accounts SHALL land on Administration, operational accounts on Supplenze, and accounts with neither permission on a no-access screen with logout. Admin-only and no-access shells SHALL NOT fetch operational data, poll Inbox or play operational notices. Permission loss and account switching SHALL remove inaccessible content and activity.

#### Scenario: Dedicated administrator logs in
- **WHEN** an administrator without campus grants logs in
- **THEN** Administration opens without background operational requests or Inbox notices

#### Scenario: No available role
- **WHEN** an enabled account with no administrator permission and no campus grants logs in
- **THEN** a clear no-access message and logout are shown without operational data requests
