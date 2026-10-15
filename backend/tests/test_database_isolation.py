from backend.tests.timetable_helpers import import_version
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import create_app, DEFAULT_DATABASE
from backend.tests.test_app import fixture


class DatabaseIsolationTest(unittest.TestCase):
    def test_import_does_not_open_database(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'must-not-exist' / 'test.sqlite'
            env = {**os.environ, 'DATABASE_PATH': str(path), 'APP_ENV': 'production'}
            subprocess.run([sys.executable, '-c', 'import backend.main'], env=env, check=True)
            self.assertFalse(path.parent.exists())

    def test_explicit_database_required(self):
        with patch.dict(os.environ):
            os.environ.pop('DATABASE_PATH', None)
            with self.assertRaisesRegex(RuntimeError, 'explicit DATABASE_PATH'):
                create_app()

    def test_testing_cannot_open_operational_database(self):
        with patch.dict(os.environ, {'APP_ENV': 'testing'}):
            with self.assertRaisesRegex(RuntimeError, 'operational data directory'):
                create_app(DEFAULT_DATABASE)

    def test_production_directory_remains_protected_when_database_name_changes(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'APP_ENV': 'production', 'BACKUP_ON_STARTUP': 'false'}):
                create_app(Path(directory) / 'real.sqlite')
            with patch.dict(os.environ, {'APP_ENV': 'testing'}):
                with self.assertRaisesRegex(RuntimeError, 'operational data directory'):
                    create_app(Path(directory) / 'another.sqlite')
            self.assertFalse((Path(directory) / 'another.sqlite').exists())

    def test_production_timetable_import_requires_confirmation_and_preserves_records(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.dict(os.environ, {'APP_ENV': 'production', 'BACKUP_ON_STARTUP': 'false'}):
                client = TestClient(create_app(Path(directory) / 'real.sqlite'))
            client.post('/api/timetable?confirm=true', json=fixture()).raise_for_status()
            client.post('/api/entries', json={'day': '2026-10-12', 'group': 'abs', 'id': 'absent', 'hours': [2]}).raise_for_status()
            before = client.get('/api/day/2026-10-12').json()
            replacement = fixture()
            replacement['orario'] = []
            self.assertEqual(client.post('/api/timetable', json=replacement).status_code, 409)
            self.assertEqual(client.get('/api/day/2026-10-12').json(), before)
            import_version(client, replacement).raise_for_status()
            self.assertEqual(client.get('/api/day/2026-10-12').json()['state'], before['state'])
