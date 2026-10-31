# Display Publication

## Purpose

Publish an explicit snapshot of today's campus substitution displays to independently hosted static pages for school monitors.

## ADDED Requirements

### Requirement: Today-only publication action
The Supplenze view SHALL show a top-right Pubblica button only for today in Europe/Rome to authenticated users publishing their own account campus. Publication SHALL enforce the same date and authorization on the server, independently of browser visibility. Missing configuration SHALL produce an actionable unavailable state.

#### Scenario: Publish today's view
- **WHEN** an authorized user presses Pubblica on today's view with either campus filter
- **THEN** only the account's campus is captured from saved data, regardless of the table filter

#### Scenario: Invalid publication request
- **WHEN** an anonymous, unauthorized or non-today request attempts publication
- **THEN** it is rejected without uploading or changing the published release

### Requirement: Optional automatic daily publication
Settings SHALL let Centrale store one daily publication time in Europe/Rome. When enabled, the server SHALL publish both campuses in one release once that time has passed and at least one campus has not been published that day at or after the configured time. The check SHALL run in the server process, catch up after a restart, and not duplicate a fresh manual publication. A failed attempt SHALL retry with a cooldown and keep the error visible in the publication control.

#### Scenario: Scheduled time arrives
- **WHEN** the configured time passes and a campus snapshot is older than that time
- **THEN** both campus snapshots are captured and published in one release

#### Scenario: Fresh manual publication
- **WHEN** both campuses were already published manually after the configured time
- **THEN** no automatic publication is started that day

#### Scenario: Server was offline at the configured time
- **WHEN** the server starts after the configured time and the campuses are not fresh
- **THEN** the automatic publication runs without waiting for the next day

### Requirement: Explicit snapshot delivery
Publication SHALL send the standalone display and both campus snapshots directly from atlante to Cloudflare Pages. Subsequent operational edits SHALL remain unpublished until another explicit publication. An empty day SHALL be publishable. Teacher snapshots and credentials SHALL NOT enter GitHub or build inputs, and public artifacts SHALL contain exactly the existing display information.

#### Scenario: Prepare a correction
- **WHEN** a saved assignment changes after a successful publication
- **THEN** monitors retain the published snapshot until another Pubblica operation succeeds

### Requirement: Existing display presentation
Published /display?campus=centrale and /display?campus=succursale SHALL reproduce the existing live display's layout, information, empty states, warnings, entry/exit notes, responsive fitting, rotation and controls. Invalid campus selection SHALL retain existing guidance. The live display SHALL retain its current behavior.

#### Scenario: Compare the two delivery modes
- **WHEN** identical data and viewport settings are supplied to the live and hosted displays
- **THEN** both render the same presentation and pagination

### Requirement: Automatic snapshot refresh
Open public displays SHALL check immediately, every 30 seconds and on visibility return for published updates without reloading the document. Unchanged snapshots SHALL preserve the rotation position and timer; changed snapshots SHALL preserve a valid page index. The displayed update time SHALL identify the captured publication, not the polling time.

#### Scenario: New publication reaches an open monitor
- **WHEN** a new release becomes available while a monitor is rotating pages
- **THEN** its next successful poll updates the table without a document reload
- **AND** unchanged polls do not restart rotation

### Requirement: Date and failure handling
Hosted displays SHALL use Europe/Rome for the school date, clear previous-day data at midnight or waking on a new day, and show unavailable until a current-day snapshot exists. Same-day refresh failure SHALL retain the last good data with the existing stale warning. Polling SHALL not depend on atlante being reachable.

#### Scenario: Midnight without a new publication
- **WHEN** the school date changes and the hosted snapshot is still yesterday's
- **THEN** yesterday's assignments are cleared and are not presented as today's

#### Scenario: Atlante is offline
- **WHEN** atlante is unavailable after a publication
- **THEN** monitors can still load the hosted current-day snapshot

### Requirement: Verified publication state
The operational UI SHALL show progress, sanitized failure details, public links and the account campus’s last verified successful publication time. Success SHALL require the stable public URL to serve the expected release identifier and both expected campus files. Concurrent publications SHALL be serialized or rejected as busy. Failure SHALL not advance the success timestamp or automatically replay an upload.

#### Scenario: Upload accepted but not yet visible
- **WHEN** Cloudflare accepts an upload but the expected public release is not yet verified
- **THEN** the operation remains pending or reports verification uncertainty rather than claiming success

#### Scenario: Competing publications
- **WHEN** another user publishes during an active operation
- **THEN** the second operation cannot overwrite it out of order

### Requirement: Atomic and bounded publication
A publication SHALL activate a complete release rather than exposing partially updated campus files. Failed uploads SHALL leave the previous release usable. Attempts SHALL have bounded upload and verification times, with status surviving application restarts and interrupted operations reported honestly.

#### Scenario: Upload fails
- **WHEN** a transfer fails before activation
- **THEN** monitors continue reading the previous complete release
- **AND** the UI reports failure without replacing last-success metadata

### Requirement: Independent campus publication
Each account SHALL publish only its own campus to the same Cloudflare site. Updating one campus SHALL preserve the other campus's last published content, date, identifier and timestamp exactly, excluding its unpublished edits. A campus never published SHALL display unavailable until explicitly published; a published empty day SHALL display the existing empty state.

#### Scenario: Centrale publishes while Succursale has drafts
- **WHEN** Centrale publishes and Succursale has saved changes since its last publication
- **THEN** Centrale's snapshot updates and Succursale's previously published file remains unchanged

#### Scenario: Succursale publishes independently
- **WHEN** Succursale publishes with Centrale selected in the operational table filter
- **THEN** only Succursale's snapshot updates and Centrale's published file remains unchanged

#### Scenario: First campus publication
- **WHEN** only Centrale has ever published
- **THEN** the Succursale link shows unavailable until a Succursale account publishes

#### Scenario: Cross-campus override
- **WHEN** a user requests publication for a campus different from their account campus
- **THEN** the server rejects the override without uploading

### Requirement: Durable published campus state
The server SHALL retain each campus's committed published snapshot and unresolved candidates outside source/build inputs. A later publication SHALL preserve the other campus from committed published state, including across restarts. Uncertain activation SHALL be reconciled before another upload so no verified campus publication is lost.

#### Scenario: Restart between activation and verification
- **WHEN** the server restarts after Cloudflare may have activated a candidate
- **THEN** it reconciles that release before accepting another publication and preserves the correct other-campus snapshot

### Requirement: Clear monitor rotation and signature reminder
Both display modes SHALL show a prominent bottom-right page count and a 15-second filling ring when multiple pages exist, preserving room for class schedule changes. Rotation and ring SHALL pause and resume together. Page changes SHALL use a brief fade, suppressed for reduced motion. A visible notice below SHALL remind staff to sign performed substitutions on the paper board.

#### Scenario: Multiple pages with schedule changes
- **WHEN** the board has several pages and class entry/exit notes
- **THEN** notes remain visible beside the bottom-right page count and filling ring, with the signature reminder below

#### Scenario: Pause and resume
- **WHEN** rotation pauses with nine seconds remaining and later resumes
- **THEN** both ring and page change resume with nine seconds remaining

### Requirement: Assignment type in each display slot
Each substitution slot SHALL include its saved assignment type, such as C, D, POT or RP, as a compact readable label beside its class. Both display modes SHALL share this rendering. Previously published snapshots without a type SHALL remain renderable until republished.

#### Scenario: Different types for the same teacher
- **WHEN** one teacher has assignments of different types
- **THEN** each cell shows the type of its own assignment

### Requirement: Consistent display grid
Display cells SHALL stack class, assignment type, room and replaced-teacher text consistently. Both visible tables SHALL use a shared measured row height without clipping content. The lower separator SHALL span above both class schedule notes and pagination, with consistent spacing from the counter and ring.

#### Scenario: Mixed text lengths and class codes
- **WHEN** class codes and teacher names have different lengths across the two tables
- **THEN** assignment types remain below their classes and all visible rows have the same height
- **AND** the separator remains above the complete lower band
