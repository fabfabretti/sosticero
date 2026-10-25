#!/usr/bin/env bash
set -euo pipefail

host=pietroa@atlante
base=/home/pietroa/server/fabs/containers/sosticero
root=$(cd -- "$(dirname -- "$0")/.." && pwd)
if [[ ${1:-} == --dry-run && $# == 1 ]]; then
    printf '%s\n' "Target: $host:$base" \
        'Check existing data, environment, proxy network and disk space.' \
        'Upload a source-only snapshot; never upload or sync data/.' \
        'Acquire the Sosticero deployment lock and build on the server.' \
        'Stop only Sosticero, verify a complete data backup, then recreate only Sosticero.' \
        'Verify the selected image, source marker and frontend over HTTPS.'
    exit 0
fi
[[ $# == 0 ]] || { echo 'Usage: scripts/deploy.sh [--dry-run]' >&2; exit 2; }
work=$(mktemp -d)
cleanup() {
    if [[ -S $work/ssh ]]; then ssh -S "$work/ssh" -O exit "$host" >/dev/null 2>&1 || true; fi
    rm -rf -- "$work"
}
trap cleanup EXIT
ssh_options=(-o StrictHostKeyChecking=yes -o ClearAllForwardings=yes
    -o ConnectTimeout=10 -o ServerAliveInterval=15 -o ServerAliveCountMax=3
    -o ControlMaster=auto -o ControlPersist=60 -o "ControlPath=$work/ssh")
release="incoming-$(date -u +%Y%m%dT%H%M%S)-$$"
python3 "$root/scripts/prepare-source.py" "$work/release"
snapshot=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["source_snapshot"])' "$work/release/release.json")

# Initial data migration is deliberately outside routine code deployment.
ssh -T "${ssh_options[@]}" "$host" bash -s -- "$release" <<'REMOTE'
set -euo pipefail
cd /home/pietroa/server/fabs/containers/sosticero
test -f .env
test -f data/.sosticero-production && test -f data/supplenze.sqlite && test -f data/auth.sqlite || {
    echo 'Stop: transfer the complete initial data folder before deploying.' >&2; exit 1;
}
docker network inspect npm_npm_proxy >/dev/null
env SOSTICERO_IMAGE=localhost/sosticero:check docker compose -p sosticero -f compose.yaml config --quiet
python3 - <<'PY'
from pathlib import Path
import shutil
size = sum(p.stat().st_size for p in Path('data').rglob('*') if p.is_file())
assert shutil.disk_usage('.').free > size * 2 + 5 * 1024**3, 'Insufficient space for build, recovery and reserve'
PY
mkdir -m 700 -- "$1"
REMOTE
scp "${ssh_options[@]}" "$work/release/source.tar" "$work/release/SHA256SUMS" "$host:$base/$release/"
ssh -T "${ssh_options[@]}" "$host" bash -s -- "$release" "$snapshot" <<'REMOTE'
set -euo pipefail
umask 077
cd /home/pietroa/server/fabs/containers/sosticero
exec 9>.deploy.lock
flock -n 9 || { echo 'Another Sosticero deployment is running.' >&2; exit 1; }
stage=$1
snapshot=$2
cd "$stage"
sha256sum -c SHA256SUMS
tar -xf source.tar --no-same-owner
cd ..
cmp compose.yaml "$stage/compose.yaml" || {
    echo 'Compose changed: review and install that configuration separately before deploying.' >&2; exit 1;
}
image="localhost/sosticero:$stage"
compose() { env SOSTICERO_IMAGE="$image" docker compose -p sosticero -f compose.yaml "$@"; }
report_failure() {
    code=$?
    if ((code)); then
        echo 'Deployment failed; no automatic data restore was attempted.' >&2
        compose ps -a || true
        id=$(compose ps -aq sosticero) || true
        if [[ -n ${id:-} ]]; then docker inspect --format '{{.Image}} {{json .Mounts}}' "$id" || true; fi
    fi
}
trap report_failure EXIT
ids=$(docker ps -aq --filter label=com.docker.compose.project=sosticero)
if [[ -n $ids ]]; then
    docker inspect $ids | python3 -c '
import json,sys
from pathlib import Path
items=json.load(sys.stdin); assert len(items)==1, "Unexpected containers in Sosticero project"
c=items[0]; assert c["Config"]["Labels"]["com.docker.compose.service"]=="sosticero"
mounts=[m for m in c["Mounts"] if m["Destination"]=="/data"]
assert len(mounts)==1 and mounts[0]["Source"]==str(Path.cwd()/"data"), "Unexpected data mount"
'
fi
docker build --platform=linux/amd64 --label "io.sosticero.source-snapshot=$snapshot" -t "$image" "$stage/context"
image_id=$(docker image inspect --format '{{.Id}}' "$image")
marker=$(docker run --rm --network=none --read-only --cap-drop=ALL --entrypoint cat "$image" /app/frontend/dist/sosticero-release.json)
python3 -c 'import json,sys; assert json.loads(sys.argv[1])=={"snapshot":sys.argv[2]}' "$marker" "$snapshot"
html_hash=$(docker run --rm --network=none --read-only --cap-drop=ALL --entrypoint cat "$image" /app/frontend/dist/index.html | sha256sum | cut -d ' ' -f1)
mkdir -p -m 700 snapshots
backup="snapshots/$stage"
running=$(compose ps -q --status running sosticero)
compose stop sosticero
if ! python3 "$stage/installation-data.py" pack "$PWD/data" "$PWD/$backup" --stopped; then
    if [[ -n $running ]]; then compose start sosticero; fi
    exit 1
fi
cp .env compose.yaml "$backup/"
if [[ -f current-release.txt ]]; then cp current-release.txt "$backup/"; fi
if [[ -n $ids ]]; then docker inspect --format '{{.Image}}' $ids > "$backup/previous-image.txt"; fi
awk '!/^SOSTICERO_IMAGE=/' .env > "$stage/next.env"
printf 'SOSTICERO_IMAGE=%s\n' "$image" >> "$stage/next.env"
mv "$stage/next.env" .env
compose up -d --no-build --pull never --no-deps --force-recreate sosticero
id=$(compose ps -q sosticero)
test "$(docker inspect --format '{{.Image}}' "$id")" = "$image_id"
python3 - "$snapshot" "$html_hash" <<'PY'
import hashlib,json,sys,time,urllib.request
origin='https://sosticero.iamfabs.dev'
def read(path):
    with urllib.request.urlopen(origin+path,timeout=5) as r:
        assert r.geturl()==origin+path, 'Unexpected redirect'
        return r.read(2*1024*1024)
for attempt in range(30):
    try:
        assert json.loads(read('/api/environment'))=={'testing':False}
        assert json.loads(read('/sosticero-release.json'))=={'snapshot':sys.argv[1]}
        assert hashlib.sha256(read('/')).hexdigest()==sys.argv[2]
        break
    except (OSError,ValueError,AssertionError):
        if attempt==29: raise
        time.sleep(2)
print('HTTPS environment, source snapshot and frontend verified.')
PY
printf '%s\n' "$snapshot" "$image_id" > current-release.txt
compose ps
printf 'Deployed %s\nRecovery snapshot: %s/%s\n' "$image" "$PWD" "$backup"
REMOTE
