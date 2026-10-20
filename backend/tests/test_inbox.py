import asyncio
from concurrent.futures import ThreadPoolExecutor
import copy
import importlib
import json
from pathlib import Path
import stat
import tempfile
import threading
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from backend.main import create_app
from backend.inbox import HEADERS, CASES, parse, fetch_sheet, credentials
from backend.storage import Store
from backend import backup, timetables
from backend.tests.test_app import fixture, DAY
from backend.tests.test_attachments import image


def key_info():
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    return dict(type='service_account', client_email='reader@project.iam.gserviceaccount.com',
                private_key_id='test-key', token_uri='https://oauth2.googleapis.com/token',
                private_key=private.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                                 serialization.NoEncryption()).decode())


def response(case=0, name='absent', day='12/10/2026', end='13/10/2026', hours='1, 2'):
    return ['16/10/2026 10.10.54', CASES[case], name, day if case == 0 else '',
            day if case == 1 else '', end if case == 1 else '', day if case == 2 else '', hours if case == 2 else '']


class InboxTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.info = key_info()

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'db.sqlite'
        self.app = create_app(self.path)
        self.client = TestClient(self.app)
        self.inbox = self.app.state.inbox
        self.client.post('/api/timetable', json=fixture()).raise_for_status()
        self.matrix = [HEADERS, response()]
        self.inbox.fetcher = lambda config, key: copy.deepcopy(self.matrix)

    def configure(self):
        self.client.post('/api/inbox/credentials', content=json.dumps(self.info), headers={'Content-Type': 'application/json'}).raise_for_status()
        self.client.post('/api/inbox/connection', json=dict(spreadsheet='test_sheet_123', worksheet='Risposte del modulo 1')).raise_for_status()

    def discover(self):
        self.configure()
        self.assertTrue(self.inbox.sync())
        return self.client.get('/api/inbox').json()

    def state(self):
        return self.client.get('/api/export').json()

    def action(self, item, action='accept', **data):
        return self.client.post('/api/inbox/' + item['id'] + '/' + action, json=data)

    def test_key_validation_permissions_and_safe_errors(self):
        self.configure()
        original = self.inbox.key.read_bytes()
        for bad in ('{', '{}', json.dumps(dict(self.info, token_uri='http://127.0.0.1/private')),
                    json.dumps(dict(self.info, private_key='secret-but-invalid')), 'x' * 32769):
            r = self.client.post('/api/inbox/credentials', content=bad, headers={'Content-Type': 'application/json'})
            self.assertEqual(r.status_code, 422)
            self.assertNotIn('secret-but-invalid', r.text)
            self.assertEqual(self.inbox.key.read_bytes(), original)
        self.assertEqual(stat.S_IMODE(self.inbox.key.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.inbox.key.parent.stat().st_mode), 0o700)
        for url in ('/api/inbox/summary', '/api/inbox/connection', '/api/export'):
            text = self.client.get(url).text
            self.assertNotIn('PRIVATE KEY', text)
        self.assertEqual(self.client.post('/api/inbox/connection', json=dict(spreadsheet='http://localhost/private', worksheet='x')).status_code, 422)
        self.client.post('/api/inbox/connection', json=dict(spreadsheet='https://docs.google.com/spreadsheets/d/valid_sheet_123/edit?usp=sharing', worksheet='x')).raise_for_status()
        self.assertEqual(self.inbox.status()['spreadsheet'], 'valid_sheet_123')

    def test_transport_is_read_only_and_errors_are_redacted(self):
        self.configure()
        with patch('google.auth.transport.requests.AuthorizedSession') as session:
            get = session.return_value.__enter__.return_value.get
            get.return_value.status_code = 200
            get.return_value.json.return_value = dict(values=self.matrix)
            self.assertEqual(fetch_sheet(dict(spreadsheet='test_sheet_123', worksheet="O'Brien"), self.inbox.key), self.matrix)
            self.assertIn('sheets.googleapis.com/v4/spreadsheets/test_sheet_123/values/', get.call_args.args[0])
            self.assertFalse(get.call_args.kwargs['allow_redirects'])
            cred = session.call_args.args[0]
            self.assertEqual(cred.scopes, ['https://www.googleapis.com/auth/spreadsheets.readonly'])
            get.side_effect = RuntimeError('PRIVATE KEY sensitive body')
            with self.assertRaisesRegex(ValueError, 'Impossibile leggere') as exc:
                fetch_sheet(dict(spreadsheet='test_sheet_123', worksheet='x'), self.inbox.key)
            self.assertNotIn('sensitive', str(exc.exception))
        self.client.post('/api/inbox/test', json={}).raise_for_status()
        self.assertEqual(self.inbox.status()['pending'], 0)

    def test_discovery_survives_deletion_reordering_duplicates_restart_and_source_change(self):
        self.matrix = [HEADERS, response(), response(), response(name='co'), response(day='01/01/2020')]
        items = self.discover()
        self.assertEqual(len(items), 4)
        self.assertEqual(self.inbox.status()['received'], 4)
        self.action(items[0], 'ignore').raise_for_status()
        self.assertEqual(self.inbox.status()['received'], 4)
        self.matrix = [HEADERS, response(name='co'), response(), response(name='blank')]
        self.inbox.sync()
        self.assertEqual(len(self.client.get('/api/inbox').json()), 4)
        reopened = create_app(self.path).state.inbox
        reopened.fetcher = self.inbox.fetcher
        self.assertTrue(reopened.sync())
        self.assertEqual(reopened.status()['pending'], 4)
        self.assertEqual(self.state()['abs'], {})
        self.client.post('/api/inbox/connection', json=dict(spreadsheet='other_sheet_123', worksheet='x')).raise_for_status()
        self.inbox.sync()
        self.assertEqual(self.inbox.status()['pending'], 7)

    def test_parse_cases_weekends_and_malformed_rows(self):
        for case in range(3):
            p = parse(response(case))
            self.assertFalse(p['error'])
            self.assertEqual(p['hours'], [1, 2] if case == 2 else list(range(1, 8)))
        p = parse(response(1, day='09/10/2026', end='19/10/2026'))
        self.assertEqual(len(p['days']), 7)
        for row in (response(1, end='11/10/2026'), response(day='31/02/2026'), response(2, hours='0, 8'),
                    response(2, hours='1.5'), response(1, end='13/10/2028'), response(day='11/10/2026'),
                    response(name=''), ['bad'], response() + ['extra']):
            self.assertTrue(parse(row)['error'], row)
        hourly = response(2, day='14/10/2026'); hourly[3] = '12/10/2026'
        self.assertEqual(parse(hourly)['start'], '2026-10-14')
        self.matrix = [HEADERS, ['malformed']]
        item = self.discover()[0]
        self.assertTrue(item['error'])
        self.assertEqual(self.action(item).status_code, 422)
        self.action(item, 'ignore').raise_for_status()

    def test_additive_acceptance_preserves_metadata_and_manual_corrections(self):
        self.matrix = [HEADERS, response(2, hours='1, 2, 3')]
        item = self.discover()[0]
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2, 4], note='keep', classification='planned', attachment=image())).raise_for_status()
        self.client.post('/api/permessi', json=dict(day=DAY, id='absent', hours=[1])).raise_for_status()
        permits = self.state()['permessi']
        attachment = self.state()['absenceAttachments'][DAY]['absent']
        preview = self.action(item, 'preview').json()
        self.assertEqual(preview['overlaps'][0]['hours'], [1, 2])
        self.action(item).raise_for_status()
        state = self.state()
        self.assertEqual(state['abs'][DAY]['absent'], [1, 2, 3, 4])
        self.assertEqual(state['absenceNotes'][DAY]['absent'], 'keep\nimported from sheet')
        self.assertEqual(state['absenceKinds'][DAY]['absent'], 'planned')
        self.assertEqual(state['permessi'], permits)
        self.assertEqual(state['absenceAttachments'][DAY]['absent'], attachment)
        facts = state['statistics']
        self.action(item).raise_for_status()
        self.assertEqual(self.state()['statistics'], facts)
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[4])).raise_for_status()
        self.inbox.sync()
        self.action(item).raise_for_status()
        self.assertEqual(self.state()['abs'][DAY]['absent'], [4])
        self.assertEqual(len(self.client.get('/api/inbox?history=true').json()), 1)

    def test_acceptance_metadata_applies_to_range_and_is_idempotent(self):
        self.matrix = [HEADERS, response(1)]
        item = self.discover()[0]
        data = dict(classification='trip', note='Bring documents', attachment=image())
        self.action(item, **data).raise_for_status()
        state = self.state()
        for day in item['days']:
            self.assertEqual(state['absenceKinds'][day]['absent'], 'trip')
            self.assertEqual(state['absenceNotes'][day]['absent'], 'Bring documents\nimported from sheet')
            identifier = state['absenceAttachments'][day]['absent']
            self.client.get('/api/attachments/' + identifier).raise_for_status()
        self.action(item, **data).raise_for_status()
        self.assertEqual(self.state(), state)

    def test_invalid_acceptance_metadata_rolls_back(self):
        item = self.discover()[0]
        before = self.state()
        for data in [dict(classification='bad'), dict(note=123), dict(attachment={'mediaType': 'image/png', 'data': 'bad'})]:
            self.assertEqual(self.action(item, **data).status_code, 422)
            self.assertEqual(self.state(), before)
            self.assertEqual(self.client.get('/api/inbox').json()[0]['status'], 'pending')

    def test_import_note_is_added_once_even_when_hours_already_exist(self):
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=list(range(1, 8)))).raise_for_status()
        item = self.discover()[0]
        self.action(item).raise_for_status()
        self.assertEqual(self.state()['absenceNotes'][DAY]['absent'], 'imported from sheet')
        self.matrix.append(response())
        self.matrix[-1][0] = '16/10/2026 11.00.00'
        self.inbox.sync()
        self.action(self.client.get('/api/inbox').json()[0]).raise_for_status()
        self.assertEqual(self.state()['absenceNotes'][DAY]['absent'], 'imported from sheet')

    def test_unknown_ambiguous_and_inactive_teacher_resolution_atomicity(self):
        self.matrix = [HEADERS, response(name='Not Known')]
        item = self.discover()[0]
        self.assertIn('Seleziona', item['error'])
        self.assertEqual(self.action(item).status_code, 422)
        self.assertFalse(self.action(item, 'preview', teacher='absent').json()['error'])
        self.action(item, teacher='absent').raise_for_status()
        self.matrix = [HEADERS, response(1)]
        self.inbox.sync()
        item = self.client.get('/api/inbox').json()[0]
        with self.inbox.store.connect() as db:
            history = self.inbox.store.read(db, 'timetables')
            ds = copy.deepcopy(history['versions'][0]['dataset'])
            ds['teachers'].pop('absent')
            history['versions'].append(dict(id='later', effective='2026-10-13', dataset=ds))
            self.inbox.store.write(db, 'timetables', history)
        before = self.state()['abs']
        self.assertEqual(self.action(item).status_code, 422)
        self.assertEqual(self.state()['abs'], before)
        with self.inbox.store.connect() as db:
            history['versions'].pop()
            history['versions'][0]['dataset']['teachers']['co']['name'] = 'absent'
            self.inbox.store.write(db, 'timetables', history)
        self.assertIn('ambiguo', self.action(item, 'preview').json()['error'])

    def test_concurrent_acceptance_ignore_and_rollback(self):
        item = self.discover()[0]
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses = list(pool.map(lambda _: self.action(item).status_code, range(2)))
        self.assertEqual(statuses, [200, 200])
        self.assertEqual(self.state()['abs'][DAY]['absent'], list(range(1, 8)))
        self.matrix.append(response(name='co'))
        self.inbox.sync()
        item = self.client.get('/api/inbox').json()[0]
        self.action(item, 'ignore').raise_for_status()
        self.assertEqual(self.action(item).status_code, 409)
        self.matrix.append(response(name='blank')); self.inbox.sync()
        item = self.client.get('/api/inbox').json()[0]
        before = self.state()
        with patch.object(self.inbox, 'save_state', side_effect=ValueError('failed save')):
            self.assertEqual(self.action(item).status_code, 422)
        self.assertEqual(self.state(), before)
        self.assertEqual(self.inbox.status()['pending'], 1)

    def test_failures_preserve_items_and_restore_keeps_key(self):
        self.discover()
        original = self.inbox.key.read_bytes()
        self.matrix = [['wrong headers']]
        self.assertFalse(self.inbox.sync())
        self.assertEqual(self.inbox.status()['pending'], 1)
        self.assertTrue(self.inbox.status()['error'])
        self.matrix = [HEADERS, response()]
        self.assertTrue(self.inbox.sync())
        self.assertEqual(self.inbox.status()['error'], '')
        snap = backup.backup_database(str(self.path), self.tmp.name)
        self.assertNotIn(b'PRIVATE KEY', Path(snap['path']).read_bytes())
        item = self.client.get('/api/inbox').json()[0]
        self.action(item, 'ignore').raise_for_status()
        backup.restore_backup(str(self.path), snap['path'])
        self.assertEqual(self.inbox.status()['pending'], 1)
        self.assertEqual(self.inbox.key.read_bytes(), original)
        self.inbox.key.unlink()
        self.assertFalse(self.inbox.status()['configured'])
        self.assertTrue(self.inbox.sync())


    def test_range_and_fully_recorded_acceptance_and_api_restore(self):
        self.matrix = [HEADERS, response(1, day='09/10/2026', end='19/10/2026')]
        item = self.discover()[0]
        self.action(item).raise_for_status()
        self.assertEqual(len(self.state()['abs']), 7)
        self.assertTrue(all(v['absent'] == 'imported from sheet' for v in self.state()['absenceNotes'].values()))
        self.assertNotIn('2026-10-10', self.state()['abs'])
        self.matrix.append(response(2)); self.inbox.sync()
        item = self.client.get('/api/inbox').json()[0]
        before = self.state()
        self.action(item).raise_for_status()
        self.assertEqual(self.state(), before)
        snap = self.client.post('/api/backups').json()
        original = self.inbox.key.read_bytes()
        self.matrix.append(response(name='co')); self.inbox.sync()
        self.assertEqual(self.inbox.status()['pending'], 1)
        self.client.post('/api/backups/restore', json=dict(filename=snap['filename'], confirm=True)).raise_for_status()
        self.assertEqual(self.inbox.status()['pending'], 0)
        self.assertEqual(self.inbox.key.read_bytes(), original)
        self.assertTrue(self.inbox.sync())
        self.assertEqual(self.inbox.status()['pending'], 1)

    def test_summary_does_not_wait_for_google(self):
        self.configure()
        started, finish = threading.Event(), threading.Event()
        def slow_fetch(*args):
            started.set()
            finish.wait(2)
            return self.matrix
        self.inbox.fetcher = slow_fetch
        with ThreadPoolExecutor(max_workers=2) as pool:
            sync = pool.submit(self.inbox.sync)
            self.assertTrue(started.wait(1))
            try:
                result = pool.submit(self.inbox.status).result(timeout=.5)
                self.assertEqual(result['pending'], 0)
            finally:
                finish.set()
            self.assertTrue(sync.result())

    def test_poll_backoff_resets_after_recovery(self):
        waits = []
        calls = []
        def sync():
            calls.append(1)
            return len(calls) > 2
        original_sleep = asyncio.sleep
        async def wait(awaitable, timeout):
            awaitable.close()
            waits.append(timeout)
            await original_sleep(.001)
            raise TimeoutError()
        async def exercise():
            async with self.inbox.lifespan(self.app):
                for _ in range(100):
                    if len(waits) >= 3: break
                    await original_sleep(.002)
        with patch.object(self.inbox, 'sync', side_effect=sync), patch('backend.inbox.asyncio.wait_for', new=wait):
            asyncio.run(exercise())
        self.assertEqual(waits[:3], [60, 120, 30])

    def test_lifespan_poll_and_no_import_io(self):
        self.configure()
        calls = []
        self.inbox.fetcher = lambda *args: calls.append(1) or self.matrix
        async def exercise():
            async with self.inbox.lifespan(self.app):
                for _ in range(100):
                    if calls: break
                    await asyncio.sleep(.01)
                self.assertEqual(len(calls), 1)
                for _ in range(3): self.inbox.status()
                self.assertEqual(len(calls), 1)
        asyncio.run(exercise())
        with patch('sqlite3.connect', side_effect=AssertionError('import opened DB')):
            import backend.inbox
            importlib.reload(backend.inbox)
