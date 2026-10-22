from backend.tests.timetable_helpers import import_version
import copy
from datetime import date
from pathlib import Path
import tempfile
import unittest
from backend.tests.client import TestClient

from backend import statistics, backup
from backend.domain import normalize_dataset
from backend.main import create_app
from backend.storage import Store, EMPTY
from backend.tests.test_app import fixture, DAY


class StatisticsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'stats.sqlite'
        self.client = TestClient(create_app(self.path))
        self.dataset = fixture()
        self.client.post('/api/timetable', json=self.dataset).raise_for_status()

    def entry(self, teacher='absent', hours=None, day=DAY, group='abs'):
        return self.client.post('/api/entries', json=dict(day=day, group=group, id=teacher, hours=hours))

    def assign(self, value, key='absent|2|1A'):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=key, value=value))

    def report(self, **params):
        return self.client.get('/api/stats', params=dict(period='custom', start=DAY, end=DAY, **params)).json()

    def test_outcomes_corrections_and_restart(self):
        self.entry(hours=[2]).raise_for_status()
        self.assertEqual(self.report()['totals']['pending'], 1)
        before = self.client.get('/api/day/' + DAY).json()['autoDis']
        self.assign('UNCOVERED').raise_for_status()
        self.assertEqual(self.report()['totals']['uncovered'], 1)
        self.assertEqual(self.client.get('/api/day/' + DAY).json()['autoDis'], before)
        self.assertFalse(self.client.get('/api/day/' + DAY).json()['issues'])
        self.assign('pot').raise_for_status()
        self.assertEqual(self.report()['coverage'], 100)
        self.entry('pot', [2]).raise_for_status()
        self.assertEqual(self.report()['totals']['covered'], 0)
        self.entry('pot', None).raise_for_status()
        self.assertEqual(self.report()['totals']['covered'], 1)
        self.assign(None).raise_for_status()
        self.assertEqual(self.report()['totals']['pending'], 1)
        self.assertEqual(self.assign('UNCOVERED', 'absent|3|1A').status_code, 422)
        self.assign('ENTRA').raise_for_status()
        self.assertEqual(self.report()['totals']['late'], 1)
        self.assertEqual(self.report()['totals']['uncovered'], 0)
        self.assign('ESCE').raise_for_status()
        self.assertEqual(self.report()['totals']['early'], 1)
        reopened = TestClient(create_app(self.path))
        self.assertEqual(reopened.get('/api/stats', params=dict(period='custom', start=DAY, end=DAY)).json(), self.report())

    def test_context_survives_timetable_and_archive_backup(self):
        self.entry(hours=[2]).raise_for_status()
        self.assign('UNCOVERED').raise_for_status()
        archive = self.client.get('/api/export').json()
        modified = copy.deepcopy(self.dataset)
        modified['orario'] = []
        import_version(self.client, modified, '2026-10-19').raise_for_status()
        self.assertEqual(self.report(campus='centrale')['totals']['demand'], 1)
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.report()['totals']['uncovered'], 1)
        bad = copy.deepcopy(archive)
        bad['statistics']['days'][DAY]['absences']['absent|2']['site'] = 'invalid'
        self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
        self.assertEqual(self.client.get('/api/export').json(), archive)
        saved = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'backups'))
        self.entry(hours=None).raise_for_status()
        backup.restore_backup(str(self.path), saved['path'])
        self.assertEqual(self.report()['totals']['uncovered'], 1)
        self.entry('co', [3]).raise_for_status()
        facts = self.client.get('/api/export').json()['statistics']['days'][DAY]['absences']
        self.assertEqual(facts['absent|2']['site'], 'centrale')
        self.assertIsNone(facts['co|3']['site'])

    def test_merged_uncovered_and_invalid_archive_atomicity(self):
        self.entry(hours=[2]).raise_for_status()
        self.entry('co', [2]).raise_for_status()
        self.assign('UNCOVERED').raise_for_status()
        self.assertEqual(self.report()['totals']['uncovered'], 1)
        self.assertEqual(self.report()['totals']['teachers'], 2)
        archive = self.client.get('/api/export').json()
        for value in ('bad', True, None):
            bad = copy.deepcopy(archive)
            bad['statistics']['days'][DAY]['demand']['2|1A']['outcome'] = value
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
            self.assertEqual(self.client.get('/api/export').json(), archive)
        self.client.post('/api/import', json=archive).raise_for_status()
        candidates = self.client.get('/api/candidates', params=dict(day=DAY, key='absent|2|1A')).json()
        uncovered = next(c for c in candidates if c['id'] == 'UNCOVERED')
        self.assertEqual(uncovered['total'], 0)

    def test_legacy_reconstruction_idempotent_and_read_only(self):
        self.entry(hours=[2]).raise_for_status()
        archive = self.client.get('/api/export').json()
        del archive['statistics']
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.report()['provenance'], {'reconstructed': 1})
        with Store(str(self.path)).connect() as db:
            db.execute("DELETE FROM documents WHERE key='statistics'")
        reopened = TestClient(create_app(self.path))
        facts = reopened.get('/api/export').json()['statistics']
        reopened = TestClient(create_app(self.path))
        self.assertEqual(reopened.get('/api/export').json()['statistics'], facts)
        with Store(str(self.path)).connect() as db:
            before = db.execute('SELECT * FROM documents ORDER BY key').fetchall()
        reopened.get('/api/stats').raise_for_status()
        with Store(str(self.path)).connect() as db:
            self.assertEqual(db.execute('SELECT * FROM documents ORDER BY key').fetchall(), before)

    def test_denominators_union_unknown_and_coabsence(self):
        ds = normalize_dataset(self.dataset)
        state = copy.deepcopy(EMPTY)
        state['abs'] = {DAY: {'absent': [2, 3], 'co': [2]}, '2026-10-05': {'wrongcampus': [2]}, '2026-10-06': {}}
        state['permessi'] = {DAY: {'absent': [2]}}
        facts = statistics.sync(ds, state, statistics.empty())
        result = statistics.report(facts, today=date(2026, 10, 13))
        self.assertEqual(result['days'], 2)
        self.assertEqual(result['totals']['teacherHours'], 4)
        self.assertEqual(result['totals']['demand'], 2)
        self.assertEqual(result['totals']['teachers'], 3)
        self.assertEqual(result['unknown']['teacherHours'], 1)
        central = statistics.report(facts, campus='centrale', today=date(2026, 10, 13))
        self.assertEqual(central['weekdays'][0]['demand'], .5)
        self.assertEqual(central['hours'][0]['demand'], 0)
        self.assertEqual(central['heatmap'][1]['demand'], .5)
        self.assertEqual([(d['date'], d['demand']) for d in central['heatmap'][1]['observations']], [('2026-10-05', 0), (DAY, 1)])
        self.assertEqual(result['heatmap'][1]['observations'][1]['teacherHours'], 2)
        self.assertEqual(result['weekdays'][1]['demand'], None)
        state['cf'] = {DAY: {'1A': [2]}}
        corrected = statistics.sync(ds, state, facts, [DAY])
        self.assertEqual(len(corrected['days'][DAY]['demand']), 0)
        self.assertEqual(len(corrected['days'][DAY]['absences']), 3)

    def test_absent_pot_counts_as_teacher_hours_without_class_demand(self):
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2], 'pot': [2]}
        facts = statistics.sync(normalize_dataset(self.dataset), state, statistics.empty())
        result = statistics.report(facts, campus='centrale', today=date(2026, 10, 13))
        self.assertEqual(result['totals']['teacherHours'], 2)
        self.assertEqual(result['totals']['demand'], 1)

    def test_filters_validation_future_orphans(self):
        self.entry(hours=[2], day='2099-10-12').raise_for_status()
        self.assertEqual(self.client.get('/api/stats').json()['days'], 0)
        future = self.client.get('/api/stats', params=dict(period='custom', start='2099-10-01', end='2099-10-20')).json()
        self.assertEqual(future['days'], 0)
        self.assertEqual(future['end'], '2099-10-20')
        for params in ({'campus': 'x'}, {'period': 'x'}, {'period': 'custom'}, {'period': 'custom', 'start': DAY, 'end': '2026-10-01'}):
            self.assertEqual(self.client.get('/api/stats', params=params).status_code, 422)
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2]}
        state['asg'][DAY] = {'absent|3|1A': dict(v='pot', t='POT', c='1A')}
        facts = statistics.sync(normalize_dataset(self.dataset), state, statistics.empty())
        result = statistics.report(facts, today=date(2026, 10, 13))
        self.assertEqual(result['issues'], 1)
        self.assertEqual(result['totals']['covered'], 0)
        self.assertEqual(statistics.report(facts, period='week', today=date(2026, 10, 13))['start'], DAY)
        self.assertEqual(statistics.report(facts, period='month', today=date(2026, 10, 13))['start'], '2026-10-01')
