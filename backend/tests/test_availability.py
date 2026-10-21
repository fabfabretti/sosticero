import copy
import sqlite3
import tempfile
import unittest
from contextlib import closing
from datetime import date
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend import availability, timetables, overrides
from backend.domain import normalize_dataset
from backend.hour_types import merge_types
from backend.main import create_app
from backend.storage import EMPTY
from backend.tests.test_app import fixture
from backend.tests.timetable_helpers import import_version

MONDAY = date(2026, 10, 12)


class AvailabilityTest(unittest.TestCase):
    def setUp(self):
        self.ds = normalize_dataset(fixture())
        self.state = copy.deepcopy(EMPTY)
        self.rules = merge_types(self.ds, {})
        for code in ('ALF', 'PE'):
            self.rules['code:' + code] = dict(label=code, available=True, visible=False, school=True, color='blue')

    def report(self, campus='total', history=None, selected=MONDAY):
        return availability.report(history or timetables.baseline(self.ds), self.state, self.rules, selected, campus)

    def cell(self, report, h=2):
        return next(c for c in report['cells'] if c['date'] == MONDAY.isoformat() and c['hour'] == h)

    def test_campus_disabled_mixed_codes_unknown_and_policy(self):
        self.ds['lessons']['pot|lun|2'].update(activities=['POT', 'ALF'], disabled=True, classes=['1A'])
        self.ds['lessons']['blank|lun|2'] = dict(classes=[], activities=['PE'], site='succursale')
        self.ds['lessons']['co|lun|2'] = dict(classes=[], activities=['ALF'], site=None)
        self.assertEqual(self.report('centrale')['pot']['total'], 1)
        self.assertEqual(self.report('centrale')['pot']['enabled'], 0)
        self.assertEqual(self.report('succursale')['pot']['percentage'], 100)
        both = self.report()
        self.assertEqual(both['pot']['total'], 3)
        self.assertEqual(both['pot']['enabled'], 2)
        self.assertEqual(both['unknown']['pot'], 1)
        self.assertEqual([t['id'] for t in self.cell(self.report('succursale'))['available']], ['blank'])
        self.assertIn('dis', [t['id'] for t in self.cell(self.report('centrale'))['available']])
        self.assertNotIn('pot', [t['id'] for t in self.cell(both)['available']])
        self.rules['code:PE']['available'] = False
        self.assertEqual(self.report('succursale')['pot']['enabled'], 0)
        self.assertEqual(self.report('succursale')['pot']['total'], 1)

    def test_utc_uts_and_sos_are_never_disposable(self):
        # Fixture already schedules 'utc' with U.T.C at centrale on Monday 2nd hour.
        self.ds['lessons']['blank|lun|2'] = dict(classes=[], activities=['UTS'], site='succursale')
        self.ds['lessons']['support|lun|2'] = dict(classes=[], activities=['SOS'], site=None)
        for campus in ('total', 'centrale', 'succursale'):
            ids = [t['id'] for t in self.cell(self.report(campus))['available']]
            self.assertNotIn('utc', ids)
            self.assertNotIn('blank', ids)
            self.assertNotIn('support', ids)
        # SOS has no site: excluding it must not inflate the unknown-campus disclosure.
        self.assertEqual([t['id'] for t in self.cell(self.report())['available']], ['dis', 'pot'])
        self.assertEqual(self.report()['unknown']['hours'], 0)

    def test_weighted_ratio_and_empty(self):
        self.ds['lessons'] = {}
        for n in range(60):
            i = str(n)
            self.ds['teachers'][i] = dict(name=i)
            self.ds['lessons'][f'{i}|lun|2'] = dict(classes=[], activities=['POT'],
                site='centrale' if n < 50 else 'succursale', disabled=not (n < 18 or 50 <= n < 58))
        self.assertEqual(self.report('centrale')['pot']['percentage'], 36)
        self.assertEqual(self.report('succursale')['pot']['percentage'], 80)
        self.assertAlmostEqual(self.report()['pot']['percentage'], 26 / 60 * 100)
        self.ds['lessons'] = {}
        self.assertIsNone(self.report()['pot']['percentage'])

    def test_midweek_version_override_and_retired(self):
        self.ds['lessons']['pot|mer|2'] = copy.deepcopy(self.ds['lessons']['pot|lun|2'])
        history = timetables.baseline(self.ds)
        changed = copy.deepcopy(self.ds)
        changed['lessons']['pot|mer|2']['disabled'] = True
        history['versions'].append(dict(id='later', effective='2026-10-14', dataset=changed))
        result = self.report(history=history)
        self.assertEqual(result['pot']['total'], 2)
        self.assertEqual(result['pot']['enabled'], 1)
        self.assertEqual(result['versions'][2]['id'], 'later')
        self.ds['teachers']['pot']['retired'] = True
        self.assertEqual(self.report()['pot']['total'], 0)

    def test_rp_date_windows_reservations_travel_and_daily_invariance(self):
        self.ds['lessons']['blank|lun|1'] = dict(classes=['1A'], activities=[], site='centrale')
        self.state['permessi'] = {'2026-09-12': {'blank': [1]}}
        self.state['permitIds'] = {'2026-09-12': {'blank': 'permit'}}
        result = self.report('centrale')
        self.assertEqual([t['id'] for t in self.cell(result)['recovery']], ['blank'])
        self.assertEqual(self.cell(self.report('succursale'))['recovery'], [])
        self.state['abs'] = {'2026-10-12': {'pot': [2], 'blank': [2]}}
        self.state['dis'] = {'2026-10-12': {'blank': [2]}}
        self.state['cf'] = {'2026-10-12': {'1A': [1]}}
        self.state['asg'] = {'2026-10-12': {'absent|2|1A': dict(v='blank', t='D', c='1A')}}
        self.assertEqual(result, self.report('centrale'))
        self.assertTrue(all(not c['recovery'] for c in self.report(selected=date(2026, 10, 19))['cells']))
        self.state['asg']['2026-10-12']['absent|2|1A'].update(t='RP', permitId='permit')
        self.assertEqual(self.cell(self.report())['recovery'], [])

    def test_rp_combined_deduplicates_eligible_campuses(self):
        self.ds['lessons']['blank|lun|2'] = dict(classes=['1A'], activities=[], site='centrale')
        self.state['manualPermits'] = {'blank': dict(id='manual', hours=1)}
        rp = self.cell(self.report(), h=3)['recovery']
        self.assertEqual(len(rp), 1)
        self.assertEqual(rp[0]['sites'], ['centrale', 'succursale'])


class AvailabilityApiTest(unittest.TestCase):
    def test_read_only_dates_validation_and_names(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict('os.environ', {'BACKUP_ON_STARTUP': 'false'}):
            path = Path(tmp) / 'test.sqlite'
            client = TestClient(create_app(path))
            self.assertEqual(client.get('/api/stats/availability').status_code, 422)
            client.post('/api/timetable', json=fixture()).raise_for_status()
            client.post('/api/orari/name', json=dict(teacher='pot', value=dict(name='Nome corretto', originalName='pot'), previous=None)).raise_for_status()
            def snapshot():
                with closing(sqlite3.connect(path)) as db:
                    return db.execute('SELECT * FROM documents ORDER BY key').fetchall()
            before = snapshot()
            response = client.get('/api/stats/availability?date=2099-10-12&campus=centrale')
            response.raise_for_status()
            body = response.json()
            self.assertIn('Nome corretto (pot)', [t['name'] for c in body['cells'] for t in c['available']])
            self.assertEqual(body['campus'], 'centrale')
            self.assertEqual(len(body['cells']), 35)
            self.assertEqual(before, snapshot())
            self.assertEqual(client.get('/api/stats/availability?campus=bad').status_code, 422)
            self.assertEqual(client.get('/api/stats/availability?date=no').status_code, 422)
            client.get('/api/stats/availability').raise_for_status()

    def test_dated_override_and_future_timetable(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict('os.environ', {'BACKUP_ON_STARTUP': 'false'}):
            client = TestClient(create_app(Path(tmp) / 'test.sqlite'))
            client.post('/api/timetable', json=fixture()).raise_for_status()
            data = client.get('/api/orari?day=2026-10-12').json()
            cells = overrides.cells(data['dataset'], 'pot')
            cells['lun|2']['disabled'] = True
            draft = dict(teacher='pot', start='2026-10-12', end='2026-10-18', cells=cells, basis=data['basis'])
            preview = client.post('/api/orari/preview', json=draft)
            preview.raise_for_status()
            client.post('/api/orari/override', json={**draft, 'token': preview.json()['token']}).raise_for_status()
            report = client.get('/api/stats/availability?date=2026-10-12&campus=centrale').json()
            self.assertEqual(report['pot']['enabled'], 0)
            self.assertEqual(report['pot']['total'], 1)
            self.assertEqual(client.get('/api/stats/availability?date=2026-10-19&campus=centrale').json()['pot']['enabled'], 1)
            changed = fixture()
            next(l for l in changed['orario'] if l['docente'] == 'pot')['sede'] = 'succursale'
            import_version(client, changed, effective='2099-01-01').raise_for_status()
            self.assertEqual(client.get('/api/stats/availability?date=2099-01-05&campus=succursale').json()['pot']['total'], 1)
