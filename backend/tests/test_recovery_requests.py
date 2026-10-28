import copy
import tempfile
import unittest
from pathlib import Path
from backend.tests.client import TestClient
from backend.tests.test_recovery import fixture, DAY
from backend.main import create_app
from backend import backup, recovery


class RecoveryRequestsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'school.sqlite'
        self.client = TestClient(create_app(self.path))
        self.client.post('/api/timetable', json=fixture()).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[1, 4])).raise_for_status()
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', hours=[2])).raise_for_status()
        self.key = 'absent|1|1A'
        self.assign('rp').raise_for_status()

    def assign(self, value):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=self.key, value=value))

    def mark(self, **values):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=self.key, **values))

    def state(self):
        return self.client.get('/api/export').json()

    def test_toggle_persistence_accounting_revalidation_and_replacement(self):
        before = self.state()
        self.assertNotIn('accepted', before['asg'][DAY][self.key])
        for value in (True, False, True):
            self.mark(accepted=value).raise_for_status()
            restarted = TestClient(create_app(self.path))
            self.assertIs(restarted.get('/api/export').json()['asg'][DAY][self.key]['accepted'], value)
            current = self.state()
            self.assertEqual(recovery.summary(current), recovery.summary(before))
            self.client.post('/api/import', json=current).raise_for_status()
        self.assign('rp').raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[1, 4, 6])).raise_for_status()
        self.assertTrue(self.state()['asg'][DAY][self.key]['accepted'])
        saved = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'backups'))
        self.mark(accepted=False).raise_for_status()
        backup.restore_backup(str(self.path), saved['path'])
        self.assertTrue(TestClient(create_app(self.path)).get('/api/export').json()['asg'][DAY][self.key]['accepted'])
        self.client = TestClient(create_app(self.path))
        self.assign('normal').raise_for_status()
        self.assertNotIn('accepted', self.state()['asg'][DAY][self.key])
        self.assign('rp').raise_for_status()
        self.assertNotIn('accepted', self.state()['asg'][DAY][self.key])
        self.assign(None).raise_for_status()
        self.assertNotIn(self.key, self.state()['asg'][DAY])

    def test_invalid_commands_stale_baseline_and_atomic_import(self):
        original = self.state()
        for values in (dict(accepted='true'), dict(accepted=1), dict(accepted=None),
                       dict(accepted=True, value='rp'), dict(accepted=True, communicated=True),
                       dict(accepted=True, replace_key='missing'), dict(accepted=True, exceptional=True)):
            self.assertEqual(self.mark(**values).status_code, 422, values)
            self.assertEqual(self.state(), original)
        for mutation in ('string', 'nonrp'):
            bad = copy.deepcopy(original)
            a = bad['asg'][DAY][self.key]
            a['accepted'] = 'true' if mutation == 'string' else False
            if mutation == 'nonrp':
                a.update(v='normal', t='POT'); a.pop('permitId')
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
            self.assertEqual(self.state(), original)
        tokens = self.client.get('/api/day/' + DAY).json()['concurrency']['records']
        ref = f'asg|{DAY}|{self.key}'
        self.mark(accepted=True).raise_for_status()
        self.assertEqual(self.mark(accepted=False, expected={ref: tokens[ref]}).status_code, 409)
        self.assign('normal').raise_for_status()
        self.assertEqual(self.mark(accepted=True).status_code, 422)
        self.assign(None).raise_for_status()
        self.assertEqual(self.mark(accepted=True).status_code, 422)

    def test_request_metadata_uses_fixed_link_and_manual_source(self):
        self.client.post('/api/permessi', json=dict(day='2026-09-28', id='rp', hours=[3])).raise_for_status()
        details = self.client.get('/api/day/' + DAY).json()['recoveryRequests']
        self.assertEqual(details[self.key], dict(date='2026-10-05', periods=[2]))
        self.assign(None).raise_for_status()
        for day in ('2026-09-28', '2026-10-05'):
            self.client.post('/api/permessi', json=dict(day=day, id='rp', hours=None)).raise_for_status()
        self.client.post('/api/manual-permits', json=dict(id='rp', hours=1)).raise_for_status()
        self.assign('rp').raise_for_status()
        self.assertEqual(self.client.get('/api/day/' + DAY).json()['recoveryRequests'][self.key], dict(date=None))
        broken = self.state(); broken['asg'][DAY][self.key]['permitId'] = 'missing'
        self.assertEqual(recovery.request_details(broken, DAY), {})

    def test_other_campus_can_read_request_but_cannot_accept(self):
        other = TestClient(create_app(self.path), campus='succursale')
        before = self.state()
        self.assertIn(self.key, other.get('/api/day/' + DAY).json()['recoveryRequests'])
        response = other.post('/api/assignments', json=dict(day=DAY, key=self.key, accepted=True))
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.state(), before)
