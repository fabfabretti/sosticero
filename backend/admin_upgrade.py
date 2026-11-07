"""One-time, stopped-service administrator upgrade used by scripts/deploy.sh."""
import argparse
from contextlib import closing
from pathlib import Path
import sqlite3
from .auth import Identities


def preflight(path):
    with closing(sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True)) as db:
        db.row_factory = sqlite3.Row
        columns = {r['name'] for r in db.execute('PRAGMA table_info(accounts)')}
        if 'protected' in columns:
            protected = db.execute('SELECT * FROM accounts WHERE protected=1').fetchall()
            if protected:
                if len(protected) != 1 or not protected[0]['admin'] or not protected[0]['enabled']:
                    raise ValueError('Invalid protected administrator; recover locally before deployment.')
                return
        # Explicit original installation mapping, verified before this upgrade.
        accounts = db.execute('SELECT username,name,campus FROM accounts ORDER BY username').fetchall()
        if [(r['username'],r['name'],r['campus']) for r in accounts] != [('centrale','Centrale','centrale'),('succursale','Succursale','succursale')]:
            raise ValueError('Verify legacy account mapping and bootstrap the protected administrator locally before deployment.')


def upgrade(path):
    preflight(path)
    identities = Identities(path)
    if any(a['protected'] for a in identities.list()):
        identities.require_admin(); return
    for campus in ('centrale','succursale'): identities.map_legacy(campus,campus)
    # The file is exclusive, private and outside school-data backups/archives.
    keys = path.parent / 'keys'; keys.mkdir(mode=0o700,exist_ok=True)
    credentials = keys / 'admin-initial.txt'
    import os
    import secrets
    if credentials.exists():
        if credentials.is_symlink() or credentials.stat().st_mode & 0o077:
            raise ValueError('Initial credentials must be a private regular file.')
        lines = credentials.read_text().splitlines()
        if len(lines) != 2 or lines[0] != 'Username: admin' or not lines[1].startswith('Password: '):
            raise ValueError('Invalid initial credential file; recover locally before activation.')
        password = lines[1][10:]
    else:
        password = secrets.token_urlsafe(24)
        descriptor = os.open(credentials,os.O_CREAT | os.O_EXCL | os.O_WRONLY,0o600)
        with os.fdopen(descriptor,'w') as output:
            output.write(f'Username: admin\nPassword: {password}\n')
    identities.create('admin','Amministratore',None,password,admin=True,protected=True)
    identities.require_admin()
    print('Protected administrator ready; initial credentials are in /data/keys/admin-initial.txt (0600).')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('database',type=Path); parser.add_argument('--check',action='store_true')
    args = parser.parse_args()
    if args.check: preflight(args.database)
    else: upgrade(args.database)


if __name__ == '__main__': main()
