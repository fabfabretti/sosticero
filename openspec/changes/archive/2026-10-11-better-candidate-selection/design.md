# Design

## Context

The app keeps rules in `backend/domain.py` (pure Python), HTTP in `backend/main.py`, and presentation in `frontend/src/main.tsx` + `CandidateDrawer.tsx`. The drawer currently receives a flat `Candidate` per option (`id/name/ty/loc/why/tag/today/total/tier`); the sidebar "A disposizione" renders only manual `state.dis` entries; ENTRA/ESCE candidates are appended only when `row.h` equals the class's first/last *effective* hour. The timetable JSON carries `classe_concorso` per teacher but `normalize_dataset` drops it. Motivation and scope: see proposal.md.

## Goals / Non-Goals

**Goals:**
- Give the office, at a glance: who the candidate is (role, classe di concorso, weekly classes), whether they already teach the covered class, and the class's effective entry/exit hours.
- Surface automatically-computed availability in the sidebar without letting it be mis-edited.
- Keep one source of truth (backend) for eligibility/boundaries so the UI can't show something the API rejects.

**Non-Goals:**
- No ranking/tier changes (same-sezione ordering explicitly postponed by the user).
- No indirizzo/sezione mapping or grouping.
- No change to substitution-row merging or the archive format.

## Decisions

**D1 — Backend enriches candidates; frontend only renders.** `eligibility`/`candidates` in domain.py already own eligibility, ranking, and the ENTRA/ESCE boundaries; the day response already carries `dataset.lessons`. Adding role/concorso/weekly-classes/entry-exit flags there means tests live in Python and the frontend stays a dumb renderer.
*Alternatives:* computing weekly classes client-side from `dataset.lessons` — rejected, duplicates out-hours logic and splits the behavior contract.

**D2 — `classe_concorso` kept at normalize; names via a static table.** `normalize_dataset` stores the code on each teacher record; a `CDC_NAMES` dict in domain.py maps the 29 codes seen in this dataset to their Italian names, falling back to the raw code for unknown/new codes.
*Alternatives:* names supplied with the timetable (no such field exists today; user picked the static table).

**D3 — Candidate payload extensions.** Teacher candidates carry `role`, `cdc`, `cdcName`, `clsWeek` (sorted union of the teacher's classes across all five weekdays), and `inClass` (whether `clsWeek` contains the row's class). ENTRA/ESCE candidates carry `enable` (bool boundary check) and `info` — the label "La classe <c> entra alle X ed esce alle Y", using **effective** bounds (`effective = scheduled hours minus hours out via ENTRA/ESCE/class-out`), which already yields the requested chaining (ESCE at 7 → last effective hour becomes 6). Dirty/`why`-disabled candidates keep working unchanged; DIR is untouched.

**D4 — Auto availability computed per day in the backend.** A pure function returns, per day, `{ teacher: { hour: [reasons] } }` when the teacher has a lesson that hour, **all** its classes are out for that hour (`class_out` with no row context), the teacher is not absent and not already assigned. Reasons name each class and its cause ("entra dopo" / "esce prima" / "classe fuori"). Exposed in `GET /api/day/{day}`. Cost is 155×7 lookups — negligible.
*Alternatives:* deriving it client-side — rejected for the same reason as D1.

**D5 — Sidebar merges manual + auto entries; auto hours locked.** The "A disposizione" list shows the union. Auto hours render selected-but-`disabled` with a `title` tooltip (the reason list); toggles and removal send only the manual hour set. For a teacher with no manual hours, the row is informational: edit chrome (all/none, site, remove) is hidden.

**D6 — `validate_assignment` rejects greyed entry/exit.** When a request assigns `ENTRA`/`ESCE` to a row whose hour is not the corresponding effective boundary, validation raises an error and nothing is stored, keeping the API consistent with the greyed UI.

## Risks / Trade-offs

- **Concorso names may be inaccurate** → the table is a small static dict; the user reviews it once; unknown codes degrade to code-only.
- **Payload growth** — every teacher candidate now carries a class list → bounded (155 teachers, a handful of classes each); trivial for a local SQLite app.
- **Re-upload with a different timetable invalidates stored assignments** → the deploy note mandates re-uploading the *same* file, and unrelated changes surface as "da verificare" rather than corrupting data.
- **Always-visible entry/exit rows add clutter to every drawer** → mitigated with a compact two-line layout and greyed styling.

## Migration Plan

1. Deploy the new backend/frontend; **existing DBs store teacher records without `classe_concorso`**.
2. Back up (archive export and/or SQLite online backup, per README).
3. Re-upload the **same** `references/orari.json` via "Carica database JSON" (`POST /api/timetable`). Only the `dataset` document is rewritten; the `state` document (absences, disponibilità, assignments) is untouched (verified in `storage.py` / `main.py`).
4. Rollback is a normal redeploy of the previous build; the DB schema and archive format are unchanged.

No code migration is needed: `classe_concorso` is derived data repopulated on re-upload, and every new field (candidate profile, auto availability, entry/exit flags) is computed from the day's dataset/state at request time.