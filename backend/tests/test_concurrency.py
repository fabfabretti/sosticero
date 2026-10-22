import tempfile
import unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient as RawClient
from backend.tests.client import TestClient
from backend.tests.test_app import fixture, DAY
from backend.main import create_app


class ConcurrencyTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        app = create_app(Path(self.tmp.name) / 'test.sqlite')
        self.client = TestClient(app)
        self.raw = RawClient(app)
        self.client.post('/api/timetable', json=fixture()).raise_for_status()

    def entry(self, teacher='absent', hours=None, **extra):
        return dict(day=DAY, group='abs', id=teacher, hours=hours or [2], **extra)

    def baseline(self, body):
        data = self.raw.get('/api/day/' + body['day']).json()['concurrency']['records']
        ref = f"{body['group']}|{body['day']}|{body['id']}"
        return {ref: data.get(ref, 'absent')}

    def test_required_stable_independent_and_stale_hours(self):
        body = self.entry()
        self.assertEqual(self.raw.post('/api/entries', json=body).status_code, 428)
        self.client.post('/api/entries', json=body).raise_for_status()
        old = self.baseline(body)
        self.client.post('/api/entries', json=self.entry('support')).raise_for_status()
        self.assertEqual(old, self.baseline(body))
        self.raw.post('/api/entries', json=dict(body, hours=[1, 2], expected=old)).raise_for_status()
        r = self.raw.post('/api/entries', json=dict(body, hours=[2, 3], expected=old))
        self.assertEqual(r.status_code, 409)
        self.assertEqual(self.raw.get('/api/day/' + DAY).json()['state']['abs'][DAY]['absent'], [1, 2])

    def test_duplicate_creation_and_metadata_delete(self):
        body = self.entry()
        old = self.baseline(body)
        self.client.post('/api/entries', json=body).raise_for_status()
        self.assertEqual(self.raw.post('/api/entries', json=dict(body, expected=old)).status_code, 409)
        old = self.baseline(body)
        self.client.post('/api/entries', json=dict(body, note='new note')).raise_for_status()
        self.assertEqual(self.raw.post('/api/entries', json=dict(body, hours=None, expected=old)).status_code, 409)

    def test_simultaneous_shared_edit(self):
        body = self.entry()
        self.client.post('/api/entries', json=body).raise_for_status()
        old = self.baseline(body)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda h: self.raw.post('/api/entries', json=dict(body, hours=h, expected=old)).status_code, [[1, 2], [2, 3]]))
        self.assertEqual(sorted(results), [200, 409])

    def test_range_and_future_changes_roll_back(self):
        body = self.entry()
        old = self.baseline(body)
        next_day = '2026-10-13'
        other = dict(body, day=next_day)
        ref = f'abs|{next_day}|absent'
        expected = dict(old, **{ref: 'absent'})
        self.client.post('/api/entries', json=other).raise_for_status()
        self.assertEqual(self.raw.post('/api/entries', json=dict(body, until=next_day, expected=expected)).status_code, 409)
        self.assertNotIn('absent', self.raw.get('/api/day/' + DAY).json()['state']['abs'].get(DAY, {}))
        self.assertEqual(self.raw.post('/api/entries', json=dict(body, future=True, expected=old)).status_code, 409)

    def test_assignment_stale_removal_and_global_booking(self):
        self.client.post('/api/entries', json=self.entry()).raise_for_status()
        k = f'asg|{DAY}|absent|2|1A'
        old = self.raw.get('/api/day/' + DAY).json()['concurrency']['records'][k]
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).raise_for_status()
        self.assertEqual(self.raw.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', expected={k: old})).status_code, 409)

    def test_manual_balance_stale_edit(self):
        body = dict(id='pot', hours=3)
        self.client.post('/api/manual-permits', json=body).raise_for_status()
        k = 'manualPermits||pot'
        old = self.raw.get('/api/permessi').json()['concurrency']['records'][k]
        self.client.post('/api/manual-permits', json=dict(body, hours=4, editing=True)).raise_for_status()
        self.assertEqual(self.raw.post('/api/manual-permits', json=dict(body, editing=True, expected={k: old})).status_code, 409)

    def test_dated_permit_stale_edit_and_move(self):
        ds = fixture()
        for h in (1, 3, 4):
            ds['orario'].append(dict(docente='absent', giorno='lun', ora=h, classi=[], attivita_originale=''))
        app = create_app(Path(self.tmp.name) / 'permit.sqlite')
        self.client = TestClient(app)
        self.raw = RawClient(app)
        self.client.post('/api/timetable', json=ds).raise_for_status()
        body = dict(day=DAY, id='absent', hours=[2])
        self.client.post('/api/permessi', json=body).raise_for_status()
        k = f'permessi|{DAY}|absent'
        old = self.raw.get('/api/permessi').json()['concurrency']['records'][k]
        edit = dict(body, original_day=DAY, original_id='absent')
        self.client.post('/api/permessi', json=dict(edit, note='new')).raise_for_status()
        self.assertEqual(self.raw.post('/api/permessi', json=dict(edit, note='old', expected={k: old})).status_code, 409)
        self.assertEqual(self.raw.post('/api/permessi', json=dict(body, hours=None, expected={k: old})).status_code, 409)
