import copy
import tempfile
import unittest
from pathlib import Path
from backend.main import create_app
from backend.storage import Store
from backend import backup
from backend.tests.client import TestClient
from backend.tests.test_app import fixture, DAY


class PermitCreatorsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'db.sqlite'
        self.app = create_app(self.path)
        self.central = TestClient(self.app)
        self.succ = TestClient(self.app, campus='succursale')
        ds = fixture()
        ds['orario'].append(dict(docente='absent', giorno='lun', ora=1, classi=[]))
        self.central.post('/api/timetable', json=ds).raise_for_status()

    def save(self, client=None, **extra):
        return (client or self.central).post('/api/permessi', json=dict(day=DAY, id='absent', hours=[1]) | extra)

    def export(self):
        return self.central.get('/api/export').json()

    def test_creator_is_server_derived_and_follows_moves(self):
        for creator, editor, campus in ((self.central, self.succ, 'centrale'), (self.succ, self.central, 'succursale')):
            self.save(creator, creator='forged').raise_for_status()
            original = dict(original_day=DAY, original_id='absent')
            self.save(editor, **original).raise_for_status()
            moved = '2026-10-19'
            self.save(editor, day=moved, **original).raise_for_status()
            state = self.export()
            self.assertEqual(state['permitCreators'][moved]['absent'], campus)
            self.assertNotIn('absent', state['permitCreators'].get(DAY, {}))
            self.save(editor, day=moved, hours=None).raise_for_status()
            self.assertNotIn('absent', self.export()['permitCreators'].get(moved, {}))

    def test_legacy_edit_stays_unspecified(self):
        self.save().raise_for_status()
        old = self.export()
        old.pop('permitCreators')
        self.central.post('/api/import', json=old).raise_for_status()
        self.save(self.succ, original_day=DAY, original_id='absent').raise_for_status()
        self.assertEqual(self.export()['permitCreators'], {})

    def test_round_trip_reload_backup_and_invalid_archives(self):
        self.save(self.succ).raise_for_status()
        state = self.export()
        self.central.post('/api/import', json=state).raise_for_status()
        self.assertEqual(TestClient(create_app(self.path)).get('/api/permessi').json()['permitCreators'], state['permitCreators'])
        saved = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'backups'))
        store = Store(saved['path'])
        with store.connect() as db:
            self.assertEqual(store.read(db, 'state')['permitCreators'], state['permitCreators'])
        for metadata in ({DAY: {'absent': 'invalid'}}, {DAY: {'missing': 'centrale'}}, {DAY: {'absent': []}}):
            bad = copy.deepcopy(state)
            bad['permitCreators'] = metadata
            self.assertEqual(self.central.post('/api/import', json=bad).status_code, 422)
            self.assertEqual(self.export(), state)
