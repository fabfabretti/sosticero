import copy
from datetime import date
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from backend import student_groups, timetables, statistics, availability, paid, permit_context
from backend.domain import normalize_dataset, eligibility, auto_availability, default_availability, manual_candidates
from backend.main import create_app
from backend.storage import EMPTY
from backend.tests.client import TestClient

DAY = '2026-11-16'


def record(**changes):
    return dict(id='g1', teacher='group', day='lun', hour=3, site='centrale', room='Aula 20', sources=[{'class': '1A', 'count': 5}, {'class': '2A', 'count': None}], start=DAY, end=None, **changes) if not changes else dict(record(), **changes)


def fixture():
    return dict(docenti=[dict(id=i, nome_originale=i) for i in ('group', 'absent', 'other')], orario=[dict(docente='absent', giorno='lun', ora=3, classi=['1A'], sede='centrale'), dict(docente='other', giorno='mar', ora=2, classi=['2A'], sede='centrale')])


class GroupRulesTest(unittest.TestCase):
    def setUp(self):
        self.doc = dict(schema=1, records=[record()])
        self.history = timetables.baseline(normalize_dataset(fixture()))
        self.history['_studentGroups'] = self.doc

    def test_validation_dates_counts_and_duplicates(self):
        student_groups.validate(self.doc, {'group'}, {'1A', '2A'})
        for changed in (dict(count=0), dict(count=True), dict(count=-1)):
            doc = copy.deepcopy(self.doc)
            doc['records'][0]['sources'][0].update(changed)
            with self.assertRaises(ValueError): student_groups.validate(doc)
        for changes in (dict(teacher='missing'), dict(end='2026-11-15'), dict(hour=True), dict(day=[]), dict(site=[])):
            with self.assertRaises((ValueError, TypeError)): student_groups.validate(dict(schema=1, records=[record(**changes)]), {'group'}, {'1A', '2A'})
        for duplicate in (record(), record(id='g2')):
            with self.assertRaises(ValueError): student_groups.validate(dict(schema=1, records=[record(), duplicate]))
        with self.assertRaises(ValueError): student_groups.validate(self.doc, {'group'}, {'1A'})
        self.assertFalse(student_groups.on_day(self.doc, '2026-11-15'))
        ended = dict(schema=1, records=[record(end=DAY)])
        self.assertEqual(len(student_groups.on_day(ended, DAY)), 1)
        self.assertFalse(student_groups.on_day(ended, '2026-11-17'))
        self.assertFalse(timetables.resolver(dict(self.history, _studentGroups=ended))('2026-11-17')['studentGroups'])

    def test_occupancy_no_class_demand_and_historical_context(self):
        ds = timetables.dataset(self.history, DAY)
        state = copy.deepcopy(EMPTY)
        state['abs'] = {DAY: {'absent': [3], 'group': [3]}}
        from backend.domain import rows
        self.assertEqual(len(rows(ds, state, DAY)), 2)
        self.assertEqual(len(student_groups.reviews(ds, state, DAY)), 1)
        facts = timetables.sync(self.history, state, statistics.empty())
        self.assertEqual(len(facts['days'][DAY]['absences']), 2)
        self.assertEqual(len(facts['days'][DAY]['demand']), 2)
        self.assertEqual(facts['days'][DAY]['absences']['group|3']['group']['room'], 'Aula 20')
        self.history['_studentGroups']['records'][0]['site'] = 'succursale'
        self.assertEqual(timetables.sync(self.history, state, facts), facts)
        statistics.validate(facts, timetables.resolver(self.history), state)
        state['abs'][DAY].pop('group')
        state['dis'] = {DAY: {'group': [3]}}
        row = rows(ds, state, DAY)[0]
        self.assertIsNone(eligibility(ds, state, DAY, row, ds['teachers']['group']))
        self.assertNotIn(3, default_availability(ds, 'group', DAY))
        self.assertIn('gruppo', next(c for c in manual_candidates(ds, state, DAY, row) if c['id'] == 'group')['tag'])
        self.assertIn('Impegnato', paid.slot(ds, state, DAY, 3, 'group', declared=False)['why'])
        self.assertEqual(permit_context.project(ds, dict(schema=1, teachers={}))['hours']['group']['lun'], [3])
        state['cf'] = {DAY: {'1A': [3], '2A': [3]}}
        ds['lessons']['group|lun|3'] = dict(classes=['1A'], room=None, site='centrale', special='POT', activities=['POT'])
        self.assertNotIn('group', auto_availability(ds, state, DAY))
        self.assertTrue(student_groups.conflicts(ds))
        self.assertIsNone(eligibility(ds, state, DAY, row, ds['teachers']['group']))
        result = availability.report(self.history, state, {}, date.fromisoformat(DAY))
        self.assertFalse(any(t['id'] == 'group' for c in result['cells'] if c['date'] == DAY and c['hour'] == 3 for t in c['available'] + c['recovery'] + c['paid']))


class GroupApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'test.sqlite'
        with patch.dict(os.environ, {'BACKUP_ON_STARTUP': 'false'}):
            self.app = create_app(self.path)
            self.client = TestClient(self.app)
        self.client.post('/api/timetable', json=fixture()).raise_for_status()

    def save(self, records, revision=None):
        revision = revision or self.client.get('/api/student-groups').json()['revision']
        return self.client.post('/api/student-groups', json=dict(revision=revision, document=dict(schema=1, records=records)))

    def test_persistence_archive_legacy_and_atomic_rejection(self):
        self.save([record()]).raise_for_status()
        doc = self.client.get('/api/student-groups').json()['document']
        self.assertEqual(doc['records'], [record()])
        self.assertFalse(self.client.get('/api/orari?day=2026-11-15').json()['dataset']['studentGroups'])
        self.assertEqual(self.client.get('/api/orari?day='+DAY).json()['dataset']['studentGroups'], [record()])
        archive = self.client.get('/api/export').json()
        self.assertEqual(archive['schema'], 13)
        self.client.post('/api/import', json=archive).raise_for_status()
        legacy = copy.deepcopy(archive); legacy['schema'] = 12; legacy.pop('studentGroupHours')
        self.client.post('/api/import', json=legacy).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json()['studentGroupHours'], doc)
        bad = copy.deepcopy(archive); bad['studentGroupHours']['records'][0]['sources'][0]['count'] = True
        self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
        self.assertEqual(self.client.get('/api/export').json(), archive)
        missing = copy.deepcopy(archive); missing.pop('studentGroupHours')
        self.assertEqual(self.client.post('/api/import', json=missing).status_code, 422)
        self.assertEqual(self.save([record(teacher='missing')]).status_code, 422)
        self.assertEqual(self.save([record(id='g2')], revision='stale').status_code, 409)
        with patch.dict(os.environ, {'BACKUP_ON_STARTUP': 'false'}):
            restarted = TestClient(create_app(self.path))
        self.assertEqual(restarted.get('/api/student-groups').json()['document'], doc)
        from backend import backup
        import sqlite3
        snapshot = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'snapshots'))
        restored_path = Path(self.tmp.name) / 'restored.sqlite'
        with sqlite3.connect(snapshot['path']) as source, sqlite3.connect(restored_path) as destination:
            source.backup(destination)
        with patch.dict(os.environ, {'BACKUP_ON_STARTUP': 'false'}):
            restored = TestClient(create_app(restored_path))
        self.assertEqual(restored.get('/api/student-groups').json()['document'], doc)

    def test_absence_review_and_overlap_keeps_ordinary_rows(self):
        self.save([record(teacher='absent')]).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[3])).raise_for_status()
        daily = self.client.get('/api/day/'+DAY).json()
        self.assertEqual(len(daily['rows']), 2)
        self.assertEqual(len(daily['groupReviews']), 1)
        self.assertEqual(daily['groupReviews'][0]['status'], 'Da valutare')
        self.assertTrue(self.client.get('/api/student-groups?day='+DAY).json()['conflicts'])
        archive = self.client.get('/api/export').json()
        self.assertEqual(len(archive['statistics']['days'][DAY]['absences']), 1)
        self.client.post('/api/import', json=archive).raise_for_status()

    def test_existing_assignment_is_retained_and_flagged(self):
        self.client.post('/api/entries', json=dict(day=DAY, group='dis', id='group', hours=[3])).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[3])).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|3|1A', value='group')).raise_for_status()
        assignment = self.client.get('/api/day/'+DAY).json()['state']['asg'][DAY]['absent|3|1A']
        self.save([record()]).raise_for_status()
        daily = self.client.get('/api/day/'+DAY).json()
        self.assertEqual(daily['state']['asg'][DAY]['absent|3|1A'], assignment)
        self.assertTrue(any(issue['key'] == 'absent|3|1A' for issue in daily['issues']))
        self.assertFalse(daily['groupReviews'])

    def test_group_substitution_is_assignable_and_reported_once(self):
        self.save([record()]).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='dis', id='other', hours=[3])).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='group', hours=[3])).raise_for_status()
        daily = self.client.get('/api/day/' + DAY).json()
        self.assertEqual(len(daily['rows']), 1)
        row = daily['rows'][0]
        self.assertEqual(row['label'], 'Gruppo: 1A (5) + 2A')
        self.client.post('/api/assignments', json=dict(day=DAY, key=row['k'], value='other')).raise_for_status()
        daily = self.client.get('/api/day/' + DAY).json()
        self.assertEqual(daily['state']['asg'][DAY][row['k']]['v'], 'other')
        archive = self.client.get('/api/export').json()
        demand = list(archive['statistics']['days'][DAY]['demand'].values())
        self.assertEqual(len(demand), 1)
        self.assertEqual(demand[0]['outcome'], 'covered')
        self.client.post('/api/import', json=archive).raise_for_status()

    def test_campus_permissions_and_new_entries_fixture(self):
        from collections import Counter
        import json
        document = json.loads((Path(__file__).parents[2] / 'openspec/changes/add-student-group-hours/entries.json').read_text())
        records = document['records']
        self.assertEqual(Counter(r['site'] for r in records), {'centrale': 10, 'succursale': 5})
        self.assertEqual(Counter(r['teacher'] for r in records), {'d080': 5, 'd135': 6, 'd051': 2, 'd119': 1, 'd038': 1})
        teachers = {r['teacher'] for r in records}
        classes = {s['class'] for r in records for s in r['sources']}
        student_groups.validate(document, teachers, classes)
        for r in records:
            self.assertEqual(r['start'], DAY)
            self.assertTrue(r['teacher'])
        roster = dict(docenti=[dict(id=i) for i in teachers], orario=[dict(docente='d080', giorno='lun', ora=1, classi=sorted(classes))])
        history = timetables.baseline(normalize_dataset(roster))
        history['_studentGroups'] = document
        for offset in range(5):
            from datetime import timedelta
            day = (date.fromisoformat(DAY) + timedelta(days=offset)).isoformat()
            ds = timetables.dataset(history, day)
            state = copy.deepcopy(EMPTY)
            from backend.domain import DAYS, rows
            matching = [r for r in records if r['day'] == DAYS[offset]]
            state['abs'][day] = {i: sorted({r['hour'] for r in matching if r['teacher'] == i}) for i in teachers}
            self.assertEqual(len(student_groups.reviews(ds, state, day)), len(matching))
            self.assertEqual(len(rows(ds, state, day)), len(matching))
            for r in matching:
                self.assertIsNotNone(student_groups.at(ds, r['teacher'], day, r['hour']))
        succursale = TestClient(self.app, campus='succursale')
        revision = succursale.get('/api/student-groups').json()['revision']
        body = dict(revision=revision, document=dict(schema=1, records=[record()]))
        self.assertEqual(succursale.post('/api/student-groups', json=body).status_code, 403)
        body['document']['records'][0]['site'] = 'succursale'
        succursale.post('/api/student-groups', json=body).raise_for_status()
        self.assertEqual(self.save([]).status_code, 403)
