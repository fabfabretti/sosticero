# AGENTS.md

## After finishing a feature
Always ask the user whether they want to commit the work before committing it.

## Development database and normal deployment

- The normal deployment is `compose.yaml`, mounting `./data:/data:Z`. Its operational database is `data/supplenze.sqlite`. Keep the ordinary `podman compose up` command pointed at this database.
- Develop and verify against an isolated database in a temporary directory. If realistic data is needed, copy the main database with SQLite's online backup API; never copy a live SQLite file directly or overwrite an existing test copy without checking it.
- Use an explicitly selected temporary Compose override that replaces the entire `/data` mount with the test directory. This isolates the database, WAL files and backups together. Never create an automatically loaded `compose.override.yaml`, change the normal mount, or persist `COMPOSE_FILE` to select test configuration.
- Test with `podman compose -f compose.yaml -f <temporary-override.yaml> up -d --build --force-recreate`, supplying `LOCAL_UID` and `LOCAL_GID` as below. Verify the running container's `/data` mount before changing any data.
- Never import timetables, change settings, create test records, or restore backups in the main database for development or verification. Never copy test data back to the main database. An intentional production data change requires an explicit user request; normal application initialization/migrations must preserve existing operational records.
- Before handing the app back at the end of operations, recreate the normal deployment with the command below, omitting the test override. Verify that `/data` mounts the project's `data` directory and the updated frontend is served. Use read-only deployment checks; keep behavioral tests on the isolated database.
- Do not leave the app running on the test database unless the user explicitly asks for that. If restoring normal service fails, report the failure and the database currently in use. Test overrides and database copies are disposable, and must never become the default deployment.

## Showing results and testing

The app runs in a Podman container serving a frontend built by the Dockerfile
(`npm ci && npm run build` inside the image). Whenever the result of a feature
should be seen or tested, rebuild the image and restart the container:

```sh
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate
```

Both flags are required: `--build` alone leaves the running container on the
old bundle, `--force-recreate` alone reuses the old image.

## Verifying builds efficiently
When rebuilding, avoid dumping large minified bundles into context. The built
assets (especially `dist/assets/*.js`) can be hundreds of KB and very
token-dense.

- **Trust the build output.** If `npm run build` completes successfully and
  emits new files, the changes are in `dist/`. You don't need to read the full
  minified bundle to confirm it.
- **Use targeted checks only.** Check for existence, not full content. Prefer
  `grep -q "string"` or a tiny one-liner like
  `python3 -c "import os; p=[f for f in os.listdir('dist/assets') if f.endswith('.js')][0]; print('ok' if b'text' in open('dist/assets/'+p,'rb').read() else 'no')"` only if absolutely necessary.
- **Don't repeatedly read built assets.** Once the container serves the updated
  bundle (check the asset hash in the HTML), that's sufficient proof.
- **Stop after the decisive signal.** A rebuilt container with the new bundle
  is the verification that matters; extra passes add noise and tokens.
