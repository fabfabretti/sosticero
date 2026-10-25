# Settings Page

## Purpose

Provide a compact, coherent configuration page whose grouped controls remain accessible and can be restyled consistently as the application evolves.

## ADDED Requirements

### Requirement: Functional settings groups
Settings SHALL organize existing controls into five groups in this order: Orari e ricevimenti, Regole supplenze, Collegamenti, Dati e backup, Aspetto. Timetable and reception imports SHALL remain distinct workflows within their shared group. The existing Settings URL and credits footer SHALL remain unchanged.

#### Scenario: Find each existing function
- **WHEN** the user opens Settings
- **THEN** timetable and reception imports are under Orari e ricevimenti, hour policies under Regole supplenze, Google Forms under Collegamenti, JSON archives and database backups under Dati e backup, and theme controls under Aspetto

### Requirement: Independent accessible accordions
Each group SHALL use the same disclosure pattern with a title, short description, expansion indicator and useful status summary. Groups SHALL start collapsed on a fresh page visit and allow multiple groups open independently. Headers SHALL be keyboard operable, expose expanded state and retain visible focus. Status loading failures SHALL NOT prevent opening a group.

#### Scenario: Compare groups
- **WHEN** the user opens Orari e ricevimenti and then Regole supplenze
- **THEN** both remain open and each can be closed independently

#### Scenario: Keyboard use
- **WHEN** a focused group header is activated with the keyboard
- **THEN** its content visibility and accessible expanded state change together
- **AND** collapsed controls are excluded from keyboard navigation

### Requirement: Preserve in-progress work on collapse
Closing and reopening a group SHALL preserve its unsaved field values, selected files, teacher matches, preview results and feedback for the current page visit. Background status refreshes SHALL NOT reset these values, close groups or move focus. Collapsing a group SHALL NOT save or apply its settings.

#### Scenario: Return to a reception preview
- **WHEN** the user selects a reception file, reviews matches, closes the group and opens it again
- **THEN** the file, choices and preview remain intact and no import has occurred

### Requirement: Shared compact presentation
All Settings group headers and contents SHALL share the app's typography, theme colors, compact spacing, field sizing, action hierarchy and feedback treatments. Import forms, hour-type rules, integration settings, archive actions and backup lists SHALL use the same visual conventions. Groups SHALL NOT retain independent outer card styles or duplicate wrapper headings.

#### Scenario: Compare open settings groups
- **WHEN** the user opens all five groups in either theme
- **THEN** equivalent fields, buttons, notices, headings and list rows have consistent styling and spacing
- **AND** the page remains visually coherent with the surrounding application

### Requirement: Centralized restyling contract
Settings presentation SHALL use reusable CSS classes and a centralized set of variables derived from app tokens. Settings controls SHALL NOT use inline presentation CSS or duplicated per-section definitions for shared patterns. Styling documentation SHALL identify the shared variables, classes and extension convention for future groups.

#### Scenario: Restyle shared controls
- **WHEN** a maintainer changes a shared Settings spacing or field-style definition
- **THEN** every corresponding Settings control updates without editing individual workflow components

### Requirement: Consistent feedback and confirmations
Settings SHALL show loading, validation, success and failure feedback next to the relevant workflow using shared treatments and accessible announcements. Timetable and reception imports SHALL retain select, preview and confirm stages. JSON and database restores SHALL require explicit confirmation naming the target and explaining replacement. Cancel SHALL leave stored data unchanged.

#### Scenario: Failed import and cancelled restore
- **WHEN** an import fails or a user cancels a restore confirmation
- **THEN** the workflow shows its local result, preserves applicable draft values and makes no unconfirmed data changes

### Requirement: Responsive compact controls
Settings SHALL remain readable and operable on narrow screens without page-wide horizontal scrolling. Field labels and values SHALL wrap appropriately; wide preview and policy tables SHALL retain all meaningful columns through contained scrolling or responsive layouts. Compact presentation SHALL preserve usable pointer targets and keyboard focus in both themes.

#### Scenario: Review on a narrow screen
- **WHEN** the user reviews reception matches, hour policies or backups on a phone-sized viewport
- **THEN** actions and their labels remain available, long names do not overflow the page and no meaningful column disappears because of unrelated table styles
