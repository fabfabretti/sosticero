import copy
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.domain import normalize_dataset, candidates, rows, validate_assignment
from backend.hour_types import merge_types, validate_types
from backend.storage import EMPTY
from backend.tests.test_app import fixture, DAY


class HourTypesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'app.sqlite'
        self.client = TestClient(create_app(self.path))
        self.raw = fixture()
        for code in ('GM', 'PE', 'RIT', 'CPO'):
            self.raw['docenti'].append(dict(id=code))
            self.raw['orario'].append(dict(docente=code, giorno='lun', ora=2, classi=[], attivita_originale=code))
        self.assertEqual(self.client.post('/api/timetable', json=self.raw).status_code, 200)
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2]))
        self.key = 'absent|2|1A'

    def inventory(self):
        return self.client.get('/api/hour-types').json()['types']

    def set_type(self, key, **changes):
        p = self.inventory()[key]
        payload = {k: p[k] for k in ('available', 'visible', 'school')}
        return self.client.post('/api/hour-types', json=dict(id=key, **(payload | changes)))

    def choices(self):
        r = self.client.get('/api/candidates', params=dict(day=DAY, key=self.key))
        self.assertEqual(r.status_code, 200, r.text)
        return {c['id']: c for c in r.json()}

    def assign(self, who, exceptional=False):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=self.key, value=who, exceptional=exceptional))

    def test_inventory_defaults_aliases_and_restart(self):
        types = self.inventory()
        self.assertEqual(types['code:GM']['school'], False)
        self.assertIsNone(types['code:PE']['school'])
        self.assertFalse(types['derived:itp']['available'])
        self.assertTrue(types['derived:itp']['visible'])
        self.set_type('code:PE', available=True, visible=True, school=True)
        updated = self.inventory()
        self.client.post('/api/timetable', json=self.raw)
        self.assertEqual(updated, self.inventory())
        other = TestClient(create_app(self.path))
        self.assertEqual(updated, other.get('/api/hour-types').json()['types'])
        raw = copy.deepcopy(self.raw)
        raw['orario'][4]['attivita_originale'] = 'U.T.C'
        raw['orario'][4]['attivita_riconosciute'] = ['UTC']
        raw['orario'][0]['attivita_originale'] = '1A A16C'
        raw['orario'][0]['aula'] = 'A16C'
        ds = normalize_dataset(raw)
        self.assertEqual(ds['lessons']['absent|lun|2']['activities'], [])
        self.assertEqual(ds['lessons']['utc|lun|2']['activities'], ['UTC'])
        self.assertIn('U.T.C', ds['lessons']['utc|lun|2']['activityLabels'])
        self.assertNotEqual('derived:lesson', 'code:LESSON')
        legacy = {'lessons': {'x': {'special': 'UTC'}}}
        self.assertIn('code:UTC', merge_types(legacy, {}))

    def test_all_policy_combinations_and_school_independence(self):
        for visible in (False, True):
            for available in (False, True):
                self.set_type('code:PE', visible=visible, available=available)
                cs = self.choices()
                self.assertEqual('PE' in cs, visible)
                if visible:
                    self.assertEqual(cs['PE']['exceptional'], not available)
        before = self.choices()
        self.set_type('code:PE', school=False)
        self.assertEqual(before, self.choices())
        self.assertNotIn('GM', before)
        self.assertFalse(before['co']['exceptional'])
        self.assertTrue(before['support']['exceptional'])
        self.set_type('derived:itp', visible=False)
        self.assertNotIn('co', self.choices())
        self.assertEqual(self.assign('co', True).status_code, 422)

    def test_exception_hard_blocks_and_stale_policy(self):
        self.assertEqual(self.assign('co').status_code, 200)
        record = self.client.get('/api/export').json()['asg'][DAY][self.key]
        self.assertFalse(record.get('exceptional', False))
        self.set_type('derived:itp', visible=False)
        self.assertEqual(self.client.get('/api/export').json()['asg'][DAY][self.key], record)
        self.set_type('derived:itp', visible=True)
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='co', hours=[2]))
        self.assertEqual(self.assign('co', True).status_code, 422)
        self.set_type('code:PE', available=True, visible=True)
        self.assertFalse(self.choices()['PE']['exceptional'])
        self.set_type('code:PE', available=False)
        self.assertEqual(self.assign('PE').status_code, 422)
        self.client.post('/api/entries', json=dict(day=DAY, group='dis', id='PE', hours=[2]))
        self.assertFalse(self.choices()['PE']['exceptional'])

    def test_curricular_teacher_covers_absent_itp_in_same_class(self):
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[]))
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='co', hours=[2]))
        self.key = 'co|2|1A'
        candidate = self.choices()['absent']
        self.assertEqual(candidate['ty'], 'C')
        self.assertEqual(candidate['typeLabel'], 'Compresenza')
        self.assertFalse(candidate['exceptional'])
        self.assertEqual(self.assign('absent').status_code, 200)

    def test_same_class_in_different_rooms_is_not_coteaching(self):
        ds = normalize_dataset(self.raw)
        ds['lessons']['absent|lun|2']['room'] = 'A4C'
        ds['lessons']['co|lun|2']['room'] = 'A18C'
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2]}
        row = rows(ds, state, DAY)[0]
        rules = merge_types(ds, {})
        for role in ('ITP', 'curricolare', 'sostegno'):
            with self.subTest(role=role):
                ds['teachers']['co']['role'] = role
                cs = {c['id']: c for c in candidates(ds, state, DAY, row, rules)}
                self.assertTrue('co' not in cs or cs['co']['ty'] != 'C')

    def test_support_already_in_class_is_ordinary_cover(self):
        ds = normalize_dataset(self.raw)
        ds['lessons']['support|lun|2']['classes'] = ['1A']
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2]}
        row = rows(ds, state, DAY)[0]
        rules = merge_types(ds, {})
        cs = {c['id']: c for c in candidates(ds, state, DAY, row, rules)}
        self.assertEqual(cs['support']['ty'], 'C')
        self.assertFalse(cs['support']['exceptional'])
        self.assertEqual(validate_assignment(ds, state, DAY, row['k'], 'support', rules)['t'], 'C')

    def test_multi_code_and_class_out_precedence(self):
        ds = normalize_dataset(self.raw)
        ds['lessons']['PE|lun|2']['activities'] = ['PE', 'GM']
        rules = merge_types(ds, {})
        rules['code:PE'].update(available=True, visible=True)
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2]}
        row = rows(ds, state, DAY)[0]
        self.assertNotIn('PE', [c['id'] for c in candidates(ds, state, DAY, row, rules)])
        rules['code:GM']['visible'] = True
        cs = {c['id']: c for c in candidates(ds, state, DAY, row, rules)}
        self.assertTrue(cs['PE']['exceptional'])
        self.assertIn('GM', cs['PE']['typeLabel'])
        state['cf'][DAY] = {'2A': [2]}
        cs = {c['id']: c for c in candidates(ds, state, DAY, row, rules)}
        self.assertEqual(cs['support']['ty'], 'D')
        self.assertFalse(cs['support']['exceptional'])
        ds['teachers']['PE']['retired'] = True
        with self.assertRaises(ValueError):
            validate_assignment(ds, state, DAY, row['k'], 'PE', rules, True)

    def test_atomic_archive_legacy_and_backup(self):
        self.set_type('code:PE', available=True, visible=True, school=True)
        self.assign('co', True)
        archive = self.client.get('/api/export').json()
        self.set_type('code:PE', available=False)
        legacy = copy.deepcopy(archive)
        del legacy['hourTypes']
        self.assertEqual(self.client.post('/api/import', json=legacy).status_code, 200)
        self.assertFalse(self.inventory()['code:PE']['available'])
        self.assertEqual(self.client.post('/api/import', json=archive).status_code, 200)
        self.assertEqual(self.inventory(), archive['hourTypes'])
        bad = copy.deepcopy(archive)
        bad['hourTypes']['code:PE']['available'] = 'yes'
        self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
        self.assertEqual(self.client.get('/api/export').json(), archive)
        self.assertEqual(self.set_type('code:PE', available='yes').status_code, 422)
        self.assertEqual(self.inventory(), archive['hourTypes'])
        snap = self.client.post('/api/backups').json()
        self.set_type('code:PE', visible=False)
        self.assertEqual(self.client.post('/api/backups/restore', json=dict(filename=snap['filename'], confirm=True)).status_code, 200)
        self.assertEqual(self.client.get('/api/export').json(), archive)
