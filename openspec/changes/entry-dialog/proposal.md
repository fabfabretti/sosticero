# Proposal

## Why

The daily entry form fills the top half of the Supplenze sidebar and pushes the day's absence lists into a small scroll area. At the start of the school day the lists are what the planner reads while recording several absences, yet the form is always on screen even when nothing is being added. The form also defaults the availability campus to Centrale regardless of the signed-in account, so succursale users re-pick it on every entry.

## What Changes

- Replace the inline sidebar form with a single quiet **+ Aggiungi** button under the calendar.
- Open a centred modal dialog containing every control the form has today: teacher/class search with suggestions, Tutto il giorno / A disposizione, hour selection, Programmata / Last minute, notes, attachment and availability campus.
- Show the selected date in the dialog header; the calendar stays in the sidebar with the day's grouped lists.
- Keep the dialog open after a successful add, retain the option toggles, hours, classification and campus, and show an inline confirmation of what was added.
- Close explicitly with the close button, Escape or the backdrop; closing discards an unsaved draft.
- Show save failures inside the dialog, including the conflicting saved values and the reload action, so a conflict cannot strand the user behind an inert backdrop.
- Preselect the availability campus from the signed-in account.
- Disable the submit action with a short hint when the chosen teacher or class already has an entry that day.
- Keep everything behind the dialog inert and pause quiet refresh while it is open.
- Use the app's existing dialog, surface, form, action and notice patterns, including full-width presentation on narrow screens.

## Capabilities

### New Capabilities

<!-- None: this change revises an existing entry capability. -->

### Modified Capabilities

- `absence-entry`: the daily entry controls move from an inline sidebar form into a modal dialog opened by a sidebar button; entry, option persistence, classification, failed-save and grouped-list behavior otherwise stay as they are.

## Impact

Frontend only: `frontend/src/main.tsx` (dialog state, trigger, moved form, notice placement, campus default, inert and refresh-pause conditions), `frontend/src/supplenze.css` (dialog container and compact control rules), `frontend/tests/sidebar.test.cjs` (form lookup and entry scenarios). No API, storage or dependency change; the existing entries endpoint already accepts the submitted payload.

The `absence-entry` capability is currently declared only by the unarchived `compact-absence-entry` change, so its delta and this one describe the same screen. `compact-absence-entry` must be folded into or archived before this change so the durable spec does not keep claiming an inline sidebar form.
