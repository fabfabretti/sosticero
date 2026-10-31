import copy
from datetime import datetime
import json
from pathlib import Path
import tempfile
import threading
import unittest
from unittest.mock import patch, Mock
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient as AnonymousClient
from backend.publication import Publisher, encoded
from backend.cloudflare import Cloudflare, UploadError
from backend.main import create_app
from backend.tests.client import TestClient
from backend.tests.test_app import DAY, fixture
from backend.domain import normalize_dataset
from backend.storage import Store, EMPTY


class PublisherTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.shell = self.root / 'shell'; self.shell.mkdir()
        (self.shell / 'publication.html').write_text('<html>display</html>')
        self.captured = []
        def capture(day, campus):
            self.captured.append(campus)
            return dict(day=day, campus=campus, updated=day+'T09:00:00+01:00', teachers=[], changes=[], incomplete=False)
        self.publisher = Publisher(self.root / 'publication', self.shell, capture)
        self.publisher.cloud = Mock(configured=True, url='https://fixture.pages.dev')
        self.publisher.cloud.verify.return_value = True
        self.publisher.cloud.upload.side_effect = lambda files, release, activate: (activate(), 'deployment')[1]
        self.publisher.cloud.deployment_failed.return_value = False

    def publish(self, campus, auto=False):
        # Execute deterministically while preserving lock transfer semantics.
        class Immediate:
            def __init__(self, target, args, **kw): self.target, self.args = target, args
            def start(self): self.target(*self.args)
        with patch('backend.publication.threading.Thread', Immediate):
            self.publisher.start(DAY, campus, auto)

    def test_independent_campuses_preserve_bytes_and_timestamp_across_restart(self):
        self.publish('centrale')
        first = self.publisher.read()['committed']
        self.assertTrue(first['succursale']['unavailable'])
        self.publish('succursale')
        second = self.publisher.read()['committed']
        self.assertEqual(encoded(first['centrale']), encoded(second['centrale']))
        self.assertEqual(self.captured, ['centrale', 'succursale'])
        self.publisher = Publisher(self.publisher.root, self.shell, self.publisher.capture)
        self.assertEqual(second, self.publisher.read()['committed'])
        self.assertEqual((self.publisher.root/'state.json').stat().st_mode & 0o777, 0o600)
        self.assertEqual(len(list(self.publisher.root.glob('state-*'))), 0)

    def test_upload_failure_keeps_committed_state_and_hides_provider_details(self):
        self.publish('centrale'); before = self.publisher.read()['committed']
        self.publisher.cloud.upload.side_effect = UploadError('SECRET payload')
        self.publish('succursale')
        state = self.publisher.read()
        self.assertEqual(before, state['committed'])
        self.assertIsNone(state['pending'])
        self.assertNotIn('SECRET', state['error'])

    def test_uncertain_activation_reconciles_before_next_publication(self):
        self.publisher.cloud.verify.return_value = False
        self.publish('centrale')
        state = self.publisher.read(); pending = copy.deepcopy(state['pending'])
        self.assertTrue(pending)
        with self.assertRaises(Exception) as raised: self.publisher.start(DAY, 'succursale')
        self.assertEqual(raised.exception.status_code, 409)
        self.publisher.cloud.verify.return_value = True
        status = self.publisher.status('centrale')
        self.assertFalse(status['uncertain'])
        self.assertEqual(self.publisher.read()['committed'], pending['snapshots'])
        self.publish('succursale')
        self.assertEqual(self.publisher.read()['committed']['centrale'], pending['snapshots']['centrale'])

    def test_concurrent_attempt_rejected_and_prepared_restart_discarded(self):
        fd = self.publisher.lock()
        try:
            with self.assertRaises(Exception) as raised: self.publisher.start(DAY, 'centrale')
            self.assertEqual(raised.exception.status_code, 409)
        finally: self.publisher.unlock(fd)
        state = self.publisher.read(); state['pending'] = {'phase': 'prepared'}; self.publisher.save(state)
        self.publisher.status('centrale')
        self.assertIsNone(self.publisher.read()['pending'])

    def test_bundle_exact_files_and_no_operational_data(self):
        state = self.publisher.read()
        files = self.publisher.files(state['committed'], 'release')
        self.assertEqual(files['display/index.html'], files['index.html'])
        self.assertEqual(json.loads(files['succursale.json']), {'campus':'succursale','unavailable':True})
        self.assertIn(b'no-store', files['_headers'])
        self.assertEqual(set(json.loads(files['release.json'])['hashes']), {'centrale','succursale'})

    def test_auto_publication_captures_both_campuses_in_one_release(self):
        self.publish('centrale', auto=True)
        self.assertEqual(self.captured, ['centrale', 'succursale'])
        committed = self.publisher.read()['committed']
        self.assertEqual({c: committed[c]['day'] for c in ('centrale', 'succursale')}, {'centrale': DAY, 'succursale': DAY})
        self.assertEqual(committed['centrale']['publication'], committed['succursale']['publication'])
        self.assertEqual(self.publisher.cloud.upload.call_count, 1)

    def test_auto_due_after_configured_time_until_both_campuses_are_fresh(self):
        self.publisher.schedule = lambda: '08:00'
        at = lambda h, m: datetime.fromisoformat(f'{DAY}T{h:02d}:{m:02d}:00').replace(tzinfo=ZoneInfo('Europe/Rome'))
        self.assertFalse(self.publisher.due(at(7, 59)))
        self.assertTrue(self.publisher.due(at(8, 0)))
        state = self.publisher.read()
        for campus in ('centrale', 'succursale'):
            state['committed'][campus] = dict(campus=campus, day=DAY, updated=at(8, 0).isoformat())
        self.publisher.save(state)
        self.assertFalse(self.publisher.due(at(8, 1)))
        state['committed']['succursale']['updated'] = at(7, 59).isoformat()
        self.publisher.save(state)
        self.assertTrue(self.publisher.due(at(8, 1)))
        state['committed']['succursale']['updated'] = '2026-10-11T08:00:00+02:00'
        self.publisher.save(state)
        self.assertTrue(self.publisher.due(at(8, 1)))
        self.publisher.schedule = lambda: ''
        self.assertFalse(self.publisher.due(at(9, 0)))


class PublicationApiTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        self.app = create_app(root/'app.sqlite')
        self.central = TestClient(self.app); self.addCleanup(self.central.close)
        self.branch = TestClient(self.app, campus='succursale'); self.addCleanup(self.branch.close)
        self.anonymous = AnonymousClient(self.app, base_url='http://localhost'); self.addCleanup(self.anonymous.close)
        self.clock = patch('backend.main.datetime').start(); self.addCleanup(patch.stopall)
        self.clock.now.return_value = datetime.fromisoformat(DAY+'T09:00:00').replace(tzinfo=ZoneInfo('Europe/Rome'))

    def test_authorization_date_csrf_and_account_scope(self):
        with patch.object(self.app.state.publisher, 'start') as start:
            self.assertEqual(self.anonymous.post('/api/publication',json={'day':DAY},headers={'Origin':'http://localhost'}).status_code,401)
            for client,campus in [(self.central,'centrale'),(self.branch,'succursale')]:
                response=client.post('/api/publication',json={'day':DAY})
                self.assertEqual(response.status_code,202,response.text)
                self.assertEqual(start.call_args.args,(DAY,campus))
            count=start.call_count
            for client,body,headers in [(self.branch,{'day':DAY,'campus':'centrale'},{}),
                (self.central,{'day':'1999-01-01'},{}),
                (self.central,{'day':DAY},{'Origin':'https://foreign.invalid'}),
                (self.central,{'day':DAY},{'X-CSRF-Token':'invalid'})]:
                self.assertIn(client.post('/api/publication',json=body,headers=headers).status_code,(403,422))
            self.assertEqual(start.call_count,count)

    def test_missing_configuration_is_actionable(self):
        self.app.state.publisher.cloud.token=''
        response=self.central.post('/api/publication',json={'day':DAY})
        self.assertEqual(response.status_code,503)

    def test_schedule_read_shared_and_written_only_by_centrale(self):
        self.assertEqual(self.central.get('/api/publication/schedule').json(), {'time': ''})
        self.assertEqual(self.branch.get('/api/publication/schedule').json(), {'time': ''})
        self.assertEqual(self.branch.post('/api/publication/schedule', json={'time': '07:30'}).status_code, 403)
        for invalid in ('7:30', '24:00', '07:60', 730, None):
            self.assertEqual(self.central.post('/api/publication/schedule', json={'time': invalid}).status_code, 422)
        self.assertEqual(self.central.post('/api/publication/schedule', json={}).status_code, 422)
        self.assertEqual(self.central.post('/api/publication/schedule', json={'time': '07:30'}).json(), {'time': '07:30'})
        self.assertEqual(self.branch.get('/api/publication/schedule').json(), {'time': '07:30'})
        self.assertEqual(self.central.post('/api/publication/schedule', json={'time': ''}).json(), {'time': ''})

    def test_capture_matches_live_projection_and_never_reads_other_campus_for_publish(self):
        ds=normalize_dataset(fixture()); state=copy.deepcopy(EMPTY)
        state['abs'][DAY]={'absent':[2]}
        state['asg'][DAY]={'absent|2|1A':dict(v='pot',t='POT',c='1A')}
        store = Store(str(Path(self.temp.name)/'app.sqlite'))
        with store.connect() as db:
            store.write(db,'dataset',ds); store.write(db,'state',state)
        for campus in ('centrale','succursale'):
            live=self.anonymous.get('/api/display',params={'campus':campus}).json()
            self.assertEqual(self.app.state.publisher.capture(DAY,campus),live)


class CloudflareTest(unittest.TestCase):
    def test_upload_protocol_and_activation_boundary(self):
        cloud=Cloudflare(); calls=[]
        def api(method,path,**kw):
            calls.append((method,path,kw))
            if path.endswith('upload-token'): return {'jwt':'upload-jwt'}
            if path.endswith('check-missing'): return kw['json']['hashes']
            if path.endswith('deployments'): return {'id':'deployment-id'}
            return {}
        cloud.api=api
        activated=[]
        result=cloud.upload({'index.html':b'hello','_headers':b'/*\n  Cache-Control: no-store'},'release',lambda:activated.append(True))
        self.assertEqual(result,'deployment-id');self.assertEqual(activated,[True])
        upload=next(kw['json'] for _,path,kw in calls if path.endswith('assets/upload'))
        self.assertEqual(upload[0]['value'],'aGVsbG8=')
        self.assertEqual(len(upload[0]['key']),32)
        self.assertEqual(calls[-1][2]['data']['commit_message'],'release')
        self.assertIn('_headers',calls[-1][2]['files'])

    def test_api_failures_sanitized_and_redirects_disabled(self):
        cloud=Cloudflare()
        with patch('backend.cloudflare.requests.request') as req:
            req.return_value.json.return_value={'success':False,'errors':[{'message':'SECRET'}]}
            with self.assertRaises(UploadError) as raised: cloud.api('GET','/fixture')
            self.assertNotIn('SECRET',str(raised.exception))
            self.assertFalse(req.call_args.kwargs['allow_redirects'])

    def test_verification_requires_all_expected_files(self):
        cloud=Cloudflare();files={name:b'expected' for name in ('release.json','centrale.json','succursale.json')}
        with patch('backend.cloudflare.requests.get') as get:
            get.return_value.content=b'wrong'
            self.assertFalse(cloud.verify(files,'release',seconds=0))
            get.return_value.content=b'expected'
            self.assertTrue(cloud.verify(files,'release',seconds=0))


class CloudflareEmptyResultTest(unittest.TestCase):
    def test_success_without_result_is_valid_for_hash_upsert(self):
        with patch('backend.cloudflare.requests.request') as request:
            request.return_value.json.return_value = {'success': True}
            self.assertIsNone(Cloudflare().api('POST', '/pages/assets/upsert-hashes'))
