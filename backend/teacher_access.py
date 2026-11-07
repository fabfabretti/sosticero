"""Personal teacher credentials; never grants office access."""
import re
import secrets
import time
from uuid import uuid4
from fastapi import HTTPException
from argon2.exceptions import VerificationError, InvalidHashError

COOKIE = 'sosticero_teacher'
COOKIE_PATH = '/api/teacher'


def initialize(db):
    db.executescript('''
        CREATE TABLE IF NOT EXISTS teacher_accounts (
            id TEXT PRIMARY KEY, person TEXT UNIQUE NOT NULL, email TEXT NOT NULL DEFAULT '',
            pin TEXT, enabled INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 1);
        CREATE UNIQUE INDEX IF NOT EXISTS teacher_email ON teacher_accounts(email) WHERE email<>'';
        CREATE TABLE IF NOT EXISTS teacher_sessions (
            token TEXT PRIMARY KEY, account TEXT NOT NULL, csrf TEXT NOT NULL, expires REAL NOT NULL);
    ''')


def metadata(row):
    return dict(person=row['person'], email=row['email'], enabled=bool(row['enabled']),
                hasPin=bool(row['pin']), revision=row['revision'])


class TeacherAccess:
    def __init__(self, identities):
        self.identities = identities

    def list(self):
        with self.identities.connect() as db:
            return {r['person']: metadata(r) for r in db.execute('SELECT * FROM teacher_accounts')}

    def save(self, rows, people):
        if not isinstance(rows, list) or len(rows) > 2000:
            raise ValueError('Elenco accessi non valido.')
        with self.identities.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            existing = {r['person']: dict(r) for r in db.execute('SELECT * FROM teacher_accounts')}
            proposed, seen = {}, set()
            for value in rows:
                if not isinstance(value, dict) or set(value) != {'person', 'email', 'enabled', 'revision'}:
                    raise ValueError('Campi accesso docente non validi.')
                person = value['person']
                if not isinstance(person, str) or person not in people or person in seen:
                    raise ValueError('Docente non valido o ripetuto.')
                seen.add(person)
                old = existing.get(person)
                if type(value['revision']) is not int or value['revision'] != (old['revision'] if old else 0):
                    raise HTTPException(409, f"{people[person]['name']}: accesso modificato. Ricarica e verifica le modifiche.")
                if not isinstance(value['email'], str) or type(value['enabled']) is not bool:
                    raise ValueError(f"{people[person]['name']}: email o stato non valido.")
                email = value['email'].strip().casefold()
                if email and (len(email) > 254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email)):
                    raise ValueError(f"{people[person]['name']}: email non valida.")
                if value['enabled'] and (not email or not old or not old['pin']):
                    raise ValueError(f"{people[person]['name']}: salva un’email e genera il PIN prima di attivare l’accesso.")
                proposed[person] = dict(email=email, enabled=value['enabled'])
            emails = {}
            for person in set(existing) | set(proposed):
                email = proposed.get(person, existing.get(person))['email']
                if email:
                    if email in emails:
                        names = [people.get(i, {}).get('name', i) for i in (person, emails[email])]
                        raise ValueError('Email già utilizzata: ' + ', '.join(names))
                    emails[email] = person
            # Release unique values first so an atomic batch can swap addresses.
            for person in proposed:
                db.execute("UPDATE teacher_accounts SET email='' WHERE person=?", (person,))
            for person, value in proposed.items():
                old = existing.get(person)
                if old:
                    db.execute('UPDATE teacher_accounts SET email=?,enabled=?,revision=revision+1 WHERE person=?',
                               (value['email'], value['enabled'], person))
                    if old['email'] != value['email'] or bool(old['enabled']) != value['enabled']:
                        db.execute('DELETE FROM teacher_sessions WHERE account=?', (old['id'],))
                else:
                    db.execute('INSERT INTO teacher_accounts(id,person,email,enabled) VALUES (?,?,?,?)',
                               (uuid4().hex, person, value['email'], value['enabled']))
        return self.list()

    def issue(self, person, revision):
        from .auth import HASHER
        pin = f'{secrets.randbelow(100000000):08d}'
        hashed = HASHER.hash(pin)
        with self.identities.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            row = db.execute('SELECT * FROM teacher_accounts WHERE person=?', (person,)).fetchone()
            if not row or not row['email']: raise ValueError('Salva prima l’email di accesso.')
            if type(revision) is not int or row['revision'] != revision:
                raise HTTPException(409, 'Accesso modificato: ricarica prima di generare il PIN.')
            db.execute('UPDATE teacher_accounts SET pin=?,revision=revision+1 WHERE person=?', (hashed, person))
            db.execute('DELETE FROM teacher_sessions WHERE account=?', (row['id'],))
        return dict(pin=pin, account=self.list()[person])

    def activate(self, rows, enabled, people):
        """Apply access changes atomically; activation creates only missing PINs."""
        from .auth import HASHER
        if type(enabled) is not bool or not isinstance(rows, list) or not 1 <= len(rows) <= 2000:
            raise ValueError('Seleziona almeno un docente.')
        pins = []
        with self.identities.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            selected, seen = [], set()
            for value in rows:
                if not isinstance(value, dict) or set(value) != {'person', 'revision'}:
                    raise ValueError('Selezione docenti non valida.')
                person = value['person']
                if not isinstance(person, str) or person not in people or person in seen:
                    raise ValueError('Docente non valido o ripetuto.')
                seen.add(person)
                row = db.execute('SELECT * FROM teacher_accounts WHERE person=?', (person,)).fetchone()
                if not row or type(value['revision']) is not int or row['revision'] != value['revision']:
                    raise HTTPException(409, 'Accessi modificati: ricarica e verifica la selezione.')
                if enabled and not row['email']:
                    raise ValueError(f"{people[person]['name']}: inserisci prima l’email.")
                selected.append(row)
            for row in selected:
                hashed = row['pin']
                if enabled and not hashed:
                    pin = f'{secrets.randbelow(100000000):08d}'
                    hashed = HASHER.hash(pin)
                    pins.append(dict(person=row['person'], name=people[row['person']]['name'], email=row['email'], pin=pin))
                if bool(row['enabled']) != enabled or hashed != row['pin']:
                    db.execute('UPDATE teacher_accounts SET enabled=?,pin=?,revision=revision+1 WHERE person=?',
                               (enabled, hashed, row['person']))
                    db.execute('DELETE FROM teacher_sessions WHERE account=?', (row['id'],))
        return dict(accounts=self.list(), pins=pins)

    def session(self, token):
        with self.identities.connect() as db:
            row = db.execute('''SELECT a.id,a.person,a.email,s.csrf FROM teacher_sessions s
                JOIN teacher_accounts a ON a.id=s.account
                WHERE s.token=? AND s.expires>? AND a.enabled=1''',
                (self.identities.token_hash(token), time.time())).fetchone()
        if not row: raise HTTPException(401, 'Accesso richiesto.')
        return dict(row)

    def revoke(self, token):
        with self.identities.connect() as db:
            db.execute('DELETE FROM teacher_sessions WHERE token=?', (self.identities.token_hash(token),))

    def login(self, email, pin, address, previous=None):
        from .auth import HASHER
        if not isinstance(email, str) or not isinstance(pin, str) or len(email) > 254 or len(pin) > 256:
            raise HTTPException(401, 'Credenziali non valide.')
        email = email.strip().casefold()
        pin = pin.strip()
        keys = [self.identities.token_hash('teacher:user:' + email), self.identities.token_hash('teacher:ip:' + address)]
        now = time.time()
        # Reserve attempts before hashing so parallel requests cannot bypass the limits.
        with self.identities.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            db.execute('DELETE FROM attempts WHERE until<?', (now,))
            db.execute('DELETE FROM teacher_sessions WHERE expires<?', (now,))
            for key, limit in zip(keys, (5, 30)):
                row = db.execute('SELECT count FROM attempts WHERE key=?', (key,)).fetchone()
                if row and row['count'] >= limit:
                    raise HTTPException(429, 'Troppi tentativi. Riprova tra 15 minuti.')
            if db.execute('SELECT COUNT(*) FROM attempts').fetchone()[0] >= 10000:
                raise HTTPException(429, 'Troppi tentativi. Riprova più tardi.')
            for key in keys:
                db.execute('INSERT INTO attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', (key, now+900))
            account = db.execute('SELECT * FROM teacher_accounts WHERE email=?', (email,)).fetchone()
        try:
            valid = HASHER.verify(account['pin'] if account and account['pin'] else self.identities.dummy, pin)
        except (VerificationError, InvalidHashError): valid = False
        if not valid or not re.fullmatch(r'[0-9]{8}', pin) or not account or not account['enabled']:
            raise HTTPException(401, 'Credenziali non valide.')
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        with self.identities.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            current = db.execute('SELECT * FROM teacher_accounts WHERE id=?', (account['id'],)).fetchone()
            if not current or current['revision'] != account['revision'] or not current['enabled']:
                raise HTTPException(401, 'Credenziali non valide.')
            db.execute('DELETE FROM teacher_sessions WHERE token=?', (self.identities.token_hash(previous),))
            db.execute('DELETE FROM attempts WHERE key=?', (keys[0],))
            db.execute('UPDATE attempts SET count=MAX(0,count-1) WHERE key=?', (keys[1],))
            db.execute('INSERT INTO teacher_sessions VALUES (?,?,?,?)',
                       (self.identities.token_hash(token), account['id'], csrf, now+43200))
        return token
