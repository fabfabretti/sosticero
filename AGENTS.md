# AGENTS.md

## After finishing a feature
Always ask the user whether they want to commit the work before committing it.

## Showing results and testing
The app runs in a Podman container that serves the built frontend from
`frontend/dist`. Whenever the result of a feature should be seen or tested,
start the container first:

```sh
npm --prefix frontend run build          # only needed after frontend changes
LOCAL_UID=$(id -u) LOCAL_GID=$(id -g) podman compose up -d --force-recreate
```

`--force-recreate` is required: `podman compose up --build` refreshes the image
but leaves the running container on the old bundle.