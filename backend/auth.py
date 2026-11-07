"""Local identities, revocable sessions and a cross-process publication gate."""
import argparse
from contextlib import contextmanager, closing
import getpass
import hashlib
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from urllib.parse import urlsplit
from uuid import uuid4
from . import teacher_access

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import HTTPException

HASHER = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
COOKIE = 'sosticero_session'
ADMIN_WRITES = {'hour-types', 'receptions', 'receptions/preview', 'timetable', 'timetable/preview', 'import', 'import/preview', 'backups', 'backups/restore', 'inbox/connection', 'inbox/credentials', 'inbox/test', 'publication/schedule'}
SHARED_WRITES = {'paid-availability', 'entries', 'assignments', 'permessi', 'manual-permits', 'orari/name', 'orari/preview', 'orari/override'}
READS = {'publication', 'publication/schedule', 'paid-availability', 'hour-types', 'stats', 'stats/availability', 'orari', 'receptions', 'permessi', 'candidates', 'availability', 'export', 'backups', 'inbox', 'inbox/connection', 'inbox/summary'}
PUBLICATIONS = {'timetable', 'receptions', 'import', 'backups/restore'}

CAMPUSES = ('centrale', 'succursale')
ACCOUNT_FIELDS = ('id', 'username', 'name', 'admin', 'campuses', 'enabled', 'protected', 'revision')
CONFIG_READS = {'hour-types', 'receptions', 'backups', 'inbox/connection', 'publication/schedule', 'settings/overview'}


def account_data(row):
    value = {k: row[k] for k in ACCOUNT_FIELDS}
    value['campuses'] = json.loads(value['campuses']) if isinstance(value['campuses'], str) else value['campuses']
    for key in ('admin', 'enabled', 'protected'): value[key] = bool(value[key])
    return value


def validate_account(data):
    if not isinstance(data.get('username'), str) or not re.fullmatch(r'[a-z0-9_.-]{1,64}', data['username'].strip().lower()):
        raise ValueError('Nome utente non valido.')
    if not isinstance(data.get('name'), str) or not 1 <= len(data['name'].strip()) <= 100:
        raise ValueError('Nome completo non valido.')
    if any(type(data.get(k)) is not bool for k in ('admin', 'enabled')):
        raise ValueError('Permessi o stato non validi.')
    campuses = data.get('campuses')
    if not isinstance(campuses, list) or any(c not in CAMPUSES for c in campuses) or len(set(campuses)) != len(campuses):
        raise ValueError('Sedi non valide.')
    return dict(username=data['username'].strip().lower(), name=data['name'].strip(), admin=data['admin'],
                enabled=data['enabled'], campuses=sorted(campuses))


def password_hash(password):
    if not isinstance(password, str) or not 10 <= len(password) <= 256:
        raise ValueError('La password deve contenere da 10 a 256 caratteri.')
    return HASHER.hash(password)


class Identities:
    def __init__(self, path, testing=False):
        self.path = Path(path).resolve()
        if testing and (self.path.parent / '.sosticero-production').exists():
            raise RuntimeError('Testing cannot open operational identities.')
        self.path.parent.mkdir(parents=True, exist_ok=True)
        fd = os.open(self.path, os.O_CREAT | os.O_RDWR, 0o600)
        os.close(fd)
        os.chmod(self.path, 0o600)
        with self.connect() as db:
            db.executescript('''
                CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, campus TEXT NOT NULL, password TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1);
                CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account TEXT NOT NULL, csrf TEXT NOT NULL, expires REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS metadata (id INTEGER PRIMARY KEY CHECK(id=1), generation INTEGER NOT NULL);
                INSERT OR IGNORE INTO metadata VALUES (1,0);
                CREATE TABLE IF NOT EXISTS attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until REAL NOT NULL);
            ''')
        with self.gate(), self.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            columns = {r['name'] for r in db.execute('PRAGMA table_info(accounts)')}
            additions = {'admin': 'INTEGER NOT NULL DEFAULT 0', 'campuses': "TEXT NOT NULL DEFAULT '[]'",
                         'protected': 'INTEGER NOT NULL DEFAULT 0', 'revision': 'INTEGER NOT NULL DEFAULT 1'}
            for column, definition in additions.items():
                if column not in columns: db.execute(f'ALTER TABLE accounts ADD COLUMN {column} {definition}')
            if 'campuses' not in columns:
                for row in db.execute('SELECT id,campus FROM accounts').fetchall():
                    db.execute('UPDATE accounts SET campuses=? WHERE id=?', (json.dumps([row['campus']] if row['campus'] in CAMPUSES else []), row['id']))
                db.execute('DELETE FROM sessions')
            db.execute('CREATE UNIQUE INDEX IF NOT EXISTS protected_administrator ON accounts(protected) WHERE protected=1')
            db.execute('CREATE TABLE IF NOT EXISTS legacy_authors (campus TEXT PRIMARY KEY, identity TEXT NOT NULL)')
            db.execute('PRAGMA user_version=2')
        with self.connect() as db:
            teacher_access.initialize(db)
        self.dummy = HASHER.hash(secrets.token_urlsafe(32))

    @contextmanager
    def connect(self):
        with closing(sqlite3.connect(self.path, timeout=15)) as db, db:
            db.row_factory = sqlite3.Row
            yield db

    def acquire(self, shared=False):
        fd = os.open(str(self.path) + '.lock', os.O_CREAT | os.O_RDWR, 0o600)
        stream = os.fdopen(fd, 'r+b')
        if os.name == 'nt':
            # shortcut: Windows keeps exclusive read locks; use shared Windows locks if contention becomes measurable there.
            import msvcrt
            stream.write(b'0'); stream.flush(); stream.seek(0)
            lock = lambda: msvcrt.locking(stream.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            lock = lambda: fcntl.flock(stream, (fcntl.LOCK_SH if shared else fcntl.LOCK_EX) | fcntl.LOCK_NB)
        deadline = time.monotonic() + 15
        while True:
            try:
                lock()
                return stream
            except OSError:
                if time.monotonic() >= deadline:
                    stream.close()
                    raise HTTPException(503, 'Operazione in corso. Riprova tra poco.')
                time.sleep(.02)

    @contextmanager
    def gate(self):
        stream = self.acquire()
        try:
            yield
        finally:
            stream.close()

    def generation(self, advance=False):
        with self.connect() as db:
            if advance:
                db.execute('UPDATE metadata SET generation=generation+1 WHERE id=1')
            return db.execute('SELECT generation FROM metadata WHERE id=1').fetchone()[0]

    def require_admin(self):
        with self.connect() as db:
            if not db.execute('SELECT 1 FROM accounts WHERE protected=1 AND enabled=1 AND admin=1').fetchone():
                raise RuntimeError('Initialize the protected administrator with backend.auth bootstrap before activation.')

    def list(self):
        with self.connect() as db:
            return [account_data(row) for row in db.execute('SELECT * FROM accounts ORDER BY username')]

    def create(self, username, name, campus, password, *, admin=False, campuses=None, protected=False, locked=False):
        value = validate_account(dict(username=username, name=name, admin=admin, enabled=True,
                                      campuses=campuses if campuses is not None else [campus] if campus in CAMPUSES else []))
        if campus is not None and campuses is None and campus not in CAMPUSES: raise ValueError('Sede non valida.')
        hashed = password_hash(password)
        def save():
            with self.connect() as db:
                if protected and not admin: raise ValueError('L’account protetto deve essere amministratore.')
                try:
                    identifier = uuid4().hex
                    db.execute('INSERT INTO accounts (id,username,name,campus,password,enabled,admin,campuses,protected,revision) VALUES (?,?,?,?,?,1,?,?,?,1)',
                               (identifier, value['username'], value['name'], '', hashed, admin, json.dumps(value['campuses']), protected))
                except sqlite3.IntegrityError:
                    raise ValueError('Nome utente o amministratore protetto già presente.') from None
                return account_data(db.execute('SELECT * FROM accounts WHERE id=?', (identifier,)).fetchone())
        if locked: return save()
        with self.gate(): return save()

    def update(self, identifier, data, *, locked=False):
        if set(data) - {'username','name','admin','campuses','enabled','password','revision'}:
            raise ValueError('Campo account non valido.')
        if type(data.get('revision')) is not int: raise ValueError('Revisione account richiesta.')
        hashed = password_hash(data['password']) if 'password' in data else None
        def save():
            with self.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                row = db.execute('SELECT * FROM accounts WHERE id=?', (identifier,)).fetchone()
                if not row: raise HTTPException(404, 'Account non trovato.')
                if row['revision'] != data['revision']: raise HTTPException(409, 'Account modificato. Ricarica i valori prima di salvare.')
                value = validate_account({**account_data(row), **data})
                if row['protected'] and (not value['admin'] or not value['enabled']):
                    raise ValueError('L’amministratore protetto non può essere disabilitato o perdere il ruolo amministratore.')
                try:
                    db.execute('UPDATE accounts SET username=?,name=?,admin=?,campuses=?,enabled=?,password=?,revision=revision+1 WHERE id=?',
                               (value['username'],value['name'],value['admin'],json.dumps(value['campuses']),value['enabled'],hashed or row['password'],identifier))
                except sqlite3.IntegrityError: raise ValueError('Nome utente già presente.') from None
                db.execute('DELETE FROM sessions WHERE account=?', (identifier,))
                return account_data(db.execute('SELECT * FROM accounts WHERE id=?', (identifier,)).fetchone())
        if locked: return save()
        with self.gate(): return save()

    def change(self, username, field, value):
        if field not in ('name','username','password','campus','campuses','admin','enabled'): raise ValueError('Campo non valido.')
        row = next((a for a in self.list() if a['username']==username.strip().lower()), None)
        if not row: raise ValueError('Account non trovato.')
        if field == 'campus':
            if value not in CAMPUSES: raise ValueError('Sede non valida.')
            field, value = 'campuses', [value]
        return self.update(row['id'], {field:value, 'revision':row['revision']})

    def map_legacy(self, campus, username):
        if campus not in CAMPUSES: raise ValueError('Sede non valida.')
        with self.gate(), self.connect() as db:
            row = db.execute('SELECT id,username,name FROM accounts WHERE username=?', (username,)).fetchone()
            if not row: raise ValueError('Account storico non trovato.')
            value = json.dumps(dict(row), ensure_ascii=False)
            previous = db.execute('SELECT identity FROM legacy_authors WHERE campus=?', (campus,)).fetchone()
            if previous and json.loads(previous[0])['id'] != row['id']: raise ValueError('Mappatura storica già registrata: non può essere reinterpretata.')
            db.execute('INSERT OR IGNORE INTO legacy_authors VALUES (?,?)', (campus,value))

    def authors(self):
        with self.connect() as db:
            identities = {r['id']: dict(r) for r in db.execute('SELECT id,username,name FROM accounts')}
            mappings = {r['campus']: json.loads(r['identity']) for r in db.execute('SELECT * FROM legacy_authors')}
        return identities, mappings

    def session(self, token):
        with self.connect() as db:
            row = db.execute('''SELECT a.*,s.csrf,s.expires FROM sessions s JOIN accounts a ON a.id=s.account
                WHERE s.token=? AND s.expires>? AND a.enabled=1''', (self.token_hash(token), time.time())).fetchone()
        if not row: raise HTTPException(401, 'Accesso richiesto.')
        return dict(**account_data(row), csrf=row['csrf'], expires=row['expires'])

    @staticmethod
    def token_hash(token):
        return hashlib.sha256((token or '').encode()).hexdigest()

    def revoke(self, token=None):
        with self.connect() as db:
            if token is None: db.execute('DELETE FROM sessions')
            else: db.execute('DELETE FROM sessions WHERE token=?', (self.token_hash(token),))

    def login(self, username, password, address, previous=None):
        if not isinstance(username, str) or not isinstance(password, str) or len(username) > 64 or len(password) > 256:
            raise HTTPException(401, 'Credenziali non valide.')
        username = username.strip().lower()
        keys = [self.token_hash('user:'+username), self.token_hash('ip:'+address)]
        now = time.time()
        with self.connect() as db:
            db.execute('DELETE FROM attempts WHERE until<?', (now,))
            db.execute('DELETE FROM sessions WHERE expires<?', (now,))
            for key, limit in zip(keys, (10, 30)):
                row = db.execute('SELECT count FROM attempts WHERE key=?', (key,)).fetchone()
                if row and row['count'] >= limit: raise HTTPException(429, 'Troppi tentativi. Riprova tra 15 minuti.')
            # A global bound also prevents one-off usernames from growing the attempt table indefinitely.
            if db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0] > 10000:
                raise HTTPException(429, 'Troppi tentativi. Riprova più tardi.')
            account = db.execute('SELECT * FROM accounts WHERE username=?', (username,)).fetchone()
        try:
            valid = HASHER.verify(account['password'] if account else self.dummy, password)
        except (VerificationError, InvalidHashError): valid = False
        if not valid or not account or not account['enabled']:
            with self.connect() as db:
                for key in keys:
                    db.execute('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', (key, now+900))
            raise HTTPException(401, 'Credenziali non valide.')
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        with self.connect() as db:
            db.execute('DELETE FROM sessions WHERE token=?', (self.token_hash(previous),))
            db.execute('DELETE FROM attempts WHERE key=?', (keys[0],))
            db.execute('INSERT INTO sessions VALUES (?,?,?,?)', (self.token_hash(token), account['id'], csrf, now+43200))
        return token


def check_origin(request):
    configured = os.environ.get('APP_ORIGIN')
    host = request.headers.get('host', '')
    if configured:
        parsed = urlsplit(configured)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.path not in ('', '/'):
            raise HTTPException(503, 'APP_ORIGIN non valido.')
        allowed = configured.rstrip('/')
        if host != parsed.netloc: raise HTTPException(403, 'Host non consentito.')
    else:
        parsed = urlsplit('http://'+host)
        try: local = parsed.hostname == 'localhost' or ipaddress.ip_address(parsed.hostname or '').is_loopback
        except ValueError: local = False
        if not local: raise HTTPException(403, 'Configura APP_ORIGIN per questo host.')
        allowed = 'http://'+host
    if request.method not in ('GET', 'HEAD'):
        origin = request.headers.get('origin')
        if not origin:
            referer = urlsplit(request.headers.get('referer', ''))
            origin = f'{referer.scheme}://{referer.netloc}'
        if origin != allowed: raise HTTPException(403, 'Origine non consentita.')
    return allowed.startswith('https://')


def policy(path, method):
    route = path.removeprefix('/api/')
    if route == 'paid-finance': return 'admin'
    if route in ('teacher-access', 'teacher-access/pin', 'teacher-access/activation'): return 'admin'
    if route in ('staffing', 'staffing/preview', 'staffing/apply'): return 'admin'
    if route == 'accounts' or re.fullmatch(r'accounts/[a-zA-Z0-9_-]+', route): return 'admin'
    if method in ('GET', 'HEAD'):
        if route == 'export': return 'admin'
        if route in CONFIG_READS: return 'config'
        if route in READS or re.fullmatch(r'(day|attachments)/[^/]+', route): return 'operational'
    elif method == 'POST':
        if route in ADMIN_WRITES: return 'admin'
        if route == 'publication' or route in SHARED_WRITES or re.fullmatch(r'inbox/[^/]+/(accept|ignore|preview)', route): return 'operational'
    raise HTTPException(404, 'Operazione non disponibile.')


def main():
    parser = argparse.ArgumentParser(description='Gestione account Sosticero (nessuna password negli argomenti).')
    parser.add_argument('--database', required=True, type=Path)
    parser.add_argument('--testing', action='store_true')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('init'); sub.add_parser('list'); sub.add_parser('check')
    for command in ('create','bootstrap'):
        cmd = sub.add_parser(command); cmd.add_argument('username'); cmd.add_argument('--name',required=True)
        cmd.add_argument('--campus', choices=CAMPUSES); cmd.add_argument('--admin',action='store_true')
        if command == 'bootstrap': cmd.add_argument('--credential-file',type=Path)
    mapping = sub.add_parser('map-legacy'); mapping.add_argument('campus',choices=CAMPUSES); mapping.add_argument('username')
    for command in ('reset','rename','username','campus','permissions','enable','disable'):
        cmd = sub.add_parser(command); cmd.add_argument('username')
        if command in ('rename','username','campus'): cmd.add_argument('value')
        if command == 'permissions':
            cmd.add_argument('--admin',action='store_true'); cmd.add_argument('--campuses',nargs='*',choices=CAMPUSES,default=[])
    args = parser.parse_args()
    identities = Identities(args.database,args.testing)
    try:
        if args.command in ('create','bootstrap'):
            protected = args.command == 'bootstrap'
            if protected and any(a['protected'] for a in identities.list()):
                identities.require_admin(); return
            credential_file = args.credential_file if protected else None
            if credential_file:
                password = secrets.token_urlsafe(24)
                fd = os.open(credential_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
                with os.fdopen(fd,'w') as output: output.write(f'Username: {args.username}\nPassword: {password}\n')
            else:
                password = getpass.getpass('Password: ')
                if password != getpass.getpass('Ripeti password: '): raise ValueError('Le password non coincidono.')
            identities.create(args.username,args.name,args.campus,password,admin=protected or args.admin,protected=protected)
        elif args.command == 'check': identities.require_admin()
        elif args.command == 'map-legacy': identities.map_legacy(args.campus,args.username)
        elif args.command == 'list':
            for row in identities.list(): print(json.dumps(row,ensure_ascii=False))
        elif args.command == 'permissions':
            row = next((a for a in identities.list() if a['username']==args.username),None)
            if not row: raise ValueError('Account non trovato.')
            identities.update(row['id'], dict(revision=row['revision'],admin=args.admin,campuses=args.campuses))
        elif args.command != 'init':
            field = {'reset':'password','rename':'name','username':'username','campus':'campus','enable':'enabled','disable':'enabled'}[args.command]
            value = getpass.getpass('Nuova password: ') if args.command == 'reset' else (args.command == 'enable' if field=='enabled' else args.value)
            identities.change(args.username,field,value)
    except ValueError as exc: parser.error(str(exc))


def install(app, identities):
    from fastapi import Request
    from fastapi.responses import JSONResponse
    from starlette.concurrency import run_in_threadpool

    @app.middleware('http')
    async def protect(request: Request, call_next):
        if not request.url.path.startswith('/api/') or request.url.path == '/api/environment':
            return await call_next(request)
        gate = None
        try:
            secure = check_origin(request)
            request.state.secure_cookie = secure
            gate = await run_in_threadpool(identities.acquire, shared=request.method in ('GET', 'HEAD'))
            route = request.url.path.removeprefix('/api/')
            if route.startswith('teacher/'):
                allowed = {('teacher/auth/login', 'POST'), ('teacher/auth/session', 'GET'),
                           ('teacher/auth/logout', 'POST'), ('teacher/timetable', 'GET')}
                if (route, request.method) not in allowed:
                    raise HTTPException(404, 'Operazione non disponibile.')
                if route != 'teacher/auth/login':
                    user = teacher_access.TeacherAccess(identities).session(request.cookies.get(teacher_access.COOKIE))
                    request.state.teacher = user
                    if request.method == 'POST' and not secrets.compare_digest(request.headers.get('x-csrf-token', ''), user['csrf']):
                        raise HTTPException(403, 'Verifica di sicurezza scaduta. Accedi di nuovo.')
                response = await call_next(request)
                response.headers['Cache-Control'] = 'no-store'
                return response
            public_display = route == 'display' and request.method == 'GET'
            if route not in ('auth/login','auth/session') and not public_display:
                user = identities.session(request.cookies.get(COOKIE))
                request.state.account = user
                if request.method not in ('GET','HEAD'):
                    if not secrets.compare_digest(request.headers.get('x-csrf-token',''),user['csrf']):
                        raise HTTPException(403, 'Verifica di sicurezza scaduta. Accedi di nuovo.')
                if route != 'auth/logout':
                    permission = policy(request.url.path,request.method)
                    if permission == 'admin' and not user['admin']:
                        raise HTTPException(403, 'Operazione riservata agli amministratori.')
                    if permission == 'operational' and not user['campuses']:
                        raise HTTPException(403, 'Accesso operativo non assegnato.')
                    if permission == 'config' and not (user['admin'] or user['campuses']):
                        raise HTTPException(403, 'Accesso non assegnato.')
                    if request.method == 'POST':
                        generation = request.headers.get('x-data-generation')
                        if generation is None: raise HTTPException(428, 'Ricarica i dati prima di salvare.')
                        if generation != str(identities.generation()):
                            raise HTTPException(409, detail=dict(code='dataset_replaced',message='I dati sono stati importati o ripristinati. Ricarica e verifica il lavoro prima di salvare.'))
            response = await call_next(request)
            response.headers['X-Data-Generation'] = str(identities.generation())
            response.headers.setdefault('Cache-Control', 'no-store')
            return response
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code,content={'detail':exc.detail},headers={'Cache-Control':'no-store','X-Data-Generation':str(identities.generation())})
        finally:
            if gate: gate.close()

    @app.get('/api/auth/session')
    def current(request: Request):
        user = identities.session(request.cookies.get(COOKIE))
        return dict(account={k:user[k] for k in ACCOUNT_FIELDS},csrf=user['csrf'],generation=identities.generation())

    @app.post('/api/auth/login')
    def login(request: Request, data: dict):
        token = identities.login(data.get('username'),data.get('password'),request.client.host if request.client else 'local',request.cookies.get(COOKIE))
        user = identities.session(token)
        response = JSONResponse(dict(account={k:user[k] for k in ACCOUNT_FIELDS},csrf=user['csrf'],generation=identities.generation()))
        response.set_cookie(COOKIE,token,max_age=43200,httponly=True,secure=request.state.secure_cookie,samesite='lax',path='/')
        return response

    @app.post('/api/auth/logout')
    def logout(request: Request):
        identities.revoke(request.cookies.get(COOKIE))
        response = JSONResponse({'ok':True})
        response.delete_cookie(COOKIE,path='/')
        return response

    @app.get('/api/accounts')
    def accounts():
        return identities.list()

    @app.post('/api/accounts')
    def create_account(data: dict):
        if set(data) != {'username','name','admin','campuses','password'}: raise ValueError('Campi account non validi.')
        value = validate_account({**data,'enabled':True})
        return identities.create(value['username'],value['name'],None,data['password'],admin=value['admin'],campuses=value['campuses'],locked=True)

    @app.post('/api/accounts/{identifier}')
    def update_account(identifier: str, data: dict, request: Request):
        value = identities.update(identifier,data,locked=True)
        return dict(account=value, reauthenticate=identifier==request.state.account['id'])


if __name__ == '__main__': main()
