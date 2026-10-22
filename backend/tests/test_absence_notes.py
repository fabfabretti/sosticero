from backend.tests.timetable_helpers import import_version
import copy
import unittest
from pathlib import Path
from backend.tests.client import TestClient
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
        import_version(self.client, test_recovery.fixture(), '2026-10-01').raise_for_status()
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


class ManualBalanceNotesTest(unittest.TestCase):
    from backend.tests.test_manual_permits import ManualPermitsTest as _base
    setUp = _base.setUp
    manual = _base.manual
    assign = _base.assign
    exported = _base.exported

    def test_note_validation_clear_and_delete(self):
        self.assertEqual(self.client.get('/api/permessi').json()['manualPermitNotes'], {})
        for value in (1, True, [], {}):
            self.assertEqual(self.manual(hours=3, note=value).status_code, 422)
        self.manual(hours=3, note='  <b>Contesto</b>\nseconda riga  ').raise_for_status()
        expected = '<b>Contesto</b>\nseconda riga'
        self.assertEqual(self.client.get('/api/permessi').json()['manualPermitNotes']['rp'], expected)
        pid = self.exported()['manualPermits']['rp']['id']
        self.manual(hours=4, editing=True).raise_for_status()
        self.assertEqual(self.exported()['manualPermitNotes']['rp'], expected)
        self.assertEqual(self.exported()['manualPermits']['rp']['id'], pid)
        for blank in (None, '', ' \n '):
            self.manual(hours=4, editing=True, note=blank).raise_for_status()
            self.assertNotIn('rp', self.exported()['manualPermitNotes'])
            self.manual(hours=4, editing=True, note='nota').raise_for_status()
        self.manual(hours=None).raise_for_status()
        self.assertEqual(self.exported()['manualPermitNotes'], {})

    def test_protected_edits_and_recovery_links(self):
        self.manual(hours=3, note='originale').raise_for_status()
        self.assign(1).raise_for_status()
        self.assign(4).raise_for_status()
        before = self.exported()
        for body in (dict(hours=None), dict(hours=1, editing=True, note='changed')):
            self.assertEqual(self.manual(**body).status_code, 422)
            self.assertEqual(self.exported(), before)
        self.manual(hours=4, editing=True).raise_for_status()
        after = self.exported()
        self.assertEqual(after['asg'], before['asg'])
        self.assertEqual(after['manualPermits']['rp']['id'], before['manualPermits']['rp']['id'])
        self.assertEqual(after['manualPermitNotes'], before['manualPermitNotes'])

    def test_legacy_archives_backup_and_atomic_rejection(self):
        self.manual(hours=3, note='saldo precedente').raise_for_status()
        archive = self.exported()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(TestClient(create_app(self.path)).get('/api/permessi').json()['manualPermitNotes']['rp'], 'saldo precedente')
        for notes in ({'rp': False}, {'rp': []}, {'rp': ' '}, {'absent': 'orphan'}):
            bad = copy.deepcopy(archive); bad['manualPermitNotes'] = notes
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
            self.assertEqual(self.exported(), archive)
        snapshot = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'snapshots'))
        self.manual(hours=3, editing=True, note='changed').raise_for_status()
        backup.restore_backup(str(self.path), snapshot['path'])
        self.assertEqual(self.exported(), archive)
        legacy = {k: v for k, v in archive.items() if k != 'manualPermitNotes'}
        self.client.post('/api/import', json=legacy).raise_for_status()
        self.assertEqual(self.client.get('/api/permessi').json()['manualPermitNotes'], {})
