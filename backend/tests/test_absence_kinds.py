import copy
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.tests.test_app import fixture, DAY


class AbsenceKindsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'db.sqlite'
        self.client = TestClient(create_app(self.path))
        ds = fixture()
        for teacher in ('absent', 'co'):
            ds['orario'].append(dict(docente=teacher, giorno='lun', ora=1, classi=[]))
        self.client.post('/api/timetable', json=ds).raise_for_status()

    def entry(self, **extra):
        return self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2]) | extra)

    def permit(self, **extra):
        return self.client.post('/api/permessi', json=dict(day=DAY, id='absent', hours=[1]) | extra)

    def state(self):
        return self.client.get('/api/export').json()

    def test_entry_validation_preservation_clearing_and_deletion(self):
        self.assertEqual(self.state()['absenceKinds'], {})
        for value in ('bad', 1, True, [], {}):
            self.assertEqual(self.entry(classification=value).status_code, 422)
        for group in ('dis', 'cf'):
            self.assertEqual(self.entry(group=group, classification=None).status_code, 422)
        self.entry(classification='planned').raise_for_status()
        self.entry(hours=[1, 2]).raise_for_status()
        self.assertEqual(self.state()['absenceKinds'][DAY]['absent'], 'planned')
        self.entry(classification='last_minute').raise_for_status()
        self.assertEqual(TestClient(create_app(self.path)).get('/api/day/' + DAY).json()['state']['absenceKinds'][DAY]['absent'], 'last_minute')
        self.entry(classification=None).raise_for_status()
        self.assertNotIn('absent', self.state()['absenceKinds'][DAY])
        self.entry(classification='planned').raise_for_status()
        self.entry(hours=None).raise_for_status()
        self.assertNotIn('absent', self.state()['absenceKinds'][DAY])

    def test_permit_move_preserves_identity_metadata_and_failed_edits(self):
        self.permit(classification='last_minute').raise_for_status()
        pid = self.state()['permitIds'][DAY]['absent']
        edit = dict(original_day=DAY, original_id='absent')
        self.permit(**edit).raise_for_status()
        self.assertEqual(self.state()['permitKinds'][DAY]['absent'], 'last_minute')
        before = self.state()
        self.assertEqual(self.permit(id='missing', **edit).status_code, 422)
        self.assertEqual(self.state(), before)
        self.permit(id='co', **edit).raise_for_status()
        state = self.state()
        self.assertNotIn('absent', state['permitKinds'][DAY])
        self.assertEqual(state['permitKinds'][DAY]['co'], 'last_minute')
        self.assertEqual(state['permitIds'][DAY]['co'], pid)
        self.permit(id='co', original_day=DAY, original_id='co', classification=None).raise_for_status()
        self.assertNotIn('co', self.state()['permitKinds'][DAY])
        self.permit(id='co', original_day=DAY, original_id='co', classification='planned').raise_for_status()
        self.permit(id='co', hours=None).raise_for_status()
        self.assertNotIn('co', self.state()['permitKinds'][DAY])
        for value in ('bad', False, {}):
            self.assertEqual(self.permit(classification=value).status_code, 422)

    def test_date_move_and_backup_preserve_classification(self):
        from backend import backup
        self.permit(classification='planned').raise_for_status()
        pid = self.state()['permitIds'][DAY]['absent']
        moved = '2026-10-19'
        self.permit(day=moved, original_day=DAY, original_id='absent').raise_for_status()
        state = self.state()
        self.assertNotIn('absent', state['permitKinds'][DAY])
        self.assertEqual(state['permitKinds'][moved]['absent'], 'planned')
        self.assertEqual(state['permitIds'][moved]['absent'], pid)
        snapshot = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'backups'))
        self.permit(day=moved, original_day=moved, original_id='absent', classification='last_minute').raise_for_status()
        backup.restore_backup(str(self.path), snapshot['path'])
        self.assertEqual(self.client.get('/api/permessi').json()['permitKinds'][moved]['absent'], 'planned')

    def test_archives_legacy_round_trip_and_atomic_rejection(self):
        self.entry(classification='planned').raise_for_status()
        self.permit(classification='last_minute').raise_for_status()
        archive = self.state()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.state(), archive)
        for group in ('absenceKinds', 'permitKinds'):
            for values in ({'absent': 'bad'}, {'blank': 'planned'}, {'absent': []}):
                bad = copy.deepcopy(archive)
                bad[group][DAY] = values
                self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
                self.assertEqual(self.state(), archive)
        legacy = {k: v for k, v in archive.items() if k not in ('absenceKinds', 'permitKinds')}
        self.client.post('/api/import', json=legacy).raise_for_status()
        self.assertEqual(self.state()['absenceKinds'], {})
        self.assertEqual(self.state()['permitKinds'], {})

    def test_trip_is_metadata_only_and_survives_archive_round_trip(self):
        self.entry(classification='planned').raise_for_status()
        self.permit(classification='planned').raise_for_status()
        before = self.client.get('/api/day/' + DAY).json()
        self.entry(classification='trip').raise_for_status()
        self.permit(classification='trip', original_day=DAY, original_id='absent').raise_for_status()
        after = self.client.get('/api/day/' + DAY).json()
        self.assertEqual(after['rows'], before['rows'])
        self.assertEqual(after['state']['cf'], before['state']['cf'])
        self.assertEqual(after['state']['dis'], before['state']['dis'])
        archive = self.state()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.state(), archive)
        reopened = TestClient(create_app(self.path)).get('/api/day/' + DAY).json()['state']
        for group in ('absenceKinds', 'permitKinds'):
            self.assertEqual(reopened[group][DAY]['absent'], 'trip')

    def test_strike_is_metadata_only_and_survives_archive_round_trip(self):
        self.entry(classification='planned').raise_for_status()
        self.permit(classification='planned').raise_for_status()
        before = self.client.get('/api/day/' + DAY).json()
        self.entry(classification='strike').raise_for_status()
        self.permit(classification='strike', original_day=DAY, original_id='absent').raise_for_status()
        after = self.client.get('/api/day/' + DAY).json()
        self.assertEqual(after['rows'], before['rows'])
        self.assertEqual(after['state']['cf'], before['state']['cf'])
        self.assertEqual(after['state']['dis'], before['state']['dis'])
        archive = self.state()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.state(), archive)
        reopened = TestClient(create_app(self.path)).get('/api/day/' + DAY).json()['state']
        for group in ('absenceKinds', 'permitKinds'):
            self.assertEqual(reopened[group][DAY]['absent'], 'strike')
