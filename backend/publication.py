"""Durable campus publication; no import-time filesystem or database operations."""
import asyncio
import fcntl
import hashlib
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, time as clock, timedelta
from pathlib import Path
import threading
from uuid import uuid4
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from .cloudflare import Cloudflare, UploadError

CAMPUSES = ('centrale', 'succursale')
ROME = ZoneInfo('Europe/Rome')


def encoded(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


class Publisher:
    def __init__(self, root, shell, capture, schedule=None):
        self.root, self.shell, self.capture = Path(root), Path(shell), capture
        self.schedule = schedule
        self.cloud = Cloudflare()

    def read(self):
        try:
            return json.loads((self.root / 'state.json').read_text())
        except FileNotFoundError:
            return {'committed': {c: {'campus': c, 'unavailable': True} for c in CAMPUSES}, 'pending': None, 'error': None}

    def save(self, state):
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        temporary = self.root / ('state-' + uuid4().hex)
        try:
            with temporary.open('xb') as stream:
                os.chmod(temporary, 0o600)
                stream.write(encoded(state)); stream.flush(); os.fsync(stream.fileno())
            os.replace(temporary, self.root / 'state.json')
            fd = os.open(self.root, os.O_DIRECTORY)
            try: os.fsync(fd)
            finally: os.close(fd)
        finally:
            temporary.unlink(missing_ok=True)

    def lock(self):
        self.root.mkdir(mode=0o700, parents=True, exist_ok=True)
        fd = os.open(self.root / 'publish.lock', os.O_CREAT | os.O_RDWR, 0o600)
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return fd
        except BlockingIOError:
            os.close(fd)
            return None

    def unlock(self, fd):
        fcntl.flock(fd, fcntl.LOCK_UN); os.close(fd)

    def files(self, snapshots, release):
        files = {str(p.relative_to(self.shell)): p.read_bytes() for p in self.shell.rglob('*') if p.is_file()}
        html = files.pop('publication.html')
        files['index.html'] = html
        files['display/index.html'] = html
        for campus in CAMPUSES:
            files[campus + '.json'] = encoded(snapshots[campus])
        files['release.json'] = encoded({'release': release, 'hashes': {
            c: hashlib.sha256(files[c + '.json']).hexdigest() for c in CAMPUSES}})
        files['_headers'] = b'/*\n  Cache-Control: no-store\n'
        return files

    def promote(self, state):
        state['committed'] = state['pending']['snapshots']
        state['pending'] = None
        state['error'] = None
        self.save(state)

    def reconcile(self, state):
        pending = state['pending']
        if not pending: return
        if pending['phase'] == 'prepared':
            state['pending'] = None
            state['error'] = 'Pubblicazione interrotta prima dell’invio. Premi Pubblica per riprovare.'
            self.save(state)
        elif self.cloud.verify(self.files(pending['snapshots'], pending['release']), pending['release'], seconds=0):
            self.promote(state)
        elif self.cloud.deployment_failed(pending):
            state['pending'] = None
            state['error'] = 'Pubblicazione Cloudflare non riuscita. Premi Pubblica per riprovare.'
            self.save(state)

    def status(self, campus):
        fd = self.lock()
        busy = fd is None
        try:
            state = self.read()
            if fd is not None and state['pending'] and self.cloud.configured:
                # Recovery performs bounded reads only; never replays an upload.
                try: self.reconcile(state)
                except UploadError: pass
            pending = state['pending']
            snapshot = state['committed'][campus]
            return dict(configured=self.cloud.configured and (self.shell / 'publication.html').is_file(),
                busy=busy, uncertain=bool(pending and not busy), error=state['error'],
                updated=snapshot.get('updated'), day=snapshot.get('day'), campus=campus,
                url=self.cloud.url + '/display?campus=' + campus)
        finally:
            if fd is not None: self.unlock(fd)

    def start(self, day, campus, auto=False):
        if campus not in CAMPUSES: raise HTTPException(403, 'Sede non autorizzata.')
        if not self.cloud.configured or not (self.shell / 'publication.html').is_file():
            raise HTTPException(503, 'Pubblicazione non configurata sul server.')
        fd = self.lock()
        if fd is None: raise HTTPException(409, 'Pubblicazione in corso. Riprova tra poco.')
        try:
            state = self.read()
            self.reconcile(state)
            if state['pending']:
                raise HTTPException(409, 'Esito precedente da verificare. Attendi e aggiorna lo stato.')
            release = uuid4().hex
            snapshots = dict(state['committed'])
            for target in CAMPUSES if auto else (campus,):
                snapshot = self.capture(day, target)
                snapshot['publication'] = release
                snapshots[target] = snapshot
            state['pending'] = dict(release=release, snapshots=snapshots, campus=campus, phase='prepared')
            state['error'] = None
            self.save(state)
            thread = threading.Thread(target=self.run, args=(state, fd), daemon=True)
            thread.start()
        except BaseException:
            self.unlock(fd)
            raise

    def due(self, now):
        """A daily run is due after the configured Rome time until both campuses are fresh."""
        time = self.schedule() if self.schedule else ''
        if not time: return False
        hour, minute = map(int, time.split(':'))
        if now.time() < clock(hour, minute): return False
        state = self.read()
        for campus in CAMPUSES:
            try:
                updated = datetime.fromisoformat(state['committed'][campus]['updated'])
            except (KeyError, TypeError, ValueError):
                return True
            if updated.date() != now.date() or updated.time() < clock(hour, minute):
                return True
        return False

    @asynccontextmanager
    async def lifespan(self, app):
        stop = asyncio.Event()

        async def poll():
            last = None
            while not stop.is_set():
                now = datetime.now(ROME)
                try:
                    if self.due(now) and (last is None or now - last >= timedelta(minutes=15)):
                        last = now
                        await asyncio.to_thread(self.start, now.date().isoformat(), 'centrale', True)
                except Exception:
                    pass
                try:
                    await asyncio.wait_for(stop.wait(), timeout=30)
                except TimeoutError:
                    pass

        task = asyncio.create_task(poll())
        try:
            yield
        finally:
            stop.set()
            await task

    def register(self, app):
        previous = app.router.lifespan_context

        @asynccontextmanager
        async def lifespan(app):
            async with previous(app):
                async with self.lifespan(app):
                    yield

        app.router.lifespan_context = lifespan

    def run(self, state, fd):
        pending = state['pending']
        try:
            files = self.files(pending['snapshots'], pending['release'])
            def activating():
                pending['phase'] = 'activating'
                self.save(state)
            pending['deployment'] = self.cloud.upload(files, pending['release'], activating)
            self.save(state)
            if not self.cloud.verify(files, pending['release']):
                raise UploadError('La nuova versione non è ancora verificabile sul sito pubblico.')
            self.promote(state)
        except Exception:
            # Never expose provider responses, tokens or snapshot contents in logs/status.
            if pending['phase'] == 'prepared':
                state['pending'] = None
                state['error'] = 'Invio non riuscito. Verifica connessione e credenziali; puoi riprovare.'
            else:
                state['error'] = 'Esito da verificare: il sito potrebbe essere aggiornato. Aggiorna lo stato prima di riprovare.'
            self.save(state)
        finally:
            self.unlock(fd)
