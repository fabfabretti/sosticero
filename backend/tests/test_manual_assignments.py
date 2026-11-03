import tempfile
import unittest
from pathlib import Path
from backend.tests.client import TestClient
from backend.main import create_app
from backend.tests.test_app import fixture, DAY


class ManualAssignmentsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.client = TestClient(create_app(Path(self.temp.name) / 'test.sqlite'))
        self.client.post('/api/timetable', json=fixture()).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2])).raise_for_status()
        self.key = 'absent|2|1A'

    def assign(self, teacher, **extra):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=self.key, value=teacher, category='MANUAL', **extra))

    def test_manual_options_warn_without_disabling_and_save_note(self):
        choices = self.client.get('/api/candidates', params=dict(day=DAY, key=self.key, include_manual=True)).json()
        manual = {c['id']: c for c in choices if c['ty'] == 'MANUAL'}
        self.assertIn('occupata', manual['support']['tag'])
        self.assertIn('Assente', manual['absent']['tag'])
        self.assertEqual(manual['blank']['tag'], '')
        self.assertEqual(self.assign('support').status_code, 422)
        self.assign('support', exceptional=True, note='  Accordo con docente  ').raise_for_status()
        data = self.client.get('/api/day/' + DAY)
        self.assertEqual(data.status_code, 200, data.text)
        self.assertEqual(data.json()['state']['asg'][DAY][self.key]['note'], 'Accordo con docente')
        self.assertEqual(data.json()['issues'], [])
        self.assertEqual(self.assign('missing', exceptional=True).status_code, 422)
        self.assertEqual(self.assign('support', exceptional=True, note='x' * 2001).status_code, 422)

    def test_absence_and_double_booking_are_explicit_manual_overrides(self):
        self.assign('absent', exceptional=True).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='support', hours=[2])).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='support|2|2A', value='absent', category='MANUAL', exceptional=True)).raise_for_status()
        choices = self.client.get('/api/candidates', params=dict(day=DAY, key=self.key, include_manual=True)).json()
        self.assertIn('Già assegnato', next(c['tag'] for c in choices if c['id'] == 'absent' and c['ty'] == 'MANUAL'))
