"""Google Form discovery and review; importing this module performs no I/O."""
import asyncio
from collections import Counter
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import json
import os
from pathlib import Path
import re
import tempfile
import threading
from urllib.parse import quote
from zoneinfo import ZoneInfo

from fastapi import HTTPException, Request
from . import timetables, teacher_names, attachments
from .domain import HOURS, absences

HEADERS = ['Informazioni cronologiche', 'Quale caso vuoi comunicare?', 'Nome del docente',
           "Giorno dell'assenza", 'Giorno INIZIO assenza (COMPRESO)', 'Giorno FINE assenza (COMPRESO)',
           "Giorno dell'assenza", 'Ore di assenza (seleziona tutte quelle rilevanti)']
CASES = ['Assenza di 1 giorno', 'Assenza su più giorni consecutivi',
         'Assenza (da NON recuperare) su ALCUNE ORE di un giorno']
MAX_KEY = 32768
TOKEN_URI = 'https://oauth2.googleapis.com/token'


def now():
    return datetime.now(ZoneInfo('Europe/Rome')).isoformat()


def credentials(info):
    try:
        from google.oauth2.service_account import Credentials
        if not isinstance(info, dict) or info.get('type') != 'service_account' or info.get('token_uri') != TOKEN_URI:
            raise ValueError()
        if not re.fullmatch(r'[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com', info.get('client_email', '')):
            raise ValueError()
        # Pass only the supported fields: uploaded config cannot redirect token exchange.
        return Credentials.from_service_account_info({k: info[k] for k in
            ('client_email', 'private_key', 'private_key_id', 'token_uri', 'type')},
            scopes=['https://www.googleapis.com/auth/spreadsheets.readonly'])
    except Exception:
        raise ValueError('JSON account di servizio non valido.') from None


def fetch_sheet(config, key):
    try:
        from google.auth.transport.requests import AuthorizedSession
        with AuthorizedSession(credentials(json.loads(key.read_text())), refresh_timeout=15) as session:
            cell_range = "'" + config['worksheet'].replace("'", "''") + "'!A:H"
            url = 'https://sheets.googleapis.com/v4/spreadsheets/' + config['spreadsheet'] + '/values/' + quote(cell_range, safe='')
            response = session.get(url, timeout=20, max_allowed_time=45, allow_redirects=False)
            if response.status_code != 200:
                raise ValueError()
            return response.json().get('values', [])
    except Exception:
        raise ValueError('Impossibile leggere Google Sheets. Verifica chiave, API abilitata e condivisione come Visualizzatore.') from None


def validate_matrix(matrix):
    if not isinstance(matrix, list) or not matrix or matrix[0] != HEADERS:
        raise ValueError('Colonne del modulo non riconosciute: verifica nome del foglio e intestazioni.')


def parse(row):
    try:
        if len(row) > 8:
            raise ValueError()
        v = (row + [''] * 8)[:8]
        stamp = datetime.strptime(v[0], '%d/%m/%Y %H.%M.%S').replace(tzinfo=ZoneInfo('Europe/Rome'))
        case = CASES.index(v[1])
        if not v[2].strip():
            raise ValueError()
        start = datetime.strptime(v[4] if case == 1 else v[6] if case == 2 else v[3], '%d/%m/%Y').date()
        end = datetime.strptime(v[5], '%d/%m/%Y').date() if case == 1 else start
        if end < start or (end - start).days > 366:
            raise ValueError()
        hours = sorted({int(x.strip()) for x in v[7].split(',')}) if case == 2 else HOURS
        if not hours or any(h not in HOURS for h in hours):
            raise ValueError()
        days = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)
                if (start + timedelta(days=i)).weekday() < 5]
        if not days:
            raise ValueError()
        return dict(submitted=stamp.isoformat(), name=v[2].strip(), case=v[1], start=start.isoformat(), end=end.isoformat(), days=days, hours=hours, error='')
    except (ValueError, TypeError, IndexError, AttributeError):
        return dict(error='Risposta non valida: verifica caso, data, intervallo (massimo un anno), giorni feriali e ore 1–7.')


class Inbox:
    def __init__(self, store, database, load, save_state, fetcher=None):
        self.store, self.load, self.save_state = store, load, save_state
        self.key = Path(database).parent / 'keys' / 'google-service-account.json'
        self.fetcher = fetcher or fetch_sheet
        self.lock = threading.RLock()
        self.wake = None
        self.initialize()

    def initialize(self):
        with self.store.connect() as db:
            db.execute('''CREATE TABLE IF NOT EXISTS inbox (
                id TEXT PRIMARY KEY, source TEXT NOT NULL, raw TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending', processed TEXT, teacher TEXT)''')

    def config(self, db):
        return self.store.read(db, 'googleSheets', {})

    def status(self):
        with self.store.connect() as db:
            config = self.config(db)
            email = ''
            if self.key.exists():
                try:
                    email = json.loads(self.key.read_text())['client_email']
                except (ValueError, KeyError, OSError):
                    pass
            return dict(**config, email=email, configured=bool(config and email),
                        pending=db.execute("SELECT COUNT(*) FROM inbox WHERE status='pending'").fetchone()[0],
                        received=db.execute("SELECT COUNT(*) FROM inbox").fetchone()[0],
                        **self.store.read(db, 'googleSheetsStatus', {}))

    def sync(self):
        with self.lock:
            with self.store.connect() as db:
                config = self.config(db)
            if not config or not self.key.exists():
                return True
            try:
                matrix = self.fetcher(config, self.key)
                validate_matrix(matrix)
                source = timetables.digest(config)
                counts = Counter()
                with self.store.connect() as db:
                    db.execute('BEGIN IMMEDIATE')
                    for row in matrix[1:]:
                        if not any(row):
                            continue
                        raw = [str(v).strip() for v in row]
                        raw += [''] * max(0, 8 - len(raw))
                        fingerprint = timetables.digest(raw)
                        counts[fingerprint] += 1
                        identifier = timetables.digest([source, fingerprint, counts[fingerprint]])
                        db.execute('INSERT OR IGNORE INTO inbox (id,source,raw) VALUES (?,?,?)',
                                   (identifier, source, json.dumps(raw)))
                    self.store.write(db, 'googleSheetsStatus', dict(lastSuccess=now(), error=''))
                return True
            except Exception as exc:
                safe = {'Colonne del modulo non riconosciute: verifica nome del foglio e intestazioni.',
                        'Impossibile leggere Google Sheets. Verifica chiave, API abilitata e condivisione come Visualizzatore.'}
                error = str(exc) if str(exc) in safe else 'Sincronizzazione non disponibile. Riprova più tardi.'
                with self.store.connect() as db:
                    status = self.store.read(db, 'googleSheetsStatus', {})
                    self.store.write(db, 'googleSheetsStatus', dict(status, error=error))
                return False

    @asynccontextmanager
    async def lifespan(self, app):
        self.wake = asyncio.Event()
        stop = asyncio.Event()

        async def poll():
            delay = 30
            while not stop.is_set():
                self.wake.clear()
                success = await asyncio.to_thread(self.sync)
                delay = 30 if success else min(delay * 2, 300)
                try:
                    await asyncio.wait_for(self.wake.wait(), timeout=delay)
                except TimeoutError:
                    pass
        task = asyncio.create_task(poll())
        try:
            yield
        finally:
            stop.set()
            self.wake.set()
            await task
            self.wake = None

    def item(self, db, identifier):
        row = db.execute('SELECT id,raw,status,processed,teacher FROM inbox WHERE id=?', (identifier,)).fetchone()
        if row is None:
            raise HTTPException(404, 'Comunicazione non trovata.')
        return dict(id=row[0], raw=json.loads(row[1]), status=row[2], processed=row[3], teacher=row[4])

    def preview(self, db, item, selected=None):
        result = dict(item, **parse(item['raw']))
        if result['error']:
            return result
        try:
            ds, state = self.load(db, result['days'][0])
            teachers = ds['teachers']
            labels = self.store.read(db, 'teacherNameOverrides', teacher_names.empty())
            matches = teacher_names.matches(teachers, labels, result['name'])
            display = teacher_names.teachers(teachers, labels)
            teacher = selected or item['teacher'] or (matches[0] if len(matches) == 1 else None)
            result.update(teacher=teacher, nameMatched=len(matches) == 1, teacherName=display.get(teacher, {}).get('name'),
                          teachers=[dict(id=i, name=t['name']) for i, t in sorted(display.items(), key=lambda p: p[1]['name'])])
            if teacher not in teachers:
                raise ValueError('Seleziona il docente: nome sconosciuto o ambiguo.')
            history = self.store.read(db, 'timetables')
            overlaps = []
            for day in result['days']:
                if teacher not in timetables.version(history, day)['dataset']['teachers']:
                    raise ValueError('Docente non attivo in data ' + day + '.')
                overlaps.append(dict(day=day, hours=sorted(set(absences(state, day).get(teacher, [])) & set(result['hours']))))
            result['overlaps'] = overlaps
        except ValueError as exc:
            result['error'] = str(exc)
        return result

    def register(self, app):
        app.router.lifespan_context = self.lifespan

        @app.get('/api/inbox/connection')
        @app.get('/api/inbox/summary')
        def status():
            return self.status()

        @app.post('/api/inbox/connection')
        async def configure(data: dict):
            source, worksheet = data.get('spreadsheet', ''), data.get('worksheet', '')
            if not isinstance(source, str) or not isinstance(worksheet, str):
                raise ValueError('Configurazione non valida.')
            match = re.fullmatch(r'https://docs\.google\.com/spreadsheets/d/([A-Za-z0-9_-]+)(?:/[^\s]*)?', source.strip())
            source = match[1] if match else source.strip()
            if not re.fullmatch(r'[A-Za-z0-9_-]{10,200}', source) or not 0 < len(worksheet.strip()) <= 100:
                raise ValueError('ID o URL del foglio e nome scheda non validi.')
            def save():
                with self.lock, self.store.connect() as db:
                    self.store.write(db, 'googleSheets', dict(spreadsheet=source, worksheet=worksheet.strip()))
                    self.store.write(db, 'googleSheetsStatus', {})
            await asyncio.to_thread(save)
            if self.wake:
                self.wake.set()
            return self.status()

        @app.post('/api/inbox/credentials')
        async def upload(request: Request):
            if request.headers.get('content-type', '').split(';')[0] != 'application/json':
                raise HTTPException(415, 'Carica un file JSON.')
            raw = bytearray()
            async for chunk in request.stream():
                if len(raw) + len(chunk) > MAX_KEY:
                    raise ValueError('File JSON troppo grande (massimo 32 KB).')
                raw.extend(chunk)
            try:
                info = json.loads(raw)
            except (ValueError, UnicodeDecodeError):
                raise ValueError('File JSON non valido.') from None
            credentials(info)
            def install():
                with self.lock:
                    self.key.parent.mkdir(mode=0o700, exist_ok=True)
                    os.chmod(self.key.parent, 0o700)
                    fd, name = tempfile.mkstemp(dir=self.key.parent)
                    try:
                        with os.fdopen(fd, 'w') as out:
                            json.dump(info, out)
                            out.flush()
                            os.fsync(out.fileno())
                        os.replace(name, self.key)
                    finally:
                        Path(name).unlink(missing_ok=True)
            await asyncio.to_thread(install)
            if self.wake:
                self.wake.set()
            return self.status()

        @app.post('/api/inbox/test')
        def test_connection():
            with self.lock:
                with self.store.connect() as db:
                    config = self.config(db)
                if not config or not self.key.exists():
                    raise ValueError('Salva il foglio e carica la chiave JSON.')
                validate_matrix(self.fetcher(config, self.key))
            return dict(ok=True)

        @app.get('/api/inbox')
        def listing(history: bool = False):
            with self.store.connect() as db:
                db.execute('BEGIN')
                ids = db.execute("SELECT id FROM inbox WHERE " + ("status!='pending'" if history else "status='pending'") + ' ORDER BY rowid DESC').fetchall()
                return [self.preview(db, self.item(db, r[0])) for r in ids]

        @app.post('/api/inbox/{identifier}/preview')
        def preview(identifier: str, data: dict):
            if data.get('teacher') is not None and not isinstance(data['teacher'], str):
                raise ValueError('Docente non valido.')
            with self.store.connect() as db:
                db.execute('BEGIN')
                return self.preview(db, self.item(db, identifier), data.get('teacher'))

        @app.post('/api/inbox/{identifier}/{action}')
        def process(identifier: str, action: str, data: dict):
            if action not in ('accept', 'ignore'):
                raise HTTPException(404)
            if data.get('teacher') is not None and not isinstance(data['teacher'], str):
                raise ValueError('Docente non valido.')
            with self.store.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                item = self.item(db, identifier)
                if item['status'] != 'pending':
                    if item['status'] == ('accepted' if action == 'accept' else 'ignored'):
                        return dict(ok=True, status=item['status'])
                    raise HTTPException(409, 'Comunicazione già elaborata. Aggiorna Inbox.')
                teacher = None
                if action == 'accept':
                    result = self.preview(db, item, data.get('teacher'))
                    if result['error']:
                        raise ValueError(result['error'])
                    if 'classification' in data and data['classification'] not in (None, 'planned', 'last_minute', 'trip', 'strike'):
                        raise ValueError('Classificazione non valida.')
                    if 'note' in data and not isinstance(data['note'], str):
                        raise ValueError('Note non valide.')
                    attachment = attachments.insert(db, data.get('attachment'))
                    teacher = result['teacher']
                    ds, state = self.load(db, result['days'][0])
                    changed = []
                    for day in result['days']:
                        old = state['abs'].get(day, {}).get(teacher, [])
                        hours = sorted(set(old) | set(result['hours']))
                        note = state['absenceNotes'].get(day, {}).get(teacher, '')
                        extra_note = data.get('note', '').strip()
                        if extra_note and extra_note not in note.splitlines():
                            note = '\n'.join(filter(None, [note, extra_note]))
                        if 'classification' in data:
                            state['absenceKinds'].get(day, {}).pop(teacher, None)
                            if data['classification']:
                                state['absenceKinds'].setdefault(day, {})[teacher] = data['classification']
                        if attachment:
                            state['absenceAttachments'].setdefault(day, {})[teacher] = attachment
                        marker = 'imported from sheet'
                        add_note = marker not in note.splitlines()
                        if hours != old:
                            state['abs'].setdefault(day, {})[teacher] = hours
                        if add_note or extra_note:
                            state['absenceNotes'].setdefault(day, {})[teacher] = '\n'.join(filter(None, [note, marker if add_note else '']))
                        if hours != old or add_note or extra_note or 'classification' in data or attachment:
                            changed.append(day)
                    if changed:
                        self.save_state(db, ds, state, changed)
                status = 'accepted' if action == 'accept' else 'ignored'
                db.execute('UPDATE inbox SET status=?,processed=?,teacher=? WHERE id=?', (status, now(), teacher, identifier))
                return dict(ok=True, status=status)
