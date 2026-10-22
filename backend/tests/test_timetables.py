import copy
from datetime import datetime
from pathlib import Path
import sqlite3
import tempfile
import unittest
from unittest.mock import patch

from backend.tests.client import TestClient
from backend.main import create_app
from backend.storage import Store
from backend.domain import normalize_dataset, HOURS
from backend import timetables, backup
from backend.tests.test_app import fixture, DAY


def import_version(client, raw, effective=DAY):
    preview = client.post('/api/timetable/preview', params={'effective': effective}, json=raw)
    preview.raise_for_status()
    return client.post('/api/timetable', params=dict(effective=effective, token=preview.json()['token'], confirm='true'), json=raw)


class TimetableTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)/'test.sqlite'
        with patch.dict('os.environ', {'BACKUP_ON_STARTUP': 'false'}):
            self.client = TestClient(create_app(self.path))
        self.client.post('/api/timetable', json=fixture()).raise_for_status()

    def get(self, day=DAY):
        return self.client.get('/api/day/'+day).json()

    def archive(self):
        return self.client.get('/api/export').json()

    def changed(self):
        raw = fixture()
        raw['orario'][0]['classi'] = ['9Z']
        return raw

    def entry(self, day=DAY, **extra):
        self.client.post('/api/entries', json=dict(day=day, group='abs', id='absent', hours=[2], note='Keep me', **extra)).raise_for_status()

    def test_migration_preserves_and_is_idempotent(self):
        self.entry()
        store = Store(str(self.path))
        with store.connect() as db:
            db.execute("DELETE FROM documents WHERE key='timetables'")
            before = db.execute('SELECT key,value FROM documents ORDER BY key').fetchall()
        for _ in range(2):
            with patch.dict('os.environ', {'BACKUP_ON_STARTUP': 'false'}):
                TestClient(create_app(self.path))
            with store.connect() as db:
                self.assertEqual(db.execute("SELECT key,value FROM documents WHERE key!='timetables' ORDER BY key").fetchall(), before)
                self.assertEqual(len(store.read(db, 'timetables')['versions']), 1)

    def test_boundaries_future_and_backdated_insertion(self):
        self.entry()
        self.entry('2026-10-19')
        self.entry('2026-10-26')
        old = self.get()
        raw = self.changed()
        import_version(self.client, raw, '2026-10-26').raise_for_status()
        self.assertEqual(self.get()['rows'], old['rows'])
        self.assertEqual(self.get('2026-10-26')['rows'][0]['c'], '9Z')
        earlier = fixture(); earlier['orario'][0]['classi'] = ['8Z']
        impact = import_version(self.client, earlier, '2026-10-19').json()['impact']
        self.assertEqual(impact['end'], '2026-10-25')
        self.assertEqual(self.get('2026-10-19')['rows'][0]['c'], '8Z')
        self.assertEqual(self.get('2026-10-26')['rows'][0]['c'], '9Z')
        self.assertEqual(self.get()['rows'], old['rows'])
        self.assertEqual(self.client.post('/api/timetable/preview?effective=2026-10-19', json=earlier).status_code, 422)

    def test_preview_stale_and_no_side_effects(self):
        before = self.archive()
        backups = self.client.get('/api/backups').json()
        raw = self.changed()
        preview = self.client.post('/api/timetable/preview', params={'effective': DAY}, json=raw).json()
        self.assertEqual(before, self.archive())
        self.assertEqual(backups, self.client.get('/api/backups').json())
        self.entry()
        response = self.client.post('/api/timetable', params=dict(effective=DAY, token=preview['token'], confirm='true'), json=raw)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(len(self.archive()['timetables']['versions']), 1)
        self.assertEqual(backups, self.client.get('/api/backups').json())

    def test_statistics_conflict_evidence_and_resolution(self):
        self.entry()
        self.entry('2026-10-19')
        self.client.post('/api/assignments', json=dict(day='2026-10-19', key='absent|2|1A', value='pot')).raise_for_status()
        before = self.archive()
        raw = self.changed()
        response = import_version(self.client, raw, '2026-10-19'); response.raise_for_status()
        archive = self.archive()
        self.assertEqual(archive['abs'], before['abs'])
        self.assertEqual(archive['absenceNotes'], before['absenceNotes'])
        self.assertEqual(archive['asg'], before['asg'])
        self.assertEqual(archive['statistics']['days'][DAY], before['statistics']['days'][DAY])
        self.assertEqual(archive['statistics']['days']['2026-10-19']['demand']['2|9Z']['outcome'], 'pending')
        problem = self.get('2026-10-19')['issues'][0]
        self.assertEqual(problem['context']['c'], '1A')
        self.assertEqual(problem['context']['substitute'], 'pot')
        self.assertEqual(archive['timetables']['corrections'][0]['previous']['2026-10-19']['facts'], before['statistics']['days']['2026-10-19'])
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.archive(), archive)
        self.client.post('/api/assignments', json=dict(day='2026-10-19', key='absent|2|9Z', value='pot', replace_key='absent|2|1A')).raise_for_status()
        self.assertFalse(self.get('2026-10-19')['issues'])
        self.assertEqual(self.archive()['statistics']['days']['2026-10-19']['demand']['2|9Z']['outcome'], 'covered')
        self.assertNotIn('absent|2|1A', self.archive()['asg']['2026-10-19'])

    def test_backup_failure_and_transaction_failure_leave_database_unchanged(self):
        before = self.archive()
        with patch('backend.backup.backup_database', side_effect=OSError('disk full')):
            self.assertEqual(import_version(self.client, self.changed()).status_code, 422)
        self.assertEqual(self.archive(), before)
        original = Store.write
        def fail(store, db, key, value):
            if key == 'statistics':
                raise ValueError('reconciliation failed')
            return original(store, db, key, value)
        with patch.object(Store, 'write', fail):
            self.assertEqual(import_version(self.client, self.changed()).status_code, 422)
        self.assertEqual(self.archive(), before)

    def test_preimport_snapshot_restore_and_collision_safe_names(self):
        self.entry()
        before = self.archive()
        result = import_version(self.client, self.changed()); result.raise_for_status()
        snapshot = result.json()['backup']
        with sqlite3.connect(snapshot['path']) as db:
            self.assertEqual(db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        self.client.post('/api/backups/restore', json=dict(filename=snapshot['filename'], confirm=True)).raise_for_status()
        self.assertEqual(self.archive(), before)
        with patch('backend.backup.datetime') as clock:
            clock.now.return_value = datetime(2026, 10, 15, 12)
            a = backup.backup_database(str(self.path), str(Path(self.tmp.name)/'backups'))
            b = backup.backup_database(str(self.path), str(Path(self.tmp.name)/'backups'))
        self.assertNotEqual(a['filename'], b['filename'])

    def test_version_archive_rejects_corruption_atomically(self):
        self.entry()
        import_version(self.client, self.changed()).raise_for_status()
        archive = self.archive()
        for mutation in ('duplicate', 'missing-baseline', 'teacher', 'lesson', 'evidence', 'date'):
            bad = copy.deepcopy(archive)
            h = bad['timetables']
            if mutation == 'duplicate': h['versions'].append(copy.deepcopy(h['versions'][1]))
            if mutation == 'missing-baseline': h['versions'].pop(0)
            if mutation == 'teacher': h['versions'][0]['dataset']['teachers']['absent']['id']='other'
            if mutation == 'lesson': h['versions'][1]['dataset']['lessons']['bad']=None
            if mutation == 'evidence': h['corrections'][0]['previous'][DAY]['version']='missing'
            if mutation == 'date': h['versions'][1]['effective']='bad'
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422, mutation)
            self.assertEqual(self.archive(), archive)

    def test_inactive_teacher_history_and_legacy_archive(self):
        self.entry()
        raw = fixture()
        raw['docenti'] = [t for t in raw['docenti'] if t['id'] != 'absent']
        raw['orario'] = [l for l in raw['orario'] if l['docente'] != 'absent']
        import_version(self.client, raw).raise_for_status()
        self.assertTrue(self.get()['dataset']['teachers']['absent']['retired'])
        self.assertTrue(self.get()['references'])
        archive = self.archive()
        legacy = copy.deepcopy(archive); legacy['schema'] = 3; legacy.pop('timetables')
        self.client.post('/api/import', json=legacy).raise_for_status()
        self.assertEqual(self.archive()['timetables'], archive['timetables'])
        self.assertEqual(self.client.post('/api/entries', json=dict(day='2026-10-19', group='abs', id='absent', hours=[2])).status_code, 422)

    def test_date_range_resolves_defaults_individually(self):
        raw = fixture()
        raw['orario'].append(dict(docente='blank', giorno='lun', ora=3, classi=['1A']))
        import_version(self.client, raw, '2026-10-19').raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, until='2026-10-19', group='dis', id='blank', hours=HOURS, defaults=True)).raise_for_status()
        state = self.archive()
        self.assertIn(3, state['dis'][DAY]['blank'])
        self.assertNotIn(3, state['dis']['2026-10-19']['blank'])


    def test_lock_timeout_is_clean_and_preserves_state(self):
        from contextlib import contextmanager
        before = self.archive()
        raw = self.changed()
        preview = self.client.post('/api/timetable/preview', params={'effective': DAY}, json=raw).json()
        connect = Store.connect
        @contextmanager
        def fast_timeout(store):
            with connect(store) as db:
                db.execute('PRAGMA busy_timeout=1')
                yield db
        with sqlite3.connect(self.path) as locked:
            locked.execute('BEGIN IMMEDIATE')
            with patch.object(Store, 'connect', fast_timeout):
                response = self.client.post('/api/timetable', params=dict(effective=DAY, token=preview['token'], confirm='true'), json=raw)
                self.assertEqual(response.status_code, 503)
        self.assertEqual(before, self.archive())

    def test_archive_restores_to_empty_installation(self):
        self.entry()
        import_version(self.client, self.changed()).raise_for_status()
        archive = self.archive()
        with patch.dict('os.environ', {'BACKUP_ON_STARTUP': 'false'}):
            other = TestClient(create_app(Path(self.tmp.name)/'empty.sqlite'))
        other.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(other.get('/api/export').json(), archive)

    def test_stale_preview_rejects_changed_input_date_policy_and_timeline(self):
        raw = self.changed()
        for change in ('input', 'date', 'policy', 'timeline'):
            preview = self.client.post('/api/timetable/preview', params={'effective': '2026-10-19'}, json=raw).json()
            candidate = copy.deepcopy(raw)
            effective = '2026-10-19'
            if change == 'input': candidate['orario'][0]['classi']=['8Z']
            if change == 'date': effective='2026-10-20'
            if change == 'policy':
                rules = self.client.get('/api/hour-types').json()['types']
                key = next(iter(rules))
                self.client.post('/api/hour-types', json=dict(id=key, available=not rules[key]['available'], visible=rules[key]['visible'], school=rules[key]['school'])).raise_for_status()
            if change == 'timeline': import_version(self.client, fixture(), '2026-10-26').raise_for_status()
            before = self.archive()
            r = self.client.post('/api/timetable', params=dict(effective=effective, token=preview['token'], confirm='true'), json=candidate)
            self.assertEqual(r.status_code, 409, change)
            self.assertEqual(before, self.archive())

    def test_rp_conflict_preserves_ledger_and_explicit_removal_releases_credit(self):
        from backend.tests.test_recovery import fixture as rp_fixture
        import_version(self.client, rp_fixture(), '2026-10-01').raise_for_status()
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', hours=[2])).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[1])).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|1|1A', value='rp')).raise_for_status()
        before = self.archive()
        raw = rp_fixture(); raw['orario'].append(dict(docente='rp', giorno='lun', ora=1, classi=['2A'], sede='centrale'))
        import_version(self.client, raw).raise_for_status()
        after = self.archive()
        self.assertEqual(before['asg'], after['asg'])
        self.assertEqual(before['permitIds'], after['permitIds'])
        self.assertTrue(self.get()['issues'])
        self.assertEqual(after['statistics']['days'][DAY]['demand']['1|1A']['outcome'], 'pending')
        self.client.post('/api/import', json=after).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|1|1A', value=None)).raise_for_status()
        permit = self.client.get('/api/permessi').json()['recoveries']['2026-10-05']['rp']
        self.assertEqual(permit['recovered'], 0)
        self.assertEqual(permit['remaining'], 1)

    def test_permits_resolve_destination_and_keep_historical_identities(self):
        self.client.post('/api/permessi', json=dict(day=DAY, id='blank', hours=[2])).raise_for_status()
        raw = fixture(); raw['docenti']=[t for t in raw['docenti'] if t['id'] != 'blank']
        import_version(self.client, raw, '2026-10-19').raise_for_status()
        before = self.archive()
        r = self.client.post('/api/permessi', json=dict(day='2026-10-19', id='blank', hours=[2], original_day=DAY, original_id='blank'))
        # Existing teacher identity can be retained for explicit corrections, but new records cannot be created.
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.post('/api/permessi', json=dict(day='2026-10-26', id='blank', hours=[2])).status_code, 422)
        self.assertIn('blank', self.get()['dataset']['teachers'])
        self.assertEqual(self.get()['dataset']['teachers']['blank'].get('retired', False), False)
