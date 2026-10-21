# Proposal

## Why

Reception hours are absent from teaching timetables, so the application can incorrectly offer them for recupero permesso (RP) and miss useful adjacent recovery opportunities. The supplied reception spreadsheet makes these commitments importable, provided uncertain teacher identities and locations remain explicit.

## What Changes

- Add a Ricevimenti section in Settings to import XLSX schedules with preview, effective date, manual teacher matching and optional campus confirmation.
- Display receptions as R in Orari, preserving and flagging overlapping lessons.
- Always exclude reception periods from RP; recognize adjacent free periods as favorable when campus feasibility is established, otherwise label them potentially favorable with sede da verificare.
- Preserve dated reception schedules, stable teacher references, existing assignments and recovery attribution through updates and portable data round trips.
- Apply the same reception constraints to candidate selection, assignment validation and timetable availability statistics.

## Capabilities

### New Capabilities

- `reception-schedules`: Reception import, identity resolution, dated storage, location uncertainty, Orari display and portability.

### Modified Capabilities

- `candidate-selection`: Reception exclusion from RP and reception-aware convenience and campus checks.

## Impact

Backend storage, import APIs, timetable/date resolution, domain RP rules, archive validation and availability statistics; frontend Settings, Orari and candidate explanations. Add an XLSX reader dependency if required by the selected parser. Reuse preview/confirmation and backup patterns. This change does not import production data automatically, alter permit entitlement calculations, or turn R into an ordinary configurable availability type.
