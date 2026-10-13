import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.domain import normalize_dataset, candidates, rows, validate_assignment, auto_availability, CDC_NAMES, PRIORITIES
from backend.storage import EMPTY
import copy

DAY = '2026-10-12'


def fixture():
    roles = {'co': 'ITP', 'support': 'sostegno'}
    cdcs = {'co': 'B016', 'support': 'SOS'}
    teachers = [{'id': i, 'nome_originale': i, 'ruolo': roles.get(i, 'curricolare'), 'classe_concorso': cdcs.get(i, '')} for i in ['absent', 'co', 'wrongcampus', 'pot', 'utc', 'dis', 'support', 'blank']]
    def l(i, classes, site='centrale', activity=''):
        return dict(docente=i, giorno='lun', ora=2, classi=classes, sede=site, attivita_originale=activity)
    return dict(docenti=teachers, orario=[l('absent', ['1A']), l('co', ['1A']), l('wrongcampus', ['1A'], 'succursale'), l('pot', [], activity='POT'), l('utc', [], activity='U.T.C'), l('dis', [], activity='DI.S'), l('support', ['2A'])])


class RulesTest(unittest.TestCase):
    def setUp(self):
        self.ds = normalize_dataset(fixture())
        self.state = copy.deepcopy(EMPTY)
        self.state['abs'][DAY] = {'absent': [2]}
        self.row = rows(self.ds, self.state, DAY)[0]

    def cs(self):
        return candidates(self.ds, self.state, DAY, self.row)

    def test_coteaching_requires_class_period_and_known_campus(self):
        self.assertEqual(next(c for c in self.cs() if c['id'] == 'co')['ty'], 'C')
        self.assertNotIn('wrongcampus', [c['id'] for c in self.cs()])
        self.ds['lessons']['co|lun|2']['site'] = None
        self.assertNotIn('co', [c['id'] for c in self.cs()])
        self.ds['lessons']['co|lun|3'] = self.ds['lessons'].pop('co|lun|2')
        self.assertNotIn('co', [c['id'] for c in self.cs()])

    def test_blank_manual_absence_and_double_booking(self):
        self.assertNotIn('blank', [c['id'] for c in self.cs()])
        self.state['dis'][DAY] = {'blank': [2]}
        self.assertEqual(validate_assignment(self.ds, self.state, DAY, self.row['k'], 'blank')['t'], 'D')
        self.state['abs'][DAY]['blank'] = [2]
        with self.assertRaisesRegex(ValueError, 'Assente'):
            validate_assignment(self.ds, self.state, DAY, self.row['k'], 'blank')
        del self.state['abs'][DAY]['blank']
        self.state['asg'][DAY] = {'absent|2|2A': {'v': 'blank', 'c': '2A', 't': 'D'}}
        with self.assertRaisesRegex(ValueError, 'Già assegnato'):
            validate_assignment(self.ds, self.state, DAY, self.row['k'], 'blank')

    def test_ranking_and_duties(self):
        cs = self.cs()
        self.assertEqual([c['id'] for c in cs[:4]], ['co', 'pot', 'dis', 'utc'])
        self.assertEqual(next(c for c in cs if c['id'] == 'dis')['ty'], 'DIS')
        self.ds['lessons']['pot|lun|2']['site'] = 'succursale'
        cs = self.cs()
        self.assertGreater(next(c for c in cs if c['id'] == 'pot')['tier'], next(c for c in cs if c['id'] == 'support')['tier'])

    def test_class_out_releases_teacher_and_support_rows_remain(self):
        self.state['cf'][DAY] = {'2A': [2]}
        self.assertEqual(next(c for c in self.cs() if c['id'] == 'support')['ty'], 'D')
        self.state['abs'][DAY]['support'] = [2]
        self.assertEqual(len(rows(self.ds, self.state, DAY)), 1)
        self.state['cf'][DAY] = {}
        self.assertEqual(len(rows(self.ds, self.state, DAY)), 2)

    def test_co_absent_teachers_merge_into_one_row(self):
        self.state['abs'][DAY] = {'absent': [2], 'co': [2]}
        rs = rows(self.ds, self.state, DAY)
        self.assertEqual(len(rs), 1)
        self.assertEqual(rs[0]['ids'], ['absent', 'co'])
        self.assertEqual((rs[0]['id'], rs[0]['k']), ('absent', 'absent|2|1A'))
        ids = [c['id'] for c in candidates(self.ds, self.state, DAY, rs[0])]
        self.assertNotIn('absent', ids)
        self.assertNotIn('co', ids)

    def test_three_co_absent_teachers_merge_into_one_row(self):
        data = fixture()
        data['docenti'].append({'id': 'co2', 'nome_originale': 'co2', 'ruolo': 'curricolare'})
        data['orario'].append(dict(docente='co2', giorno='lun', ora=2, classi=['1A'], sede='centrale', attivita_originale=''))
        ds = normalize_dataset(data)
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2], 'co': [2], 'co2': [2]}
        rs = rows(ds, state, DAY)
        self.assertEqual(len(rs), 1)
        self.assertEqual(rs[0]['ids'], ['absent', 'co', 'co2'])
        self.assertEqual(rs[0]['k'], 'absent|2|1A')

    def test_present_co_teacher_remains_candidate(self):
        self.assertEqual(next(c for c in self.cs() if c['id'] == 'co')['ty'], 'C')

    def test_tie_break_uses_daily_then_total_load(self):
        self.state['dis'][DAY] = {'blank': [2]}
        self.state['disSites'][DAY] = {'blank': 'centrale'}
        self.state['asg']['2026-10-09'] = {'absent|1|1A': dict(v='blank', c='1A', t='D')}
        cs = self.cs()
        self.assertLess(next(i for i,c in enumerate(cs) if c['id']=='pot'), next(i for i,c in enumerate(cs) if c['id']=='blank'))

    def test_uts_forces_branch_and_manual_site_overrides(self):
        self.ds['lessons']['pot|lun|2']['special'] = 'UTS'
        c = next(c for c in self.cs() if c['id'] == 'pot')
        self.assertEqual((c['ty'], c['loc'], c['tier']), ('UTS', 'succursale', 55))
        self.state['dis'][DAY] = {'pot': [2]}
        self.state['disSites'][DAY] = {'pot': 'centrale'}
        c = next(c for c in self.cs() if c['id'] == 'pot')
        self.assertEqual((c['ty'], c['loc'], c['tier']), ('D', 'centrale', 10))

    def test_classe_concorso_survives_normalization(self):
        self.assertEqual(self.ds['teachers']['co']['classe_concorso'], 'B016')
        self.assertEqual(self.ds['teachers']['support']['classe_concorso'], 'SOS')

    def test_cdc_names_known_code_and_fallback(self):
        self.assertEqual(CDC_NAMES['B016'], 'Laboratori di scienze e tecnologie informatiche')
        self.assertEqual(CDC_NAMES.get('ZZ99', 'ZZ99'), 'ZZ99')

    def test_candidate_profile_itp_compresenza(self):
        c = next(c for c in self.cs() if c['id'] == 'co')
        self.assertEqual((c['role'], c['cdc'], c['cdcName']), ('ITP', 'B016', 'Laboratori di scienze e tecnologie informatiche'))
        self.assertEqual(c['clsWeek'], ['1A'])
        self.assertTrue(c['inClass'])

    def test_candidate_profile_sostegno_and_no_badge(self):
        c = next(c for c in self.cs() if c['id'] == 'support')
        self.assertEqual((c['role'], c['cdc'], c['cdcName']), ('sostegno', 'SOS', 'Sostegno'))
        self.assertEqual(c['clsWeek'], ['2A'])
        self.assertFalse(c['inClass'])

    def test_candidate_weekly_classes_sorted_union(self):
        self.ds['lessons']['co|mar|3'] = dict(self.ds['lessons']['co|lun|2'], classes=['3B'])
        c = next(c for c in self.cs() if c['id'] == 'co')
        self.assertEqual(c['clsWeek'], ['1A', '3B'])

    def test_entry_exit_always_visible_and_enabled_at_boundaries(self):
        self.ds['lessons']['absent|lun|1'] = dict(self.ds['lessons']['absent|lun|2'])
        self.ds['lessons']['absent|lun|3'] = dict(self.ds['lessons']['absent|lun|2'])
        mid = self.cs()
        self.assertFalse(next(c for c in mid if c['id'] == 'ENTRA')['enable'])
        self.assertFalse(next(c for c in mid if c['id'] == 'ESCE')['enable'])
        info = next(c for c in mid if c['id'] == 'ENTRA')['info']
        self.assertIn('entra alle 1', info)
        self.assertIn('esce alle 3', info)
        self.state['abs'][DAY]['absent'] = [1, 2, 3]
        first = next(r for r in rows(self.ds, self.state, DAY) if r['h'] == 1)
        last = next(r for r in rows(self.ds, self.state, DAY) if r['h'] == 3)
        self.assertTrue(next(c for c in candidates(self.ds, self.state, DAY, first) if c['id'] == 'ENTRA')['enable'])
        self.assertFalse(next(c for c in candidates(self.ds, self.state, DAY, first) if c['id'] == 'ESCE')['enable'])
        self.assertTrue(next(c for c in candidates(self.ds, self.state, DAY, last) if c['id'] == 'ESCE')['enable'])
        self.assertFalse(next(c for c in candidates(self.ds, self.state, DAY, last) if c['id'] == 'ENTRA')['enable'])
        assignment = validate_assignment(self.ds, self.state, DAY, first['k'], 'ENTRA')
        self.state['asg'][DAY] = {first['k']: assignment}
        self.assertFalse(any(r['h'] == 1 and r['k'] != first['k'] for r in rows(self.ds, self.state, DAY)))
        self.assertEqual(validate_assignment(self.ds, self.state, DAY, first['k'], 'ENTRA')['v'], 'ENTRA')
        self.assertIn('ENTRA', [c['id'] for c in self.cs()])

    def test_exit_chain_esce_at_last_enables_previous_hour(self):
        self.ds['lessons']['absent|lun|6'] = dict(self.ds['lessons']['absent|lun|2'])
        self.ds['lessons']['absent|lun|7'] = dict(self.ds['lessons']['absent|lun|2'])
        self.state['abs'][DAY]['absent'] = [6, 7]
        r7 = next(r for r in rows(self.ds, self.state, DAY) if r['h'] == 7)
        self.assertTrue(next(c for c in candidates(self.ds, self.state, DAY, r7) if c['id'] == 'ESCE')['enable'])
        self.state['asg'][DAY] = {r7['k']: validate_assignment(self.ds, self.state, DAY, r7['k'], 'ESCE')}
        r6 = next(r for r in rows(self.ds, self.state, DAY) if r['h'] == 6)
        self.assertTrue(next(c for c in candidates(self.ds, self.state, DAY, r6) if c['id'] == 'ESCE')['enable'])

    def test_greyed_entry_exit_rejected_and_nothing_stored(self):
        self.ds['lessons']['absent|lun|1'] = dict(self.ds['lessons']['absent|lun|2'])
        self.ds['lessons']['absent|lun|3'] = dict(self.ds['lessons']['absent|lun|2'])
        with self.assertRaisesRegex(ValueError, 'prima ora effettiva'):
            validate_assignment(self.ds, self.state, DAY, self.row['k'], 'ENTRA')
        with self.assertRaisesRegex(ValueError, 'ultima ora effettiva'):
            validate_assignment(self.ds, self.state, DAY, self.row['k'], 'ESCE')
        self.assertNotIn(self.row['k'], self.state['asg'].get(DAY, {}))

    def test_auto_availability_entra_dopo_and_absent_excluded(self):
        self.state['asg'][DAY] = {'absent|2|1A': dict(v='ENTRA', c='1A', t='SPECIAL')}
        aa = auto_availability(self.ds, self.state, DAY)
        self.assertEqual(aa['co'][2], ['1A entra dopo'])
        self.state['abs'][DAY]['co'] = [2]
        aa = auto_availability(self.ds, self.state, DAY)
        self.assertNotIn(2, aa.get('co', {}))

    def test_auto_availability_classe_fuori_and_assigned_excluded(self):
        self.state['cf'][DAY] = {'2A': [2]}
        aa = auto_availability(self.ds, self.state, DAY)
        self.assertEqual(aa['support'][2], ['2A classe fuori'])
        self.state['asg'][DAY] = {'x|2|1A': dict(v='co', c='1A', t='C')}
        aa = auto_availability(self.ds, self.state, DAY)
        self.assertNotIn(2, aa.get('co', {}))

    def test_reject_duplicate_slot_and_unknown_teacher(self):
        x=fixture();x['orario'].append(x['orario'][0])
        with self.assertRaises(ValueError): normalize_dataset(x)
        x=fixture();x['orario'][0]['docente']='missing'
        with self.assertRaises(ValueError): normalize_dataset(x)


class PersistenceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = str(Path(self.tmp.name) / 'test.sqlite')
        self.client = TestClient(create_app(self.path))
        self.assertEqual(self.client.post('/api/timetable', json=fixture()).status_code, 200)

    def tearDown(self): self.tmp.cleanup()

    def post(self, route, **body):
        r=self.client.post('/api/'+route, json=body)
        self.assertEqual(r.status_code, 200, r.text)
        return r

    def test_restart_and_reimport_preserve_ids_and_records(self):
        self.post('entries',day=DAY,group='abs',id='absent',hours=[2])
        self.post('entries',day=DAY,group='dis',id='blank',hours=[2],site='centrale')
        self.post('assignments',day=DAY,key='absent|2|1A',value='blank')
        changed=fixture();changed['docenti'][-1]['nome_originale']='Renamed'
        self.client.post('/api/timetable',json=changed)
        self.client=TestClient(create_app(self.path))
        d=self.client.get('/api/day/'+DAY).json()
        self.assertEqual(d['state']['asg'][DAY]['absent|2|1A']['v'],'blank')
        self.assertEqual(d['dataset']['teachers']['blank']['name'],'Renamed')
        self.assertEqual(d['issues'],[])
        self.post('entries',day=DAY,group='abs',id='blank',hours=[2])
        self.assertEqual(len(self.client.get('/api/day/'+DAY).json()['issues']),1)

    def test_invalid_import_rolls_back(self):
        bad=fixture();bad['orario'].append(bad['orario'][0])
        self.assertEqual(self.client.post('/api/timetable',json=bad).status_code,422)
        self.assertEqual(len(self.client.get('/api/day/'+DAY).json()['dataset']['teachers']),8)

    def test_assignment_revalidated_and_archive_roundtrip(self):
        self.post('entries',day=DAY,group='abs',id='absent',hours=[2])
        self.post('assignments',day=DAY,key='absent|2|1A',value='pot')
        self.assertEqual(self.client.post('/api/assignments',json=dict(day=DAY,key='absent|2|1A',value='blank')).status_code,422)
        archive=self.client.get('/api/export').json()
        self.assertEqual(self.client.post('/api/import',json=archive).status_code,200)
        archive['abs'][DAY]['missing']=[8]
        self.assertEqual(self.client.post('/api/import',json=archive).status_code,422)

    def test_multi_day_manual_defaults_use_each_days_timetable(self):
        self.post('entries',day=DAY,until='2026-10-19',group='dis',id='pot',hours=list(range(1,8)),defaults=True,site='succursale')
        state=self.client.get('/api/day/'+DAY).json()['state']
        self.assertNotIn('2026-10-17',state['dis'])
        self.assertIn(2,state['dis'][DAY]['pot'])

    def test_timetable_change_flags_but_preserves_assignment(self):
        self.post('entries',day=DAY,group='abs',id='absent',hours=[2])
        self.post('assignments',day=DAY,key='absent|2|1A',value='co',exceptional=True)
        changed=fixture()
        changed['orario'][1]['sede']='succursale'
        self.assertEqual(self.client.post('/api/timetable',json=changed).status_code,200)
        d=self.client.get('/api/day/'+DAY).json()
        self.assertEqual(len(d['issues']),1)
        self.assertEqual(d['state']['asg'][DAY]['absent|2|1A']['v'],'co')
        changed['docenti']=[t for t in changed['docenti'] if t['id']!='co']
        changed['orario']=[l for l in changed['orario'] if l['docente']!='co']
        self.assertEqual(self.client.post('/api/timetable',json=changed).status_code,200)
        self.assertTrue(self.client.get('/api/day/'+DAY).json()['dataset']['teachers']['co']['retired'])

    def test_malformed_inputs_return_422(self):
        for invalid in [dict(docenti=[None],orario=[]),dict(docenti=[],orario=[None])]:
            self.assertEqual(self.client.post('/api/timetable',json=invalid).status_code,422)
        self.assertEqual(self.client.post('/api/entries',json=dict(day=DAY,group='abs',id='absent',hours=[True])).status_code,422)

    def test_concurrent_assignments_cannot_double_book(self):
        from concurrent.futures import ThreadPoolExecutor
        self.post('entries',day=DAY,group='abs',id='absent',hours=[2])
        self.post('entries',day=DAY,group='abs',id='support',hours=[2])
        def assign(key):
            return self.client.post('/api/assignments',json=dict(day=DAY,key=key,value='pot')).status_code
        with ThreadPoolExecutor(max_workers=2) as pool:
            statuses=list(pool.map(assign,['absent|2|1A','support|2|2A']))
        self.assertEqual(sorted(statuses),[200,422])

    def test_day_reports_auto_availability(self):
        self.post('entries', day=DAY, group='abs', id='absent', hours=[2])
        self.post('entries', day=DAY, group='cf', id='2A', hours=[2])
        d = self.client.get('/api/day/'+DAY).json()
        self.assertIn('autoDis', d)
        self.assertEqual(d['autoDis'][DAY]['support']['2'], ['2A classe fuori'])  # keys sono stringhe nel JSON

    def test_timetable_upload(self):
        r = self.client.post('/api/timetable', json=fixture())
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(len(self.client.get('/api/day/'+DAY).json()['dataset']['teachers']), 8)


if __name__=='__main__': unittest.main()
