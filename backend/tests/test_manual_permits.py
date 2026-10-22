import copy
import tempfile
import unittest
from pathlib import Path
from backend.tests.client import TestClient
from backend.main import create_app
from backend.tests.test_recovery import fixture, DAY
from backend import recovery, backup


class ManualPermitsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'db.sqlite'
        self.client = TestClient(create_app(self.path))
        self.client.post('/api/timetable', json=fixture()).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=list(range(1, 8)))).raise_for_status()

    def manual(self, **kw):
        return self.client.post('/api/manual-permits', json=dict(id='rp', **kw))

    def assign(self, h, value='rp'):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=f'absent|{h}|1A', value=value))

    def exported(self):
        return self.client.get('/api/export').json()

    def test_manual_balance_has_no_absence_or_expiry_and_recovers(self):
        before = self.client.get('/api/day/' + DAY).json()['rows']
        stats = self.exported()['statistics']
        self.manual(hours=2).raise_for_status()
        self.assertEqual(self.client.get('/api/day/' + DAY).json()['rows'], before)
        self.assertEqual(self.exported()['statistics'], stats)
        self.assertEqual(self.exported()['permessi'], {})
        pid = self.exported()['manualPermits']['rp']['id']
        self.assertEqual(recovery.eligible(recovery.ledger(self.exported()), 'rp', '2099-01-01')[0]['id'], pid)
        self.assign(1).raise_for_status()
        self.assign(4).raise_for_status()
        data = self.client.get('/api/permessi').json()
        self.assertEqual(data['manualPermits']['rp']['remaining'], 0)
        self.assertEqual(data['manualPermits']['rp']['recovered'], 2)
        self.assertEqual(data['balances']['rp']['remaining'], 0)
        self.assertEqual(self.assign(6).status_code, 422)
        self.assign(1, None).raise_for_status()
        self.assertEqual(self.client.get('/api/permessi').json()['manualPermits']['rp']['remaining'], 1)

    def test_validation_and_linked_recoveries_are_protected(self):
        for value in [True, 0, -1, 1.5, '2']:
            self.assertEqual(self.manual(hours=value).status_code, 422)
        self.manual(hours=3).raise_for_status()
        self.assertEqual(self.manual(hours=4).status_code, 422)
        pid = self.exported()['manualPermits']['rp']['id']
        self.assign(1).raise_for_status()
        self.assign(4).raise_for_status()
        before = self.exported()
        for body in [dict(hours=1, editing=True), dict(hours=None)]:
            self.assertEqual(self.manual(**body).status_code, 422)
            self.assertEqual(self.exported(), before)
        self.manual(hours=4, editing=True).raise_for_status()
        self.assertEqual(self.exported()['manualPermits']['rp']['id'], pid)
        self.assertEqual(self.client.get('/api/permessi').json()['manualPermits']['rp']['remaining'], 2)
        self.assign(1, None).raise_for_status()
        self.assign(4, None).raise_for_status()
        self.manual(hours=None).raise_for_status()
        self.assertEqual(self.exported()['manualPermits'], {})

    def test_dated_permit_used_first_and_archive_round_trip(self):
        self.manual(hours=3).raise_for_status()
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', hours=[2])).raise_for_status()
        dated = self.exported()['permitIds']['2026-10-05']['rp']
        self.assign(1).raise_for_status()
        self.assertEqual(self.exported()['asg'][DAY]['absent|1|1A']['permitId'], dated)
        self.assign(4).raise_for_status()
        archive = self.exported()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.exported(), archive)
        self.assertEqual(TestClient(create_app(self.path)).get('/api/permessi').json()['manualPermits']['rp']['remaining'], 2)
        saved = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'backups'))
        self.manual(hours=5, editing=True).raise_for_status()
        backup.restore_backup(str(self.path), saved['path'])
        self.assertEqual(self.exported(), archive)
        for change in [dict(hours=True), dict(hours=0), dict(hours=0.5), dict(id=dated)]:
            bad = copy.deepcopy(archive)
            bad['manualPermits']['rp'].update(change)
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
        bad = copy.deepcopy(archive)
        bad['manualPermits']['missing'] = bad['manualPermits'].pop('rp')
        self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
        self.assertEqual(self.exported(), archive)
