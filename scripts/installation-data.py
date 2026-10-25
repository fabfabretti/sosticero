#!/usr/bin/python3 -I
"""Operator-only stopped-installation transfer. Never used by routine deployment."""
import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import sys
import tarfile
import tempfile


def digest(stream):
    result = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        result.update(block)
    return result.hexdigest()


def verify_databases(data):
    for name in ('supplenze.sqlite', 'auth.sqlite'):
        path = data / name
        if not path.is_file():
            raise ValueError('Missing required database: ' + name)
        # Inspect a stopped copy so SQLite cannot create root-owned WAL/SHM in the source.
        with tempfile.TemporaryDirectory(prefix='sosticero-integrity-') as temporary:
            copy = Path(temporary) / name
            shutil.copyfile(path, copy)
            wal = Path(str(path) + '-wal')
            if wal.exists():
                shutil.copyfile(wal, str(copy) + '-wal')
            with closing(sqlite3.connect(copy.as_uri() + '?mode=ro', uri=True)) as db:
                if db.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                    raise ValueError('Invalid database: ' + name)
    if not (data / '.sosticero-production').is_file():
        raise ValueError('Expected a stopped operational installation, including its production marker')


def pack(source, destination):
    source, destination = Path(source).resolve(), Path(destination).absolute()
    if destination.exists() or destination.is_relative_to(source):
        raise ValueError('Use a new destination outside the source data directory')
    for path in source.rglob('*'):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise ValueError('Data may contain only real files and directories')
    verify_databases(source)
    destination.mkdir(mode=0o700)
    with tarfile.open(destination / 'data.tar', 'w', dereference=True) as archive:
        archive.add(source, arcname='data')
    hashes = {}
    with tarfile.open(destination / 'data.tar', 'r:') as archive:
        for member in archive:
            if member.isfile():
                hashes[member.name] = digest(archive.extractfile(member))
                with (source / PurePosixPath(member.name).relative_to('data')).open('rb') as stream:
                    if hashes[member.name] != digest(stream):
                        raise ValueError('Source changed during transfer preparation; keep writers stopped')
    with (destination / 'data.tar').open('rb') as stream:
        hashes['archive_sha256'] = digest(stream)
    (destination / 'checksums.json').write_text(json.dumps(hashes, indent=2) + '\n')


def restore(source, destination):
    source, destination = Path(source).resolve(), Path(destination).absolute()
    if destination.exists() or destination.is_symlink():
        raise ValueError('Destination must not exist; never overwrite an installation')
    expected = json.loads((source / 'checksums.json').read_text())
    with (source / 'data.tar').open('rb') as stream:
        if digest(stream) != expected['archive_sha256']:
            raise ValueError('Transfer archive checksum mismatch')
    with tarfile.open(source / 'data.tar', 'r:') as archive:
        members = archive.getmembers()
        names = set()
        for member in members:
            name = PurePosixPath(member.name)
            if name.is_absolute() or '..' in name.parts or not name.parts or name.parts[0] != 'data' or str(name) in names:
                raise ValueError('Unsafe archive path')
            if not (member.isdir() or member.isfile()):
                raise ValueError('Archive links and special files are not accepted')
            names.add(str(name))
        total = sum(member.size for member in members if member.isfile())
        if shutil.disk_usage(destination.parent).free < total + 2 * 1024**3:
            raise ValueError('Insufficient space for installation and 2 GiB reserve')
        destination.mkdir(mode=0o700)
        found = {}
        try:
            for member in members:
                target = destination.joinpath(*PurePosixPath(member.name).parts[1:])
                if member.isdir():
                    target.mkdir(mode=0o700, parents=True, exist_ok=True)
                else:
                    target.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
                    with target.open('xb') as output, archive.extractfile(member) as stream:
                        shutil.copyfileobj(stream, output)
                    os.chmod(target, 0o600)
                    with target.open('rb') as stream:
                        found[member.name] = digest(stream)
            if found != {k: v for k, v in expected.items() if k != 'archive_sha256'}:
                raise ValueError('Restored file checksums differ from source')
            verify_databases(destination)
        except Exception:
            # Keep evidence for operator review; never delete or reuse a partial installation.
            print('Incomplete transfer retained at ' + str(destination), file=sys.stderr)
            raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['pack', 'restore'])
    parser.add_argument('source')
    parser.add_argument('destination')
    parser.add_argument('--stopped', action='store_true', required=True,
                        help='Confirm all applications/CLI writers using these data directories are stopped')
    args = parser.parse_args()
    os.umask(0o077)
    {'pack': pack, 'restore': restore}[args.action](args.source, args.destination)
    print('Verified:', args.destination)


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, KeyError, tarfile.TarError, sqlite3.Error) as error:
        sys.exit(str(error))
