## Purpose

Provide an unattended, readable daily substitution board for a single campus on a staff-room monitor, without requiring an operational account.

## ADDED Requirements

### Requirement: Campus-specific direct access
The board SHALL open without login at `/display?campus=centrale` and `/display?campus=succursale`. Campus selection SHALL be explicit, independent of stored operational filters. Missing or invalid campus SHALL show the valid links without silently choosing a campus.

#### Scenario: Open and reload
- **WHEN** an anonymous browser opens or reloads either valid link
- **THEN** it shows the selected campus board without login or operational navigation

#### Scenario: Invalid campus
- **WHEN** campus is missing or unsupported
- **THEN** configuration guidance and the two valid links appear without a board data request

### Requirement: Assigned substitutes only
The board SHALL show only real teachers with at least one saved substitution attached to a current row at the selected campus today, using displayed names and alphabetical order. Selection SHALL follow the target row campus, regardless of substitute campus, communication or acceptance status. Special actions and orphan assignments SHALL NOT create teacher rows.

#### Scenario: Mixed campuses and statuses
- **WHEN** a teacher has an uncommunicated assignment at Centrale and another teacher has an assignment only at Succursale
- **THEN** only the first appears on the Centrale board, even if their ordinary timetable is at Succursale

#### Scenario: Non-teacher outcomes
- **WHEN** a day contains only uncovered rows, entry/exit actions or orphan assignments
- **THEN** none creates a substitute teacher row and unresolved saved assignments produce a generic incomplete-data indication

### Requirement: Daily class and room grid
Each teacher row SHALL show hours 1–7, with class, room and displayed names of all teachers being replaced in substitution cells and ordinary lessons blank. Multiple assignments in a slot SHALL remain visible. Missing rooms SHALL show `Aula n.d.`. The board SHALL display campus and date and an explicit empty state when no teachers qualify.

#### Scenario: Several assigned classes
- **WHEN** a teacher covers two classes in one period and another period has no room
- **THEN** both classes remain visible in their slot and the missing room is labelled

#### Scenario: Empty day
- **WHEN** no teachers have qualifying assignments today
- **THEN** the board states that no substitutions are assigned for this campus today

### Requirement: Readable viewport layout
The board SHALL fit a 16:9 viewport without scrolling, using one table where it fits and two side-by-side tables when needed. It SHALL preserve teacher rows, readable text, repeated period headings and complete class/room content across resize and data changes. It SHALL omit teacher-count/refresh-interval text and in-app fullscreen controls. Content that cannot fit even as one row SHALL produce a visible fit warning rather than clipping.

#### Scenario: Increased row count
- **WHEN** a single table exceeds the available height
- **THEN** the board uses two tables before introducing additional pages

#### Scenario: Long content and resize
- **WHEN** long names or multiple classes wrap, or the viewport changes size
- **THEN** layout is recalculated without clipped cells, hidden rows or scrolling

### Requirement: Overflow rotation
Only when two tables cannot fit all teachers, the board SHALL rotate alphabetically ordered pages every 15 seconds with a visible current/total page indicator. Every qualifying teacher SHALL appear once per cycle. Unchanged data refreshes SHALL preserve the current page, and reduced page counts SHALL keep the current index valid.

#### Scenario: Rare overflow
- **WHEN** the board requires three pages
- **THEN** each page is displayed for 15 seconds in a repeating cycle with its page number

#### Scenario: Single-page board
- **WHEN** all teachers fit on one page
- **THEN** the board does not rotate

### Requirement: Automatic updates and school date
The board SHALL fetch immediately and every 30 seconds, refresh on visibility return, and use Europe/Rome for today. It SHALL discard superseded responses. At school midnight or waking on a new school date, it SHALL clear the previous day's board and immediately request the current day.

#### Scenario: Remote edit
- **WHEN** a saved assignment changes while the monitor is active
- **THEN** the next successful 30-second refresh updates the board without user action

#### Scenario: Midnight with different device timezone
- **WHEN** midnight passes in Europe/Rome while the device uses another timezone
- **THEN** yesterday's assignments are cleared and the new day's board is requested

### Requirement: Visible update health
The board SHALL show the last successful snapshot time. A same-day update failure SHALL retain the last good board with a visible stale warning and retry on the next refresh. Initial failure or missing timetable SHALL show unavailable, without misleading empty or current-data claims. A new day SHALL never display yesterday's cached assignments as today's.

#### Scenario: Offline refresh
- **WHEN** a refresh fails after a successful same-day load
- **THEN** the prior snapshot remains visible with its unchanged timestamp and a stale warning

#### Scenario: New day unavailable
- **WHEN** the new day's request fails
- **THEN** unavailable status appears without yesterday's assignments

### Requirement: Minimal public read model
The public display response SHALL include only today's date, campus, snapshot timestamp, displayed substitute and replaced-teacher names, period/class/room values, class schedule changes and a generic incomplete-data indicator. It SHALL exclude full datasets/state, absence reasons, private notes, attachments, recovery details and internal diagnostics. Requests SHALL validate campus and SHALL NOT alter stored operational data or be cached.

#### Scenario: Anonymous response inspection
- **WHEN** an anonymous client reads the display response
- **THEN** only allowlisted display fields are returned and private operational fields are absent

#### Scenario: Invalid campus request
- **WHEN** an API client submits an unsupported campus
- **THEN** the request is rejected without returning school data or modifying records


### Requirement: Class entry and exit summary
The board SHALL show saved late-entry and early-exit class changes for today's selected campus below the grid, even without substitute teachers. It SHALL list each class/action once, using the latest late-entry period or earliest early-exit period and the operational screen's clock labels. Orphan/unknown-campus records SHALL NOT become notes. The section SHALL be absent when no changes exist.

#### Scenario: Consecutive entry and exit periods
- **WHEN** a class has late-entry assignments for periods 1 and 2 and early-exit assignments for periods 5 to 7
- **THEN** one late-entry note uses period 2 and one early-exit note uses period 5, restricted to the selected campus

#### Scenario: Only schedule changes
- **WHEN** no substitute teachers are assigned but class entry/exit changes exist
- **THEN** the empty grid state and the class schedule summary remain visible together

#### Scenario: Teacher identity in a shared substitution
- **WHEN** one substitute covers a row with multiple teachers being replaced
- **THEN** the cell shows all their displayed names without disclosing reasons or private notes
