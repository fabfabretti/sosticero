# Design

## Context

The report filters future fact dates before processing the requested range; the calendar independently disables them. Coverage types already count valid covered demand rows, and absence percentages currently use all absent teacher-hours. Print preview renders all tabs and opens disclosures.

## Goals / Non-Goals

**Goals:** Keep the screen, print and CSV consistent about scope while making the report compact and understandable.

**Non-Goals:** Forecasting future absences or changing operational records, the separate availability week, or stored historical facts.

## Decisions

- Filter facts by the requested custom range rather than an unconditional today cutoff; keep preset end dates at today. Reuse recorded facts and existing aggregation rules rather than inventing forecasts. Warn whenever the selected end is future, even if no future facts exist. CSV continues to reflect the selected range and should identify its estimate status.
- Keep absence table percentages over all hours for continuity and CSV compatibility, label this basis, and compute pie shares from classified hours. An all-unclassified scope retains the table and shows an empty chart message. This avoids treating missing classifications as a pie category without concealing them.
- Derive coverage slices from the existing valid type totals; label their denominator and retain text values for accessibility and print. Do not add exceptional counts again or include other outcomes.
- Implement row limits in the shared report table presentation with an explicit screen expansion and print-specific first-10 rendering, preserving original ordering and complete data in CSV. Keep indicators when rows are omitted and avoid truncating small tables or fixed matrices.
- Reduce duplicated explanatory text while preserving contextual help, scope, essential definitions and quality warnings. Adjust print layout and page breaks for legibility, with all sections still present.

## Risks / Trade-offs

- [Future facts are incomplete and subject to change] → Explicit estimate warning, no generated predictions and existing recorded-day denominators.
- [Different absence percentage bases confuse readers] → Label both bases visibly, including print.
- [Print truncation hides records] → Indicate omitted row count and preserve complete CSV.
- [Charts or tables break across pages] → Check an actual print rendering with representative long and empty data.

## Migration Plan

No data migration is required. Deploy using the normal server deployment script after isolated verification; rollback to the previous release if necessary. Verify deployed release using read-only checks.
