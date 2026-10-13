import copy
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.tests.test_app import fixture, DAY
from backend import backup


class PermessiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'db.sqlite'
        self.client = TestClient(create_app(self.path))
        self.ds = fixture()
        for teacher in ('absent', 'pot', 'co'):
            for h, activity in [(1, ''), (3, 'POT'), (4, 'DI.S')]:
                self.ds['orario'].append(dict(docente=teacher, giorno='lun', ora=h, classi=[], attivita_originale=activity))
        self.assertEqual(self.client.post('/api/timetable', json=self.ds).status_code, 200)

    def permit(self, **values):
        return self.client.post('/api/permessi', json=dict(day=DAY, id='absent', hours=[2, 3], **values))

    def register(self):
        return self.client.get('/api/permessi').json()['permessi']

    def test_crud_move_and_restart(self):
        self.assertEqual(self.permit().status_code, 200)
        self.assertEqual(self.permit().status_code, 422)
        edit = dict(day=DAY, id='absent', original_day=DAY, original_id='absent', hours=[1])
        self.assertEqual(self.client.post('/api/permessi', json=edit).status_code, 200)
        edit['id'] = 'blank'
        self.assertEqual(self.client.post('/api/permessi', json=edit).status_code, 422)
        self.assertEqual(self.register()[DAY]['absent'], [1])
        edit['id'] = 'co'
        self.assertEqual(self.client.post('/api/permessi', json=edit).status_code, 200)
        self.assertNotIn('absent', self.register()[DAY])
        self.assertEqual(TestClient(create_app(self.path)).get('/api/permessi').json()['permessi'][DAY]['co'], [1])
        self.client.post('/api/permessi', json=dict(day=DAY, id='co', hours=None))
        self.assertEqual(self.register()[DAY], {})

    def test_optional_request_date_round_trip_move_and_delete(self):
        body = dict(day=DAY, id='absent', hours=[2], requested_on='2026-10-09')
        self.assertEqual(self.client.post('/api/permessi', json={**body, 'requested_on': 'bad'}).status_code, 422)
        self.assertEqual(self.client.post('/api/permessi', json=body).status_code, 200)
        archive = self.client.get('/api/export').json()
        self.assertEqual(archive['permitRequests'][DAY]['absent'], '2026-10-09')
        self.assertEqual(self.client.post('/api/import', json=archive).status_code, 200)
        bad = copy.deepcopy(archive)
        bad['permitRequests'][DAY]['absent'] = 'bad'
        self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
        move = {**body, 'id': 'co', 'original_id': 'absent', 'original_day': DAY}
        self.assertEqual(self.client.post('/api/permessi', json=move).status_code, 200)
        requests = self.client.get('/api/permessi').json()['permitRequests'][DAY]
        self.assertNotIn('absent', requests)
        self.assertEqual(requests['co'], '2026-10-09')
        self.client.post('/api/permessi', json=dict(day=DAY, id='co', hours=None))
        self.assertEqual(self.client.get('/api/permessi').json()['permitRequests'][DAY], {})

    def test_limits_and_invalid_input(self):
        for hours in ([], [2, 2], [True], [0], [8], [1, 2, 3]):
            self.assertEqual(self.client.post('/api/permessi', json=dict(day=DAY, id='absent', hours=hours)).status_code, 422)
        for teacher, day in [('missing', DAY), ('blank', DAY), ('absent', '2026-10-13'), ('absent', 'bad')]:
            self.assertEqual(self.client.post('/api/permessi', json=dict(day=day, id=teacher, hours=[1])).status_code, 422)
        self.assertEqual(self.client.post('/api/permessi', json=dict(day=DAY, id='absent', hours=[6, 7])).status_code, 200)
        for count, limit in [(5, 2), (6, 3)]:
            ds = copy.deepcopy(self.ds)
            for h in range(5, count + 1):
                ds['orario'].append(dict(docente='pot', giorno='lun', ora=h, classi=[]))
            self.client.post('/api/timetable', json=ds)
            self.assertEqual(self.client.post('/api/permessi', json=dict(day=DAY, id='pot', hours=list(range(1, limit + 2)))).status_code, 422)
            self.assertEqual(self.client.post('/api/permessi', json=dict(day=DAY, id='pot', hours=list(range(1, limit + 1)))).status_code, 200)
            self.client.post('/api/permessi', json=dict(day=DAY, id='pot', hours=None))

    def test_effective_absence_and_manual_overlap(self):
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2]))
        self.assertEqual(self.permit().status_code, 200)
        day = self.client.get('/api/day/' + DAY).json()
        self.assertEqual(len(day['rows']), 1)
        self.assertEqual(day['state']['abs'][DAY]['absent'], [2])
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=None))
        self.assertEqual(len(self.client.get('/api/day/' + DAY).json()['rows']), 1)
        key = day['rows'][0]['k']
        self.client.post('/api/assignments', json=dict(day=DAY, key=key, value='pot'))
        self.client.post('/api/permessi', json=dict(day=DAY, id='pot', hours=[2]))
        cs = self.client.get('/api/candidates', params=dict(day=DAY, key=key)).json()
        self.assertEqual(next(c for c in cs if c['id'] == 'pot')['why'], 'Assente')
        self.assertEqual(self.client.post('/api/assignments', json=dict(day=DAY, key=key, value='pot')).status_code, 422)
        self.assertTrue(self.client.get('/api/day/' + DAY).json()['issues'])
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2]))
        self.client.post('/api/permessi', json=dict(day=DAY, id='absent', hours=None))
        self.assertEqual(len(self.client.get('/api/day/' + DAY).json()['rows']), 1)
        self.client.post('/api/permessi', json=dict(day=DAY, id='co', hours=[2]))
        self.assertEqual(self.client.get('/api/day/' + DAY).json()['rows'][0]['ids'], ['absent', 'co'])
        self.client.post('/api/entries', json=dict(day=DAY, group='cf', id='1A', hours=[2]))
        self.assertNotIn('co', self.client.get('/api/day/' + DAY).json()['autoDis'][DAY])

    def test_archive_and_backup(self):
        self.permit()
        archive = self.client.get('/api/export').json()
        self.assertEqual(self.client.post('/api/import', json=archive).status_code, 200)
        for value in ([True], [], [2, 2], [8]):
            bad = copy.deepcopy(archive)
            bad['permessi'][DAY]['absent'] = value
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
            self.assertEqual(self.register(), archive['permessi'])
        ds = copy.deepcopy(self.ds)
        ds['orario'] = [l for l in ds['orario'] if l['docente'] != 'absent']
        ds['docenti'] = [t for t in ds['docenti'] if t['id'] != 'absent']
        self.client.post('/api/timetable', json=ds)
        self.assertEqual(self.client.post('/api/import', json=archive).status_code, 200)
        saved = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'backups'))
        self.client.post('/api/permessi', json=dict(day=DAY, id='absent', hours=None))
        backup.restore_backup(str(self.path), saved['path'])
        self.assertEqual(self.register(), archive['permessi'])
        archive['schema'] = 1
        del archive['permitIds']
        del archive['permessi']
        del archive['statistics']  # Simulate an archive from before permits and statistical facts.
        self.assertEqual(self.client.post('/api/import', json=archive).status_code, 200)
        self.assertEqual(self.register(), {})
