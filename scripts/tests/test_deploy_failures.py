"""Exercise the actual remote shell with fake Docker and a disposable installation."""
from contextlib import closing
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('prepare_source', ROOT / 'scripts/prepare-source.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class DeploymentFailureTest(unittest.TestCase):
    def exercise(self, failure):
        with tempfile.TemporaryDirectory() as temporary:
            base = Path(temporary)
            repo = base / 'repo'
            for name in ('backend', 'frontend', 'scripts'):
                (repo / name).mkdir(parents=True)
            (repo / 'Dockerfile').write_text('FROM python:3.12-slim')
            (repo / '.dockerignore').write_text('data')
            shutil.copyfile(ROOT / 'compose.server.yaml', repo / 'compose.server.yaml')
            shutil.copyfile(ROOT / 'scripts/installation-data.py', repo / 'scripts/installation-data.py')
            with patch.object(prepare, 'ROOT', repo):
                manifest = prepare.prepare(base / 'package')
            stage = base / 'incoming-test'
            shutil.copytree(base / 'package', stage)
            shutil.copyfile(ROOT / 'compose.server.yaml', base / 'compose.yaml')
            (base / '.env').write_text('LOCAL_UID=1000\nLOCAL_GID=1000\nSOSTICERO_IMAGE=old\n')
            data = base / 'data'
            data.mkdir()
            (data / '.sosticero-production').touch()
            for name in ('supplenze.sqlite', 'auth.sqlite'):
                with closing(sqlite3.connect(data / name)) as db, db:
                    db.execute('CREATE TABLE record(value TEXT)')
            if failure == 'backup':
                (data / 'auth.sqlite').unlink()
            before = {p.name: p.read_bytes() for p in data.iterdir()}
            tools = base / 'bin'
            tools.mkdir()
            docker = tools / 'docker'
            docker.write_text('#!' + sys.executable + '\n' + r'''
import json,os,sys
from pathlib import Path
base=Path(os.environ['TEST_BASE']); args=sys.argv[1:]
with (base/'calls').open('a') as log: log.write(json.dumps(args)+'\n')
if args[:2]==['ps','-aq']: print('old-container')
elif args[0]=='inspect':
    if '--format' in args: print('sha256:old')
    else: print(json.dumps([{'Config':{'Labels':{'com.docker.compose.service':'sosticero'}},'Mounts':[{'Destination':'/data','Source':str(base/'data')}]}]))
elif args[0]=='build':
    if os.environ['FAIL']=='build': sys.exit(1)
elif args[:2]==['image','inspect']: print('sha256:new')
elif args[0]=='run':
    if args[-1].endswith('sosticero-release.json'): print(json.dumps({'snapshot':os.environ['SNAPSHOT']}))
    else: print('HTML')
elif args[0]=='compose':
    if 'ps' in args:
        if '-q' in args or '-aq' in args: print('old-container')
''')
            docker.chmod(0o755)
            blocks = re.findall(r"<<'REMOTE'\n(.*?)\nREMOTE", (ROOT / 'scripts/deploy.sh').read_text(), re.S)
            script = blocks[1].replace('/home/pietroa/server/fabs/containers/sosticero', str(base))
            result = subprocess.run(['bash', '-s', '--', 'incoming-test', manifest['source_snapshot']],
                                    input=script, text=True, capture_output=True,
                                    env={**os.environ, 'PATH': str(tools)+':'+os.environ['PATH'],
                                         'TEST_BASE': str(base), 'SNAPSHOT': manifest['source_snapshot'], 'FAIL': failure})
            self.assertNotEqual(result.returncode, 0, result.stdout + result.stderr)
            calls = [json.loads(line) for line in (base / 'calls').read_text().splitlines()]
            self.assertEqual(before, {p.name: p.read_bytes() for p in data.iterdir()})
            for call in calls:
                self.assertNotIn('prune', call)
                self.assertNotIn('down', call)
                if call[0] == 'compose':
                    self.assertEqual(call[call.index('-p')+1], 'sosticero')
            return calls, result.stdout + result.stderr, (base / '.env').read_text()

    def test_build_failure_does_not_stop_running_service(self):
        calls, _, environment = self.exercise('build')
        self.assertFalse(any('stop' in call or 'up' in call for call in calls))
        self.assertIn('SOSTICERO_IMAGE=old', environment)

    def test_backup_failure_resumes_only_the_unchanged_service(self):
        calls, _, environment = self.exercise('backup')
        self.assertTrue(any('stop' in call for call in calls))
        self.assertTrue(any('start' in call for call in calls))
        self.assertFalse(any('up' in call for call in calls))
        self.assertIn('SOSTICERO_IMAGE=old', environment)

    def test_post_start_failure_reports_state_without_automatic_restore(self):
        calls, output, environment = self.exercise('readiness')
        self.assertTrue(any('up' in call for call in calls))
        self.assertFalse(any('start' in call for call in calls))
        self.assertIn('no automatic data restore', output)
        self.assertIn('SOSTICERO_IMAGE=localhost/sosticero:incoming-test', environment)


if __name__ == '__main__':
    unittest.main()
