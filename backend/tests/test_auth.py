import json
import io
import os
from pathlib import Path
import secrets
import tempfile
import threading
import time
import unittest
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.auth import COOKIE
from backend.tests.test_app import fixture, DAY
from backend.tests.test_inbox import response as inbox_response


class AuthenticationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.app = create_app(Path(self.tmp.name)/'school.sqlite')
        self.identities = self.app.state.identities
        self.password = secrets.token_urlsafe(24)
        self.identities.create('centrale','Maria','centrale',self.password)
        self.identities.create('succursale','Luca','succursale',self.password)
        self.central = self.client('centrale')
        self.succ = self.client('succursale')
        timetable=fixture()
        for lesson in timetable['orario']:
            if lesson['docente'] in ('support','pot'):lesson['sede']='succursale'
        self.post(self.central,'timetable',timetable).raise_for_status()
        self.sync_generation(self.succ)

    def client(self, username=None):
        client = TestClient(self.app,base_url='http://localhost',headers={'Origin':'http://localhost'})
        if username:
            result=client.post('/api/auth/login',json=dict(username=username,password=self.password))
            result.raise_for_status()
            client.headers['X-CSRF-Token']=result.json()['csrf']
            client.headers['X-Data-Generation']=str(result.json()['generation'])
        return client

    def sync_generation(self, client):
        result=client.get('/api/auth/session')
        client.headers['X-Data-Generation']=str(result.json()['generation'])

    def post(self,client,route,body):
        result=client.post('/api/'+route,json=body)
        if result.is_success: client.headers['X-Data-Generation']=result.headers['x-data-generation']
        return result

    def entry(self,client,teacher,day=DAY):
        data=client.get('/api/day/'+day).json()
        key=f'abs|{day}|{teacher}'
        return self.post(client,'entries',dict(day=day,group='abs',id=teacher,hours=[2],expected={key:data['concurrency']['records'].get(key,'absent')}))

    def test_every_operational_route_requires_authentication(self):
        anonymous=self.client()
        for route in self.app.routes:
            path=getattr(route,'path','')
            if not path.startswith('/api/') or path=='/api/environment' or path.startswith('/api/auth/'): continue
            path=path.replace('{day}',DAY).replace('{identifier}','unknown').replace('{action}','accept')
            for method in route.methods & {'GET','POST'}:
                if path == '/api/display' and method == 'GET': continue
                with self.subTest(path=path,method=method):
                    res=anonymous.request(method,path,json={} if method=='POST' else None)
                    self.assertEqual(res.status_code,401,res.text)

    def test_session_identity_cookie_csrf_and_origin(self):
        data=self.central.get('/api/auth/session').json()
        self.assertEqual(data['account']['name'],'Maria')
        self.assertEqual(data['account']['campus'],'centrale')
        self.assertNotIn('password',str(data))
        cookie=self.central.cookies.get(COOKIE)
        self.assertTrue(cookie)
        self.assertEqual(self.central.post('/api/entries',json={},headers={'X-CSRF-Token':'wrong'}).status_code,403)
        self.assertEqual(self.central.post('/api/entries',json={},headers={'Origin':'http://evil.example'}).status_code,403)
        self.assertEqual(self.central.get('/api/permessi',headers={'Host':'evil.example'}).status_code,403)
        self.assertEqual(self.post(self.central,'auth/logout',{}).status_code,200)
        self.central.cookies.set(COOKIE,cookie)
        self.assertEqual(self.central.get('/api/permessi').status_code,401)

    def test_https_cookie_and_untrusted_host(self):
        with patch.dict(os.environ,{'APP_ORIGIN':'https://school.example'}):
            client=TestClient(self.app,base_url='https://school.example',headers={'Origin':'https://school.example'})
            result=client.post('/api/auth/login',json=dict(username='centrale',password=self.password))
            self.assertEqual(result.status_code,200)
            self.assertIn('Secure',result.headers['set-cookie'])
            self.assertIn('HttpOnly',result.headers['set-cookie'])
            self.assertEqual(client.get('/api/orari',headers={'Host':'evil.example'}).status_code,403)
            self.assertEqual(client.post('/api/auth/login',json={},headers={'Origin':'http://school.example'}).status_code,403)

    def test_local_commands_hide_password_and_revoke_sessions(self):
        from backend.auth import main
        secret=secrets.token_urlsafe(24)
        output=io.StringIO()
        command=['accounts','--database',str(self.identities.path),'--testing','create','extra','--name','Extra','--campus','succursale']
        with patch('sys.argv',command),patch('getpass.getpass',return_value=secret),patch('sys.stdout',output):main()
        with patch('sys.argv',command[:4]+['list']),patch('sys.stdout',output):main()
        self.assertIn('extra',output.getvalue())
        self.assertNotIn(secret,output.getvalue())
        with patch('sys.argv',command[:4]+['disable','centrale']):main()
        self.assertEqual(self.central.get('/api/orari').status_code,401)

    def test_reset_disable_and_expiration_revoke_sessions(self):
        self.identities.change('succursale','enabled',False)
        self.assertEqual(self.succ.get('/api/permessi').status_code,401)
        self.identities.change('succursale','enabled',True)
        self.assertEqual(self.succ.get('/api/permessi').status_code,401)
        self.identities.change('centrale','password',secrets.token_urlsafe(24))
        self.assertEqual(self.central.get('/api/permessi').status_code,401)
        renewed=self.client('succursale')
        with self.identities.connect() as db:db.execute('UPDATE sessions SET expires=0')
        self.assertEqual(renewed.get('/api/permessi').status_code,401)

    def test_succursale_reads_everything_but_settings_are_centrale_only(self):
        for route in ('orari','permessi','inbox','hour-types','receptions','backups','inbox/connection'):
            self.assertEqual(self.succ.get('/api/'+route).status_code,200,route)
        for route in ('timetable','timetable/preview','receptions','receptions/preview','hour-types','inbox/credentials','inbox/connection','inbox/test','import','import/preview','backups','backups/restore'):
            self.assertEqual(self.post(self.succ,route,{}).status_code,403,route)
        self.assertEqual(self.succ.get('/api/export').status_code,403)
        self.entry(self.succ,'absent').raise_for_status()
        self.entry(self.central,'support').raise_for_status()

    def test_assignment_scope_follows_row_not_candidate(self):
        self.entry(self.central,'absent').raise_for_status()
        data=self.central.get('/api/day/'+DAY).json()
        ref=f'asg|{DAY}|absent|2|1A'
        body=dict(day=DAY,key='absent|2|1A',value='pot',expected={ref:data['concurrency']['records'][ref]})
        self.assertEqual(self.post(self.succ,'assignments',body).status_code,403)
        self.post(self.central,'assignments',body).raise_for_status()
        current=self.central.get('/api/day/'+DAY).json()['concurrency']['records'][ref]
        self.assertEqual(self.post(self.succ,'assignments',dict(body,value=None,expected={ref:current})).status_code,403)
        self.assertEqual(self.post(self.succ,'assignments',dict(day=DAY,key=body['key'],communicated=True,expected={ref:current})).status_code,403)
        self.assertEqual(self.post(self.succ,'assignments',dict(day=DAY,key=body['key'],accepted=True,expected={ref:current})).status_code,403)

    def test_succursale_assignment_and_cross_campus_move(self):
        self.entry(self.central,'absent').raise_for_status()
        self.entry(self.succ,'support').raise_for_status()
        state=self.central.get('/api/day/'+DAY).json()['concurrency']['records']
        ref=f'asg|{DAY}|support|2|2A'
        body=dict(day=DAY,key='support|2|2A',value='dis',expected={ref:state[ref]})
        self.assertEqual(self.post(self.central,'assignments',body).status_code,403)
        self.post(self.succ,'assignments',body).raise_for_status()
        state=self.central.get('/api/day/'+DAY).json()['concurrency']['records']
        ref2=f'asg|{DAY}|absent|2|1A'
        move=dict(day=DAY,key='absent|2|1A',replace_key='support|2|2A',value='dis',expected={ref:state[ref],ref2:state[ref2]})
        self.assertEqual(self.post(self.central,'assignments',move).status_code,403)
        self.assertEqual(self.post(self.succ,'assignments',move).status_code,403)

    def test_two_campuses_cannot_book_one_teacher_simultaneously(self):
        self.entry(self.central,'absent').raise_for_status()
        self.entry(self.succ,'support').raise_for_status()
        records=self.central.get('/api/day/'+DAY).json()['concurrency']['records']
        def assign(pair):
            client,key=pair
            ref=f'asg|{DAY}|{key}'
            return self.post(client,'assignments',dict(day=DAY,key=key,value='dis',expected={ref:records[ref]}))
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(assign,[(self.central,'absent|2|1A'),(self.succ,'support|2|2A')]))
        self.assertEqual(sum(r.status_code==200 for r in results),1,[r.text for r in results])
        state=self.central.get('/api/day/'+DAY).json()['state']['asg'][DAY]
        self.assertEqual(sum(v.get('v')=='dis' for v in state.values()),1)

    def test_inbox_fetch_crossing_publication_is_discarded(self):
        from backend.inbox import HEADERS
        inbox=self.app.state.inbox
        inbox.key.parent.mkdir(parents=True,exist_ok=True)
        inbox.key.write_text('{}')
        with inbox.store.connect() as db:inbox.store.write(db,'googleSheets',dict(spreadsheet='synthetic',worksheet='test'))
        fetched,release=threading.Event(),threading.Event()
        def fetcher(config,key):
            fetched.set();release.wait(2)
            return [HEADERS,inbox_response()]
        inbox.fetcher=fetcher
        with ThreadPoolExecutor(max_workers=1) as pool:
            job=pool.submit(inbox.sync)
            self.assertTrue(fetched.wait(2))
            with self.identities.gate():self.identities.generation(advance=True)
            release.set();self.assertTrue(job.result(timeout=3))
        self.assertEqual(inbox.status()['received'],0)

    def test_shared_names_and_irrelevant_poll_status(self):
        data=self.central.get('/api/orari').json()
        body=dict(teacher='absent',previous=None,value=dict(name='Updated',originalName='absent'))
        self.post(self.succ,'orari/name',body).raise_for_status()
        self.assertEqual(self.post(self.central,'orari/name',body).status_code,409)
        self.assertTrue(self.central.get('/api/orari').json()['dataset']['teachers']['absent']['name'].startswith('Updated'))

    def test_generation_blocks_waiting_old_requests_and_restore_preserves_accounts(self):
        self.entry(self.central,'absent').raise_for_status()
        old=self.central.get('/api/day/'+DAY).json()['concurrency']['records'][f'abs|{DAY}|absent']
        old_generation=self.central.headers['X-Data-Generation']
        backup=self.post(self.central,'backups',{}).json()['filename']
        self.identities.change('succursale','name','Renamed')
        restored=self.post(self.central,'backups/restore',dict(filename=backup,confirm=True))
        restored.raise_for_status()
        self.assertEqual(self.central.get('/api/permessi').status_code,401)
        self.central=self.client('centrale')
        body=dict(day=DAY,group='abs',id='absent',hours=[1,2],expected={f'abs|{DAY}|absent':old})
        r=self.central.post('/api/entries',json=body,headers={'X-Data-Generation':old_generation})
        self.assertEqual(r.status_code,409)
        self.assertEqual(r.json()['detail']['code'],'dataset_replaced')
        self.assertEqual(self.client('succursale').get('/api/auth/session').json()['account']['name'],'Renamed')

    def test_failed_restore_recovers_previous_school_records(self):
        from backend import backup as backup_module
        saved=self.post(self.central,'backups',{}).json()['filename']
        self.entry(self.central,'absent').raise_for_status()
        original=backup_module.restore_backup
        calls=[]
        def fail_after_copy(*args):
            original(*args)
            calls.append(args)
            if len(calls)==1: raise ValueError('synthetic restore failure')
        with patch('backend.main.backup.restore_backup',side_effect=fail_after_copy):
            result=self.post(self.central,'backups/restore',dict(filename=saved,confirm=True))
        self.assertEqual(result.status_code,422)
        self.assertEqual(len(calls),2)
        self.central=self.client('centrale')
        data=self.central.get('/api/day/'+DAY).json()
        self.assertIn(f'abs|{DAY}|absent',data['concurrency']['records'])

    def test_hour_type_preconditions_and_login_rate_limit(self):
        inventory=self.central.get('/api/hour-types').json()
        key=next(k for k,v in inventory['types'].items() if v['visible'] and v['available'])
        value=inventory['types'][key]
        body=dict(id=key,available=not value['available'],visible=value['visible'],school=value['school'],expected=inventory['versions'][key])
        self.post(self.central,'hour-types',body).raise_for_status()
        self.assertEqual(self.post(self.central,'hour-types',body).status_code,409)
        anon=self.client()
        for _ in range(10):self.assertEqual(anon.post('/api/auth/login',json=dict(username='missing',password='wrong')).status_code,401)
        self.assertEqual(anon.post('/api/auth/login',json=dict(username='missing',password='wrong')).status_code,429)

    def test_inbox_acceptance_attribution_survives_rename_and_retry(self):
        with self.app.state.inbox.store.connect() as db:
            db.execute('INSERT INTO inbox(id,source,raw) VALUES(?,?,?)',('acceptor-test','synthetic',json.dumps(inbox_response())))
        first=self.post(self.central,'inbox/acceptor-test/accept',{})
        first.raise_for_status()
        self.identities.change('centrale','name','New Name')
        repeat=self.post(self.succ,'inbox/acceptor-test/accept',dict(acceptedBy={'name':'forged'}))
        self.assertTrue(repeat.json()['alreadyProcessed'])
        self.assertEqual(repeat.json()['acceptedBy']['name'],'Maria')
        history=self.succ.get('/api/inbox?history=true').json()
        self.assertEqual(history[0]['acceptedBy']['username'],'centrale')
        self.central=self.client('centrale')
        saved=self.post(self.central,'backups',{}).json()['filename']
        self.post(self.central,'backups/restore',dict(filename=saved,confirm=True)).raise_for_status()
        self.central=self.client('centrale')
        self.assertEqual(self.central.get('/api/inbox?history=true').json()[0]['acceptedBy']['name'],'Maria')
        with self.app.state.inbox.store.connect() as db:
            db.execute('UPDATE inbox SET accepted_by=NULL WHERE id=?',('acceptor-test',))
        self.assertIsNone(self.central.get('/api/inbox?history=true').json()[0]['acceptedBy'])

    def test_identity_validation_and_gate_timeout_cleanup(self):
        from fastapi import HTTPException
        for username,campus in [('bad user','centrale'),('valid','other')]:
            with self.assertRaises(ValueError):self.identities.create(username,'Test',campus,self.password)
        with self.identities.connect() as db:
            hashed=db.execute('SELECT password FROM accounts WHERE username=?',('centrale',)).fetchone()[0]
        self.assertTrue(hashed.startswith('$argon2id$'))
        self.assertNotIn(self.password,hashed)
        with self.identities.gate():
            with patch('backend.auth.time.monotonic',side_effect=[0,16]):
                with self.assertRaises(HTTPException) as error:self.identities.acquire()
        self.assertEqual(error.exception.status_code,503)
        with self.identities.gate():pass

    @unittest.skipIf(os.name == 'nt', 'Windows retains exclusive read locks')
    def test_api_reads_overlap_but_account_changes_wait_for_readers(self):
        route=next(r for r in self.app.routes if getattr(r,'path',None)=='/api/permessi')
        original=route.dependant.call
        both=threading.Barrier(3)
        release=threading.Event()
        def reading():
            both.wait(timeout=3)
            if not release.wait(3):raise RuntimeError('Readers were not released')
            return original()
        route.dependant.call=reading
        try:
            with ThreadPoolExecutor(max_workers=3) as pool:
                readers=[pool.submit(c.get,'/api/permessi') for c in (self.central,self.succ)]
                try:
                    both.wait(timeout=3)
                    writer=pool.submit(self.identities.change,'succursale','name','Updated')
                    time.sleep(.05)
                    self.assertFalse(writer.done())
                finally:release.set()
                for reader in readers:self.assertEqual(reader.result(timeout=3).status_code,200)
                writer.result(timeout=3)
            self.assertEqual(self.succ.get('/api/auth/session').status_code,401)
        finally:
            release.set()
            route.dependant.call=original

    def test_publication_gate_excludes_other_threads_and_releases_after_error(self):
        acquired=threading.Event()
        def waiting():
            with self.identities.gate():acquired.set()
        with ThreadPoolExecutor(max_workers=1) as pool:
            with self.identities.gate():
                task=pool.submit(waiting)
                self.assertFalse(acquired.wait(.05))
            task.result(timeout=2)
        self.assertTrue(acquired.is_set())
        try:
            with self.identities.gate():raise ValueError('abort')
        except ValueError:pass
        with self.identities.gate():pass
