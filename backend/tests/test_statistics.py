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
        self.assertEqual(future['days'], 1)
        self.assertEqual(future['end'], '2099-10-20')
        mixed = self.client.get('/api/stats', params=dict(period='custom', start='2000-01-01', end='2099-10-20')).json()
        self.assertEqual(mixed['days'], 1)
        empty = self.client.get('/api/stats', params=dict(period='custom', start='2099-11-01', end='2099-11-20')).json()
        self.assertEqual(empty['days'], 0)
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

class AbsenceBreakdownsTest(unittest.TestCase):
    def test_scopes_overlap_classification_corrections_and_identity(self):
        ds = normalize_dataset(fixture())
        state = copy.deepcopy(EMPTY)
        state['abs'] = {DAY: {'absent': [2], 'co': [2, 3]}}
        state['permessi'] = {DAY: {'absent': [2]}}
        state['absenceKinds'] = {DAY: {'absent': 'planned', 'co': 'trip'}}
        state['permitKinds'] = {DAY: {'absent': 'last_minute'}}
        facts = statistics.sync(ds, state, statistics.empty())
        names = {'absent': {'name': 'Stesso nome'}, 'co': {'name': 'Stesso nome'}}
        def report(**kwargs):
            return statistics.report(facts, today=date(2026, 10, 13), state=state, teachers=names, **kwargs)
        result = report()
        self.assertEqual(result['totals']['teacherHours'], 3)
        self.assertEqual(sum(r['hours'] for r in result['teacherAbsences']), 3)
        self.assertEqual([r['id'] for r in result['teacherAbsences']], ['co', 'absent'])
        self.assertEqual([r['days'] for r in result['teacherAbsences']], [1, 1])
        kinds = {r['kind']: r for r in result['absenceTypes']}
        self.assertEqual(kinds['last_minute']['hours'], 1)
        self.assertEqual(kinds['trip']['hours'], 2)
        self.assertAlmostEqual(sum(r['percentage'] for r in result['absenceTypes']), 100)
        central = report(campus='centrale')
        self.assertEqual(central['totals']['demand'], 1)
        self.assertEqual(sum(r['hours'] for r in central['teacherAbsences']), central['totals']['teacherHours'])
        self.assertEqual(sum(r['hours'] for r in report(campus='succursale')['absenceTypes']), 0)
        # Corrections use current metadata without rewriting captured campus/hour context.
        before = copy.deepcopy(facts)
        state['permitKinds'][DAY]['absent'] = 'planned'
        self.assertEqual(next(r for r in report()['absenceTypes'] if r['kind'] == 'planned')['hours'], 1)
        state['absenceKinds'][DAY]['co'] = 'assembly'
        self.assertEqual(next(r for r in report()['absenceTypes'] if r['kind'] == 'assembly')['hours'], 2)
        self.assertEqual(facts, before)
        legacy = statistics.report(facts, today=date(2026, 10, 13))
        self.assertEqual(next(r for r in legacy['absenceTypes'] if r['kind'] == 'unclassified')['hours'], 3)
        self.assertEqual({r['name'] for r in legacy['teacherAbsences']}, {'absent', 'co'})
        empty = report(period='custom', start=date(2026, 10, 13), end=date(2026, 10, 13))
        self.assertEqual(empty['teacherAbsences'], [])
        self.assertTrue(all(r['percentage'] is None for r in empty['absenceTypes']))

    def test_api_uses_names_and_categories_without_rewriting_facts(self):
        with tempfile.TemporaryDirectory() as tmp:
            client = TestClient(create_app(Path(tmp) / 'stats.sqlite'))
            client.post('/api/timetable', json=fixture()).raise_for_status()
            entry = dict(day=DAY, group='abs', id='absent', hours=[2], classification='planned')
            client.post('/api/entries', json=entry).raise_for_status()
            query = dict(period='custom', start=DAY, end=DAY)
            report = client.get('/api/stats', params=query).json()
            self.assertEqual(report['teacherAbsences'][0]['name'], normalize_dataset(fixture())['teachers']['absent']['name'])
            self.assertEqual(next(r for r in report['absenceTypes'] if r['kind'] == 'planned')['percentage'], 100)
            facts = client.get('/api/export').json()['statistics']
            client.post('/api/entries', json=dict(entry, classification='last_minute')).raise_for_status()
            updated = client.get('/api/stats', params=query).json()
            self.assertEqual(next(r for r in updated['absenceTypes'] if r['kind'] == 'last_minute')['percentage'], 100)
            self.assertEqual(client.get('/api/export').json()['statistics'], facts)
            client.post('/api/orari/name', json=dict(teacher='absent', value=dict(name='Anna Rossi', originalName='assente'), previous=None)).raise_for_status()
            self.assertEqual(client.get('/api/stats', params=query).json()['teacherAbsences'][0]['name'], 'Anna Rossi (assente)')
            changed = fixture()
            changed['docenti'] = [t for t in changed['docenti'] if t['id'] != 'absent']
            changed['orario'] = [r for r in changed['orario'] if r['docente'] != 'absent']
            import_version(client, changed, '2026-10-19').raise_for_status()
            self.assertEqual(client.get('/api/stats', params=query).json()['teacherAbsences'][0]['hours'], 1)
