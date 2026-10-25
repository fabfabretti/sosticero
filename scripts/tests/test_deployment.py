from contextlib import closing
import importlib.util
from pathlib import Path
import sqlite3
import tempfile
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('installation_data', ROOT / 'scripts/installation-data.py')
data_tools = importlib.util.module_from_spec(spec)
spec.loader.exec_module(data_tools)

class DeploymentTest(unittest.TestCase):
    def test_compose_uses_server_folder_without_public_ports(self):
        config = yaml.safe_load((ROOT / 'compose.server.yaml').read_text())
        self.assertEqual(config['name'], 'sosticero')
        self.assertEqual(set(config['services']), {'sosticero'})
        app = config['services']['sosticero']
        self.assertEqual(app['volumes'], [{'type': 'bind', 'source': './data', 'target': '/data', 'bind': {'create_host_path': False}}])
        self.assertIn('${LOCAL_UID:?', app['user'])
        self.assertIn('${LOCAL_GID:?', app['user'])
        self.assertEqual(app['environment']['APP_ORIGIN'], 'https://sosticero.iamfabs.dev')
        self.assertEqual(app['environment']['APP_ENV'], 'production')
        self.assertEqual(config['networks']['proxy'], {'external': True, 'name': 'npm_npm_proxy'})
        for option in ('build', 'ports', 'privileged', 'network_mode'):
            self.assertNotIn(option, app)
        self.assertEqual(app['cpus'], 1.0)
        self.assertEqual(app['mem_limit'], '1g')
        self.assertTrue(app['read_only'])

    def test_complete_transfer_and_refusal_to_overwrite_or_restore_corruption(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'source'
            source.mkdir()
            for name in ('supplenze.sqlite', 'auth.sqlite'):
                with closing(sqlite3.connect(source / name)) as db, db:
                    db.execute('CREATE TABLE record(value TEXT)')
                    db.execute('INSERT INTO record VALUES (?)', (name,))
            (source / '.sosticero-production').touch()
            (source / '.generation').write_text('42')
            (source / 'keys').mkdir()
            (source / 'keys/google-service-account.json').write_text('private-test-fixture')
            data_tools.pack(source, root / 'transfer')
            data_tools.restore(root / 'transfer', root / 'restored')
            for path in source.rglob('*'):
                if path.is_file():
                    self.assertEqual(path.read_bytes(), (root / 'restored' / path.relative_to(source)).read_bytes())
            with self.assertRaises(ValueError):
                data_tools.restore(root / 'transfer', root / 'restored')
            with self.assertRaises(ValueError):
                data_tools.pack(source, root / 'transfer')
            (root / 'transfer/data.tar').write_bytes(b'corrupt')
            with self.assertRaises(ValueError):
                data_tools.restore(root / 'transfer', root / 'invalid')
            self.assertFalse((root / 'invalid').exists())

    def test_wal_check_does_not_modify_source(self):
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary)
            (source / '.sosticero-production').touch()
            with closing(sqlite3.connect(source / 'auth.sqlite')) as db, db:
                db.execute('CREATE TABLE accounts(id INTEGER)')
            with closing(sqlite3.connect(source / 'supplenze.sqlite')) as db:
                db.execute('PRAGMA journal_mode=WAL')
                db.execute('CREATE TABLE record(value TEXT)')
                db.commit()
                before = {p.name: p.read_bytes() for p in source.iterdir()}
                data_tools.verify_databases(source)
                self.assertEqual(before, {p.name: p.read_bytes() for p in source.iterdir()})

if __name__ == '__main__':
    unittest.main()
