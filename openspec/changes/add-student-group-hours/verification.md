# Verification — 16 November 2026

- Implemented dated group records, campus-scoped office API with generation/revision protection, atomic validation and online backup before writes.
- Six focused backend group tests pass, including all 15 supplied slots, no false whole-class demand, occupied candidates, existing-assignment preservation/flagging, historical context, campus permissions, malformed/legacy archives, restart and online backup/restore.
- Full backend run: 408 tests, 407 passed; remaining assertion used schema 13 as an unsupported format. Updated that fixture to 14 and reran the failing archive/attachment test successfully. Earlier schema-version expectations were updated to the new format 13.
- Frontend suite: all 36 test files passed. Additional focused editor/PDF checks passed after extending PDF rows for group/reception overlap. Final container build passed.
- Isolated project `sosticero-groups-1794851780-43886`, temporary mount `/tmp/sosticero-groups-data.WU2CLA`, allocated localhost ports only. Final port 33507; environment returned testing=true. Red TESTING ribbon, office editor, all 15 timetable groups and one separate absent-group review with zero ordinary demand were verified. HTTP archive round trip passed. Final served assets index-BfxCvfdO.js and index-Y_K4x5Ga.css. Test project stopped and removed.
- Production catalogue checked read-only. All five teacher identities resolved; user confirmed 1GST → 1GS and 3AES → 3AE. Wednesday period 3 is 1EST (5), not 1FST. Start 2026-11-16, no end date.
- No ordinary-lesson overlaps in the requested target slots. Iorio's Friday period 2 overlaps an existing reception (08:35–09:30, unspecified campus); both are preserved and flagged.

Deployment succeeded with `./scripts/deploy.sh`: release `incoming-20261116T182025-80487`. The script verified the production data mount, complete recovery snapshot at `snapshots/incoming-20261116T182025-80487`, HTTPS testing=false, source identity and served frontend. The user-authorized operational entry completed through the supported campus-scoped office API using the existing Centrale and Succursale accounts. Both temporary login sessions were logged out after use. No credentials were placed in commands, logs or files.

Read-only production verification confirmed all 15 requested records exactly match `entries.json`: 10 Centrale and 5 Succursale, effective 2026-11-16, no earlier group entries. Teacher totals: Corrà 1, Dal Cortivo 2, Saccoccio 6, Presta 1, Iorio 5. The only reported conflict is Iorio Friday period 2 with the preserved reception.

Automatic pre-entry backups: `supplenze-2026-11-16T18-26-32.946846_812ztgjn.sqlite` and `supplenze-2026-11-16T18-26-37.143032_awa4in21.sqlite`. Read-only SHA-256 comparison confirmed `timetables`, `timetableOverrides`, `teacherAppointments`, `receptions`, `teacherNameOverrides`, `paidFinance` and `hourTypes` are unchanged from the pre-deployment fingerprints. No commit made.
