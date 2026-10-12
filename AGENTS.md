# AGENTS.md

## After finishing a feature
Always ask the user whether they want to commit the work before committing it.

## Showing results and testing
The app runs in a Podman container serving a frontend built by the Dockerfile
(`npm ci && npm run build` inside the image). Whenever the result of a feature
should be seen or tested, rebuild the image and restart the container:

```sh
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --build --force-recreate
```

Both flags are required: `--build` alone leaves the running container on the
old bundle, `--force-recreate` alone reuses the old image.