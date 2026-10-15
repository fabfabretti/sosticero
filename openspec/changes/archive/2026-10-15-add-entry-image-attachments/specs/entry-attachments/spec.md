# Spec Delta

## Purpose

Keep optional screenshot evidence attached to teacher absence, dated permit, and manual availability records, with direct viewing and reliable data portability.

## ADDED Requirements

### Requirement: Optional image capture
The system SHALL allow one optional PNG or JPEG image per manual teacher absence/date, dated permit, or manual disposition/date. Creation and editing SHALL support pasting an image, previewing it, replacing it and removing it. Unsupported sources SHALL reject attachment input.

#### Scenario: Create with or without a screenshot
- **WHEN** a user creates any supported record with a pasted screenshot or no image
- **THEN** the record saves with the selected image or without an attachment respectively

#### Scenario: Draft safety
- **WHEN** a save fails
- **THEN** the draft image remains available for retry and existing saved data is unchanged
- **AND** successful save, cancellation or changing the draft's teacher, date or source clears the image draft

#### Scenario: Non-image clipboard content
- **WHEN** the attachment area receives text, a URL, or unsupported clipboard content
- **THEN** it reports that a supported image is required without downloading URLs or changing the saved attachment
- **AND** ordinary text fields retain normal text-paste behavior

### Requirement: Attachment validation
The system SHALL reject malformed, animated or mismatched image content, non-PNG/JPEG formats, images larger than 5,242,880 decoded bytes, and images exceeding 25 megapixels. Validation SHALL apply to saves and imports and SHALL leave saved data unchanged on failure.

#### Scenario: Invalid image
- **WHEN** a request declares PNG but contains HTML, invalid base64, truncated image data, an oversized image or excessive image dimensions
- **THEN** the entire operation fails without changing records or attachments

### Requirement: Source-specific attachment lifecycle
Attachments SHALL belong independently to their source record. Omitted attachment input SHALL preserve the attachment, explicit removal SHALL clear it, and replacement SHALL replace it atomically. Valid permit moves SHALL carry their attachment; source deletion SHALL remove its association. Shared images SHALL remain available while another record references them.

#### Scenario: Overlapping sources
- **WHEN** a teacher has an absence and dated permit with separate attachments on one day and the manual absence is removed
- **THEN** the permit attachment remains accessible and the absence association disappears

#### Scenario: Preserve and protect edits
- **WHEN** hours or site are changed without attachment input
- **THEN** the saved attachment is preserved
- **AND** a rejected recovery-protected permit mutation leaves its attachment unchanged

#### Scenario: Range and move
- **WHEN** an image is attached while creating a multi-day absence or disposition
- **THEN** each created date links to that image and removing one date's attachment preserves the others
- **AND** moving a dated permit successfully carries its attachment to the destination

### Requirement: Accessible attachment viewing
Supported saved rows SHALL expose attachment links in a single information popover beside the teacher name, retaining existing notes and permit information. Links SHALL identify their source and open the image in a new tab. All information (i) icons SHALL share a style and click-to-toggle behavior, without opening on hover. Popovers SHALL appear beside their trigger and support touch, keyboard, focusable links and Escape dismissal.

#### Scenario: Links in both views
- **WHEN** the user opens the information indicator for a daily absence, daily manual disposition or dated Permessi register record with an attachment
- **THEN** a labelled link opens its stored image in a new tab
- **AND** overlapping absence and permit attachments have separately labelled links in the daily row

#### Scenario: Keyboard access
- **WHEN** the user activates the information button using the keyboard
- **THEN** its links can receive focus and be activated, and Escape closes the popover and returns focus to the trigger

### Requirement: Durable and bounded retrieval
Attachments SHALL survive reloads and timetable changes. Ordinary record responses SHALL exclude image bytes. Image retrieval SHALL serve only referenced validated raster content with its correct media type, prevent content sniffing and caching, and return not found for missing or unreferenced images under the application's existing access boundary.

#### Scenario: On-demand retrieval
- **WHEN** a saved record is loaded after restart or timetable replacement
- **THEN** its attachment reference remains present without inline image bytes and its link retrieves the image on demand

#### Scenario: Removed final reference
- **WHEN** the final source association for an image is removed
- **THEN** its old URL returns not found

### Requirement: Attachment portability
Database backups and restores SHALL include attachments consistently with their records. Schema-3 archives SHALL round-trip images and references atomically. Legacy schema-1/2 archives without attachments SHALL remain importable. Invalid image data, unsupported versions or dangling source/image references SHALL reject import without changing existing data.

#### Scenario: Round trip and restore
- **WHEN** attachment-bearing records are exported and imported, or restored from a database backup
- **THEN** the original images and source associations are available together

#### Scenario: Legacy archive
- **WHEN** a valid schema-1/2 archive without attachments is imported
- **THEN** it replaces the current state with no attachments while preserving existing legacy import behavior

#### Scenario: Corrupted or ambiguous archive
- **WHEN** an archive includes a missing image, an unreferenced image, an invalid source reference or attachment content under schema 1/2
- **THEN** import fails atomically and current records and images remain unchanged
