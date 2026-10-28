import copy
from datetime import datetime
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient as AnonymousClient

from backend.display import project
from backend.domain import normalize_dataset
from backend.main import create_app
from backend.storage import Store, EMPTY
from backend.tests.client import TestClient
from backend.tests.test_app import DAY, fixture
from backend.tests.timetable_helpers import import_version


class DisplayTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.path = root / 'app.sqlite'
        (root / 'index.html').write_text('<html>display entry</html>')
        with patch.dict('os.environ', STATIC_PATH=str(root)):
            self.app = create_app(self.path)
        self.client = AnonymousClient(self.app, base_url='http://localhost')
        self.addCleanup(self.client.close)
        self.store = Store(str(self.path))
        self.ds = normalize_dataset(fixture())
        self.ds['teachers']['pot']['name'] = 'Àlba'
        self.ds['lessons']['pot|lun|2']['site'] = 'succursale'
        self.ds['lessons']['absent|lun|2']['room'] = 'A12'
        self.state = copy.deepcopy(EMPTY)
        self.state['abs'][DAY] = {'absent': [2], 'support': [2]}
        self.state['asg'][DAY] = {
            'absent|2|1A': dict(v='pot', t='POT', c='1A', communicated=False, accepted=False),
            'support|2|2A': dict(v='pot', t='POT', c='2A'),
        }
        self.state['absenceNotes'][DAY] = {'absent': 'PRIVATE NOTE'}
        self.save()
        clock = patch('backend.main.datetime')
        self.clock = clock.start()
        self.addCleanup(clock.stop)
        self.clock.now.return_value = datetime.fromisoformat(DAY + 'T09:00:00').replace(tzinfo=ZoneInfo('Europe/Rome'))

    def save(self):
        with self.store.connect() as db:
            self.store.write(db, 'dataset', self.ds)
            self.store.write(db, 'state', self.state)

    def get(self, campus='centrale'):
        return self.client.get('/api/display', params={'campus': campus})

    def test_minimal_current_campus_projection_preserves_multiple_classes(self):
        before = self.path.read_bytes()
        response = self.get()
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertEqual(set(data), {'day', 'campus', 'updated', 'teachers', 'changes', 'incomplete'})
        self.assertEqual(data['teachers'], [dict(name='Àlba', slots=[
            dict(period=2, classe='1A', room='A12', replaced=['absent']), dict(period=2, classe='2A', room='Aula n.d.', replaced=['support'])])])
        self.assertEqual(self.get('succursale').json()['teachers'], [])
        self.assertNotIn('PRIVATE', response.text)
        self.assertNotIn('absenceNotes', response.text)
        self.assertEqual(response.headers['cache-control'], 'no-store')
        self.assertEqual(self.path.read_bytes(), before)

    def test_other_campus_special_actions_orphans_and_unknown_campus(self):
        for special in ('ENTRA', 'ESCE', 'DIR', 'UNCOVERED'):
            state = copy.deepcopy(self.state)
            for a in state['asg'][DAY].values():
                a['v'] = special
            self.assertEqual(project(self.ds, state, DAY, 'centrale')['teachers'], [])
        missing = copy.deepcopy(self.state)
        missing['asg'][DAY] = {'absent|2|1A': dict(v='missing', t='D', c='1A')}
        self.assertEqual(project(self.ds, missing, DAY, 'centrale'), dict(teachers=[], changes=[], incomplete=True))
        self.ds['lessons']['support|lun|2']['site'] = 'succursale'
        self.state['asg'][DAY]['support|2|2A']['v'] = 'dis'
        self.state['asg'][DAY]['missing|1|1Z'] = dict(v='pot', t='POT', c='1Z')
        self.save()
        self.assertEqual(self.get().json()['teachers'][0]['slots'], [dict(period=2, classe='1A', room='A12', replaced=['absent'])])
        self.assertEqual(self.get('succursale').json()['teachers'][0]['name'], 'dis')
        self.assertTrue(self.get().json()['incomplete'])
        self.ds['lessons']['absent|lun|2']['site'] = None
        self.save()
        self.assertEqual(self.get().json()['teachers'], [])

    def test_validation_authentication_and_no_public_writes(self):
        for url in ('/api/display', '/api/display?campus=both', '/api/display?campus=../export'):
            self.assertEqual(self.client.get(url).status_code, 422)
        for url in ('/api/day/' + DAY, '/api/orari', '/api/inbox', '/api/export', '/api/attachments/private', '/api/backups'):
            self.assertEqual(self.client.get(url).status_code, 401)
        before = self.path.read_bytes()
        for url in ('/api/display?campus=centrale', '/api/assignments'):
            self.assertIn(self.client.post(url, json={}).status_code, (401, 403))
        self.assertEqual(self.path.read_bytes(), before)

    def test_no_timetable_and_deep_link(self):
        with self.store.connect() as db:
            db.execute("DELETE FROM documents WHERE key='dataset'")
        self.assertEqual(self.get().status_code, 503)
        for campus in ('centrale', 'succursale'):
            response = self.client.get('/display?campus=' + campus)
            self.assertEqual(response.status_code, 200)
            self.assertIn('display entry', response.text)

    def test_effective_timetable_and_saved_display_names(self):
        client = TestClient(self.app)
        self.addCleanup(client.close)
        raw = fixture()
        import_version(client, raw, effective=DAY).raise_for_status()
        client.post('/api/orari/name', json=dict(teacher='pot', value=dict(name='Rossi', originalName='pot'), previous=None)).raise_for_status()
        self.assertEqual(self.get().json()['teachers'][0]['name'], 'Rossi (pot)')
        client.post('/api/orari/name', json=dict(teacher='absent', value=dict(name='Bianchi', originalName='absent'), previous=None)).raise_for_status()
        self.assertEqual(self.get().json()['teachers'][0]['slots'][0]['replaced'], ['Bianchi (absent)'])
        revised = copy.deepcopy(raw)
        for item in revised['orario']:
            if item['docente'] in ('absent', 'support'):
                item['sede'] = 'succursale'
        import_version(client, revised, effective='2026-10-19').raise_for_status()
        self.clock.now.return_value = datetime(2026, 10, 19, 9, tzinfo=ZoneInfo('Europe/Rome'))
        self.assertEqual(self.get().json()['teachers'], [])

    def test_alphabetical_display_order_and_no_ordinary_lessons(self):
        self.ds['teachers']['dis']['name'] = 'Anna'
        self.state['asg'][DAY]['support|2|2A']['v'] = 'dis'
        result = project(self.ds, self.state, DAY, 'centrale')
        self.assertEqual([t['name'] for t in result['teachers']], ['Àlba', 'Anna'])
        self.assertTrue(all(slot['period'] == 2 for t in result['teachers'] for slot in t['slots']))
        self.state['asg'][DAY] = {}
        self.assertEqual(project(self.ds, self.state, DAY, 'centrale'), dict(teachers=[], changes=[], incomplete=False))

    def test_replaced_names_include_all_co_absent_teachers(self):
        self.state['abs'][DAY]['co'] = [2]
        self.ds['teachers']['co']['name'] = 'Secondo docente'
        self.save()
        slots = self.get().json()['teachers'][0]['slots']
        self.assertEqual(slots[0]['replaced'], ['absent', 'Secondo docente'])
        self.assertEqual(slots[1]['replaced'], ['support'])

    def test_class_changes_are_grouped_by_campus_and_boundary(self):
        self.state['abs'][DAY]['absent'] = [1, 2, 3, 5, 6, 7]
        for hour in (1, 3, 5, 6, 7):
            self.ds['lessons'][f'absent|lun|{hour}'] = copy.deepcopy(self.ds['lessons']['absent|lun|2'])
        self.ds['lessons']['support|lun|2']['site'] = 'succursale'
        self.state['asg'][DAY] = {f'absent|{h}|1A': dict(v=v, t='SPECIAL', c='1A')
                                  for h, v in ((1, 'ENTRA'), (2, 'ENTRA'), (5, 'ESCE'), (6, 'ESCE'), (7, 'ESCE'))}
        self.state['asg'][DAY]['support|2|2A'] = dict(v='ENTRA', t='SPECIAL', c='2A')
        self.state['asg'][DAY]['missing|4|9A'] = dict(v='ENTRA', t='SPECIAL', c='9A')
        self.state['asg'][DAY]['absent|3|1A'] = dict(v='pot', t='POT', c='1A')
        self.save()
        result = self.get().json()
        expected = [dict(classe='1A', action='ENTRA', period=2), dict(classe='1A', action='ESCE', period=5)]
        self.assertEqual(result['changes'], expected)
        self.assertEqual(result['teachers'][0]['slots'][0]['period'], 3)
        self.assertTrue(result['incomplete'])
        self.assertEqual(self.get('succursale').json()['changes'], [dict(classe='2A', action='ENTRA', period=2)])
        del self.state['asg'][DAY]['absent|3|1A']
        self.save()
        self.assertEqual(self.get().json()['teachers'], [])
        self.assertEqual(self.get().json()['changes'], expected)
        self.ds['lessons']['absent|lun|5']['site'] = None
        self.save()
        self.assertEqual(self.get().json()['changes'][1]['period'], 6)
