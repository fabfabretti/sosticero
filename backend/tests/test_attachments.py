import base64
import copy
import sqlite3
from io import BytesIO
from pathlib import Path
import unittest
from unittest.mock import patch

from PIL import Image
from fastapi.testclient import TestClient
from backend import attachments, backup
from backend.main import create_app
from backend.storage import Store
from backend.tests.test_absence_kinds import AbsenceKindsTest, DAY
from backend.tests import test_recovery


def image(format='PNG', **options):
    out = BytesIO()
    Image.new('RGB', (4, 3), 'red').save(out, format=format, **options)
    return dict(mediaType='image/png' if format == 'PNG' else 'image/jpeg', data=base64.b64encode(out.getvalue()).decode())


class AttachmentsTest(unittest.TestCase):
    setUp = AbsenceKindsTest.setUp
    entry = AbsenceKindsTest.entry
    permit = AbsenceKindsTest.permit
    state = AbsenceKindsTest.state

    def url(self, group='absenceAttachments', day=DAY, teacher='absent'):
        return '/api/attachments/' + self.state()[group][day][teacher]

    def test_legacy_initialization_and_restart(self):
        with sqlite3.connect(self.path) as db:
            db.execute('DROP TABLE attachments')
            before = db.execute('SELECT * FROM documents ORDER BY key').fetchall()
        Store(str(self.path))
        with sqlite3.connect(self.path) as db:
            self.assertEqual(before, db.execute('SELECT * FROM documents ORDER BY key').fetchall())
        restarted = TestClient(create_app(self.path)).get('/api/day/' + DAY).json()['state']
        for group in attachments.GROUPS:
            self.assertEqual(restarted[group], {})

    def test_restore_pre_attachment_backup(self):
        self.entry(note='legacy record').raise_for_status()
        with sqlite3.connect(self.path) as db:
            db.execute('DROP TABLE attachments')
        snapshot = backup.backup_database(str(self.path), str(self.path.parent / 'backups'))
        Store(str(self.path))
        self.entry(attachment=image()).raise_for_status()
        self.client.post('/api/backups/restore', json=dict(filename=snapshot['filename'], confirm=True)).raise_for_status()
        self.assertEqual(self.state()['attachments'], {})
        self.assertEqual(self.state()['absenceNotes'][DAY]['absent'], 'legacy record')
        self.entry(attachment=image()).raise_for_status()
        self.assertEqual(self.client.get(self.url()).status_code, 200)

    def test_validation(self):
        for format in ('PNG', 'JPEG'):
            attachments.validate(image(format))
        animated = BytesIO()
        Image.new('RGB', (2, 2), 'red').save(animated, format='PNG', save_all=True, append_images=[Image.new('RGB', (2, 2), 'blue')])
        bads = [None, {}, {'mediaType': 'image/svg+xml', 'data': 'a'},
                dict(mediaType='image/png', data='%%%'), dict(mediaType='image/png', data='é'),
                dict(mediaType='image/png', data=base64.b64encode(b'<html/>').decode()),
                dict(mediaType='image/jpeg', data=image()['data']),
                dict(mediaType='image/png', data=image()['data'][:40]),
                dict(mediaType='image/png', data=base64.b64encode(animated.getvalue()).decode()),
                dict(mediaType='image/png', data='A' * (4 * ((attachments.MAX_BYTES + 2) // 3) + 4))]
        for value in bads:
            with self.subTest(value=str(value)[:50]), self.assertRaises(ValueError):
                attachments.validate(value)
        value = image(); size = len(base64.b64decode(value['data']))
        with patch.object(attachments, 'MAX_BYTES', size):
            attachments.validate(value)
        with patch.object(attachments, 'MAX_BYTES', size - 1), self.assertRaises(ValueError):
            attachments.validate(value)
        with patch.object(attachments, 'MAX_PIXELS', 11), self.assertRaises(ValueError):
            attachments.validate(value)
        self.entry(attachment=image()).raise_for_status()
        before = self.state()
        for value in bads[1:]:
            self.assertEqual(self.entry(attachment=value).status_code, 422)
            self.assertEqual(before, self.state())
        self.assertEqual(self.entry(group='cf', attachment=None).status_code, 422)
        self.assertEqual(self.client.post('/api/manual-permits', json=dict(id='absent', hours=2, attachment=image())).status_code, 422)

    def test_lifecycle_ranges_and_serving(self):
        self.entry(attachment=image(), until='2026-10-13').raise_for_status()
        old = self.url()
        self.assertEqual(old, self.url(day='2026-10-13'))
        self.permit(attachment=image('JPEG')).raise_for_status()
        permit_url = self.url('permitAttachments')
        self.entry(hours=[1, 2]).raise_for_status()
        self.assertEqual(old, self.url())
        response = self.client.get(old)
        self.assertEqual(response.content, base64.b64decode(image()['data']))
        self.assertEqual(response.headers['content-type'], 'image/png')
        for header, value in [('cache-control', 'private, no-store'), ('x-content-type-options', 'nosniff'), ('content-disposition', 'inline')]:
            self.assertEqual(response.headers[header], value)
        daily = self.client.get('/api/day/' + DAY).json()
        self.assertNotIn(image()['data'], str(daily))
        self.assertNotIn(image('JPEG')['data'], str(self.client.get('/api/permessi').json()))
        self.entry(attachment=None).raise_for_status()
        self.assertEqual(self.client.get(old).status_code, 200)
        self.entry(day='2026-10-13', hours=None).raise_for_status()
        self.assertEqual(self.client.get(old).status_code, 404)
        self.assertEqual(self.client.get(permit_url).status_code, 200)
        self.permit(day='2026-10-19', original_day=DAY, original_id='absent').raise_for_status()
        self.assertEqual(permit_url, self.url('permitAttachments', '2026-10-19'))
        self.entry(group='dis', attachment=image(), site='centrale').raise_for_status()
        dis_url = self.url('disAttachments')
        self.entry(group='dis', site='succursale', hours=[]).raise_for_status()
        self.assertEqual(dis_url, self.url('disAttachments'))
        self.entry(group='dis', attachment=image('JPEG')).raise_for_status()
        self.assertEqual(self.client.get(dis_url).status_code, 404)
        with sqlite3.connect(self.path) as db:
            db.execute('INSERT INTO attachments VALUES (?,?,?)', ('orphan', 'image/png', b'bad'))
        self.assertEqual(self.client.get('/api/attachments/orphan').status_code, 404)

    def test_archives_backup_and_timetable(self):
        self.entry(attachment=image(), until='2026-10-13').raise_for_status()
        url = self.url(); archive = self.state()
        self.assertEqual(archive['schema'], 3)
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(archive, self.state())
        for change in ('missing', 'orphan', 'source', 'corrupt', 'old', 'unknown', 'invalid-id'):
            bad = copy.deepcopy(archive)
            if change == 'invalid-id':
                identifier = next(iter(bad['attachments']))
                bad['attachments']['bad/id'] = bad['attachments'].pop(identifier)
                for teachers in bad['absenceAttachments'].values():
                    for teacher in teachers: teachers[teacher] = 'bad/id'
            if change == 'missing': bad['attachments'] = {}
            if change == 'orphan': bad['attachments']['extra'] = image()
            if change == 'source': bad['absenceAttachments'][DAY]['unknown'] = next(iter(bad['attachments']))
            if change == 'corrupt': bad['attachments'][next(iter(bad['attachments']))]['data'] = 'broken'
            if change == 'old': bad['schema'] = 2
            if change == 'unknown': bad['schema'] = 4
            self.assertEqual(self.client.post('/api/import', json=bad).status_code, 422)
            self.assertEqual(archive, self.state())
        snapshot = backup.backup_database(str(self.path), str(Path(self.tmp.name) / 'snapshots'))
        self.entry(attachment=None).raise_for_status()
        backup.restore_backup(str(self.path), snapshot['path'])
        self.assertEqual(archive, self.state())
        self.assertEqual(self.client.get(url).status_code, 200)
        from backend.tests.test_app import fixture
        self.client.post('/api/timetable', json=fixture()).raise_for_status()
        self.assertEqual(self.client.get(url).status_code, 200)
        for schema in (1, 2):
            legacy = {k: v for k, v in archive.items() if k not in (*attachments.GROUPS, 'attachments')}
            legacy['schema'] = schema
            self.client.post('/api/import', json=legacy).raise_for_status()
            self.assertEqual(self.client.get(url).status_code, 404)

    def test_protected_permit_rollback(self):
        self.client.post('/api/timetable', json=test_recovery.fixture()).raise_for_status()
        self.entry(hours=[1]).raise_for_status()
        self.permit(day='2026-10-05', id='rp', hours=[2], attachment=image()).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|1|1A', value='rp')).raise_for_status()
        before = self.state()
        result = self.permit(day='2026-09-01', id='rp', hours=[2], original_day='2026-10-05', original_id='rp', attachment=image('JPEG'))
        self.assertEqual(result.status_code, 422)
        self.assertEqual(before, self.state())
