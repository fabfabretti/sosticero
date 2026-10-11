# Tasks

## 1. Backend row grouping

- [x] 1.1 In `backend/domain.py`, group `rows()` output by (period, class): give each row an `ids` list of every absent teacher in the group (ordered by name), keep `id` as the lowest id, and set `k = f"{min(ids)}|{period}|{class}"`. Verify with a new fixture in `backend/tests/test_app.py` where two teachers share a class and period and are both absent, asserting exactly one row whose `ids` holds both and whose `k` uses the lowest id.
- [x] 1.2 Keep single-absence and 3+ teacher behaviour correct; verify the new test also covers three co-absent teachers, and the existing row tests still pass with `.venv/bin/python -m unittest discover -s backend/tests -v`.

## 2. Candidate correctness

- [x] 2.1 In `eligibility()`, skip every id in `row["ids"]` instead of only `row["id"]`. Verify a new test asserts that neither absent co-teacher appears in `candidates(...)` for the merged row.
- [x] 2.2 Verify a present co-teacher is still offered as a Compresenza candidate when only their partner is absent; add that assertion and run the backend suite.

## 3. Frontend label

- [x] 3.1 Add `ids: string[]` to `Row` in `frontend/src/types.ts`. Verify `npm --prefix frontend run build` type-checks.
- [x] 3.2 Render the absent-teacher label from `r.ids.map(name).join(" / ")` in `frontend/src/main.tsx` and from `open.ids` in `frontend/src/CandidateDrawer.tsx`. Verify `npm --prefix frontend run build` succeeds.
- [x] 3.3 Add a `frontend/tests/sidebar.test.cjs` case driving two absent co-teachers and asserting a single merged label; verify `npm --prefix frontend test` passes.

## 4. Documentation

- [x] 4.1 Add a `README.md` note that co-absent teachers for one class and period share a single substitution row, and that an assignment left under a non-canonical key is flagged for review rather than migrated. Verify the note names both behaviours.

## 5. Integration verification

- [x] 5.1 Against `references/orari.json`, mark Domaschi and Savelli absent for the 7th period on a Tuesday and confirm one `Domaschi Alberto / Savelli Luca` row for 3FB, that archiving round-trips (`Esporta` then `Importa`) unchanged, and that `openspec validate "merge-co-absent-compresenza-rows"` still passes.

## Workflow follow-up

- Archive the change once the tasks above are complete and reviewed.
