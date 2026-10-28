import copy
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient as AnonymousClient
from backend.domain import consultation, normalize_dataset
from backend.hour_types import merge_types
from backend.main import create_app
from backend.storage import EMPTY
from backend.tests.client import TestClient
from backend.tests.test_app import DAY, fixture
from backend.tests.timetable_helpers import import_version


class ConsultationTest(unittest.TestCase):
    def setUp(self):
        self.ds = normalize_dataset(fixture())
        self.state = copy.deepcopy(EMPTY)
        self.rules = merge_types(self.ds, {})

    def choices(self, campus='all', hour=2):
        return consultation(self.ds, self.state, DAY, hour, campus, self.rules)

    def test_campus_types_profiles_and_no_manual_options(self):
        self.ds['lessons']['pot|lun|2']['site'] = 'succursale'
        self.state['dis'][DAY] = {'blank': [2]}
        all_choices = {c['id']: c for c in self.choices()}
        self.assertEqual(set(all_choices), {'pot', 'utc', 'dis', 'blank'})
        self.assertEqual(all_choices['blank']['campus'], None)
        self.assertIn('clsWeek', all_choices['pot'])
        self.assertFalse(any(c.get('sameCdc') or c.get('inClass') for c in all_choices.values()))
        self.assertEqual({c['id'] for c in self.choices('centrale')}, {'utc', 'dis'})
        self.assertEqual({c['id'] for c in self.choices('succursale')}, {'pot'})
        self.assertEqual(self.choices(hour=7), [])

    def test_absence_assignment_retirement_hidden_and_occupied_policies(self):
        self.state['abs'][DAY] = {'utc': [2]}
        self.state['asg'][DAY] = {'absent|2|1A': dict(v='dis', t='DIS', c='1A')}
        self.ds['teachers']['pot']['retired'] = True
        self.assertEqual(self.choices(), [])
        self.ds['teachers']['pot']['retired'] = False
        for changes in ({'visible': False}, {'visible': True, 'available': False}):
            self.rules['code:POT'].update(changes)
            self.assertEqual(self.choices(), [])

    def test_manual_and_class_out_release_reuse_available_type(self):
        self.state['dis'][DAY] = {'pot': [2]}
        self.state['disSites'][DAY] = {'pot': 'succursale'}
        self.state['cf'][DAY] = {'1A': [2]}
        choices = {c['id']: c for c in self.choices()}
        self.assertEqual(choices['co']['ty'], 'D')
        self.assertEqual(choices['absent']['ty'], 'D')
        self.assertEqual(choices['pot']['ty'], 'D')
        self.assertEqual(choices['pot']['campus'], 'succursale')

    def test_rp_is_checked_per_destination_and_does_not_consume_debt(self):
        self.state['manualPermits'] = {'blank': dict(id='permit', hours=1)}
        self.ds['lessons']['blank|lun|1'] = dict(classes=['3A'], site='centrale', room=None)
        before = copy.deepcopy(self.state)
        choices = [c for c in self.choices() if c['id'] == 'blank']
        self.assertEqual([(c['campus'], c['ty']) for c in choices], [('centrale', 'RP')])
        self.assertTrue(choices[0]['convenient'])
        self.assertEqual(self.state, before)
        del self.ds['lessons']['blank|lun|1']
        self.assertEqual({c['campus'] for c in self.choices() if c['id'] == 'blank'}, {'centrale', 'succursale'})
        self.state['abs'][DAY] = {'blank': [2]}
        self.assertNotIn('blank', [c['id'] for c in self.choices()])


class ConsultationApiTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = create_app(Path(self.temp.name) / 'app.sqlite')
        self.client = TestClient(self.app)
        self.raw = fixture()
        self.client.post('/api/timetable', json=self.raw).raise_for_status()

    def get(self, client=None, **params):
        return (client or self.client).get('/api/availability', params=dict(day=DAY, hour=2, campus='all') | params)

    def test_validated_authenticated_read_across_campuses_and_no_writes(self):
        self.assertEqual(self.get(AnonymousClient(self.app, base_url='http://localhost')).status_code, 401)
        other = TestClient(self.app, campus='succursale')
        before = self.client.get('/api/export').json()
        for client in (self.client, other):
            for campus in ('all', 'centrale', 'succursale'):
                response = self.get(client, campus=campus)
                self.assertEqual(response.status_code, 200, response.text)
                if campus != 'all':
                    self.assertTrue(all(c['campus'] == campus for c in response.json()))
            for invalid in (dict(hour=0), dict(hour=8), dict(hour='x'), dict(campus='other'), dict(day='invalid')):
                self.assertEqual(self.get(client, **invalid).status_code, 422)
        self.assertEqual(self.client.get('/api/export').json(), before)

    def test_effective_timetable_and_display_names(self):
        value = dict(name='Nome corretto', originalName='pot')
        self.client.post('/api/orari/name', json=dict(teacher='pot', value=value, previous=None)).raise_for_status()
        revised = copy.deepcopy(self.raw)
        next(l for l in revised['orario'] if l['docente'] == 'pot')['sede'] = 'succursale'
        import_version(self.client, revised, effective='2026-10-19').raise_for_status()
        for day, campus in ((DAY, 'centrale'), ('2026-10-19', 'succursale')):
            pot = next(c for c in self.get(day=day).json() if c['id'] == 'pot')
            self.assertEqual(pot['campus'], campus)
            self.assertEqual(pot['name'], 'Nome corretto (pot)')

    def test_real_assignment_is_excluded_without_changing_candidate_endpoint(self):
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2])).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).raise_for_status()
        self.assertNotIn('pot', [c['id'] for c in self.get().json()])
        self.assertEqual(self.client.get('/api/candidates', params=dict(day=DAY, key='')).status_code, 422)
        before = self.client.get('/api/export').json()
        self.get().raise_for_status()
        self.assertEqual(self.client.get('/api/export').json(), before)
