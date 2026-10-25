# Settings styling

Settings uses five independent `SettingsGroup` disclosures. Native `details` keeps workflow components mounted when closed, so draft values, selected files and previews survive. Do not conditionally mount children or key them by status responses. A fresh page visit starts with all groups collapsed.

## Shared styles

`frontend/src/ui.css` owns shared headings, controls, buttons, notices, tables and surfaces for Settings, Orari, Inbox, Permessi and ordinary Supplenze actions. Add `ui-page` to each page root. `settings.css`, `orari.css`, `inbox.css` and `permessi.css` contain their specific layouts; the app's color tokens (`--bg`, `--pan`, `--ink`, `--mute`, `--line`, `--acc`, `--on`, `--soft`) supply both themes. Avoid inline styles and new section-specific form or button skins.

| Variable | Controls |
| --- | --- |
| `--ui-gap` | Space between fields, actions and rows |
| `--ui-field-gap` | Space between stacked form fields (12px) |
| `--ui-label-gap` | Space between every ordinary field label and its control, including preview filters (8px) |
| `--ui-padding` | Disclosure bodies, previews and table cells |
| `--ui-control-padding` | Inputs, buttons and notices |
| `--ui-control-height` | Visible desktop control height; touch layouts keep 44px targets |
| `--ui-radius` | Borders on shared surfaces and controls |
| `--ui-form-width` | Maximum width of ordinary fields |
| `--ui-surface`, `--ui-border`, `--ui-danger` | Shared surfaces, dividers and destructive/error emphasis |

## Adding a setting

Place the workflow in the appropriate existing group. Use `settings-subsection` with a meaningful heading, `ui-form` for a field stack, `ui-field` for labelled fields outside a form and `ui-actions` for related buttons. Use `ui-button`, optionally with `ui-button-primary` or `ui-button-danger`. Input/select appearance comes from shared scoped selectors, not per-workflow CSS.

Feedback uses `ui-notice` with `role="status"`; failures add `ui-notice-error` and `role="alert"`. Use `ui-surface settings-preview` for review steps, `settings-table-scroll` around a `ui-table settings-table` for wide data and `settings-list` for compact records. Verbose details use native disclosure elements. Status callbacks update headers without remounting or resetting the workflow.

```tsx
<section className="settings-subsection" aria-label="Example">
  <h2>Example</h2>
  <div className="ui-form">
    <label>Value<input value={value} onChange={event => setValue(event.target.value)} /></label>
    <div className="ui-actions">
      <button className="ui-button ui-button-primary" onClick={save}>Save</button>
    </div>
  </div>
</section>
```

Keep behavior-specific classes only where needed, such as the hour-policy grid. They must use the shared spacing and color variables. Do not reintroduce independent outer cards. Check both themes, narrow widths, keyboard focus and long values after changing shared definitions. Final import/restore confirmations reuse native `window.confirm`, naming the target and explaining replacement.

## Shared UI conventions

Use `ui-button` for ordinary actions, with `ui-button-primary` for the main action or `ui-button-danger` for destructive text. `ui-actions` aligns related actions; `ui-form` stacks fields and `ui-field` groups a separate label and control. Native labelled inputs, selects and textareas inherit shared control styling inside `ui-page`. Use `ui-surface` for bordered panels and `ui-table` for ordinary data tables. Timetable cells and compact planner controls retain their specialized presentation.

Keep page files focused on layout and domain-specific elements. Change recurring presentation in `ui.css`, then check the affected pages in both themes and at narrow widths. Simple styled elements use shared classes; repeated behavior stays in existing React components such as `ClassificationChoices`, `AttachmentField` and `SettingsGroup`.

Permessi uses ordinary teacher text and semibold remaining-hour counts, with an explicit “Scadute” label for expiry. Avoid colored name badges, colored balance fills and row accents.

## Supplenze

`supplenze.css` owns the compact sidebar rows, assignment cells, disposition table, candidate drawer and export layout. Calendar, search suggestions, hour buttons, site filters and palettes remain in `style.css` because other screens use them. Supplenze uses `ui-scope` to inherit shared tokens and explicitly styled `ui-button` / `ui-notice` elements without applying ordinary form and heading sizes to the compact planner. The PDF disclosure uses `ui-page ui-surface` for the standard form controls. Keep the planner’s specialized selectors scoped under `.supplenze`; drawer selectors stay with `.dr` / `.c1` because the drawer mounts beside the planner. Only dynamic positioning belongs in inline styles.
