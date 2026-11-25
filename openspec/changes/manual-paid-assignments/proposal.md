# Proposal

## Why

The manual assignment action is difficult to recognize, and manual assignments cannot currently be recorded as paid work. Staff need to account for paid substitutions even when a teacher has not declared that period in advance.

## What Changes

- Make the manual assignment action visibly identifiable as a button.
- Let staff choose gratuita or a pagamento in the manual assignment dialog, preserving the existing teacher warnings and optional note.
- Count manually assigned paid hours in Banca ore and the existing paid budget, including the usual paid assignment actions and lifecycle.
- Permit manual paid assignments without a recurring paid availability declaration; preserve the manual path's existing warnings and active-teacher restriction.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `candidate-selection`: Manual assignment entry and choice of paid or free accounting.

## Impact

Candidate drawer and dialog, assignment API and validation, paid accounting and presentation, persisted assignments and archive validation, tests and user documentation. Existing saved assignments retain their meaning. Broader candidate ranking or sidebar redesign is out of scope.
