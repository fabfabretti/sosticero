# Design

## Context

See proposal.md for motivation and scope. Store currently keeps JSON documents in SQLite; entry and permit endpoints already transact source changes, and notes demonstrate omitted-versus-null semantics. Permits have stable identities and protected edits. Daily state and Permessi responses are refreshed after edits. Archive schema 2 contains state and statistics; import replaces state atomically. SQLite online backups capture all tables. HourHelp currently accepts plain text and implements a tooltip, not an interactive popover. Backend dependencies contain no image decoder.

## Goals / Non-Goals

**Goals:** Keep binary data out of frequently loaded JSON, preserve source ownership and atomic saves, and reuse the existing deployment and backup model.

**Non-Goals:** External storage, generic document management, image editing, a new UI framework, or changes to scheduling/recovery rules. Scope exclusions are in proposal.md.

## Decisions

### One SQLite blob per stored image

Add an attachments table with opaque ID, validated media type, and binary content. Add source-specific attachment reference maps keyed by teacher/date for absences, dated permits, and manual availability. Ordinary responses contain references only. A same-origin GET endpoint returns the referenced image with its validated content type, inline disposition, nosniff, and private no-store caching; missing or unreferenced IDs return 404. Serve only referenced attachments. No new access model is introduced; images have the same access boundary as existing records.

Keeping bytes in SQLite makes backup and restore consistent automatically. Restore must use SQLite’s online backup API into the destination, rather than copying over a WAL database, and initialize the attachment table after restoring pre-attachment backups. Files beside the database would require coordinated backup/restore and cleanup. Embedding base64 in ordinary state would inflate every refresh.

### Atomic record and image lifecycle

Extend existing entry/permit JSON payloads with an optional attachment field: omitted preserves, null clears, and a media-type/base64 object replaces. This reuses JSON transport without adding multipart infrastructure. Decode and validate before mutation; insert the blob, update the record references and remove unreferenced blobs within the existing transaction. Never persist an upload merely for a draft preview. Failed saves retain both saved data and the client draft.

Date ranges share a single new blob; clearing one day's reference leaves other dates intact. Attachment edits in saved daily rows target that day only. Hour/site/classification edits preserve omitted attachments. A valid permit move carries the original reference; recovery-protected rejection rolls everything back. Delete only unreferenced blobs after source cleanup. Manual and permit attachments remain separate even for overlapping hours. Reject attachment input on unsupported sources. Timetable changes retain historical attachments as they retain their records.

### Validate raster images at the boundary

Support PNG and JPEG, at most 5 MiB (5,242,880 decoded bytes), with a 25-megapixel decoded dimension limit. Bound encoded input length before base64 decoding and enforce strict decoding. Use Pillow as a justified decoder dependency for verifying image structure and dimensions, reject animated images, malformed content and media-type mismatches, and never accept SVG/HTML. Preserve validated original bytes to avoid degrading screenshot text. Apply identical validation on archive import. Client checks improve feedback but do not replace server validation.

### Local paste drafts and accessible viewing

Use a small shared attachment field in creation and edit flows. A focusable labelled paste area handles user-initiated paste events, accepts an image clipboard item, previews it locally, and offers remove/replace. Text paste into existing text fields continues normally. Unsupported clipboard content produces a clear message; pasted web URLs are not downloaded. Revoke preview object URLs when replaced/unmounted. Reset drafts on success, cancel and source/date/teacher switches; retain drafts on failed saves. Disposizioni gains a day-specific attachment edit action.

Use one shared click-to-toggle information popover for all (i) icons, including automatic availability and undated balance notes; preserve plain HourHelp tooltips for period warnings. Use the native popoverTarget relationship so re-clicking an invoker closes its popup instead of reopening after browser light dismissal. Explicitly reset popover insets and position immediately above or below the icon, matching the existing tooltip geometry. Do not open information popovers on hover or focus. Use an accessible button, click/keyboard activation, focusable contents, Escape dismissal and outside-click dismissal. Keep current notes and permit information. Render one indicator per row when information exists, label simultaneous source links, and use a normal same-origin target=_blank link with rel=noopener. Include dated Permessi register and manual daily disposizione rows; keep automatic availability information unchanged.

### Portable archives

Export schema 3 with reference maps and a top-level image collection containing base64 bytes and validated media types. Export state and images from one read transaction for a coherent snapshot. Import schemas 1/2 as having no attachments; reject attachment-bearing old-schema payloads rather than silently discarding them. Validate all schema-3 source references, IDs, image bytes, missing and unreferenced blobs before replacing state and image rows in one transaction. Keep existing dataset, statistics and recovery validation. Older application versions reject schema 3 explicitly instead of silently dropping its images.

## Risks / Trade-offs

- Image accumulation enlarges the database, archives and retained backups → bound individual images, avoid duplicate range storage, fetch only on demand, and document that backups retain historical images until pruned.
- Forged images or decompression bombs → validate using a decoder, enforce byte/dimension limits, and set safe serving headers.
- Clipboard formats vary by browser and screenshot source → verify a real screenshot paste on the user's desktop browser, alongside deterministic API tests.
- Rollback to older code may discard references through edits → keep a pre-upgrade backup and avoid editing attachment-bearing data with older code; a full restore deliberately rolls back later records too.
- Existing note work is complete but unarchived → integrate with current code and preserve its artifacts and unrelated work.

## Migration Plan

1. Add the table and empty maps without rewriting existing operational records. Backend imports remain side-effect free; schema setup occurs only through explicit app initialization.
2. Run focused lifecycle, validation, archive and backup tests against temporary SQLite databases; run frontend checks/build.
3. Use standalone compose.testing.yaml with a unique exported TEST_PROJECT and mktemp-created TEST_DATA_DIR. Start using LOCAL_UID/LOCAL_GID and podman compose -p "$TEST_PROJECT" -f compose.testing.yaml up -d --build --force-recreate. Inspect mount and allocated localhost port, confirm /api/environment testing:true and the red TESTING ribbon before behavioral checks. Never use port 8000.
4. Verify paste, preview, edits, popover keyboard/touch behavior, and new-tab image viewing; stop only this test project afterward.
5. After implementation approval, rebuild/recreate normal service with LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate. Use read-only checks for the project data mount, testing:false and newly served frontend asset hash. Do not copy test data into operational data.
6. Preserve a pre-upgrade backup for rollback. Never remove operational markers or alter environment protections to test.
