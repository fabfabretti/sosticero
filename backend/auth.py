"""Local identities, revocable sessions and a cross-process publication gate."""
import argparse
from contextlib import contextmanager, closing
import getpass
import hashlib
import ipaddress
import os
from pathlib import Path
import re
import secrets
import sqlite3
import time
from urllib.parse import urlsplit
from uuid import uuid4

from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import HTTPException

HASHER = PasswordHasher(time_cost=2, memory_cost=19456, parallelism=1)
COOKIE = 'sosticero_session'
CENTRALE_WRITES = {'hour-types', 'receptions', 'receptions/preview', 'timetable', 'timetable/preview', 'import', 'import/preview', 'backups', 'backups/restore', 'inbox/connection', 'inbox/credentials', 'inbox/test'}
SHARED_WRITES = {'paid-availability', 'entries', 'assignments', 'permessi', 'manual-permits', 'orari/name', 'orari/preview', 'orari/override'}
READS = {'paid-availability', 'hour-types', 'stats', 'stats/availability', 'orari', 'receptions', 'permessi', 'candidates', 'availability', 'export', 'backups', 'inbox', 'inbox/connection', 'inbox/summary'}
PUBLICATIONS = {'timetable', 'receptions', 'import', 'backups/restore'}


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

    def create(self, username, name, campus, password):
        username = username.strip().lower()
        if not re.fullmatch(r'[a-z0-9_.-]{1,64}', username) or not isinstance(name, str) or not 1 <= len(name.strip()) <= 100 or campus not in ('centrale', 'succursale'):
            raise ValueError('Nome utente, nome visualizzato o sede non validi.')
        hashed = password_hash(password)
        with self.gate(), self.connect() as db:
            try:
                db.execute('INSERT INTO accounts VALUES (?,?,?,?,?,1)', (uuid4().hex, username, name.strip(), campus, hashed))
            except sqlite3.IntegrityError:
                raise ValueError('Nome utente già presente.') from None

    def change(self, username, field, value):
        if field not in ('name', 'password', 'campus', 'enabled'):
            raise ValueError('Campo non valido.')
        if field == 'password': value = password_hash(value)
        if field == 'campus' and value not in ('centrale', 'succursale'): raise ValueError('Sede non valida.')
        if field == 'name':
            if not isinstance(value, str) or not 1 <= len(value.strip()) <= 100: raise ValueError('Nome non valido.')
            value = value.strip()
        with self.gate(), self.connect() as db:
            row = db.execute('SELECT id FROM accounts WHERE username=?', (username.strip().lower(),)).fetchone()
            if not row: raise ValueError('Account non trovato.')
            db.execute(f'UPDATE accounts SET {field}=? WHERE id=?', (value, row['id']))
            db.execute('DELETE FROM sessions WHERE account=?', (row['id'],))

    def session(self, token):
        with self.connect() as db:
            row = db.execute('''SELECT a.id,a.username,a.name,a.campus,s.csrf,s.expires FROM sessions s JOIN accounts a ON a.id=s.account
                WHERE s.token=? AND s.expires>? AND a.enabled=1''', (self.token_hash(token), time.time())).fetchone()
        if not row: raise HTTPException(401, 'Accesso richiesto.')
        return dict(row)

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
    if method in ('GET', 'HEAD'):
        if route == 'export': return 'centrale'
        if route in READS or re.fullmatch(r'(day|attachments)/[^/]+', route): return 'read'
    elif method == 'POST':
        if route in CENTRALE_WRITES: return 'centrale'
        if route in SHARED_WRITES or re.fullmatch(r'inbox/[^/]+/(accept|ignore|preview)', route): return 'shared'
    raise HTTPException(404, 'Operazione non disponibile.')


def main():
    parser = argparse.ArgumentParser(description='Gestione locale account Sosticero (nessuna password negli argomenti).')
    parser.add_argument('--database', required=True, type=Path)
    parser.add_argument('--testing', action='store_true')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('init'); sub.add_parser('list')
    create = sub.add_parser('create'); create.add_argument('username'); create.add_argument('--name', required=True); create.add_argument('--campus', required=True, choices=['centrale','succursale'])
    for command in ('reset','rename','campus','enable','disable'):
        cmd = sub.add_parser(command); cmd.add_argument('username')
        if command in ('rename','campus'): cmd.add_argument('value')
    args = parser.parse_args()
    identities = Identities(args.database, args.testing)
    try:
        if args.command == 'create':
            password = getpass.getpass('Password: ')
            if password != getpass.getpass('Ripeti password: '): raise ValueError('Le password non coincidono.')
            identities.create(args.username,args.name,args.campus,password)
        elif args.command == 'list':
            with identities.connect() as db:
                for row in db.execute('SELECT username,name,campus,enabled FROM accounts ORDER BY username'): print('\t'.join(map(str,row)))
        elif args.command != 'init':
            field = {'reset':'password','rename':'name','campus':'campus','enable':'enabled','disable':'enabled'}[args.command]
            value = getpass.getpass('Nuova password: ') if args.command == 'reset' else (args.command == 'enable' if field == 'enabled' else args.value)
            identities.change(args.username,field,value)
    except ValueError as exc: parser.error(str(exc))


if __name__ == '__main__': main()


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
            public_display = route == 'display' and request.method == 'GET'
            if route not in ('auth/login','auth/session') and not public_display:
                user = identities.session(request.cookies.get(COOKIE))
                request.state.account = user
                if request.method not in ('GET','HEAD'):
                    if not secrets.compare_digest(request.headers.get('x-csrf-token',''),user['csrf']):
                        raise HTTPException(403, 'Verifica di sicurezza scaduta. Accedi di nuovo.')
                if route != 'auth/logout':
                    permission = policy(request.url.path,request.method)
                    if permission == 'centrale' and user['campus'] != 'centrale':
                        raise HTTPException(403, 'Operazione riservata alla sede Centrale.')
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
        return dict(account={k:user[k] for k in ('id','username','name','campus')},csrf=user['csrf'],generation=identities.generation())

    @app.post('/api/auth/login')
    def login(request: Request, data: dict):
        token = identities.login(data.get('username'),data.get('password'),request.client.host if request.client else 'local',request.cookies.get(COOKIE))
        user = identities.session(token)
        response = JSONResponse(dict(account={k:user[k] for k in ('id','username','name','campus')},csrf=user['csrf'],generation=identities.generation()))
        response.set_cookie(COOKIE,token,max_age=43200,httponly=True,secure=request.state.secure_cookie,samesite='lax',path='/')
        return response

    @app.post('/api/auth/logout')
    def logout(request: Request):
        identities.revoke(request.cookies.get(COOKIE))
        response = JSONResponse({'ok':True})
        response.delete_cookie(COOKIE,path='/')
        return response
