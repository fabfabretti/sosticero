"""Permission and migration regressions on disposable identity/school databases."""
from contextlib import closing
import json
from pathlib import Path
import secrets
import sqlite3
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend.auth import Identities
from backend.main import create_app
from backend import attribution


class AdministrationTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.app = create_app(Path(self.tmp.name)/'school.sqlite')
        self.identities = self.app.state.identities
        self.password = secrets.token_urlsafe(24)
        self.root = self.identities.create('admin','Amministratore',None,self.password,admin=True,protected=True)

    def client(self, username):
        client = TestClient(self.app,base_url='http://localhost',headers={'Origin':'http://localhost'})
        self.addCleanup(client.close)
        result = client.post('/api/auth/login',json=dict(username=username,password=self.password))
        result.raise_for_status()
        client.headers.update({'X-CSRF-Token':result.json()['csrf'],'X-Data-Generation':str(result.json()['generation'])})
        return client

    def test_all_eight_permission_combinations(self):
        for admin in (False,True):
            for campuses in ([],['centrale'],['succursale'],['centrale','succursale']):
                username=f'u{int(admin)}{len(campuses)}'+''.join(c[0] for c in campuses)
                self.identities.create(username,username,None,self.password,admin=admin,campuses=campuses)
                client=self.client(username)
                for path in ('accounts','export'):
                    self.assertEqual(client.get('/api/'+path).status_code==403,not admin,(username,path))
                for path in ('day/2026-10-12','orari','inbox','inbox/summary','attachments/missing','paid-availability'):
                    self.assertEqual(client.get('/api/'+path).status_code==403,not bool(campuses),(username,path))
                self.assertEqual(client.get('/api/settings/overview').status_code,200 if admin or campuses else 403)
                for path in ('hour-types','backups','publication/schedule','inbox/connection','timetable/preview'):
                    self.assertEqual(client.post('/api/'+path,json={}).status_code==403,not admin,(username,path))
                for campus in ('centrale','succursale'):
                    self.assertEqual(client.get('/api/publication',params={'campus':campus}).status_code,200 if campus in campuses else 403)
                    if campus not in campuses:
                        self.assertEqual(client.post('/api/publication',json={'day':'2026-10-12','campus':campus}).status_code,403)
                if not campuses:
                    for path in ('entries','assignments','permessi','manual-permits','paid-availability','orari/override'):
                        self.assertEqual(client.post('/api/'+path,json={}).status_code,403)

    def test_account_api_and_protected_invariants(self):
        client=self.client('admin')
        body=dict(username='Maria.Rossi',name='Maria Rossi',admin=False,campuses=['centrale'],password=self.password)
        result=client.post('/api/accounts',json=body);self.assertEqual(result.status_code,200,result.text)
        account=result.json();self.assertEqual(account['username'],'maria.rossi');self.assertNotIn('password',account)
        operator=self.client('maria.rossi')
        self.assertEqual(operator.get('/api/accounts').status_code,403)
        self.assertEqual(client.post('/api/accounts',json=body).status_code,422)
        updated=client.post('/api/accounts/'+account['id'],json={'revision':account['revision'],'campuses':[]})
        self.assertEqual(updated.status_code,200,updated.text)
        self.assertEqual(operator.get('/api/permessi').status_code,401)
        self.assertEqual(client.post('/api/accounts/'+account['id'],json={'revision':account['revision'],'admin':True}).status_code,409)
        for patch in ({'admin':False},{'enabled':False},{'protected':False}):
            result=client.post('/api/accounts/'+self.root['id'],json={'revision':self.root['revision'],**patch})
            self.assertEqual(result.status_code,422,result.text)
        renamed=self.identities.change('admin','username','root')
        for field,value in (('enabled',False),('admin',False)):
            with self.assertRaises(ValueError): self.identities.change('root',field,value)
        self.identities.require_admin()
        self.assertEqual(renamed['id'],self.root['id'])

    def test_concurrent_revision_and_self_password_reset(self):
        account=self.identities.create('other','Other',None,self.password)
        def update(name):
            try: return self.identities.update(account['id'],dict(name=name,revision=1))
            except HTTPException as e: return e.status_code
        with ThreadPoolExecutor(max_workers=2) as pool: results=list(pool.map(update,['First','Second']))
        self.assertEqual(sum(r==409 for r in results),1)
        client=self.client('admin')
        result=client.post('/api/accounts/'+self.root['id'],json={'revision':1,'password':secrets.token_urlsafe(24)})
        self.assertTrue(result.json()['reauthenticate']);self.assertEqual(client.get('/api/accounts').status_code,401)

    def test_legacy_identity_migration_is_idempotent(self):
        path=Path(self.tmp.name)/'legacy.sqlite'
        with closing(sqlite3.connect(path)) as db,db:
            db.execute('CREATE TABLE accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,campus TEXT NOT NULL,password TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1)')
            db.execute("INSERT INTO accounts VALUES ('original','centrale','Centrale','centrale','unchanged-hash',0)")
        for _ in range(2):
            identities=Identities(path,testing=True);account=identities.list()[0]
            self.assertEqual(account['id'],'original');self.assertFalse(account['admin']);self.assertFalse(account['enabled'])
            self.assertEqual(account['campuses'],['centrale'])
            with identities.connect() as db:self.assertEqual(db.execute('SELECT password FROM accounts').fetchone()[0],'unchanged-hash')
            with self.assertRaises(RuntimeError):identities.require_admin()

    def test_historical_attribution_and_unknown_foreign_ids(self):
        operator=self.identities.create('centrale','Centrale', 'centrale',self.password)
        self.identities.map_legacy('centrale','centrale')
        state=dict(permitCreators={'day':{'teacher':'centrale'}},paidAvailability={'0':{'teacher':{'1':{'createdBy':operator['id'],'createdFrom':'centrale'}}}},asg={'day':{'key':{'assignedBy':'centrale'}}})
        self.assertTrue(attribution.migrate(state,*self.identities.authors()))
        before=json.dumps(state)
        self.identities.change('centrale','name','Maria Rossi')
        self.assertFalse(attribution.migrate(state,*self.identities.authors()));self.assertEqual(json.dumps(state),before)
        self.assertEqual(state['permitCreators']['day']['teacher']['name'],'Centrale')
        foreign={'paidAvailability':{'0':{'t':{'1':{'createdBy':'foreign','createdFrom':'centrale'}}}}}
        attribution.migrate(foreign)
        self.assertEqual(foreign['paidAvailability']['0']['t']['1']['createdFrom']['id'],'foreign')
        self.assertEqual(foreign['paidAvailability']['0']['t']['1']['createdFrom']['name'],'Autore non disponibile')

    def test_cli_bootstrap_and_recovery_do_not_print_password(self):
        import io
        from unittest.mock import patch
        from backend.auth import main
        path=Path(self.tmp.name)/'bootstrap.sqlite'; password=secrets.token_urlsafe(24)
        argv=['accounts','--database',str(path),'--testing','bootstrap','admin','--name','Amministratore']
        output=io.StringIO()
        with patch('sys.argv',argv),patch('getpass.getpass',return_value=password),patch('sys.stdout',output): main()
        identities=Identities(path,testing=True);identities.require_admin()
        with patch('sys.argv',argv),patch('getpass.getpass',side_effect=AssertionError('Bootstrap must be idempotent')): main()
        self.assertNotIn(password,output.getvalue())
        with patch('sys.argv',argv[:4]+['disable','admin']),self.assertRaises(SystemExit): main()

    def test_upgrade_preflight_is_read_only_and_activation_idempotent(self):
        from backend.admin_upgrade import preflight, upgrade
        path=Path(self.tmp.name)/'upgrade.sqlite'
        with closing(sqlite3.connect(path)) as db,db:
            db.execute('CREATE TABLE accounts(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,campus TEXT NOT NULL,password TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1)')
            for campus in ('centrale','succursale'):
                db.execute('INSERT INTO accounts VALUES (?,?,?,?,?,1)',(campus,campus,campus.title(),campus,'hash'))
        before=path.read_bytes();preflight(path);self.assertEqual(path.read_bytes(),before)
        upgrade(path);identities=Identities(path,testing=True);identities.require_admin()
        credentials=path.parent/'keys'/'admin-initial.txt';self.assertEqual(credentials.stat().st_mode & 0o777,0o600)
        before=credentials.read_bytes();upgrade(path);self.assertEqual(credentials.read_bytes(),before)
        self.assertEqual(len(identities.list()),3)
        bad=Path(self.tmp.name)/'bad.sqlite';Identities(bad,testing=True)
        with self.assertRaises(ValueError):preflight(bad)

    def test_interrupted_bootstrap_reuses_private_credentials(self):
        from backend.admin_upgrade import upgrade
        from unittest.mock import patch
        path=Path(self.tmp.name)/'interrupted.sqlite'
        identities=Identities(path,testing=True)
        for campus in ('centrale','succursale'): identities.create(campus,campus.title(),campus,self.password)
        with identities.connect() as db: db.execute('UPDATE accounts SET campus=username')
        with patch.object(Identities,'create',side_effect=RuntimeError('interrupted')):
            with self.assertRaises(RuntimeError): upgrade(path)
        credentials=path.parent/'keys'/'admin-initial.txt'
        before=credentials.read_bytes();upgrade(path)
        self.assertEqual(credentials.read_bytes(),before)
        Identities(path,testing=True).require_admin()

    def test_admin_only_can_import_export_restore_without_operational_access(self):
        from backend.tests.test_app import fixture
        client=self.client('admin')
        response=client.post('/api/timetable',json=fixture());response.raise_for_status()
        client.headers['X-Data-Generation']=response.headers['x-data-generation']
        summary=client.get('/api/settings/overview').json()
        self.assertGreater(summary['teacherCount'],0);self.assertNotIn('lessons',summary)
        archive=client.get('/api/export').json();self.assertEqual(archive['schema'],11)
        client.post('/api/import/preview',json=archive).raise_for_status()
        response=client.post('/api/import',json=archive);response.raise_for_status()
        client.headers['X-Data-Generation']=response.headers['x-data-generation']
        saved=client.post('/api/backups',json={});saved.raise_for_status()
        account_state=self.identities.list()
        response=client.post('/api/backups/restore',json={'filename':saved.json()['filename'],'confirm':True})
        response.raise_for_status()
        self.assertEqual(self.identities.list(),account_state)
        self.assertEqual(client.get('/api/accounts').status_code,401)
        client=self.client('admin')
        self.assertEqual(client.get('/api/permessi').status_code,403)
        self.assertEqual(client.get('/api/attachments/missing').status_code,403)

    def test_settings_summary_uses_the_current_timetable(self):
        from backend.storage import Store
        from backend.domain import normalize_dataset
        from backend import timetables
        from backend.tests.test_app import fixture
        from unittest.mock import patch
        baseline=normalize_dataset(fixture())
        current=normalize_dataset(fixture());current['teachers']['new']={'name':'New teacher'}
        store=Store(str(Path(self.tmp.name)/'school.sqlite'))
        with store.connect() as db:
            store.write(db,'dataset',baseline)
            store.write(db,'timetables',timetables.baseline(baseline))
        with patch('backend.main.timetables.dataset',return_value=current):
            summary=self.client('admin').get('/api/settings/overview').json()
        self.assertEqual(summary['teacherCount'],len(current['teachers']))
        self.assertNotIn('dataset',summary)

    def test_display_identity_uses_only_id_and_falls_back_for_missing_accounts(self):
        stored={'id':'old','username':'centrale','name':'Centrale'}
        current={'old':{'id':'old','username':'fabiola','name':'Fabiola Fabretti'}}
        self.assertEqual(attribution.resolve(stored,current)['name'],'Fabiola Fabretti')
        self.assertEqual(stored['name'],'Centrale')
        self.assertEqual(attribution.resolve(stored,{}),stored)
        self.assertEqual(attribution.resolve(stored,{'other':current['old']}),stored)
        self.assertIsNone(attribution.resolve(None,current))
