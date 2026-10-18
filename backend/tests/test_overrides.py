import copy
import unittest
from backend import overrides as o, timetables as tt
from backend.domain import normalize_dataset
from backend.tests.test_app import fixture

class OverridesTest(unittest.TestCase):
    def setUp(self):
        self.history = tt.baseline(normalize_dataset(fixture()))
        self.ds = self.history['versions'][0]['dataset']
        self.base = o.cells(self.ds, 'pot')
        self.assertEqual(len(self.base), 35)

    def save(self, doc=None, start='2026-10-12', end=None, target=None, reset=False):
        return o.propose(doc or o.empty(), self.history, dict(teacher='pot', start=start, end=end, cells=target or self.base, reset=reset))[0]

    def moved(self):
        target = copy.deepcopy(self.base)
        target['mar|3'], target['lun|2'] = target['lun|2'], None
        return target

    def test_move_and_original_preserved(self):
        original = copy.deepcopy(self.ds)
        doc = self.save(target=self.moved())
        self.history['_overrides'] = doc
        actual = tt.dataset(self.history, '2026-10-13')
        self.assertIn('pot|mar|3', actual['lessons'])
        self.assertNotIn('pot|lun|2', actual['lessons'])
        self.assertEqual(original, self.ds)
        self.assertEqual(o.validate(doc, self.history), doc)

    def test_overlap_expiry_and_reset(self):
        doc = self.save(target=self.moved())
        disabled = copy.deepcopy(self.base)
        disabled['lun|2']['disabled'] = True
        doc = self.save(doc, '2026-10-19', '2026-10-23', disabled)
        self.assertEqual(o.selected(doc, 'pot', '2026-10-23')['start'], '2026-10-19')
        self.assertEqual(o.selected(doc, 'pot', '2026-10-24')['start'], '2026-10-12')
        doc = self.save(doc, '2026-10-26', reset=True)
        doc = self.save(doc, '2026-11-02', '2026-11-06', disabled)
        self.assertTrue(o.selected(doc, 'pot', '2026-11-07')['reset'])
        self.assertIsNone(o.selected(doc, 'pot', '2026-10-11'))

    def test_invalid_edits(self):
        for target in ({}, {**self.base, 'lun|2': None}, {**self.base, 'mar|3': self.base['lun|2']}):
            with self.assertRaises(ValueError):
                self.save(target=target if target else {'x': None})
        with self.assertRaises(ValueError):
            self.save(end='2026-10-11')
        target = copy.deepcopy(o.cells(self.ds, 'absent'))
        target['mar|3'], target['lun|2'] = target['lun|2'], None
        with self.assertRaises(ValueError):
            o.groups(o.cells(self.ds, 'absent'), target)

    def test_import_conflict_sticky_and_atomic(self):
        doc = self.save(target=self.moved())
        imported = copy.deepcopy(self.ds)
        imported['lessons']['pot|mar|3'] = copy.deepcopy(self.base['lun|2'])
        self.history['versions'].append(dict(id='new', effective='2026-10-19', dataset=imported))
        doc, report = o.reconcile(doc, self.history)
        self.assertTrue(any(r['review'] for r in report))
        self.assertEqual(o.apply(doc, self.history['versions'][1], imported, '2026-10-19')['lessons'], imported['lessons'])
        self.history['versions'].append(dict(id='again', effective='2026-10-26', dataset=self.ds))
        doc, _ = o.reconcile(doc, self.history)
        self.assertEqual(o.apply(doc, self.history['versions'][2], self.ds, '2026-10-26')['lessons'], self.ds['lessons'])

    def test_same_start_revision_and_swap(self):
        ds = copy.deepcopy(self.ds)
        ds['lessons']['pot|mar|3'] = copy.deepcopy(ds['lessons']['utc|lun|2'])
        base = o.cells(ds, 'pot'); target = copy.deepcopy(base)
        target['mar|3'], target['lun|2'] = target['lun|2'], target['mar|3']
        self.assertEqual(len(o.groups(base, target)), 1)
        doc = self.save(target=self.moved())
        doc = self.save(doc, target=self.base)
        self.assertEqual(len(doc['records']), 2)
        self.assertFalse(o.selected(doc, 'pot', '2026-10-12')['groups'])
