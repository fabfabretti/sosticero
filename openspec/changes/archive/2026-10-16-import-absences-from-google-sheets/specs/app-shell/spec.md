# Spec Delta

## MODIFIED Requirements

### Requirement: Persistent application bar
Every screen SHALL render a top bar containing the Sosticero brand with a
glasses icon and the navigation tabs. The bar SHALL stay visible while the
screen's content scrolls.

#### Scenario: Bar present on every screen
- **WHEN** any tab is open
- **THEN** the top bar shows the Sosticero brand, the glasses icon, and all configured tabs, including Inbox

#### Scenario: Bar stays visible while scrolling
- **WHEN** the open screen's content is scrolled
- **THEN** the top bar remains visible

### Requirement: Tab navigation
The bar SHALL offer tabs — Supplenze, Permessi, Banca ore, Orari, Stats, Inbox and
Settings — and selecting a tab SHALL show that tab's screen and mark it as the
current tab. Exactly one tab SHALL be current at a time.

#### Scenario: Selecting a tab opens its screen
- **WHEN** the user selects "Banca ore"
- **THEN** the Banca ore screen is shown and its tab is marked current

#### Scenario: Only one tab is current
- **WHEN** any tab is current
- **THEN** no other tab is marked current

#### Scenario: Supplenze is home
- **WHEN** the app is first opened with no tab specified
- **THEN** the Supplenze screen is shown and its tab is marked current

## ADDED Requirements

### Requirement: Addressable Inbox screen
Inbox SHALL be accessible from the top bar at a stable URL with the existing reload and browser history behavior. Its tab SHALL show the pending item count. Existing navigation destinations SHALL remain available.

#### Scenario: Open Inbox directly
- **WHEN** the user opens or reloads `#/inbox`
- **THEN** Inbox is shown and marked as the current tab

### Requirement: Noninterrupting global Inbox notice
Every screen SHALL expose pending Inbox items through a persistent notice linking to Inbox. Background updates SHALL change only Inbox status and count, without navigation, focus movement, form reset or modal interruption. The notice SHALL use accessible status announcements and existing visual tokens in both themes.

#### Scenario: New response during data entry
- **WHEN** unseen responses arrive while the user fills an absence or permit form
- **THEN** the notice and badge update while all entered values, selection and focus remain intact

#### Scenario: Explicit navigation
- **WHEN** the user activates Apri Inbox
- **THEN** the app navigates to Inbox in the current browser tab


### Requirement: Immediate Inbox count consistency
Completing a pending Inbox refresh SHALL immediately update the global badge to the visible pending count. A stale in-flight summary response SHALL not overwrite that newer count. Accepting or ignoring an item SHALL refresh the count without waiting for another polling interval.

#### Scenario: List refresh beats summary polling
- **WHEN** a new submission appears in the refreshed Inbox while a summary request is in flight
- **THEN** the badge updates immediately and the stale response cannot restore its previous count

### Requirement: New submission chime
The persistent shell SHALL play one brief chime when newly discovered submissions increase the total received count. Initial loading, repeated polls and accept/ignore actions alone SHALL stay silent. Sound SHALL require browser audio availability after user interaction, and audio failure SHALL not interrupt visual notifications or form entry.

#### Scenario: New response while another is processed
- **WHEN** the received total increases while the pending count stays unchanged
- **THEN** an audio-enabled shell plays one chime

#### Scenario: Initial load and repeat polling
- **WHEN** the app first loads existing items or polls without new submissions
- **THEN** no chime plays
