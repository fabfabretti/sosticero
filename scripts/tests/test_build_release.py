import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('prepare_source', Path(__file__).parents[1] / 'prepare-source.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class SnapshotTest(unittest.TestCase):
    def fixture(self, root):
        for name in ('backend', 'frontend', 'data'):
            (root / name).mkdir()
        for name, content in {'Dockerfile': 'FROM python:3.12-slim', '.dockerignore': 'data',
                              'backend/main.py': 'uncommitted code', 'frontend/app.tsx': 'frontend',
                              'data/private.sqlite': 'live data', 'backend/.env': 'secret',
                              'frontend/private.key': 'secret'}.items():
            (root / name).write_text(content)
        for name in ('node_modules', 'dist'):
            (root / 'frontend' / name).mkdir()
            (root / 'frontend' / name / 'cache').write_text('ignored')

    def test_snapshot_includes_uncommitted_code_excludes_data_secrets_and_caches(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            identity, files = builder.snapshot(root, root / 'copy')
            self.assertEqual(set(files), {'Dockerfile', '.dockerignore', 'backend/main.py', 'frontend/app.tsx'})
            self.assertEqual((root / 'copy/backend/main.py').read_text(), 'uncommitted code')
            repeated, _ = builder.snapshot(root, root / 'copy2')
            self.assertEqual(identity, repeated)
            (root / 'backend/main.py').write_text('changed code')
            changed, _ = builder.snapshot(root, root / 'copy3')
            self.assertNotEqual(identity, changed)

    def test_symlinks_and_existing_output_are_refused(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.fixture(root)
            (root / 'backend/link').symlink_to(root / 'data/private.sqlite')
            with self.assertRaises(ValueError):
                builder.snapshot(root, root / 'copy')
            with self.assertRaises(ValueError):
                builder.prepare(root)

    def test_package_contains_only_source_configuration_and_backup_tool(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            repo = root / 'repo'
            repo.mkdir()
            self.fixture(repo)
            (repo / 'compose.server.yaml').write_text('services: {}')
            (repo / 'scripts').mkdir()
            (repo / 'scripts/installation-data.py').write_text('pass')
            (repo / 'backend').chmod(0o700)
            (repo / 'backend/main.py').chmod(0o600)
            with patch.object(builder, 'ROOT', repo):
                manifest = builder.prepare(root / 'package')
            with tarfile.open(root / 'package/source.tar') as archive:
                names = set(archive.getnames())
                self.assertIn('context/backend/main.py', names)
                self.assertIn('installation-data.py', names)
                self.assertNotIn('context/data', names)
                self.assertNotIn('context/backend/.env', names)
                marker = json.load(archive.extractfile('context/frontend/public/sosticero-release.json'))
                self.assertEqual(marker, {'snapshot': manifest['source_snapshot']})
                self.assertEqual(archive.getmember('context/backend').mode, 0o755)
                self.assertEqual(archive.getmember('context/backend/main.py').mode, 0o644)
                self.assertEqual(archive.getmember('context/frontend/public/sosticero-release.json').mode, 0o644)
            self.assertEqual(builder.sha256(root / 'package/source.tar'), manifest['archive_sha256'])

    def test_deployment_dry_run_never_connects_or_builds(self):
        script = Path(__file__).parents[1] / 'deploy.sh'
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for tool in ('ssh', 'scp', 'docker'):
                path = root / tool
                path.write_text('#!/bin/sh\necho invoked >> "' + str(root / 'calls') + '"\nexit 99\n')
                path.chmod(0o755)
            env = {**os.environ, 'PATH': str(root) + ':' + os.environ['PATH']}
            result = subprocess.run(['bash', str(script), '--dry-run'], env=env, capture_output=True, text=True, check=True)
            self.assertIn('build on the server', result.stdout)
            self.assertIn('never upload or sync data/', result.stdout)
            self.assertFalse((root / 'calls').exists())


if __name__ == '__main__':
    unittest.main()
