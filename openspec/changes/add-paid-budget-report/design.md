# Design

## Context

`PaidHours` already receives per-site finance totals and all assignment records in the paid-availability response. Its current PDF is a separate jsPDF availability grid. Statistiche uses an HTML preview and browser printing, with a branded header and generation timestamp.

## Goals / Non-Goals

**Goals:** Reuse existing accounting and present a complete, consistently scoped report with a familiar preview and print experience.

**Non-Goals:** Change financial calculations, database records, permissions, reporting periods, or the availability PDF.

## Decisions

- Use an HTML print preview and browser print-to-PDF, following Statistiche; reuse or extract its header and print styling where practical. A second jsPDF generator would make matching the existing preview and header harder.
- Add a dedicated Centrale / Succursale / both selector for this report. Filter records by `paidContext.site` and use the corresponding server-provided finance summaries. For both, retain the existing distinction between configured-budget totals and all-site expenditure. Avoid recomputing financial percentages from filtered records.
- Render a complete teacher-grouped register, with repeated table headings and page breaks suitable for long reports. The availability week remains independent; clearly state the financial scope and generation time. Preview and print share the same content.
- Disable report entry or printing when required data is unavailable or stale under existing readiness rules; preserve the existing PDF action and handle empty records explicitly.

## Risks / Trade-offs

- [Browser pagination varies] → Verify actual print output with long teacher names and a multi-page register; repeat headers and avoid clipping.
- [Combined budget may exclude an unconfigured sede] → Preserve existing explicit qualification and show all-site expenditure separately.
- [Unpriced or future records can be misread] → Show the existing partial-total warnings and scope explanation in the report.

## Migration Plan

No data migration is needed. Verify with an isolated test database and deploy using the normal deployment script, then perform read-only release checks. Roll back to the previous release if required.
