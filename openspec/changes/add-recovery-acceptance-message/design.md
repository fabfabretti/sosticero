# Design

## Context

See proposal.md for motivation. Assignments already carry optional communicated metadata and permitId; /api/assignments checks row-campus authorization and concurrency before changing them. recovery.ledger resolves each permit identity to a dated permit or manual balance, but records counts rather than individual original-hour allocation. The Supplenze row already has the room, class and substitution period. Its current state type includes dated permits but does not expose enough linked identity metadata to resolve manual versus dated sources reliably in the browser.

The change spans persistence, archive validation, the daily response and frontend controls, warranting this design.

## Goals / Non-Goals

**Goals:** Reuse assignment storage and mutation protections; derive just enough read-only metadata for deterministic clipboard text; keep acceptance independent of recovery accounting.

**Non-Goals:** A new request lifecycle, email integration, original-hour allocation, acceptance timestamps or actors, and PDF/export layout changes.

## Decisions

1. Store optional accepted: boolean on RP assignments. Missing means false, so existing records require no migration. Extend the existing assignment endpoint with a strict optional boolean metadata-only mutation following communicated. Reject combined acceptance/assignment replacement or mixed metadata commands. Keep the same assignment concurrency token and campus checks; do not create a second endpoint or ledger.

2. Preserve accepted when resaving an unchanged RP assignment with the same substitute and permit link. Clear it for replacement/removal. Audit validate_assignment and recovery revalidation paths so ordinary revalidation cannot strip this metadata. Validate archive values and RP-only placement atomically. Backups already preserve state, requiring no new backup format.

3. Extend the daily response with derived RP request details keyed by assignment key: linked permit date and original periods, or explicit manual source. Resolve permitId on the server using the existing permit ledger and permessi data, rather than creating another editable source or sending the whole ledger. Missing metadata on unresolved assignments blocks copying. The displayed row supplies current substitution date, period, class and room.

4. Use a small pure message formatter, tested through the existing frontend node test convention. Keep the exact agreed template in one place, with the variants specified in specs/permessi/spec.md. Use all sorted original periods, not a newly invented recovered-hour mapping. Use the existing Italian date helper where compatible. No dependency is needed.

5. Reuse the Comunicato control styling for Accettata and an inline SVG copy icon. Acceptance uses existing mutation and quiet-refresh flows. Copy is a read-only convenience available to both campuses; call browser clipboard writeText directly from the click action, announcing success only after completion. Report clipboard denial/unavailability with existing feedback patterns. Do not add email sending or a clipboard library.

## Risks / Trade-offs

- Multi-period permits do not identify one original recovered period → List all original periods as agreed, without changing attribution or accounting.
- Clipboard APIs can be unavailable on insecure origins or denied → Provide explicit failure feedback; verify copying on a supported browser origin and exercise the rejected/unavailable path.
- Assignment reconstruction can drop optional metadata → Test acceptance after unchanged saves and revalidation, and clearing after replacement.
- Timetable/permit edits can change message details → Build from the currently refreshed response at copy time and keep existing conflict/issue handling.
- Acceptance is informational; future assignments already reserve hours → Keep accounting unchanged and test totals before/after both toggle directions.

## Migration Plan

No data rewrite or migration: absent accepted metadata means false. Verify unit tests against temporary databases, build the frontend, then check behavior only in an isolated compose.testing.yaml project. Inspect its mount and allocated port, verify /api/environment testing=true and the red TESTING ribbon before mutations. Stop only that test project afterward. Server deployment requires a separate user request and uses scripts/deploy.sh. A code rollback preserves operational recovery records; export archives with new metadata require a compatible release.
