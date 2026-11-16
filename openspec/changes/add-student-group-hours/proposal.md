# Proposal

## Why

The supplied weekly schedules contain 15 teacher-led student-group hours missing from the operational model. Treating their source classes as whole-class lessons would multiply substitution demand and incorrectly imply whole-class participation; the school's procedure when the teacher is absent is currently unknown.

## What Changes

- Add dated weekly student-group commitments with a teacher, campus, room and source classes with optional pupil counts; exclude autonomous study without a teacher.
- Count one teacher-hour per slot and block ordinary substitution availability without blocking entire source classes or inferring co-teaching.
- Show one “Da valutare” activity when its teacher is absent, separate from ordinary substitution demand; do not invent a cover or return-to-class policy.
- Provide office management and timetable presentation, persistence, archive compatibility and safe reference/conflict handling.
- Capture the 15 supplied slots as a reviewable entry checklist, with effective date and teacher identities resolved before any operational entry.

## Capabilities

### New Capabilities

- `student-group-hours`: Dated teacher commitments for partial-class groups, their accounting, presentation and absence review.

### Modified Capabilities

None. Ordinary whole-class substitution-row requirements remain unchanged; group review items are a separate activity type rather than ordinary class rows.

## Impact

Backend timetable composition, availability/candidate checks, absence reporting/statistics, persistence and archive validation; frontend timetable management, daily absence-review presentation and exports. Reuse existing authentication, campus authorization and concurrency controls. No new external dependency is expected. Planning does not modify production data; implementation verification uses isolated databases, followed by the normal server deployment.
