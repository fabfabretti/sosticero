# Proposal

## Why

Statistiche and especially its printed report contain long explanations and tables that make the important figures harder to scan. Users also need to inspect already-recorded future absences without mistaking them for settled results.

## What Changes

- Simplify Italian copy and print layout while retaining essential counting rules and data-quality warnings.
- Limit long tables to 10 rows by default, allow expansion on screen, and always print the first 10 with an indication of omitted rows; retain complete CSV data.
- Exclude Non classificata from the absence pie while retaining it in the table; add a pie for valid coverage methods.
- Allow custom calendar ranges to include future dates and use recorded data, with a visible estimate warning on screen and in print. Presets remain limited to today.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `absence-statistics`: Change absence composition and its percentage basis.
- `statistics-navigation`: Refine report presentation, table limits, coverage composition and future-date selection.

## Impact

Statistics reporting backend and API filtering, React statistics/calendar and print styles, CSV scope and relevant tests. No changes to operational records or availability-week selection.
