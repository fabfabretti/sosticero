# Spec Delta

## Purpose

Provide a consistent, accessible color system across the application while preserving existing workflows and identifying campuses without color alone.

## ADDED Requirements

### Requirement: Theme resolution
The app SHALL use the supplied dark and light palettes. An explicit Aspetto choice SHALL override system preference through the root data-theme attribute. Without an explicit choice, the app SHALL follow prefers-color-scheme, including changes during the session.

#### Scenario: Automatic theme
- **WHEN** no explicit theme is set and system preference changes
- **THEN** the app renders the matching palette without changing the current screen or entered data

#### Scenario: Explicit override
- **WHEN** the user changes the theme under Impostazioni > Aspetto
- **THEN** the chosen theme applies across the app regardless of system preference

### Requirement: Color roles
The app SHALL reserve accent colors for primary actions, selected states and focus. Links, table names and sort headers SHALL use neutral text colors. Semantic feedback SHALL use warn, danger or info roles. Body text SHALL meet 4.5:1 contrast in both themes, and solid accent controls SHALL use accent foreground text.

#### Scenario: Read body text and actions
- **WHEN** any app screen is shown in either theme
- **THEN** body text meets 4.5:1 contrast against its rendered background and primary controls use the specified accent foreground
- **AND** links, names and sort headers do not inherit accent solely from the former palette

### Requirement: Consistent campus badges
Centrale and Succursale badges SHALL share a subtle treatment and consistent dimensions and padding across screens. Centrale SHALL use jade semantic colors and Succursale amber, with low-opacity fills and restrained borders. Existing labels, accessible names and identifying C/S letters SHALL remain available. Unknown campuses SHALL use neutral colors.

#### Scenario: Compare campus badges
- **WHEN** the user compares badges in Supplenze, Permessi and Banca ore in either theme
- **THEN** equivalent badges have consistent dimensions, padding and semantic colors
- **AND** campus identity is understandable without distinguishing colors

### Requirement: Selection and keyboard focus
Selected hour chips SHALL use accent-subtle fill, accent-border border and text foreground; unselected chips SHALL be transparent with border-strong and text-muted. Active navigation SHALL use text foreground and a 2px accent underline without a filled background. Every interactive element SHALL show a 2px accent ring on keyboard focus.

#### Scenario: Select hours and navigate by keyboard
- **WHEN** the user selects hours, opens a tab and moves keyboard focus through controls
- **THEN** the specified selection, navigation and focus treatments appear without changing interaction behavior

### Requirement: Charts and effects
Charts SHALL use accent for the main series, info for the second and warn for the third, with border-colored grids. Charts SHALL NOT use campus identity colors as series roles. The app SHALL have no hue gradients, glows or colored shadows; overlay shadows SHALL be low-opacity neutral black.

#### Scenario: View statistics in both themes
- **WHEN** the user views charts and opens an overlay in either theme
- **THEN** chart roles and grids follow the palette and overlay shadows remain neutral

### Requirement: Visual scope preservation
The refresh SHALL preserve layout, spacing, sizes, typography, font weights, border radii, copy, icons, component structure and behavior, except campus badge dimensions/padding and the specified underline/focus decoration. Required changes outside these exceptions SHALL be left untouched and reported. Necessary hard-coded colors SHALL be documented; PDF/export palettes SHALL remain unchanged.

#### Scenario: Review all screens
- **WHEN** Supplenze, Permessi, Orari, Banca ore, Statistiche, Inbox and Impostazioni, including dialogs and side panels, are compared before and after
- **THEN** only the authorized visual properties differ
- **AND** any retained hard-coded colors and deferred non-color work are listed
