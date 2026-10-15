import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import create_app
from backend.tests.test_app import fixture, DAY
from backend.tests.test_timetables import import_version


class OrariTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)/'test.sqlite'
        with patch.dict('os.environ', {'BACKUP_ON_STARTUP': 'false'}):
            self.client = TestClient(create_app(self.path))
        self.client.post('/api/timetable', json=fixture()).raise_for_status()

    def test_returns_dataset_of_version_in_effect(self):
        import_version(self.client, fixture(), effective=DAY)
        body = self.client.get('/api/orari').json()
        self.assertEqual(body['effective'], DAY)
        self.assertIn('absent', body['dataset']['teachers'])

    def test_teachers_carry_the_extended_classe_di_concorso(self):
        import_version(self.client, fixture(), effective=DAY)
        teachers = self.client.get('/api/orari').json()['dataset']['teachers']
        self.assertEqual(teachers['co']['cdcName'], 'Laboratori di scienze e tecnologie informatiche')
        self.assertEqual(teachers['support']['cdcName'], 'Sostegno')
        self.assertEqual(teachers['absent']['cdcName'], '')

    def test_future_version_does_not_replace_current(self):
        import_version(self.client, fixture(), effective=DAY)
        current = self.client.get('/api/orari').json()
        import_version(self.client, fixture(), effective='2099-01-01')
        still = self.client.get('/api/orari').json()
        self.assertEqual(still['effective'], DAY)
        self.assertEqual(still['dataset'], current['dataset'])


if __name__ == '__main__':
    unittest.main()
