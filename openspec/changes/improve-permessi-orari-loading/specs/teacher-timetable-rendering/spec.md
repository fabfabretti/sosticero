# Spec Delta

## Purpose

Let staff use the Orari teacher timetable list promptly while all matching weekly grids are progressively displayed without pagination.

## ADDED Requirements

### Requirement: Progressive timetable display
Orari SHALL display an initial batch of teacher grids before completing the list, keep interaction responsive between batches, and automatically finish rendering all matching teachers without requiring scrolling. An accessible loading indicator SHALL remain after the rendered grids until completion.

#### Scenario: Large timetable list
- **WHEN** the selected date's data is ready and the list exceeds the initial batch
- **THEN** the first grids become usable while later grids remain pending
- **AND** subsequent batches appear automatically and the end indicator disappears on completion

### Requirement: Complete teacher search
Teacher search SHALL consider the complete selected-date teacher list regardless of rendering progress. Search changes SHALL promptly display matching teachers and clearing the filter SHALL progressively restore the complete list in its normal order.

#### Scenario: Find a pending teacher
- **WHEN** a user searches for a teacher whose grid has not yet appeared
- **THEN** that teacher appears without waiting for preceding unmatched teachers to render

### Requirement: Stable progressive interactions
Appending grids SHALL preserve existing card identity, keyboard focus, scroll position and active edits. Background refresh SHALL NOT restart completed rendering or hide already displayed teachers that remain eligible and match the filter.

#### Scenario: Editing during rendering
- **WHEN** a user edits a displayed teacher while additional grids appear
- **THEN** the draft, focused control and position of the edited card remain intact

#### Scenario: Quiet refresh
- **WHEN** unchanged data is refreshed after several batches are visible
- **THEN** the visible list does not collapse to the first batch

### Requirement: Rendering belongs to the current selection
Pending rendering work SHALL be discarded on date changes, filter changes and navigation away. Grids from superseded work SHALL NOT be appended to the current results. Existing loading protection SHALL prevent actions against a mismatched selected date.

#### Scenario: Rapid date selection
- **WHEN** a user switches dates while grids from the previous date are pending
- **THEN** only grids belonging to the accepted current-date data are appended

### Requirement: Complete export during progressive display
Once the selected date's complete data is ready, PDF export SHALL include all eligible saved teachers regardless of rendering progress or search, subject to the existing restrictions on drafts and loading.

#### Scenario: Export before rendering completes
- **WHEN** the user downloads the PDF while later grids are still pending and no draft is open
- **THEN** the PDF contains the complete eligible saved timetable

### Requirement: Cached operational navigation
Supplenze, Permessi and Orari SHALL reuse endpoint-scoped in-memory snapshots immediately on return, quietly refresh snapshots older than 15 seconds, and retain ongoing refresh without resetting freshness on navigation. Cached content SHALL remain usable during background requests and failures. Active drafts and displayed save baselines SHALL remain protected. Successful writes and authentication/permission/database-generation changes SHALL invalidate all snapshots and prevent obsolete in-flight reads from repopulating them.

#### Scenario: Return to a cached page
- **WHEN** staff return to a previously loaded page or date
- **THEN** its cached content appears without awaiting the network
- **AND** stale data refreshes quietly without blocking interaction

#### Scenario: Save or change account
- **WHEN** a successful mutation or session identity change occurs
- **THEN** subsequent navigation cannot reuse an earlier snapshot
- **AND** previous-account or pre-save pending responses cannot restore it

### Requirement: Cached Banca ore and statistics
Banca ore and both statistics reports SHALL reuse the shared session-memory cache, separate date/filter selections, and quietly refresh valid selections after 15 seconds. Explicit retry and post-save refresh SHALL fetch current data. Existing validation, editing and export readiness protections SHALL remain in force.

#### Scenario: Return to a report filter
- **WHEN** staff return to a previously loaded week, campus or statistics period
- **THEN** the matching cached response appears immediately and stale responses refresh quietly
- **AND** responses belonging to other selections cannot unlock the current report
