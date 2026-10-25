#!/usr/bin/env python3
"""Prepare a source-only snapshot for the server build; never contacts the server."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tarfile
import tempfile


ROOT = Path(__file__).resolve().parents[1]


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def snapshot(source, destination):
    destination.mkdir()
    for name in ('Dockerfile', '.dockerignore'):
        shutil.copy2(source / name, destination / name, follow_symlinks=False)
    ignore = shutil.ignore_patterns('node_modules', 'dist', '__pycache__', '.git', '.venv',
                                    '.env', '.env.*', '*.sqlite*', '*.db', '*.db-*', '*.pem', '*.key',
                                    '.aws', '.ssh', 'google-service-account.json')
    for name in ('backend', 'frontend'):
        shutil.copytree(source / name, destination / name, ignore=ignore, symlinks=True)
    files = {}
    for path in sorted(destination.rglob('*')):
        if path.is_symlink():
            raise ValueError('Build inputs must not contain symlinks: ' + str(path.relative_to(destination)))
        if path.is_file():
            files[str(path.relative_to(destination))] = sha256(path)
    identity = hashlib.sha256(json.dumps(files, sort_keys=True).encode()).hexdigest()
    return identity, files


def prepare(destination):
    destination = Path(destination).resolve()
    if destination.exists() or destination.is_relative_to(ROOT):
        raise ValueError('Choose a new output directory outside the repository')
    with tempfile.TemporaryDirectory(prefix='sosticero-source-') as temporary:
        context = Path(temporary) / 'context'
        identity, files = snapshot(ROOT, context)
        public = context / 'frontend/public'
        public.mkdir(parents=True, exist_ok=True)
        (public / 'sosticero-release.json').write_text(json.dumps({'snapshot': identity}) + '\n')
        destination.mkdir(mode=0o700)
        archive = destination / 'source.tar'
        with tarfile.open(archive, 'w') as bundle:
            def readable_source(entry):
                # Build inputs must be readable by the image's non-root runtime user.
                entry.mode = 0o755 if entry.isdir() or entry.mode & 0o111 else 0o644
                return entry
            bundle.add(context, arcname='context', filter=readable_source)
            bundle.add(ROOT / 'compose.server.yaml', arcname='compose.yaml')
            bundle.add(ROOT / 'scripts/installation-data.py', arcname='installation-data.py')
        manifest = dict(source_snapshot=identity, archive_sha256=sha256(archive), archive_bytes=archive.stat().st_size)
        (destination / 'release.json').write_text(json.dumps(manifest, indent=2) + '\n')
        (destination / 'source-files.json').write_text(json.dumps(files, indent=2) + '\n')
        (destination / 'SHA256SUMS').write_text(manifest['archive_sha256'] + '  source.tar\n')
    return manifest


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', help='New output directory outside the repository')
    args = parser.parse_args()
    try:
        print(json.dumps(prepare(args.directory), indent=2))
    except (ValueError, OSError) as error:
        sys.exit(str(error))
