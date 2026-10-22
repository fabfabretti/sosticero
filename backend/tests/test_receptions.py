import base64
import copy
from io import BytesIO
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from backend.tests.client import TestClient
from openpyxl import Workbook

from backend import receptions, teacher_names, timetables
from backend.domain import normalize_dataset, rp_context
from backend.main import create_app
from backend.tests.test_recovery import fixture, DAY
from backend.tests.timetable_helpers import import_version


def spreadsheet(rows=None):
    workbook = Workbook()
    sheet = workbook.active
    sheet.append(['docente', 'giorno', 'ora', 'orario', 'luogo'])
    for row in rows if rows is not None else [['rp', 'Lun', '4', '10:40 - 11:20', None]]:
        sheet.append(row)
    stream = BytesIO()
    workbook.save(stream)
    return base64.b64encode(stream.getvalue()).decode()


class ReceptionTest(unittest.TestCase):
    def test_versions_and_validation(self):
        row = dict(teacher='rp', day='lun', hour=4, name='rp', time='', location='', site=None)
        document = receptions.replace(receptions.empty(), DAY, [row])
        document = receptions.replace(document, '2026-11-02', [])
        self.assertFalse(receptions.on_day(document, '2026-10-11'))
        self.assertEqual(receptions.on_day(document, DAY), [row])
        self.assertFalse(receptions.on_day(document, '2026-11-02'))
        document = receptions.replace(document, DAY, [])
        self.assertEqual(len(document['versions']), 2)
        receptions.validate(document, {'rp'})
        with self.assertRaises(ValueError):
            receptions.validate(receptions.replace(document, DAY, [dict(row, teacher='missing')]), {'rp'})

    def test_parser_matching_and_locations(self):
        rows = receptions.parse(spreadsheet([['  Ròssi  Mario ', 'Mar', 3, '09:45 - 10:00', 'a distanza'],
                                            ['Unknown', 'Gio', 4, '', 'succursale'], ['wrong', 'bad', True, '', '']]))
        teachers = {'one': dict(name='ROSSI MARIO'), 'two': dict(name='Bianchi')}
        review, saved, ready = receptions.review(rows, teachers, teacher_names.empty(), {})
        self.assertFalse(ready)
        self.assertEqual(review[0]['teacher'], 'one')
        self.assertIsNone(saved[0]['site'])
        review, saved, ready = receptions.review(rows, teachers, teacher_names.empty(), {'3': {'teacher': 'two'}, '4': {'skip': True}})
        self.assertTrue(ready)
        self.assertEqual(saved[1]['site'], 'succursale')
        teachers['three'] = dict(name='Rossi Mario')
        self.assertIsNone(receptions.review(rows, teachers, teacher_names.empty(), {})[0][0]['teacher'])
        labels = dict(schema=1, teachers={'two': dict(name='Other', originalName='Unknown')})
        self.assertEqual(receptions.review(rows, teachers, labels, {})[0][1]['teacher'], 'two')
        with self.assertRaises(ValueError):
            receptions.parse('invalid')
        duplicates = receptions.parse(spreadsheet([['rp', 'Lun', 4, '', 'centrale'], ['rp', 'Lun', 4, '', 'succursale']]))
        self.assertFalse(receptions.review(duplicates, {'rp': dict(name='rp')}, teacher_names.empty(), {})[2])
        workbook = Workbook()
        workbook.active.append(['wrong', 'headers'])
        content = BytesIO()
        workbook.save(content)
        with self.assertRaises(ValueError):
            receptions.parse(base64.b64encode(content.getvalue()).decode())

    def test_context(self):
        ds = normalize_dataset(fixture())
        ds['lessons'] = {k: v for k, v in ds['lessons'].items() if not k.startswith('rp|')}
        state = dict(abs={}, permessi={}, cf={}, asg={})
        reception = dict(teacher='rp', day='lun', hour=4, site='centrale')
        ds['receptions'] = [reception]
        def context(hour, site='centrale'):
            return rp_context(ds, state, DAY, dict(h=hour, sede=site, k=''), 'rp')
        self.assertTrue(context(3)[0])
        self.assertTrue(context(5)[0])
        self.assertFalse(context(2)[0])
        self.assertTrue(context(5, 'succursale')[0])
        self.assertEqual(context(3, 'succursale')[1], 'Cambio sede senza intervallo')
        reception['site'] = None
        self.assertFalse(context(3)[0])
        self.assertIn('Potenzialmente favorevole', context(3)[2])
        self.assertFalse(context(3)[1])


class ReceptionApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'test.sqlite'
        with patch.dict(os.environ, {'BACKUP_ON_STARTUP': 'false'}):
            self.client = TestClient(create_app(self.path))
        self.client.post('/api/timetable', json=fixture()).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=list(range(1, 8)))).raise_for_status()
        self.client.post('/api/manual-permits', json=dict(id='rp', hours=3)).raise_for_status()

    def preview(self, **changes):
        body = dict(file=spreadsheet(), effective=DAY, choices={})
        body.update(changes)
        response = self.client.post('/api/receptions/preview', json=body)
        response.raise_for_status()
        return body, response.json()

    def save(self, body, impact):
        return self.client.post('/api/receptions', json=dict(body, token=impact['token'], confirm=True))

    def candidates(self, hour):
        return self.client.get('/api/candidates', params=dict(day=DAY, key=f'absent|{hour}|1A')).json()

    def test_import_blocks_rp_and_roundtrip(self):
        body, impact = self.preview()
        self.assertTrue(impact['ready'])
        self.assertFalse(self.client.get('/api/receptions').json()['versions'])
        self.save(body, impact).raise_for_status()
        self.assertNotIn('rp', [c['id'] for c in self.candidates(4)])
        response = self.client.post('/api/assignments', json=dict(day=DAY, key='absent|4|1A', value='rp', exceptional=True))
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.client.get('/api/orari', params=dict(day=DAY)).json()['dataset']['receptions'][0]['teacher'], 'rp')
        archive = self.client.get('/api/export').json()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json()['receptions'], archive['receptions'])
        invalid = copy.deepcopy(archive)
        invalid['receptions']['versions'][0]['rows'][0]['teacher'] = 'missing'
        self.assertEqual(self.client.post('/api/import', json=invalid).status_code, 422)
        self.assertEqual(self.client.get('/api/export').json(), archive)
        archive['schema'] = 6
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertFalse(self.client.get('/api/receptions').json()['versions'])

    def test_stale_preview_and_backup_failure(self):
        body, impact = self.preview()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='bottom', hours=[2])).raise_for_status()
        self.assertEqual(self.save(body, impact).status_code, 409)
        body, impact = self.preview()
        before = self.client.get('/api/export').json()
        with patch('backend.main.backup.backup_database', side_effect=OSError('failed')):
            self.assertEqual(self.save(body, impact).status_code, 422)
        self.assertEqual(before, self.client.get('/api/export').json())
        self.assertEqual(self.client.post('/api/receptions', json=body).status_code, 409)

    def test_saved_rp_preserves_attribution_and_statistics(self):
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|4|1A', value='rp')).raise_for_status()
        assignment = self.client.get('/api/export').json()['asg'][DAY]
        body, impact = self.preview()
        self.assertTrue(impact['days'][0]['issues'])
        self.save(body, impact).raise_for_status()
        self.assertTrue(self.client.get('/api/day/' + DAY).json()['issues'])
        self.assertEqual(assignment, self.client.get('/api/export').json()['asg'][DAY])
        archive = self.client.get('/api/export').json()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.client.post('/api/assignments', json=dict(day=DAY, key='absent|4|1A', value='rp')).status_code, 422)

    def test_unknown_and_confirmed_statistics(self):
        body, impact = self.preview(file=spreadsheet([['rp', 'Lun', 7, '', '']]))
        self.save(body, impact).raise_for_status()
        candidate = next(c for c in self.candidates(6) if c['id'] == 'rp')
        self.assertFalse(candidate['convenient'])
        self.assertTrue(candidate['potential'])
        report = self.client.get('/api/stats/availability', params=dict(date=DAY)).json()
        cell = next(cell for cell in report['cells'] if cell['date'] == DAY and cell['hour'] == 6)
        self.assertNotIn('rp', [teacher['id'] for teacher in cell['recovery']])
        body, impact = self.preview(file=spreadsheet([['rp', 'Lun', 7, '', 'centrale']]))
        self.save(body, impact).raise_for_status()
        self.assertTrue(next(c for c in self.candidates(6) if c['id'] == 'rp')['convenient'])
        report = self.client.get('/api/stats/availability', params=dict(date=DAY)).json()
        cell = next(cell for cell in report['cells'] if cell['date'] == DAY and cell['hour'] == 6)
        self.assertIn('rp', [teacher['id'] for teacher in cell['recovery']])

    def test_teaching_updates_preserve_receptions_and_permit_limits(self):
        body, impact = self.preview()
        self.save(body, impact).raise_for_status()
        before = self.client.get('/api/receptions').json()
        raw = fixture()
        raw['orario'].append(dict(docente='rp', giorno='lun', ora=4, classi=['2A'], sede='centrale'))
        import_version(self.client, raw, '2026-10-19').raise_for_status()
        self.assertEqual(before, self.client.get('/api/receptions').json())
        data = self.client.get('/api/orari?day=2026-10-19').json()['dataset']
        self.assertTrue(data['receptions'])
        self.assertIn('rp|lun|4', data['lessons'])
        self.assertNotIn('rp|lun|4', self.client.get('/api/orari?day=' + DAY).json()['dataset']['lessons'])
