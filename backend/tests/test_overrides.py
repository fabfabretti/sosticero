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
        with self.assertRaises(ValueError):
            self.save(target={'x': None})
        with self.assertRaises(ValueError):
            self.save(end='2026-10-11')

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

class SupportOverridesTest(unittest.TestCase):
    def setUp(self):
        self.history = tt.baseline(normalize_dataset(fixture()))
        self.ds = self.history['versions'][0]['dataset']
        self.base = o.cells(self.ds, 'support')

    def propose(self, target, teacher='support'):
        return o.propose(o.empty(), self.history, dict(teacher=teacher, start='2026-10-12', end=None, cells=target))[0]

    def test_support_move_edit_and_mixed_swap_roundtrip(self):
        for destination in (None, copy.deepcopy(self.ds['lessons']['pot|lun|2']), dict(self.base['lun|2'], room='other')):
            with self.subTest(destination=destination):
                self.ds['lessons'].pop('support|mar|3', None)
                if destination:
                    self.ds['lessons']['support|mar|3'] = destination
                base = o.cells(self.ds, 'support')
                target = copy.deepcopy(base)
                target['mar|3'], target['lun|2'] = target['lun|2'], target['mar|3']
                target['mar|3']['classes'] = ['1A']
                target['mar|3']['site'] = 'succursale'
                doc = self.propose(target)
                self.assertEqual(len(doc['records'][0]['groups']), 1)
                self.assertEqual(o.validate(doc, self.history), doc)
                actual = o.apply(doc, self.history['versions'][0], self.ds, '2026-10-13')
                self.assertEqual(actual['lessons']['support|mar|3']['classes'], ['1A'])
                self.assertEqual(actual['lessons']['support|mar|3']['room'], base['lun|2']['room'])

    def test_reject_bad_payloads_and_allow_other_roles(self):
        for update in ({'classes': ['unknown']}, {'classes': ['1A', '2A']}, {'site': 'unknown'}, {'disabled': 'yes'}):
            with self.subTest(update=update), self.assertRaises(ValueError):
                target = copy.deepcopy(self.base)
                target['lun|2'].update(update)
                self.propose(target)
        for teacher in ('absent', 'co'):
            target = o.cells(self.ds, teacher)
            target['mar|3'], target['lun|2'] = target['lun|2'], None
            self.assertTrue(self.propose(target, teacher)['records'][0]['groups'])

    def test_multiclass_move_and_single_class_correction(self):
        self.ds['lessons']['support|lun|2']['classes'] = ['1A', '2A']
        self.base = o.cells(self.ds, 'support')
        target = copy.deepcopy(self.base)
        target['mar|3'], target['lun|2'] = target['lun|2'], None
        self.assertEqual(o.validate(self.propose(target), self.history)['schema'], 1)
        target['mar|3']['classes'] = ['1A']
        self.assertEqual(o.validate(self.propose(target), self.history)['schema'], 1)

    def test_role_or_cell_change_suspends_whole_swap(self):
        self.ds['lessons']['support|mar|3'] = copy.deepcopy(self.ds['lessons']['pot|lun|2'])
        base = o.cells(self.ds, 'support')
        target = copy.deepcopy(base)
        target['mar|3'], target['lun|2'] = target['lun|2'], target['mar|3']
        doc = self.propose(target)
        for change in ('source', 'destination'):
            ds = copy.deepcopy(self.ds)
            if change == 'role': ds['teachers']['support']['role'] = 'curricolare'
            else: ds['lessons']['support|' + ('lun|2' if change == 'source' else 'mar|3')]['room'] = 'new'
            history = copy.deepcopy(self.history)
            history['versions'].append(dict(id='new', effective='2026-10-19', dataset=ds))
            reconciled, report = o.reconcile(doc, history)
            self.assertTrue(any(r['review'] for r in report))
            self.assertEqual(o.apply(reconciled, history['versions'][-1], ds, '2026-10-19')['lessons'], ds['lessons'])
            self.assertEqual(o.validate(reconciled, history), reconciled)

    def test_archive_uses_start_version_role_and_detached_original(self):
        older = copy.deepcopy(self.ds)
        older['teachers']['support']['role'] = 'curricolare'
        current = self.history['versions'][0]
        current['effective'] = '2026-10-12'
        self.history['versions'].insert(0, dict(id='older', effective=None, dataset=older))
        target = copy.deepcopy(self.base)
        target['mar|3'], target['lun|2'] = target['lun|2'], None
        doc = self.propose(target)
        self.assertEqual(o.validate(doc, self.history), doc)
        current['dataset']['lessons']['support|lun|2']['site'] = 'succursale'
        self.assertEqual(o.validate(doc, self.history), doc)
        current['dataset']['teachers']['support']['role'] = 'ITP'
        self.assertEqual(o.validate(doc, self.history), doc)

    def test_effective_support_with_inheritance_groups_receptions_and_availability(self):
        from backend import appointments, receptions, student_groups
        from backend.domain import auto_availability
        from backend.storage import EMPTY
        target = copy.deepcopy(self.base)
        target['mar|3'], target['lun|2'] = dict(target['lun|2'], classes=['1A']), None
        self.history['_overrides'] = self.propose(target)
        reception = dict(teacher='support', day='mar', hour=3, name='support', time='', location='', site='centrale')
        self.history['_receptions'] = receptions.replace(receptions.empty(), '2026-10-12', [reception])
        group = dict(id='g1', teacher='support', day='mar', hour=3, site='centrale', room='20', sources=[{'class':'1A','count':5}], start='2026-10-12', end=None)
        self.history['_studentGroups'] = dict(schema=1, records=[group])
        before = copy.deepcopy(self.history)
        active = tt.dataset(self.history, '2026-10-13')
        self.assertEqual(active['receptions'], [reception])
        self.assertEqual(active['studentGroups'], [group])
        self.assertEqual(active['lessons']['support|mar|3']['classes'], ['1A'])
        self.assertEqual(self.history, before)
        # Independent records can constrain availability; check class-out without them.
        self.history.pop('_receptions'); self.history.pop('_studentGroups')
        state = copy.deepcopy(EMPTY)
        state['cf']['2026-10-13'] = {'1A': [3]}
        self.assertIn(3, auto_availability(tt.dataset(self.history, '2026-10-13'), state, '2026-10-13').get('support', []))
        doc = appointments.empty()
        doc['people']['replacement'] = dict(id='replacement', name='Replacement', code='', role='sostegno', classe_concorso='SOS')
        doc['absences'] = [dict(id='absence',person='support',start='2026-10-12',end=None)]
        doc['appointments'] = [dict(id='coverage',source='support',person='replacement',start='2026-10-12',end=None)]
        appointments.validate(doc, self.history)
        self.history['_appointments'] = doc
        active = tt.dataset(self.history, '2026-10-13')
        self.assertEqual(active['lessons']['replacement|mar|3']['classes'], ['1A'])
        self.assertNotIn('replacement|lun|2', active['lessons'])
