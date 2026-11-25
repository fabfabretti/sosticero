# Tasks

## 1. Report content and scope

- [x] 1.1 Add sede selection and a separate report preview in Banca ore, preserving the availability PDF; verify selection, readiness and return/print actions with frontend tests.
- [x] 1.2 Render the selected server-provided budget summaries and teacher-grouped assignment register, including empty, unpriced, zero-budget, over-budget and combined-scope cases; verify filtering and financial labels with focused tests.
- [x] 1.3 Document the new report, its all-records scope and browser PDF workflow in Banca ore documentation; check it against the implemented UI.

## 2. Presentation and release

- [ ] 2.1 Match the Statistiche report header and preview/print styling, with legible multi-page tables and repeated headings; verify browser print output with long and empty synthetic datasets.
- [ ] 2.2 Run relevant frontend tests and production build, then verify the feature in an isolated testing Compose project, including the TESTING indicator and existing availability PDF.
- [x] 2.3 Deploy with `./scripts/deploy.sh` and verify the deployed release and data mount using read-only checks.
