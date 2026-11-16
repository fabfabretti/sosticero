import copy
from unittest.mock import patch
from backend.tests.test_recovery import RecoveryTest, DAY
from backend.tests.test_campus_notices import NoticeAPI
from backend.tests.client import TestClient
from backend.main import create_app
from backend import refusals, concurrency
from backend.storage import Store


class RefusalAPI(RecoveryTest):
    key = 'absent|1|1A'

    def history(self):
        return self.client.get('/api/export').json()['substitutionRefusals']

    def refuse(self, **kw):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=self.key, refused=True, **kw))

    def test_release_recovery_history_reassign_and_restart(self):
        self.assign(1).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key=self.key, accepted=True)).raise_for_status()
        original = self.client.get('/api/export').json()
        self.refuse().raise_for_status()
        current = self.client.get('/api/export').json()
        self.assertNotIn(self.key, current['asg'][DAY])
        self.assertEqual(current['permessi'], original['permessi'])
        demand = next(r for r in current['statistics']['days'][DAY]['demand'].values() if r['key'] == self.key)
        self.assertIsNone(demand['assignment'])
        self.assertEqual(demand['outcome'], 'pending')
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['remaining'], 1)
        expected = {DAY: {self.key: [dict(teacher='rp', name='rp')]}}
        self.assertEqual(self.history(), expected)
        self.assertEqual(self.refuse().status_code, 422)
        self.assertEqual(self.client.post('/api/assignments', json=dict(day=DAY, key=self.key, refused=False)).status_code, 422)
        self.assign(1).raise_for_status()
        assignment = self.client.get('/api/export').json()['asg'][DAY][self.key]
        self.assertFalse(assignment.get('accepted', False))
        self.refuse().raise_for_status()
        self.assertEqual(self.history(), expected)
        self.assign(1, 'normal').raise_for_status()
        self.assign(1, None).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=None)).raise_for_status()
        restarted = TestClient(create_app(self.path))
        self.addCleanup(restarted.close)
        self.assertEqual(restarted.get('/api/export').json()['substitutionRefusals'], expected)
        restarted.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[1])).raise_for_status()
        self.assertEqual(restarted.get('/api/day/' + DAY).json()['state']['substitutionRefusals'], expected)

    def test_invalid_permission_stale_and_atomic_failure(self):
        self.assign(1).raise_for_status()
        original = self.client.get('/api/export').json()
        for extra in ({'value': None}, {'accepted': False}, {'note': 'forged'}, {'category': 'RP'}, {'exceptional': False}):
            self.assertEqual(self.refuse(**extra).status_code, 422)
        other = TestClient(create_app(self.path), campus='succursale')
        self.addCleanup(other.close)
        self.assertEqual(other.post('/api/assignments', json=dict(day=DAY, key=self.key, refused=True)).status_code, 403)
        with patch('backend.refusals.record', side_effect=ValueError('failure')):
            self.assertEqual(self.refuse().status_code, 422)
        self.assertEqual(self.client.get('/api/export').json(), original)
        tokens = self.client.get('/api/day/' + DAY).json()['concurrency']['records']
        self.assign(1, 'normal').raise_for_status()
        self.assertEqual(self.refuse(expected={f'asg|{DAY}|{self.key}': tokens[f'asg|{DAY}|{self.key}']}).status_code, 409)
        self.assertEqual(self.refuse().status_code, 422)
        self.assertEqual(self.history(), {})

    def test_archive_roundtrip_legacy_and_invalid_history(self):
        self.assign(1).raise_for_status()
        self.refuse().raise_for_status()
        archive = self.client.get('/api/export').json()
        self.assertEqual(archive['schema'], 13)
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.history(), archive['substitutionRefusals'])
        for history in ([], {DAY: {'bad': []}}, {DAY: {self.key: [{'teacher': '', 'name': 'x'}]}}, {DAY: {self.key: [dict(teacher='rp', name='x')]*2}}):
            bad = dict(archive, substitutionRefusals=history)
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
            self.assertEqual(self.history(), archive['substitutionRefusals'])
        # History may refer to a professor/row absent from the current catalog.
        archive['substitutionRefusals'][DAY][self.key].append(dict(teacher='retired', name='Retired professor'))
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.history(), archive['substitutionRefusals'])
        legacy = copy.deepcopy(archive)
        legacy['schema'] = 11
        legacy.pop('substitutionRefusals')
        self.client.post('/api/import', json=legacy).raise_for_status()
        self.assertEqual(self.history(), {})

    def test_paid_release_removes_usage(self):
        self.client.post('/api/paid-availability', json=dict(weekday=0, id='rp', hours=[1], expected={'paidAvailability|0|rp': 'absent'})).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key=self.key, value='rp', category='PAID')).raise_for_status()
        current = self.client.get('/api/paid-finance').json()
        current['config']['sites']['centrale'] = dict(budget=10000, laureato=3000, diplomato=3000)
        self.client.post('/api/paid-finance', json=dict(config=current['config'], expected=current['expected'])).raise_for_status()
        self.assertEqual(self.client.get('/api/paid-availability', params={'day': DAY}).json()['finance']['sites']['centrale']['cost'], 3000)
        self.assertEqual(len(self.client.get('/api/paid-availability', params={'day': DAY}).json()['records']), 1)
        self.refuse().raise_for_status()
        self.assertEqual(self.client.get('/api/paid-availability', params={'day': DAY}).json()['records'], [])
        self.assertEqual(self.client.get('/api/paid-availability', params={'day': DAY}).json()['finance']['sites']['centrale']['cost'], 0)
        self.assertEqual(self.register()['recoveries']['2026-10-05']['rp']['remaining'], 1)


class GroupRefusalAPI(NoticeAPI):
    def test_group_release_and_history(self):
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2,3,4])).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).raise_for_status()
        self.toggle('refused').raise_for_status()
        data = self.data()
        self.assertEqual(list(data['state']['asg'][DAY]), ['absent|2|1A'])
        self.assertEqual(data['state']['asg'][DAY]['absent|2|1A']['v'], 'pot')
        for h in (3, 4):
            self.assertEqual(data['state']['substitutionRefusals'][DAY][f'absent|{h}|1A'][0]['teacher'], 'blank')
        self.assertEqual(data['campusNotices'], {})

    def test_group_stale_member_and_rollback(self):
        baseline = self.data()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|4|1A', value=None)).raise_for_status()
        self.assertEqual(self.toggle('refused', baseline=baseline).status_code, 409)
        self.assertIn('absent|3|1A', self.data()['state']['asg'][DAY])
        self.assertEqual(self.data()['state']['substitutionRefusals'], {})
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|4|1A', value='blank')).raise_for_status()
        original = self.data()['state']
        real_record = refusals.record
        def fail_second(state, day, key, teacher, name):
            real_record(state, day, key, teacher, name)
            if '|4|' in key:
                raise ValueError('failure')
        with patch('backend.refusals.record', side_effect=fail_second):
            self.assertEqual(self.toggle('refused').status_code, 422)
        self.assertEqual(self.data()['state'], original)

    def test_group_nonmessage_member_change_and_permission(self):
        baseline = self.data()
        store = Store(self.app.state.identities.path.parent / 'test.sqlite')
        with store.connect() as db:
            state = store.read(db, 'state')
            state['asg'][DAY]['absent|4|1A']['exceptional'] = True
            store.write(db, 'state', state)
        self.assertEqual(self.toggle('refused', baseline=baseline).status_code, 409)
        other = TestClient(self.app, campus='succursale')
        self.addCleanup(other.close)
        tokens = self.data()['concurrency']['records']
        refs = [concurrency.key(g, DAY, 'absent|3|1A') for g in ('asg', 'campusNotice')]
        response = other.post('/api/assignments', json=dict(day=DAY, key='absent|3|1A', refused=True, campus_notice=True, expected={r:tokens[r] for r in refs}))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(self.data()['state']['asg'][DAY]), 2)
        self.assertEqual(self.data()['state']['substitutionRefusals'], {})
