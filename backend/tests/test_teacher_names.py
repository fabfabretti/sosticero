import copy
import json
from pathlib import Path
import sqlite3
import tempfile
import unittest

from backend.tests.client import TestClient
from backend.main import create_app
from backend.storage import Store
from backend import backup, recovery, teacher_names
from backend.tests.test_recovery import fixture, DAY
from backend.tests.test_inbox import response
from backend.tests.timetable_helpers import import_version


class TeacherNamesTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'app.sqlite'
        self.app = create_app(self.path)
        self.client = TestClient(self.app)
        self.raw = fixture()
        self.client.post('/api/timetable', json=self.raw).raise_for_status()
        self.value = dict(name='Spillari Davide', originalName='Savelli')

    def save(self, value, previous=None, teacher='rp'):
        return self.client.post('/api/orari/name', json=dict(teacher=teacher, value=value, previous=previous))

    def documents(self):
        with Store(self.path).connect() as db:
            return dict(db.execute("SELECT key,value FROM documents WHERE key != 'teacherNameOverrides'"))

    def test_lifecycle_preserves_operational_records_and_balances(self):
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[1, 2])).raise_for_status()
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='rp', hours=[2], note='existing')).raise_for_status()
        self.client.post('/api/manual-permits', json=dict(id='rp', hours=3)).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|1|1A', value='rp')).raise_for_status()
        before = self.client.get('/api/export').json()
        documents = self.documents()
        original_orari = self.client.get('/api/orari').json()
        original_candidates = self.client.get('/api/candidates', params=dict(day=DAY, key='absent|2|1A')).json()
        for value, previous in [(self.value, None), (dict(name='Corrected', originalName='Savelli'), self.value),
                                (None, dict(name='Corrected', originalName='Savelli'))]:
            self.save(value, previous).raise_for_status()
            self.assertEqual(self.documents(), documents)
            after = self.client.get('/api/export').json()
            self.assertEqual(recovery.ledger(after), recovery.ledger(before))
            self.assertEqual(recovery.summary(after), recovery.summary(before))
            orari = self.client.get('/api/orari').json()
            self.assertEqual(orari['imported'], original_orari['imported'])
            self.assertEqual(orari['basis'], original_orari['basis'])
            display = f"{value['name']} ({value['originalName']})" if value else 'rp'
            for endpoint in ['/api/orari', '/api/day/' + DAY, '/api/permessi']:
                self.assertEqual(self.client.get(endpoint).json()['dataset']['teachers']['rp']['name'], display)
            actual = self.client.get('/api/candidates', params=dict(day=DAY, key='absent|2|1A')).json()
            self.assertEqual([{k: v for k, v in c.items() if k != 'name'} for c in actual],
                             [{k: v for k, v in c.items() if k != 'name'} for c in original_candidates])

    def test_validation_stale_edits_and_independent_teachers(self):
        before = self.documents()
        for value in [dict(name='', originalName='A'), dict(name='x\nY', originalName='A'),
                      dict(name='x' * 201, originalName='A'), dict(name=True, originalName='A'), {}, []]:
            self.assertEqual(self.save(value).status_code, 422)
        self.assertEqual(self.save(self.value, teacher='missing').status_code, 422)
        self.save(self.value).raise_for_status()
        self.assertEqual(self.save(None).status_code, 409)
        self.save(dict(name='Other', originalName='Original'), teacher='normal').raise_for_status()
        self.save(None, self.value).raise_for_status()
        self.assertEqual(self.documents(), before)
        self.assertEqual(self.client.get('/api/orari').json()['dataset']['teachers']['normal']['name'], 'Other (Original)')

    def test_inbox_aliases_ambiguity_removal_and_accepted_identity(self):
        self.save(self.value).raise_for_status()
        def preview(name, identifier='one'):
            with Store(self.path).connect() as db:
                db.execute('INSERT OR REPLACE INTO inbox(id,source,raw) VALUES (?,?,?)', (identifier, 'synthetic', json.dumps(response(name=name))))
            return self.client.post(f'/api/inbox/{identifier}/preview', json={}).json()
        for alias in ['rp', ' spillari   DAVIDE ', 'SAVELLI', 'Spillari Davide (Savelli)']:
            item = preview(alias)
            self.assertTrue(item['nameMatched'])
            self.assertEqual(item['teacher'], 'rp')
            self.assertEqual(item['teacherName'], 'Spillari Davide (Savelli)')
        self.save(dict(name='Savelli', originalName='Other'), teacher='normal').raise_for_status()
        self.assertFalse(preview('Savelli')['nameMatched'])
        self.assertIn('ambiguo', preview('Savelli')['error'])
        self.assertFalse(preview('Savelli', 'ambiguous')['teacher'])
        preview('Spillari Davide', 'accepted')
        self.client.post('/api/inbox/accepted/accept', json={}).raise_for_status()
        self.save(None, self.value).raise_for_status()
        self.assertFalse(preview('Spillari Davide')['nameMatched'])
        accepted = self.client.get('/api/inbox?history=true').json()[0]
        self.assertEqual((accepted['teacher'], accepted['status']), ('rp', 'accepted'))
        self.assertIn('rp', self.client.get('/api/export').json()['abs'][DAY])

    def test_archive_import_restart_and_backup(self):
        self.save(self.value).raise_for_status()
        archive = self.client.get('/api/export').json()
        self.assertEqual(archive['schema'], 7)
        self.save(None, self.value).raise_for_status()
        self.client.post('/api/import', json=archive).raise_for_status()
        legacy = dict(archive, schema=5)
        legacy.pop('teacherNameOverrides')
        self.client.post('/api/import', json=legacy).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json()['teacherNameOverrides'], archive['teacherNameOverrides'])
        for invalid in [dict(schema=1, teachers={'unknown': self.value}), dict(schema=1, teachers={'rp': dict(name='X', originalName='')}), None]:
            bad = dict(archive, teacherNameOverrides=invalid)
            before = self.documents()
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
            self.assertEqual(self.documents(), before)
            self.assertEqual(self.client.get('/api/export').json()['teacherNameOverrides'], archive['teacherNameOverrides'])
        snapshot = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'backups'))
        with sqlite3.connect(snapshot['path']) as db:
            self.assertEqual(json.loads(db.execute("SELECT value FROM documents WHERE key='teacherNameOverrides'").fetchone()[0]), archive['teacherNameOverrides'])
        self.assertEqual(TestClient(create_app(self.path)).get('/api/orari').json()['dataset']['teachers']['rp']['name'], 'Spillari Davide (Savelli)')
        empty = dict(archive, teacherNameOverrides=teacher_names.empty())
        self.client.post('/api/import', json=empty).raise_for_status()
        self.assertNotIn('importedName', self.client.get('/api/orari').json()['dataset']['teachers']['rp'])

    def test_timetable_import_retains_override_without_rewriting_identity(self):
        self.save(self.value).raise_for_status()
        raw = copy.deepcopy(self.raw)
        next(t for t in raw['docenti'] if t['id'] == 'rp')['nome_originale'] = 'New import'
        import_version(self.client, raw, '2026-10-19').raise_for_status()
        t = self.client.get('/api/orari?day=2026-10-19').json()['dataset']['teachers']['rp']
        self.assertEqual((t['name'], t['importedName']), ('Spillari Davide (Savelli)', 'New import'))
        raw['docenti'] = [t for t in raw['docenti'] if t['id'] != 'rp']
        raw['orario'] = [l for l in raw['orario'] if l['docente'] != 'rp']
        import_version(self.client, raw, '2026-10-26').raise_for_status()
        self.assertTrue(self.client.get('/api/orari?day=2026-10-26').json()['dataset']['teachers']['rp']['retired'])
        old_archive = self.client.get('/api/export').json()
        old_archive['schema'] = 5
        old_archive.pop('teacherNameOverrides')
        for v in old_archive['timetables']['versions']:
            v['dataset']['teachers'].pop('rp', None)
            v['dataset']['lessons'] = {k: l for k, l in v['dataset']['lessons'].items() if not k.startswith('rp|')}
        self.assertEqual(self.client.post('/api/import', json=old_archive).status_code, 422)
