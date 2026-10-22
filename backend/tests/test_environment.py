import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.tests.client import TestClient
from backend.main import create_app


class EnvironmentTest(unittest.TestCase):
    def test_only_explicit_production_hides_testing_ribbon(self):
        for value, testing in [(None, True), ('testing', True), ('typo', True), ('production', False)]:
            with self.subTest(value=value), tempfile.TemporaryDirectory() as directory:
                with patch.dict(os.environ, {'BACKUP_ON_STARTUP': 'false'}):
                    os.environ.pop('APP_ENV', None)
                    if value is not None:
                        os.environ['APP_ENV'] = value
                    client = TestClient(create_app(Path(directory) / 'test.sqlite'))
                    response = client.get('/api/environment')
                    self.assertEqual(response.status_code, 200)
                    self.assertEqual(response.json(), {'testing': testing})
