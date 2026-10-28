import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import create_app


class BuildInfoTest(unittest.TestCase):
    def test_entry_pages_and_build_metadata_are_not_cached(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'index.html').write_text('<html>app</html>')
            (root / 'build-info.json').write_text('{"builtAt":"2026-10-28T12:00:00.000Z"}')
            with patch.dict('os.environ', STATIC_PATH=directory):
                app = create_app(root / 'test.sqlite')
            with TestClient(app) as client:
                for path in ('/', '/index.html', '/display', '/build-info.json'):
                    response = client.get(path)
                    self.assertEqual(response.status_code, 200, path)
                    self.assertEqual(response.headers['cache-control'], 'no-store', path)
                self.assertEqual(client.get('/build-info.json').json()['builtAt'], '2026-10-28T12:00:00.000Z')
