# Verification

- Backend regression suite: 185 tests passed; the final reception suite additionally passed all 8 tests after parser hardening and timetable-independence coverage were added.
- Frontend suite: all 12 test files passed; the final reception tests additionally passed all 3 cases, including candidate drawer grouping and disabled travel conflicts.
- Production frontend build succeeded. Existing bundle-size and React Router directive warnings remain.
- The supplied workbook parsed successfully as 140 rows with no invalid required fields. Its production data was not imported.
- Standalone test project `sosticero-ricevimenti-1792577460` mounted only `/tmp/sosticero-ricevimenti.9c0d8M` at `/data`, used an automatically allocated localhost port, and reported `{"testing":true}` before mutation.
- Container API checks passed for preview/manual matching, unknown and confirmed campus handling, RP exclusion including direct assignment attempts, dated history, portable archive round trip and the supplied workbook preview.
- Browser verification showed the red TESTING ribbon, manually resolved a fictional reception teacher, confirmed an import and displayed R with unknown/remote location details in Orari. Screenshot: `/tmp/receptions-orari.png`.
- The final test image was rebuilt and recreated with both flags; its HTML served `index-Brq4g2Lf.js`. Only the testing project was stopped afterward.
- Normal container `sosticero_app_1` retained identity `4ca269fa7306028fd56270d03f7ad01b0fa0134c830f88b501cae3f6b987277e`, remained running, and retained the project data mount. No normal deployment, production import or commit was performed.
- `openspec validate import-ricevimenti --strict` and `git diff --check` passed.

## Normal deployment

Following the user's deployment correction, rebuilt and recreated the normal service with `LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate`. Read-only checks confirmed the container is running, `/data` mounts `/home/fabs/Desktop/sosticero/data`, `/api/environment` returns `{"testing":false}`, and the HTML serves the verified `index-Brq4g2Lf.js` frontend. No reception data was imported into the operational database.
