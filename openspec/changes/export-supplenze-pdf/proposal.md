# Proposal

## Why

The daily substitution screen is not a printable office sheet. Staff need an A3 document matching their paper workflow, including space for handwritten changes and the accompanying-teacher and availability sections.

## What Changes

- Add a separate daily print/PDF export action with a pre-export choice of Centrale, Separata, or both; both produces one PDF with separate campus sheets.
- Reproduce the supplied whole-sheet layout in A3 portrait, adding Aula / sede after Classe and preserving a signature area.
- Include periods 1–7 with at least two blank writing rows per period in addition to populated rows; expand busy periods and continue onto further pages without shrinking writing space.
- Include independent lists of recorded absent classes and teachers tagged In gita, plus A disposizione grouped by period with assigned teachers crossed out.
- Print existing assignment type codes and large PAGE X/N indicators at the top and bottom of every page of a multipage document.

## Capabilities

### New Capabilities

- `substitution-printing`: Campus-selectable daily A3 substitution PDFs and printable paper sheets with supplementary lists and explicit pagination.

### Modified Capabilities

None. Existing daily row grouping, availability, assignments and JSON backup behavior remain the source of truth.

## Impact

Frontend daily controls, a read-only export projection and a PDF layout/generation module; likely one browser-compatible PDF dependency. Existing day data supplies the content. No operational database migration or changes to assignments are required. Verification uses isolated data and rendered PDF inspection.
