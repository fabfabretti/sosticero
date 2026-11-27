"""Regression checks for ordinary and newly created timetable overrides."""
import copy
import unittest

from backend import overrides, timetables
from backend.domain import normalize_dataset
from backend.tests.test_app import fixture


class FullHourOverridesTest(unittest.TestCase):
    def setUp(self):
        self.history = timetables.baseline(normalize_dataset(fixture()))
        self.dataset = self.history['versions'][0]['dataset']
        self.cells = overrides.cells(self.dataset, 'absent')

    def propose(self, cells, **extra):
        return overrides.propose(overrides.empty(), self.history, dict(
            teacher='absent', start='2026-10-12', end=None, cells=cells, **extra))[0]

    def test_ordinary_lesson_move_is_atomic(self):
        cells = copy.deepcopy(self.cells)
        cells['mar|3'], cells['lun|2'] = cells['lun|2'], None
        document = self.propose(cells)
        self.assertEqual(len(document['records'][0]['groups']), 1)
        self.history['_overrides'] = document
        effective = timetables.dataset(self.history, '2026-10-13')
        self.assertEqual(effective['lessons']['absent|mar|3'], self.cells['lun|2'])
        self.assertNotIn('absent|lun|2', effective['lessons'])

    def test_ordinary_swap_preserves_payloads(self):
        for teacher in ('absent', 'co', 'support'):
            with self.subTest(teacher=teacher):
                base = overrides.cells(self.dataset, teacher)
                base['mar|3'] = copy.deepcopy(self.dataset['lessons']['pot|lun|2'])
                target = copy.deepcopy(base)
                target['lun|2'], target['mar|3'] = target['mar|3'], target['lun|2']
                groups = overrides.full_groups(base, target, self.dataset['classes'], {'POT'}, self.dataset['teachers'][teacher]['role'], [['lun|2', 'mar|3']])
                self.assertEqual(len(groups), 1)
                self.assertEqual(groups[0]['after']['mar|3'], base['lun|2'])
                self.assertEqual(groups[0]['after']['lun|2'], base['mar|3'])

    def test_create_and_expire_without_changing_import(self):
        original = copy.deepcopy(self.dataset)
        cells = copy.deepcopy(self.cells)
        cells['mar|3'] = copy.deepcopy(cells['lun|2'])
        document = overrides.propose(overrides.empty(), self.history, dict(
            teacher='absent', start='2026-10-12', end='2026-10-16', cells=cells))[0]
        self.history['_overrides'] = document
        self.assertIn('absent|mar|3', timetables.dataset(self.history, '2026-10-13')['lessons'])
        self.assertNotIn('absent|mar|3', timetables.dataset(self.history, '2026-10-20')['lessons'])
        self.assertEqual(self.dataset, original)

    def test_direct_edits_are_independent_and_move_links_are_atomic(self):
        cells = copy.deepcopy(self.cells)
        cells['mar|3'], cells['lun|2'] = dict(cells['lun|2'], site='succursale'), None
        cells['mer|4'] = dict(self.cells['lun|2'], classes=['1A'])
        document = self.propose(cells, links=[['lun|2', 'mar|3']])
        groups = document['records'][0]['groups']
        self.assertEqual(sorted(len(g['before']) for g in groups), [1, 2])
        self.assertEqual(overrides.validate(document, self.history), document)
        changed = copy.deepcopy(self.dataset)
        changed['lessons']['absent|mar|3'] = copy.deepcopy(self.cells['lun|2'])
        self.history['versions'].append(dict(id='new', effective='2026-10-19', dataset=changed))
        document, report = overrides.reconcile(document, self.history)
        self.assertTrue(any(r['review'] for r in report))
        actual = overrides.apply(document, self.history['versions'][-1], changed, '2026-10-19')
        self.assertIn('absent|lun|2', actual['lessons'])
        self.assertIn('absent|mer|4', actual['lessons'])
        self.assertEqual(overrides.validate(document, self.history), document)

    def test_conversion_and_multiclass_preservation(self):
        self.dataset['lessons']['absent|lun|2']['classes'] = ['1A', '2A']
        cells = overrides.cells(self.dataset, 'absent')
        cells['lun|2'].update(activities=['POT'], special='POT', site='succursale')
        doc = self.propose(cells, links=[])
        self.history['_overrides'] = doc
        hour = timetables.dataset(self.history, '2026-10-12')['lessons']['absent|lun|2']
        self.assertEqual(hour['classes'], ['1A', '2A'])
        self.assertEqual(hour['special'], 'POT')
        self.assertEqual(overrides.validate(doc, self.history), doc)

    def test_malformed_values_and_unknown_kind_are_rejected(self):
        for update in ({'site': 'unknown'}, {'classes': ['missing']}, {'activities': ['UNKNOWN'], 'special': ''}, {'disabled': 'yes'}, {'extra': 1}, {'classes': [], 'activities': [], 'special': ''}):
            with self.subTest(update=update), self.assertRaises(ValueError):
                cells = copy.deepcopy(self.cells)
                cells['lun|2'].update(update)
                self.propose(cells)
        with self.assertRaises(ValueError):
            self.propose(self.cells, links=[['lun|2', 'bad']])

    def test_bounded_revision_reset_and_deletion(self):
        original = copy.deepcopy(self.cells['lun|2'])
        cells = copy.deepcopy(self.cells)
        cells['mar|3'] = copy.deepcopy(original)
        doc = self.propose(cells, links=[])
        revised = copy.deepcopy(self.cells)
        revised['lun|2'] = None
        doc, _ = overrides.propose(doc, self.history, dict(teacher='absent', start='2026-10-19', end='2026-10-23', cells=revised, links=[]))
        self.history['_overrides'] = doc
        self.assertNotIn('absent|lun|2', timetables.dataset(self.history, '2026-10-19')['lessons'])
        self.assertIn('absent|mar|3', timetables.dataset(self.history, '2026-10-26')['lessons'])
        doc, _ = overrides.propose(doc, self.history, dict(teacher='absent', start='2026-10-26', end=None, reset=True))
        self.history['_overrides'] = doc
        self.assertNotIn('absent|mar|3', timetables.dataset(self.history, '2026-10-27')['lessons'])
        reset = doc['records'][-1]
        doc, _ = overrides.remove(doc, dict(teacher='absent', start=reset['start'], id=reset['id'], delete=True))
        self.history['_overrides'] = doc
        self.assertIn('absent|mar|3', timetables.dataset(self.history, '2026-10-27')['lessons'])

    def test_legacy_groups_remain_valid(self):
        base = overrides.cells(self.dataset, 'pot')
        target = copy.deepcopy(base)
        target['mar|3'], target['lun|2'] = target['lun|2'], None
        legacy = overrides.empty()
        legacy['records'].append(dict(id='legacy', teacher='pot', start='2026-10-12', end=None, reset=False, groups=overrides.groups(base, target, self.dataset['classes'], 'curricolare')))
        self.assertEqual(overrides.validate(legacy, self.history), legacy)
        self.history['_overrides'] = legacy
        self.assertIn('pot|mar|3', timetables.dataset(self.history, '2026-10-13')['lessons'])
        invalid = copy.deepcopy(legacy)
        invalid['records'][0]['groups'][0]['after']['mar|3']['classes'] = ['1A']
        with self.assertRaises(ValueError):
            overrides.validate(invalid, self.history)


class FullHourApiTest(unittest.TestCase):
    def setUp(self):
        import os
        import tempfile
        from pathlib import Path
        from unittest.mock import patch
        from backend.main import create_app
        from backend.tests.client import TestClient
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        with patch.dict(os.environ, {'BACKUP_ON_STARTUP': 'false'}):
            self.client = TestClient(create_app(Path(self.tmp.name) / 'test.sqlite'))
        self.client.post('/api/timetable', json=fixture()).raise_for_status()

    def test_independent_commitments_warn_and_survive_save(self):
        archive = self.client.get('/api/export').json()
        archive['receptions'] = dict(schema=1, versions=[dict(effective='2026-10-12', rows=[dict(teacher='absent', day='mar', hour=3, name='absent', time='', location='', site='centrale')])])
        archive['studentGroupHours'] = dict(schema=1, records=[dict(id='g', teacher='absent', day='mar', hour=3, site='centrale', room='', sources=[{'class': '1A', 'count': None}], start='2026-10-12', end=None)])
        self.client.post('/api/import', json=archive).raise_for_status()
        data = self.client.get('/api/orari', params={'day': '2026-10-12'}).json()
        cells = overrides.cells(data['dataset'], 'absent')
        cells['mar|3'] = copy.deepcopy(cells['lun|2'])
        body = dict(teacher='absent', start='2026-10-12', end=None, cells=cells, links=[], basis=data['basis'])
        preview = self.client.post('/api/orari/preview', json=body)
        preview.raise_for_status()
        self.assertEqual({x['message'].split(':')[0] for x in preview.json()['overlaps']}, {'Ricevimento', 'Gruppo studenti'})
        self.client.post('/api/orari/override', json={**body, 'token': preview.json()['token']}).raise_for_status()
        after = self.client.get('/api/export').json()
        self.assertEqual(after['receptions'], archive['receptions'])
        self.assertEqual(after['studentGroupHours'], archive['studentGroupHours'])
        self.client.post('/api/import', json=after).raise_for_status()

    def test_itp_conversion_class_and_availability(self):
        day = '2026-10-12'
        self.client.post('/api/entries', json=dict(day=day, group='abs', id='absent', hours=[2])).raise_for_status()
        data = self.client.get('/api/orari', params={'day': day}).json()
        cells = overrides.cells(data['dataset'], 'co')
        cells['lun|2'].update(activities=['POT'], special='POT', classes=['1A'])
        body = dict(teacher='co', start=day, end=None, cells=cells, links=[], basis=data['basis'])
        preview = self.client.post('/api/orari/preview', json=body)
        preview.raise_for_status()
        self.client.post('/api/orari/override', json={**body, 'token': preview.json()['token']}).raise_for_status()
        data = self.client.get('/api/orari', params={'day': day}).json()
        self.assertEqual(data['dataset']['teachers']['co']['role'], 'ITP')
        self.assertEqual(data['dataset']['lessons']['co|lun|2']['classes'], ['1A'])
        candidates = self.client.get('/api/candidates', params=dict(day=day, key='absent|2|1A')).json()
        candidate = next(c for c in candidates if c['id'] == 'co')
        self.assertFalse(candidate['exceptional'])
        body.update(cells=overrides.cells(data['dataset'], 'co'), basis=data['basis'])
        body['cells']['lun|2']['disabled'] = True
        preview = self.client.post('/api/orari/preview', json=body)
        preview.raise_for_status()
        self.client.post('/api/orari/override', json={**body, 'token': preview.json()['token']}).raise_for_status()
        candidates = self.client.get('/api/candidates', params=dict(day=day, key='absent|2|1A')).json()
        self.assertTrue(next(c for c in candidates if c['id'] == 'co')['exceptional'])
        data = self.client.get('/api/orari', params={'day': day}).json()
        self.assertEqual(data['dataset']['lessons']['co|lun|2']['classes'], ['1A'])
        body.update(cells=overrides.cells(data['dataset'], 'co'), basis=data['basis'])
        body['cells']['lun|2'].pop('disabled')
        preview = self.client.post('/api/orari/preview', json=body)
        preview.raise_for_status()
        self.client.post('/api/orari/override', json={**body, 'token': preview.json()['token']}).raise_for_status()
        data = self.client.get('/api/orari', params={'day': day}).json()
        self.assertEqual(data['dataset']['lessons']['co|lun|2']['classes'], ['1A'])
        self.assertFalse(next(c for c in self.client.get('/api/candidates', params=dict(day=day, key='absent|2|1A')).json() if c['id'] == 'co')['exceptional'])
        body.update(cells=overrides.cells(data['dataset'], 'co'), basis=data['basis'])
        body['cells']['lun|2']['classes'] = []
        preview = self.client.post('/api/orari/preview', json=body)
        preview.raise_for_status()
        self.client.post('/api/orari/override', json={**body, 'token': preview.json()['token']}).raise_for_status()
        self.assertEqual(self.client.get('/api/orari', params={'day': day}).json()['dataset']['lessons']['co|lun|2']['classes'], [])

    def test_new_hour_rejects_stale_preview(self):
        day = '2026-10-12'
        data = self.client.get('/api/orari', params={'day': day}).json()
        cells = overrides.cells(data['dataset'], 'absent')
        cells['mar|3'] = copy.deepcopy(cells['lun|2'])
        body = dict(teacher='absent', start=day, end=None, cells=cells, links=[], basis=data['basis'])
        preview = self.client.post('/api/orari/preview', json=body)
        preview.raise_for_status()
        self.client.post('/api/entries', json=dict(day=day, group='abs', id='absent', hours=[2])).raise_for_status()
        self.assertEqual(self.client.post('/api/orari/override', json={**body, 'token': preview.json()['token']}).status_code, 409)
        self.assertFalse(self.client.get('/api/orari', params={'day': day}).json()['overrides'])
