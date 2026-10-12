# App Shell Specification

## Purpose

The persistent application chrome: the branded top bar, the tab navigation
between screens, the placeholder screens it exposes, and the credits footer.
It is the frame every current and future screen renders inside.

## Requirements

### Requirement: Persistent application bar
Every screen SHALL render a top bar containing the Sosticero brand with a
glasses icon and the navigation tabs. The bar SHALL stay visible while the
screen's content scrolls.

#### Scenario: Bar present on every screen
- **WHEN** any tab is open
- **THEN** the top bar shows the Sosticero brand, the glasses icon, and all five tabs

#### Scenario: Bar stays visible while scrolling
- **WHEN** the open screen's content is scrolled
- **THEN** the top bar remains visible

### Requirement: Tab navigation
The bar SHALL offer five tabs — Supplenze, Permessi, Banca ore, Stats and
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

### Requirement: Addressable tabs
Each tab SHALL have a stable URL. Opening that URL directly, or reloading while
it is open, SHALL show the same screen, and browser back and forward SHALL move
between previously visited tabs. A URL that matches no tab SHALL fall back to
Supplenze.

#### Scenario: Reload keeps the screen
- **WHEN** the user reloads the app while the Settings tab is open
- **THEN** the Settings screen is shown again

#### Scenario: Back and forward move between visited tabs
- **WHEN** the user visits Permessi then Settings and presses back
- **THEN** the Permessi screen is shown

#### Scenario: Unknown URL falls back to Supplenze
- **WHEN** the app is opened at a URL that matches no tab
- **THEN** the Supplenze screen is shown

### Requirement: Placeholder screens for future features
Banca ore, Stats and Settings SHALL each render a placeholder screen that identifies itself. Permessi SHALL render the permit register. This change SHALL NOT implement Banca ore, Stats or Settings features.

#### Scenario: Each future tab shows a placeholder
- **WHEN** the user opens Banca ore, Stats or Settings
- **THEN** a placeholder screen for that tab is shown

#### Scenario: Supplenze is not a placeholder
- **WHEN** the user opens Supplenze
- **THEN** the substitution screen is shown, including permit-derived absences

#### Scenario: Permessi is functional
- **WHEN** the user opens Permessi directly or through navigation
- **THEN** the permit register is shown instead of the placeholder

### Requirement: Credits footer on Settings
The Settings screen SHALL show a footer with the credits "by Fabs 🤝🏻 Big
Pickle, 2026", positioned at the bottom of the screen. No other screen SHALL
show this footer.

#### Scenario: Credits at the bottom of Settings
- **WHEN** the user opens Settings
- **THEN** the credits footer is shown at the bottom of the screen

#### Scenario: No footer elsewhere
- **WHEN** the user opens any screen other than Settings
- **THEN** the credits footer is not shown

### Requirement: App identity icon
The app SHALL use a glasses icon as its brand mark in the top bar and as the
browser favicon.

#### Scenario: Icon appears in the bar
- **WHEN** any screen is open
- **THEN** the bar's brand shows the glasses icon

#### Scenario: Icon is used as the favicon
- **WHEN** the app is loaded in a browser
- **THEN** the browser tab shows the glasses icon