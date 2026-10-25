import copy
import unittest

from backend.domain import candidates, candidate_order, rank_candidate, rows, validate_assignment
from backend.hour_types import merge_types
from backend.storage import EMPTY
from backend.tests.test_app import DAY, fixture
from backend.domain import normalize_dataset


class CandidateOrderingTest(unittest.TestCase):
    def setUp(self):
        raw = fixture()
        for code, site in [('PE', 'centrale'), ('ALF', 'succursale'), ('STAFF', None), ('UTS', 'succursale')]:
            raw['docenti'].append(dict(id=code))
            raw['orario'].append(dict(docente=code, giorno='lun', ora=2, classi=[], sede=site, attivita_originale=code))
        self.ds = normalize_dataset(raw)
        self.state = copy.deepcopy(EMPTY)
        self.state['abs'][DAY] = {'absent': [2]}
        self.row = rows(self.ds, self.state, DAY)[0]
        self.rules = merge_types(self.ds, {})
        for code in ('PE', 'ALF', 'STAFF'):
            self.rules['code:'+code].update(available=True, visible=True, school=True)

    def choices(self):
        return candidates(self.ds, self.state, DAY, self.row, self.rules)

    def test_full_hierarchy_and_campus(self):
        self.ds['lessons']['dis|lun|2']['site'] = 'succursale'
        cs = self.choices()
        self.assertEqual([c['id'] for c in cs], ['co', 'ENTRA', 'ESCE', 'dis', 'PE', 'pot', 'DIR', 'utc', 'ALF', 'UTS', 'STAFF', 'support', 'UNCOVERED'])
        self.assertEqual(next(c for c in cs if c['id'] == 'dis')['loc'], 'succursale')
        self.assertEqual(next(c for c in cs if c['id'] == 'UTS')['tier'], 6)
        self.assertTrue(next(c for c in cs if c['id'] == 'ESCE')['enable'])
        self.ds['lessons']['absent|lun|3'] = dict(self.ds['lessons']['absent|lun|2'])
        self.assertFalse(next(c for c in self.choices() if c['id'] == 'ESCE')['enable'])
        self.row['sede'] = 'succursale'
        cs = {c['id']: c for c in self.choices()}
        self.assertEqual(cs['UTS']['tier'], 5)
        self.assertEqual(cs['utc']['tier'], 6)
        self.assertEqual(cs['DIR']['tier'], 5)
        self.assertEqual(cs['ALF']['tier'], 4)
        self.row['sede'] = None
        self.assertEqual(next(c for c in self.choices() if c['id'] == 'PE')['tier'], 7)

    def test_policy_and_multiple_code_order(self):
        for school in (False, None, True):
            self.rules['code:PE'].update(available=False, school=school)
            self.assertEqual('PE' in {c['id'] for c in self.choices()}, school is True)
            if school is not True:
                with self.assertRaises(ValueError):
                    validate_assignment(self.ds, self.state, DAY, self.row['k'], 'PE', self.rules, exceptional=True)
        self.rules['code:PE']['visible'] = False
        self.assertNotIn('PE', {c['id'] for c in self.choices()})
        self.rules['code:PE'].update(visible=True, available=True)
        self.rules['code:ALF'].update(available=False, school=False)
        for codes in (['PE', 'ALF'], ['ALF', 'PE']):
            self.ds['lessons']['PE|lun|2']['activities'] = codes
            self.assertNotIn('PE', {c['id'] for c in self.choices()})
        self.rules['code:ALF'].update(available=True, school=True)
        for codes in (['PE', 'ALF'], ['ALF', 'PE']):
            self.ds['lessons']['PE|lun|2']['activities'] = codes
            self.assertEqual(next(c for c in self.choices() if c['id'] == 'PE')['tier'], 4)

    def test_affinity_exact_target_and_blocked_positions(self):
        self.ds['teachers']['absent']['classe_concorso'] = 'A041'
        self.ds['teachers']['pot']['classe_concorso'] = 'A041'
        self.ds['teachers']['PE']['classe_concorso'] = 'A020'
        self.state['abs'][DAY]['pot'] = [2]
        cs = self.choices()
        ids = [c['id'] for c in cs]
        self.assertLess(ids.index('pot'), ids.index('PE'))
        pot = next(c for c in cs if c['id'] == 'pot')
        self.assertTrue(pot['sameCdc'])
        self.assertEqual(pot['why'], 'Assente')
        self.assertFalse(next(c for c in cs if c['id'] == 'PE')['sameCdc'])
        with self.assertRaisesRegex(ValueError, 'Assente'):
            validate_assignment(self.ds, self.state, DAY, self.row['k'], 'pot', self.rules, exceptional=True)
        self.ds['teachers']['absent']['classe_concorso'] = ''
        self.assertFalse(any(c.get('sameCdc') for c in self.choices()))
        del self.state['abs'][DAY]['pot']
        self.state['asg'][DAY] = {'other|2|2B': dict(v='pot', c='2B', t='POT')}
        self.assertEqual(next(c for c in self.choices() if c['id'] == 'pot')['why'], 'Già assegnato in questa ora')

    def test_tie_breakers_and_rp(self):
        def c(i, **values):
            return dict(id=i, name=i, ty='POT', tier=4, today=0, total=0, **values)
        items = [c('z', inClass=True), c('b', sameCdc=True), c('a'), c('both', inClass=True, sameCdc=True)]
        self.assertEqual([x['id'] for x in sorted(items, key=candidate_order)], ['b', 'both', 'z', 'a'])
        items = [c('a'), c('b')]
        items[0]['today'] = 1
        self.assertEqual(sorted(items, key=candidate_order)[0]['id'], 'b')
        items[0]['today'] = 0; items[0]['total'] = 1
        self.assertEqual(sorted(items, key=candidate_order)[0]['id'], 'b')
        rp = dict(id='rp', name='RP', ty='RP', loc=None, today=5, total=20, convenient=True)
        rp['tier'] = rank_candidate(rp, self.row)
        other = dict(rp, id='other', convenient=False, inClass=True, today=0)
        self.assertEqual(sorted([other, rp], key=candidate_order)[0]['id'], 'rp')
        self.assertEqual(rp['tier'], 8)

    def test_disp_inherits_released_lesson_and_manual_site(self):
        self.state['cf'][DAY] = {'2A': [2]}
        self.ds['lessons']['support|lun|2']['site'] = 'succursale'
        candidate = next(c for c in self.choices() if c['id'] == 'support')
        self.assertEqual((candidate['ty'], candidate['loc'], candidate['tier']), ('D', 'succursale', 3))
        self.state['dis'][DAY] = {'support': [2]}
        self.state['disSites'][DAY] = {'support': 'centrale'}
        self.assertEqual(next(c for c in self.choices() if c['id'] == 'support')['loc'], 'centrale')

    def test_itp_other_class_uses_configured_fallback(self):
        self.ds['lessons']['co|lun|2']['classes'] = ['2A']
        candidate = next(c for c in self.choices() if c['id'] == 'co')
        self.assertTrue(candidate['exceptional'])
        self.assertEqual(candidate['tier'], 9)
        self.rules['derived:itp']['visible'] = False
        self.assertNotIn('co', {c['id'] for c in self.choices()})

    def test_grouped_row_cdc_uses_selected_owner(self):
        self.state['abs'][DAY]['co'] = [2]
        self.ds['teachers']['absent']['classe_concorso'] = 'A041'
        self.ds['teachers']['co']['classe_concorso'] = 'B016'
        self.ds['teachers']['pot']['classe_concorso'] = 'B016'
        self.ds['teachers']['PE']['classe_concorso'] = 'A041'
        self.row = rows(self.ds, self.state, DAY)[0]
        cs = {c['id']: c for c in self.choices()}
        self.assertTrue(cs['PE']['sameCdc'])
        self.assertFalse(cs['pot']['sameCdc'])

    def test_name_and_id_ties_are_stable(self):
        base = dict(ty='POT', tier=4, today=0, total=0)
        cs = [dict(base, id='z', name='anna'), dict(base, id='a', name='Anna')]
        self.assertEqual([c['id'] for c in sorted(cs, key=candidate_order)], ['a', 'z'])
