import copy
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.storage import Store, EMPTY
from backend.domain import normalize_dataset, candidates, rows
from backend import recovery, backup

DAY = '2026-10-12'


def fixture():
    return dict(docenti=[dict(id=i, nome_originale=i) for i in ('absent', 'rp', 'normal', 'bottom')],
                orario=[dict(docente=i, giorno='lun', ora=h, classi=classes, sede='centrale', attivita_originale=activity)
                        for i, periods, classes, activity in [('absent', range(1, 8), ['1A'], ''),
                            ('rp', [2, 3, 5], ['2A'], ''), ('normal', range(1, 8), [], 'POT'),
                            ('bottom', [2, 3], ['3A'], '')] for h in periods])


class RecoveryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'db.sqlite'
        self.client = TestClient(create_app(self.path))
        self.raw = fixture()
        self.client.post('/api/timetable', json=self.raw).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=list(range(1, 8)))).raise_for_status()
        self.permit('2026-10-05')

    def permit(self, day, teacher='rp', hours=None, **kw):
        r = self.client.post('/api/permessi', json=dict(day=day, id=teacher, hours=hours or [2], **kw))
        r.raise_for_status()
        return r

    def assign(self, h, value='rp'):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=f'absent|{h}|1A', value=value))

    def register(self):
        return self.client.get('/api/permessi').json()

    def cs(self, h):
        return self.client.get('/api/candidates', params=dict(day=DAY, key=f'absent|{h}|1A')).json()

    def test_deadlines(self):
        for day, end in [('2027-01-31', '2027-02-28'), ('2028-01-31', '2028-02-29'),
                         ('2026-12-31', '2027-01-31'), (DAY, '2026-11-12')]:
            self.assertEqual(recovery.deadline(day), end)
        ledger = recovery.ledger(self.client.get('/api/export').json())
        for day, expected in [('2026-10-04', 0), ('2026-11-05', 1), ('2026-11-06', 0)]:
            self.assertEqual(len(recovery.eligible(ledger, 'rp', day)), expected)
        _, balances = recovery.summary(self.client.get('/api/export').json(), '2026-11-06')
        self.assertEqual(balances['rp'], dict(remaining=1, expired=1, eligible=0))

    def test_ranking_and_restrictions(self):
        self.permit('2026-10-05', 'bottom')
        for h in (1, 4, 6):
            ids = [c['id'] for c in self.cs(h)]
            self.assertLess(ids.index('DIR'), ids.index('rp'))
            if not next(c for c in self.cs(h) if c['id'] == 'bottom')['convenient']:
                self.assertLess(ids.index('rp'), ids.index('bottom'))
            self.assertTrue(next(c for c in self.cs(h) if c['id'] == 'rp')['convenient'])
        self.assertEqual(self.cs(7)[-1]['ty'], 'RP')
        self.assertNotIn('rp', [c['id'] for c in self.cs(2)])
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='rp', hours=[1]))
        self.assertEqual(next(c for c in self.cs(1) if c['id'] == 'rp')['why'], 'Assente')
        self.assertEqual(self.assign(1).status_code, 422)
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='rp', hours=None))
        self.client.post('/api/entries', json=dict(day=DAY, group='dis', id='rp', hours=[1]))
        self.assertEqual(next(c for c in self.cs(1) if c['id'] == 'rp')['ty'], 'D')
        self.assign(1).raise_for_status()
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['remaining'], 1)

    def test_oldest_fixed_links_and_protected_edits(self):
        self.permit('2026-10-12')
        self.assign(1).raise_for_status()
        pid = self.register()['recoveries']['2026-10-05']['rp']['id']
        self.permit('2026-09-28')
        self.assign(1).raise_for_status()
        a = self.client.get('/api/export').json()['asg'][DAY]['absent|1|1A']
        self.assertEqual(a['permitId'], pid)
        for body in [dict(day='2026-10-05', id='rp', hours=None),
                     dict(day='2026-10-05', id='bottom', hours=[2], original_day='2026-10-05', original_id='rp'),
                     dict(day='2026-09-07', id='rp', hours=[2], original_day='2026-10-05', original_id='rp')]:
            self.assertEqual(self.client.post('/api/permessi', json=body).status_code, 422)
        self.client.post('/api/permessi', json=dict(day='2026-09-21', id='rp', hours=[2], original_day='2026-10-05', original_id='rp')).raise_for_status()
        self.assertEqual(self.register()['recoveries']['2026-09-21']['rp']['id'], pid)
        self.assign(4).raise_for_status()
        self.assertEqual(self.register()['recoveries']['2026-09-28']['rp']['recovered'], 1)

    def test_final_hour_lifecycle_statistics_and_concurrency(self):
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda h: self.assign(h).status_code, [1, 4]))
        self.assertEqual(sorted(results), [200, 422])
        saved = self.client.get('/api/export').json()['asg'][DAY]
        key = next(iter(saved)); h = int(key.split('|')[1])
        self.assertEqual(saved[key]['t'], 'RP')
        self.assign(h).raise_for_status()
        self.assertFalse(self.client.get('/api/day/' + DAY).json()['issues'])
        self.assertEqual(self.client.get('/api/stats', params=dict(period='custom', start=DAY, end=DAY)).json()['types']['RP'], 1)
        self.assertEqual(self.assign(h, 'missing').status_code, 422)
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['recovered'], 1)
        self.assign(h, 'normal').raise_for_status()
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['remaining'], 1)
        self.assign(h).raise_for_status()
        self.assign(h, None).raise_for_status()
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['recovered'], 0)

    def test_archive_migration_and_timetable_history(self):
        self.assign(1).raise_for_status()
        archive = self.client.get('/api/export').json()
        self.assertEqual(archive['schema'], 3)
        self.client.post('/api/import', json=archive).raise_for_status()
        for mutation in ('missing', 'wrongteacher', 'nonrp', 'over', 'window', 'duplicate'):
            bad = copy.deepcopy(archive); a = bad['asg'][DAY]['absent|1|1A']
            if mutation == 'missing': a['permitId'] = 'missing'
            if mutation == 'wrongteacher': a['v'] = 'normal'
            if mutation == 'nonrp': a['t'] = 'D'
            if mutation == 'over': bad['asg'][DAY]['absent|4|1A'] = dict(a)
            if mutation == 'window': bad['asg']['2027-01-01'] = bad['asg'].pop(DAY)
            if mutation == 'duplicate':
                bad['permessi'][DAY] = {'rp': [2]}
                bad['permitIds'][DAY] = {'rp': a['permitId']}
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422, mutation)
            self.assertEqual(self.client.get('/api/export').json()['asg'], archive['asg'])
        changed = copy.deepcopy(self.raw)
        changed['orario'].append(dict(docente='rp', giorno='lun', ora=1, classi=['2A'], sede='centrale'))
        self.client.post('/api/timetable', json=changed).raise_for_status()
        self.assertFalse(self.client.get('/api/day/' + DAY).json()['issues'])
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assign(1, None).raise_for_status()
        legacy = self.client.get('/api/export').json(); legacy['schema'] = 1; legacy.pop('permitIds')
        self.client.post('/api/import', json=legacy).raise_for_status()
        ids = self.client.get('/api/export').json()['permitIds']
        self.assertEqual(TestClient(create_app(self.path)).get('/api/export').json()['permitIds'], ids)
        saved = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'backups'))
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', hours=None)).raise_for_status()
        backup.restore_backup(str(self.path), saved['path'])
        self.assertEqual(self.client.get('/api/export').json()['permitIds'], ids)

    def test_startup_migration_and_capacity_reduction(self):
        self.raw['orario'].append(dict(docente='rp', giorno='lun', ora=7, classi=[], sede='centrale', attivita_originale='POT'))
        self.client.post('/api/timetable', json=self.raw).raise_for_status()
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', original_day='2026-10-05', original_id='rp', hours=[2,3])).raise_for_status()
        store = Store(str(self.path))
        with store.connect() as db:
            state = store.read(db, 'state'); state.pop('permitIds')
            state['permitRequests'] = {'2026-10-05': {'rp': '2026-10-01'}}
            store.write(db, 'state', state)
        restarted = TestClient(create_app(self.path))
        archive = restarted.get('/api/export').json()
        for field in ('permessi', 'abs', 'asg', 'permitRequests'):
            self.assertEqual(archive[field], state[field])
        self.assertEqual(TestClient(create_app(self.path)).get('/api/export').json()['permitIds'], archive['permitIds'])
        self.assign(1).raise_for_status(); self.assign(4).raise_for_status()
        r = self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', original_day='2026-10-05', original_id='rp', hours=[2]))
        self.assertEqual(r.status_code, 422)
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['recovered'], 2)

    def test_expired_future_hidden_and_released(self):
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', hours=None)).raise_for_status()
        self.permit('2026-08-03')
        self.assertNotIn('rp', [c['id'] for c in self.cs(1)])
        self.permit('2026-10-19')
        self.assertNotIn('rp', [c['id'] for c in self.cs(1)])
        self.permit('2026-10-05')
        raw = copy.deepcopy(self.raw)
        raw['orario'].append(dict(docente='rp', giorno='lun', ora=1, classi=[], sede='centrale', attivita_originale='GM'))
        self.client.post('/api/timetable', json=raw).raise_for_status()
        self.assertNotIn('rp', [c['id'] for c in self.cs(1)])
        self.assertEqual(self.assign(1).status_code, 422)
        self.client.post('/api/entries', json=dict(day=DAY, group='cf', id='2A', hours=[2])).raise_for_status()
        self.assertEqual(next(c for c in self.cs(2) if c['id'] == 'rp')['ty'], 'D')
        self.assign(2).raise_for_status()
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['recovered'], 0)

    def test_two_sided_travel_unknown_site_and_gaps(self):
        ds = normalize_dataset(self.raw)
        state = copy.deepcopy(EMPTY)
        state['permessi'] = {'2026-10-05': {'rp': [2]}}
        recovery.migrate(state)
        state['abs'][DAY] = {'absent': list(range(1, 8))}
        def candidate(h, site):
            row = next(r for r in rows(ds, state, DAY) if r['h'] == h)
            row['sede'] = site
            return next(c for c in candidates(ds, state, DAY, row) if c['id'] == 'rp')
        self.assertTrue(candidate(1, 'succursale')['why'])
        self.assertTrue(candidate(4, 'succursale')['why'])
        self.assertTrue(candidate(6, 'succursale')['why'])
        del ds['lessons']['rp|lun|2']
        self.assertTrue(candidate(2, 'succursale')['convenient'])
        ds['lessons']['rp|lun|3']['site'] = None
        self.assertFalse(candidate(2, 'centrale')['convenient'])
        ds['lessons']['rp|lun|3']['site'] = 'centrale'
        ds['lessons']['rp|lun|6'] = ds['lessons'].pop('rp|lun|5')
        ds['lessons']['rp|lun|2'] = ds['lessons'].pop('rp|lun|3')
        for h in (3, 4, 5):
            self.assertTrue(candidate(h, 'centrale')['convenient'])
        ds['lessons'] = {k: l for k, l in ds['lessons'].items() if not k.startswith('rp|')}
        self.assertFalse(candidate(1, 'centrale')['convenient'])
        ds['teachers']['rp']['retired'] = True
        row = rows(ds, state, DAY)[0]
        self.assertNotIn('rp', [c['id'] for c in candidates(ds, state, DAY, row)])
