import copy
import tempfile
import unittest
from pathlib import Path
from backend import campus_notices, concurrency
from backend.domain import normalize_dataset
from backend.storage import EMPTY
from backend.main import create_app
from backend.tests.client import TestClient
from backend.tests.auth_client import AuthenticatedClient
from backend.tests.test_app import fixture, DAY


def setup_data():
    raw = fixture()
    for h in (3, 4):
        raw['orario'].append(dict(docente='absent', giorno='lun', ora=h, classi=['1A'], sede='centrale', aula='12'))
        raw['orario'].append(dict(docente='support', giorno='lun', ora=h, classi=['2A'], sede='succursale', aula='20'))
    ds = normalize_dataset(raw)
    state = copy.deepcopy(EMPTY)
    state['abs'][DAY] = {'absent': [3, 4]}
    state['dis'][DAY] = {'blank': [3, 4]}
    state['disSites'][DAY] = {'blank': 'succursale'}
    state['asg'][DAY] = {f'absent|{h}|1A': dict(v='blank', t='D', c='1A') for h in (3, 4)}
    return raw, ds, state


class NoticeRules(unittest.TestCase):
    def setUp(self):
        _, self.ds, self.state = setup_data()

    def test_grouping_origins_and_unknown(self):
        notices = campus_notices.groups(self.ds, self.state, DAY)
        self.assertEqual(len(notices), 2)
        self.assertEqual([r['h'] for r in notices['absent|3|1A']['rows']], [3, 4])
        for site in ('centrale', None):
            self.state['disSites'][DAY]['blank'] = site
            self.assertEqual(campus_notices.groups(self.ds, self.state, DAY), {})

    def test_automatic_availability_and_manual_override(self):
        self.state['cf'][DAY] = {'2A': [3, 4]}
        for a in self.state['asg'][DAY].values():
            a['v'] = 'support'
        self.assertEqual(len(campus_notices.groups(self.ds, self.state, DAY)), 2)
        self.state['dis'][DAY]['support'] = [3]
        self.state['disSites'][DAY]['support'] = 'centrale'
        self.assertEqual(list(campus_notices.groups(self.ds, self.state, DAY)), ['absent|4|1A'])
        self.state['abs'][DAY]['support'] = [4]
        self.assertEqual(campus_notices.groups(self.ds, self.state, DAY), {})

    def acknowledge(self):
        notice = next(iter(campus_notices.groups(self.ds, self.state, DAY).values()))
        for a in self.state['asg'][DAY].values():
            a['campusNotice'] = dict(fingerprint=notice['fingerprint'], communicated=True, accepted=True)

    def test_invalidation_and_noop(self):
        self.acknowledge()
        campus_notices.reconcile(self.ds, self.state, DAY)
        self.assertTrue(next(iter(campus_notices.groups(self.ds, self.state, DAY).values()))['accepted'])
        self.ds['lessons']['absent|lun|3']['room'] = '99'
        campus_notices.reconcile(self.ds, self.state, DAY)
        self.assertTrue(all('campusNotice' not in a for a in self.state['asg'][DAY].values()))
        self.acknowledge()
        removed = self.state['asg'][DAY].pop('absent|4|1A')
        campus_notices.reconcile(self.ds, self.state, DAY)
        self.state['asg'][DAY]['absent|4|1A'] = dict(v='blank', t='D', c='1A')
        self.assertFalse(next(iter(campus_notices.groups(self.ds, self.state, DAY).values()))['accepted'])

    def test_metadata_validation(self):
        campus_notices.validate(self.state)
        self.acknowledge()
        campus_notices.validate(self.state)
        self.state['asg'][DAY]['absent|3|1A']['campusNotice']['accepted'] = 'true'
        with self.assertRaises(ValueError):
            campus_notices.validate(self.state)


class NoticeAPI(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app(str(Path(self.tmp.name) / 'test.sqlite'))
        self.client = TestClient(self.app)
        raw, _, _ = setup_data()
        self.assertEqual(self.client.post('/api/timetable', json=raw).status_code, 200)
        for group, teacher, hours, extra in [('abs', 'absent', [3, 4], {}), ('dis', 'blank', [3, 4], {'site': 'succursale'})]:
            self.assertEqual(self.client.post('/api/entries', json=dict(day=DAY, group=group, id=teacher, hours=hours, **extra)).status_code, 200)
        for h in (3, 4):
            self.assertEqual(self.client.post('/api/assignments', json=dict(day=DAY, key=f'absent|{h}|1A', value='blank')).status_code, 200)

    def tearDown(self):
        self.client.close()
        self.tmp.cleanup()

    def data(self):
        return self.client.get('/api/day/' + DAY).json()

    def toggle(self, field, value=True, baseline=None):
        tokens = (baseline or self.data())['concurrency']['records']
        refs = [concurrency.key(g, DAY, 'absent|3|1A') for g in ('asg', 'campusNotice')]
        return self.client.post('/api/assignments', json=dict(day=DAY, key='absent|3|1A', campus_notice=True, **{field: value}, expected={r: tokens.get(r, 'absent') for r in refs}))

    def test_group_status_noop_and_backup(self):
        self.assertEqual(self.toggle('communicated').status_code, 200)
        self.assertEqual(self.toggle('accepted').status_code, 200)
        self.assertTrue(all(n['accepted'] and n['communicated'] for n in self.data()['campusNotices'].values()))
        response = self.client.post('/api/assignments', json=dict(day=DAY, key='absent|3|1A', value='blank'))
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(self.data()['campusNotices']['absent|3|1A']['accepted'])
        archive = self.client.get('/api/export').json()
        response = self.client.post('/api/import', json=archive)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertTrue(self.data()['campusNotices']['absent|3|1A']['accepted'])
        archive['asg'][DAY]['absent|3|1A']['campusNotice']['accepted'] = 'yes'
        self.assertEqual(self.client.post('/api/import', json=archive).status_code, 422)

    def test_stale_status_and_membership_are_atomic(self):
        baseline = self.data()
        self.assertEqual(self.toggle('communicated').status_code, 200)
        self.assertEqual(self.toggle('accepted', baseline=baseline).status_code, 409)
        baseline = self.data()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|4|1A', value=None)).raise_for_status()
        self.assertEqual(self.toggle('accepted', baseline=baseline).status_code, 409)
        notice = self.data()['campusNotices']['absent|3|1A']
        self.assertFalse(notice['communicated'])
        self.assertFalse(notice['accepted'])

    def test_permission_and_availability_invalidation(self):
        other = AuthenticatedClient(self.app, campus='succursale')
        tokens = self.data()['concurrency']['records']
        refs = [concurrency.key(g, DAY, 'absent|3|1A') for g in ('asg', 'campusNotice')]
        response = other.post('/api/assignments', json=dict(day=DAY, key='absent|3|1A', campus_notice=True, communicated=True, expected={r: tokens[r] for r in refs}))
        self.assertEqual(response.status_code, 403)
        other.close()
        self.toggle('communicated').raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='dis', id='blank', hours=[3, 4], site='centrale')).raise_for_status()
        self.assertEqual(self.data()['campusNotices'], {})
        self.client.post('/api/entries', json=dict(day=DAY, group='dis', id='blank', hours=[3, 4], site='succursale')).raise_for_status()
        self.assertFalse(self.data()['campusNotices']['absent|3|1A']['communicated'])

    def test_timetable_room_change_and_revert_do_not_resurrect_status(self):
        from backend.tests.timetable_helpers import import_version
        self.toggle('communicated').raise_for_status()
        raw, _, _ = setup_data()
        for slot in raw['orario']:
            if slot['docente'] == 'absent' and slot['ora'] == 3:
                slot['aula'] = '99'
        response = import_version(self.client, raw, '2026-10-11')
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(self.data()['campusNotices']['absent|3|1A']['communicated'])
        raw, _, _ = setup_data()
        raw['docenti'][0]['nome_originale'] = 'Absent revised'
        response = import_version(self.client, raw, DAY)
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(self.data()['campusNotices']['absent|3|1A']['communicated'])

    def test_addition_invalidates_group_and_stale_toggle(self):
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|4|1A', value=None)).raise_for_status()
        self.toggle('communicated').raise_for_status()
        baseline = self.data()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|4|1A', value='blank')).raise_for_status()
        self.assertEqual(self.toggle('accepted', baseline=baseline).status_code, 409)
        self.assertFalse(self.data()['campusNotices']['absent|3|1A']['communicated'])
