# Design

## Context

See proposal.md - Why. The Supplenze screen owns the whole entry surface in `frontend/src/main.tsx`: the form lives inside the sidebar `<aside>` and its draft state (search text, chosen person, kind, whole-day flag, hours, classification, note, attachment, campus) sits in the `Supplenze` component. Suggestions derive from the loaded day payload, so they need no new request. The app already has two overlay precedents: `Auth` renders the only centred dialog (`.auth-backdrop` + `.ui-surface`) and `CandidateDrawer` renders a right sheet with backdrop, Escape, Tab trap and close-button focus. Styling is split between `.ui-scope` (buttons only) and `.ui-page` (stacked labels, inputs, textarea), which matters because the moved form must keep the form look rather than the planner look. `frontend/tests/sidebar.test.cjs` renders `main.tsx` through a hand-built React mock with a stubbed `document` and no DOM refs, and locates the form by `className === 'daily-entry'`.

## Goals / Non-Goals

**Goals:** reuse the existing primitives so the dialog looks native to the app, keep the current batch-entry workflow and keyboard behavior, keep every failure recoverable from where the user is looking, and add no dependency or API surface.

**Non-Goals:** changing the grouped lists, classification rules, candidate sheet or assignment flow; adding date navigation inside the dialog; persisting drafts beyond the page session; replacing the overlay mechanism used by the substitute sheet.

## Decisions

### Centred dialog, not another right sheet

The right sheet is the app's chooser; this is a form with eight controls. At 420px it would reproduce the cramping the change removes, and stacking it over the substitute sheet would make two right-side surfaces indistinguishable. The centred `.ui-surface` dialog follows the login precedent. Alternative rejected: a full page route, which loses the calendar and the day context the user just picked.

### A rendered overlay, not the native `<dialog>` element

The platform element would supply Escape, focus trapping and background inertness for free, but it requires an imperative `showModal()` on a ref. The existing test harness renders the tree with stub refs and a `document` that only exposes `dataset` and `getElementById`, so the dialog would either crash the suite or need guards that defeat the savings. The change therefore reuses the `CandidateDrawer` mechanics: conditional markup, backdrop element, keydown listener for Escape and Tab, focus on open, focus restore on close, and the existing `inert` attribute on `.app`. Alternative rejected: extracting a shared overlay component, which would touch the substitute sheet and the auth screen for no behavioral gain.

### Keep the draft state in `Supplenze`

A dedicated dialog component would need the same state, the same `mutate` and the same `entries()` lookups, so it would either grow a props tunnel or duplicate logic. The tests also drive these handlers through the `main.tsx` tree. One new `entryOpen` flag plus a trigger button moves no state and keeps the existing day-change cleanup working. Alternative rejected: a separate component with its own draft state, which must then be reset from two places.

### One form scope for the dialog

The dialog root carries `ui-page` so labels stack, inputs take the shared control height and textarea styling, and `.ui-form`/`.ui-actions` provide the rhythm. Compact chips keep `.opt`, `.hrs` and `.classification`, which the planner already styles, so the dialog shows the app's small controls rather than generic buttons. Alternative rejected: reusing `ui-scope`, which deliberately does not style form fields.

### Recovery stays visible inside the dialog

`error` and `conflict` already exist as component state, and the conflict path needs an explicit reload action. The dialog renders those same elements above its actions; the main-column notice stays for conflicts raised from the lists. Without this, a 409 sets `conflict`, every later `mutate` returns false, and the reload control sits under the backdrop.

### Dialog awareness in the surrounding conditions

The app container's `inert` gains `entryOpen`, the quiet-refresh pause gains `entryOpen` so the day does not churn unseen, and opening either overlay closes the other so two dialogs cannot coexist. On success `mutate` already refreshes, so a paused poll costs nothing.

### Small defaults inside the dialog

The campus initializes from `account.campus` and then follows the user's explicit choice for the session. Submitting a teacher or class that already has an entry is prevented with a hint, replacing today's silent return. The draft (search, person, note, attachment) resets when the dialog opens and after a successful save, while toggles, hours, classification and campus persist as the existing requirement demands.

## Risks / Trade-offs

- Tests locate the form by `className === 'daily-entry'` → update the lookup and add an open step to the entry scenarios in the same change.
- Two overlays could open at once → opening one closes the other, and both share the day-change cleanup.
- Pausing quiet refresh while the dialog stays open can show a stale day → the existing conflict path and the reload action cover it, and polling resumes on close.
- A long form on a short viewport could overflow → dialog body scrolls, actions stay visible, and the existing coarse-pointer rules keep 44px targets.
- `absence-entry` is still owned by the unarchived `compact-absence-entry` change → fold or archive that change first, otherwise the durable spec keeps describing an inline sidebar form and archive refuses this delta.

## Migration Plan

1. Frontend-only change: update the sidebar test harness expectations, then run the frontend test suite and build.
2. Verify behavior in a container against an isolated database following the project testing rules, including consecutive entries, Escape/backdrop dismissal and a forced conflict.
3. Deploy to atlante with `./scripts/deploy.sh` and verify the served release using read-only checks; no data migration or storage change is involved.
4. Rollback is a code revert; no stored data changes shape, so no database restore is required.
