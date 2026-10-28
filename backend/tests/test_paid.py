import copy
from concurrent.futures import ThreadPoolExecutor
from backend.tests.test_recovery import RecoveryTest, DAY
from backend.tests.auth_client import AuthenticatedClient
from backend import paid, timetables
from backend.domain import normalize_dataset
from backend.storage import EMPTY
from backend.tests.test_recovery import fixture


class PaidTest(RecoveryTest):
    def declare(self, teacher='rp', hours=None, weekday=0, expected=None):
        data = self.client.get('/api/paid-availability', params={'day': DAY}).json()
        ref = f'paidAvailability|{weekday}|{teacher}'
        return self.client.post('/api/paid-availability', json=dict(weekday=weekday, id=teacher, hours=hours if hours is not None else [1, 4, 6, 7], expected=expected or {ref: data['concurrency']['records'].get(ref, 'absent')}))

    def choice(self, category, h=1, teacher='rp'):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=f'absent|{h}|1A', value=teacher, category=category))

    def test_declarations_and_concurrency(self):
        self.declare().raise_for_status()
        self.assertEqual(self.declare(hours=[1], expected={'paidAvailability|0|rp': 'absent'}).status_code, 409)
        for hours in ([1, 1], [True], [8]):
            self.assertEqual(self.declare(hours=hours).status_code, 422)
        self.assertEqual(self.declare(weekday=5).status_code, 422)
        data = self.client.get('/api/paid-availability', params={'day': DAY}).json()
        cell = next(c for c in data['cells'] if c['weekday'] == 0 and c['hour'] == 1)
        self.assertEqual(cell['teachers'][0]['sites'], ['centrale'])

    def test_explicit_choice_switch_notification_and_roundtrip(self):
        self.declare().raise_for_status()
        self.assertEqual({c['ty'] for c in self.cs(1) if c['id'] == 'rp'}, {'RP', 'PAID'})
        self.choice('PAID').raise_for_status()
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['remaining'], 1)
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|1|1A', notified=True)).raise_for_status()
        self.choice('PAID').raise_for_status()
        archive = self.client.get('/api/export').json()
        a = archive['asg'][DAY]['absent|1|1A']
        self.assertTrue(a['notified']); self.assertEqual(a['assignedBy'], 'centrale')
        self.client.post('/api/import', json=archive).raise_for_status()
        self.choice('RP').raise_for_status()
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['remaining'], 0)
        self.assertEqual(self.client.get('/api/paid-availability').json()['totals'], {})
        self.choice('PAID').raise_for_status()
        a = self.client.get('/api/export').json()['asg'][DAY]['absent|1|1A']
        self.assertFalse(a['notified']); self.assertNotIn('permitId', a)
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['remaining'], 1)
        self.declare(hours=[]).raise_for_status()
        self.assertEqual(self.client.get('/api/paid-availability').json()['totals'], {'rp': 1})
        self.assertEqual(self.choice('PAID', h=4).status_code, 422)
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|1|1A')).raise_for_status()
        self.assertEqual(self.client.get('/api/paid-availability').json()['totals'], {})

    def test_permission_and_malformed_import(self):
        self.declare().raise_for_status(); self.choice('PAID').raise_for_status()
        other = AuthenticatedClient(self.client.app, campus='succursale')
        self.assertEqual(other.post('/api/assignments', json=dict(day=DAY, key='absent|1|1A', notified=True)).status_code, 403)
        archive = self.client.get('/api/export').json()
        for field, value in [('notified', 'yes'), ('assignedBy', 'fake'), ('paidContext', {})]:
            broken = copy.deepcopy(archive); broken['asg'][DAY]['absent|1|1A'][field] = value
            self.assertEqual(self.client.post('/api/import', json=broken).status_code, 422)
        self.assertEqual(self.client.get('/api/paid-availability').json()['totals'], {'rp': 1})

    def test_paid_cannot_bypass_absence_or_occupied_hour(self):
        self.declare(hours=[1, 2]).raise_for_status()
        self.assertEqual(self.choice('PAID', h=2).status_code, 422)
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='rp', hours=[1])).raise_for_status()
        self.assertEqual(self.choice('PAID').status_code, 422)
        stats = self.client.get('/api/stats/availability', params={'date': DAY}).json()
        cell = next(c for c in stats['cells'] if c['weekday'] == 0 and c['hour'] == 1)
        self.assertIn('rp', [t['id'] for t in cell['paid']])

    def test_free_day_unknown_campus_and_travel(self):
        ds = normalize_dataset(fixture()); state = copy.deepcopy(EMPTY)
        state['paidAvailability'] = {'0': {'rp': [1, 4, 7]}, '1': {'rp': [1]}}
        self.assertEqual(paid.slot(ds, state, '2026-10-13', 1, 'rp')['sites'], ['centrale', 'succursale'])
        self.assertEqual(paid.slot(ds, state, DAY, 4, 'rp')['sites'], ['centrale'])
        for l in ds['lessons'].values():
            l['site'] = None
        info = paid.slot(ds, state, DAY, 1, 'rp')
        self.assertEqual(info['sites'], ['centrale', 'succursale']); self.assertTrue(info['uncertain'])

    def test_shared_edit_and_versioned_report(self):
        from backend.tests.timetable_helpers import import_version
        other = AuthenticatedClient(self.client.app, campus='succursale')
        other.post('/api/paid-availability', json=dict(weekday=0, id='rp', hours=[1], expected={'paidAvailability|0|rp': 'absent'})).raise_for_status()
        self.declare(weekday=2, hours=[1]).raise_for_status()
        changed = copy.deepcopy(self.raw)
        changed['orario'].append(dict(docente='rp', giorno='mer', ora=2, classi=['2A'], sede='succursale', attivita_originale=''))
        import_version(self.client, changed, effective='2026-10-14').raise_for_status()
        data = self.client.get('/api/paid-availability', params={'day': DAY}).json()
        monday = next(c for c in data['cells'] if c['weekday'] == 0 and c['hour'] == 1)
        wednesday = next(c for c in data['cells'] if c['weekday'] == 2 and c['hour'] == 1)
        self.assertEqual(monday['teachers'][0]['sites'], ['centrale'])
        self.assertEqual(wednesday['teachers'][0]['sites'], ['succursale'])

    def test_fair_order_future_booking_and_concurrent_booking(self):
        self.declare().raise_for_status(); self.declare(teacher='bottom').raise_for_status()
        future = '2026-10-19'
        self.client.post('/api/entries', json=dict(day=future, group='abs', id='absent', hours=[1])).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=future, key='absent|1|1A', value='bottom', category='PAID')).raise_for_status()
        self.assertEqual([c['id'] for c in self.cs(1) if c['ty'] == 'PAID'], ['rp', 'bottom'])
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: self.choice('PAID').status_code, range(2)))
        self.assertIn(200, results)
        self.assertEqual(self.client.get('/api/paid-availability').json()['totals'], {'rp': 1, 'bottom': 1})
        opts = self.client.get('/api/availability', params=dict(day=DAY, hour=4, campus='all')).json()
        self.assertIn('PAID', [c['ty'] for c in opts])

    def test_failed_recovery_switch_legacy_and_stable_history(self):
        self.declare().raise_for_status()
        self.assign(1).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json()['asg'][DAY]['absent|1|1A']['t'], 'RP')
        self.choice('PAID', h=4).raise_for_status()
        before = self.client.get('/api/export').json()
        self.assertEqual(self.choice('RP', h=4).status_code, 422)
        self.assertEqual(self.client.get('/api/export').json()['asg'], before['asg'])
        old = copy.deepcopy(before); old.pop('paidAvailability')
        old['asg'][DAY].pop('absent|4|1A'); old.pop('statistics')
        self.client.post('/api/import', json=old).raise_for_status()
        self.assertEqual(self.client.get('/api/paid-availability').json()['declarations'], {})

    def test_paid_report_receptions_and_retired_history(self):
        ds = normalize_dataset(fixture()); history = timetables.baseline(ds)
        state = copy.deepcopy(EMPTY); state['paidAvailability'] = {'0': {'rp': [1, 4]}}
        ds['receptions'] = [dict(teacher='rp', day='lun', hour=4, site='centrale')]
        self.assertEqual(paid.slot(ds, state, DAY, 4, 'rp')['why'], 'Impegnato nell’orario')
        ds['teachers']['rp']['retired'] = True
        self.assertEqual(paid.slot(ds, state, DAY, 1, 'rp')['sites'], [])

    def test_two_rows_cannot_book_teacher_in_same_hour(self):
        self.declare(hours=[1]).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='bottom', hours=[1, 2])).raise_for_status()
        changed = copy.deepcopy(self.raw)
        changed['orario'].append(dict(docente='bottom', giorno='lun', ora=1, classi=['3A'], sede='centrale', attivita_originale=''))
        from backend.tests.timetable_helpers import import_version
        import_version(self.client, changed).raise_for_status()
        def assign(key):
            client = TestClient(self.client.app)
            return client.post('/api/assignments', json=dict(day=DAY, key=key, value='rp', category='PAID')).status_code
        from backend.tests.client import TestClient
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(assign, ['absent|1|1A', 'bottom|1|3A']))
        self.assertEqual(sorted(results), [200, 422])
        self.assertEqual(self.client.get('/api/paid-availability').json()['totals'], {'rp': 1})
