import copy
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app
from backend import backup
from backend.tests import test_absence_kinds, test_recovery

DAY = test_absence_kinds.DAY


class AbsenceNotesTest(unittest.TestCase):
    setUp = test_absence_kinds.AbsenceKindsTest.setUp
    entry = test_absence_kinds.AbsenceKindsTest.entry
    permit = test_absence_kinds.AbsenceKindsTest.permit
    state = test_absence_kinds.AbsenceKindsTest.state

    def test_validation_preservation_and_independent_deletion(self):
        self.assertEqual(self.client.get('/api/day/' + DAY).json()['state']['absenceNotes'], {})
        for value in (1, True, [], {}):
            self.assertEqual(self.entry(note=value).status_code, 422)
            self.assertEqual(self.permit(note=value).status_code, 422)
        for group in ('dis', 'cf'):
            self.assertEqual(self.entry(group=group, note=None).status_code, 422)
        self.entry(note='  <b>assenza</b>\nseconda riga  ', classification='planned').raise_for_status()
        self.permit(note='permesso').raise_for_status()
        self.entry(hours=[1, 2]).raise_for_status()
        state = self.state()
        self.assertEqual(state['absenceNotes'][DAY]['absent'], '<b>assenza</b>\nseconda riga')
        self.assertEqual(state['absenceKinds'][DAY]['absent'], 'planned')
        for blank in (None, '', '  \n '):
            self.entry(note=blank).raise_for_status()
            self.assertNotIn('absent', self.state()['absenceNotes'][DAY])
            self.entry(note='manuale').raise_for_status()
        self.entry(hours=None).raise_for_status()
        self.assertNotIn('absent', self.state()['absenceNotes'][DAY])
        self.assertEqual(self.state()['permitNotes'][DAY]['absent'], 'permesso')
        self.entry(note='manuale').raise_for_status()
        self.permit(hours=None).raise_for_status()
        self.assertNotIn('absent', self.state()['permitNotes'][DAY])
        self.assertEqual(self.state()['absenceNotes'][DAY]['absent'], 'manuale')

    def test_permit_move_clear_and_restart(self):
        self.permit(note='nota').raise_for_status()
        pid = self.state()['permitIds'][DAY]['absent']
        self.permit(id='co', day='2026-10-19', original_id='absent', original_day=DAY).raise_for_status()
        state = self.state()
        self.assertNotIn('absent', state['permitNotes'][DAY])
        self.assertEqual(state['permitNotes']['2026-10-19']['co'], 'nota')
        self.assertEqual(state['permitIds']['2026-10-19']['co'], pid)
        restarted = TestClient(create_app(self.path)).get('/api/permessi').json()
        self.assertEqual(restarted['permitNotes']['2026-10-19']['co'], 'nota')
        for blank in (None, '', '  '):
            self.permit(id='co', day='2026-10-19', original_id='co', original_day='2026-10-19', note=blank).raise_for_status()
            self.assertNotIn('co', self.state()['permitNotes']['2026-10-19'])

    def test_archives_legacy_atomic_validation_and_backup(self):
        self.entry(note='assenza').raise_for_status()
        self.permit(note='permesso').raise_for_status()
        archive = self.state()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.state(), archive)
        for group in ('absenceNotes', 'permitNotes'):
            for values in ({'absent': False}, {'absent': []}, {'absent': '  '}, {'blank': 'orphan'}):
                bad = copy.deepcopy(archive)
                bad[group][DAY] = values
                self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
                self.assertEqual(self.state(), archive)
        snapshot = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'snapshots'))
        self.entry(note='changed').raise_for_status()
        backup.restore_backup(str(self.path), snapshot['path'])
        self.assertEqual(self.state(), archive)
        legacy = {k: v for k, v in archive.items() if k not in ('absenceNotes', 'permitNotes')}
        self.client.post('/api/import', json=legacy).raise_for_status()
        self.assertEqual(self.state()['absenceNotes'], {})
        self.assertEqual(self.state()['permitNotes'], {})

    def test_recovery_protected_edits_keep_note_and_identity(self):
        self.client.post('/api/timetable', json=test_recovery.fixture()).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[1])).raise_for_status()
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', hours=[2], note='originale')).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|1|1A', value='rp')).raise_for_status()
        before = self.state()
        for body in (dict(day='2026-10-05', id='rp', hours=None), dict(day='2026-09-01', id='rp', hours=[2], original_day='2026-10-05', original_id='rp', note='changed')):
            self.assertEqual(self.client.post('/api/permessi', json=body).status_code, 422)
            self.assertEqual(self.state(), before)
        self.client.post('/api/permessi', json=dict(day='2026-10-06', id='rp', hours=[2], original_day='2026-10-05', original_id='rp')).raise_for_status()
        after = self.state()
        self.assertEqual(after['permitNotes']['2026-10-06']['rp'], 'originale')
        self.assertEqual(after['permitIds']['2026-10-06']['rp'], before['permitIds']['2026-10-05']['rp'])
        self.assertEqual(after['asg'], before['asg'])
