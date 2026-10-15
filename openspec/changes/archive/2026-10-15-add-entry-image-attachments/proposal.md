# Proposal

## Why

Office staff need to keep a screenshot supporting an absence, dated permit, or manual availability entry alongside that record. Pasting an optional image during entry and opening it from the familiar information indicator avoids managing separate files and searching for context later.

## What Changes

- Support one optional pasted image per teacher/date/source record for manual assenze, dated permessi, and manual disposizioni.
- Show a draft preview and allow removal, replacement, and later editing; save the image together with the record.
- Expose labelled attachment links in an accessible information popover beside the teacher name, opening the image in a new tab.
- Preserve independent absence and permit attachments when their hours overlap, and share image bytes across dates created in one range operation.
- Store validated PNG/JPEG images of up to 5 MiB in SQLite, outside ordinary state responses, with complete database backup and archive export/import support.
- Exclude PDFs, multiple images per record, undated manual permit balances, automatic availability, and class-out entries from this version.

## Capabilities

### New Capabilities

- `entry-attachments`: Optional image capture, validation, record ownership, accessible viewing, and attachment portability for teacher entries.

### Modified Capabilities

None. Existing permit and backup requirements continue to apply; the new capability explicitly extends their coverage to attachments.

## Impact

Backend storage and entry/permit transactions, an image-serving endpoint, state normalization and archive validation/export/import; frontend creation/edit forms, response types, information popovers and styles; focused backend tests and isolated container/browser verification. Existing SQLite backups include the new image table without a separate file store. Database and archive sizes increase. Existing records remain valid without attachments; older app versions are not guaranteed to preserve attachment-bearing archives. No production data edits are needed.
