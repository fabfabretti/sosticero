"""Teacher access isolation on disposable databases."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.storage import Store
from backend import timetables, appointments
from backend.domain import normalize_dataset
from backend.teacher_access import TeacherAccess
from backend.tests.test_recovery import fixture, DAY


class TeacherPortalTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)/'school.sqlite'
        self.app = create_app(self.path)
        self.ids = self.app.state.identities
        self.ids.create('admin', 'Admin', None, 'a-safe-password', admin=True)
        self.ids.create('office', 'Office', 'centrale', 'a-safe-password')
        self.history = timetables.baseline(normalize_dataset(fixture()))
        with Store(str(self.path)).connect() as db:
            Store(str(self.path)).write(db, 'timetables', self.history)
        self.admin = self.client()
        result = self.admin.post('/api/auth/login', json={'username':'admin','password':'a-safe-password'}).json()
        self.admin.headers.update({'X-CSRF-Token': result['csrf'], 'X-Data-Generation': str(result['generation'])})
        self.access = TeacherAccess(self.ids)

    def client(self):
        client = TestClient(self.app, base_url='http://localhost', headers={'Origin':'http://localhost'})
        self.addCleanup(client.close)
        return client

    def row(self, person='rp', email='rp@school.it', enabled=False, revision=0):
        return dict(person=person,email=email,enabled=enabled,revision=revision)

    def setup_teacher(self, person='rp'):
        result = self.admin.post('/api/teacher-access', json={'rows':[self.row(person,person+'@school.it')]})
        self.assertEqual(result.status_code,200,result.text)
        with patch('backend.teacher_access.secrets.randbelow', return_value=1234):
            result = self.admin.post('/api/teacher-access/pin',json={'person':person,'revision':1})
        self.assertEqual(result.status_code,200,result.text)
        self.assertEqual(result.json()['pin'],'00001234')
        self.assertEqual(self.admin.post('/api/teacher-access',json={'rows':[self.row(person,person+'@school.it',True,2)]}).status_code,200)
        return '00001234'

    def login(self, person='rp', pin=None):
        client = self.client()
        result = client.post('/api/teacher/auth/login',json={'email':person+'@school.it','pin':pin or self.setup_teacher(person)})
        self.assertEqual(result.status_code,200,result.text)
        client.headers['X-CSRF-Token']=result.json()['csrf']
        return client

    def test_atomic_admin_updates_and_secret_storage(self):
        self.setup_teacher()
        listed=self.admin.get('/api/teacher-access').json()
        self.assertNotIn('00001234',str(listed));self.assertNotIn('argon2',str(listed))
        for rows, status in [([self.row('normal','RP@school.it')],422),
                             ([self.row('normal','valid@school.it'),self.row('rp','new@school.it',False,0)],409),
                             ([self.row('normal',enabled=True)],422),
                             ([self.row('normal','invalid')],422)]:
            result=self.admin.post('/api/teacher-access',json={'rows':rows})
            self.assertEqual(result.status_code,status,result.text)
            self.assertNotIn('normal',self.access.list())
        self.assertEqual(self.admin.post('/api/teacher-access',json={'rows':[self.row('rp','new@school.it',False,3)]}).status_code,200)
        self.assertEqual(self.access.list()['rp']['revision'],4)
        before=self.ids.list();create_app(self.path);self.assertEqual(self.ids.list(),before)
        with self.ids.connect() as db:
            self.assertNotEqual(db.execute('SELECT pin FROM teacher_accounts').fetchone()[0],'00001234')

    def test_sessions_boundaries_revocation_and_rotation(self):
        pin=self.setup_teacher();c=self.login(pin=pin)
        cookie=c.cookies.get('sosticero_teacher')
        result=c.post('/api/teacher/auth/login',json={'email':' RP@SCHOOL.IT ','pin':pin})
        self.assertEqual(result.status_code,200);self.assertNotEqual(cookie,c.cookies.get('sosticero_teacher'))
        with self.assertRaises(Exception):self.access.session(cookie)
        for path in ('accounts','teacher-access','staffing','orari','day/'+DAY,'inbox','export','attachments/missing'):
            self.assertEqual(c.get('/api/'+path).status_code,401,path)
        self.assertEqual(c.get('/api/teacher/anything').status_code,404)
        self.assertEqual(c.post('/api/teacher/auth/logout',headers={'Origin':'https://evil.test'},json={}).status_code,403)
        self.assertEqual(c.post('/api/teacher/auth/logout',headers={'X-CSRF-Token':'wrong'},json={}).status_code,403)
        with patch('backend.teacher_access.secrets.randbelow', return_value=1234):
            self.assertEqual(self.admin.post('/api/teacher-access/pin',json={'person':'rp','revision':3}).status_code,200)
        self.assertEqual(c.get('/api/teacher/timetable').status_code,401)
        c=self.login(pin=pin)
        self.assertEqual(self.admin.post('/api/teacher-access',json={'rows':[self.row('rp',enabled=False,revision=4)]}).status_code,200)
        self.assertEqual(c.get('/api/teacher/auth/session').status_code,401)

    def test_personal_projection_dates_and_replacements(self):
        c=self.login()
        result=c.get('/api/teacher/timetable',params={'day':DAY})
        self.assertEqual(result.status_code,200,result.text)
        data=result.json();self.assertEqual([p['hour'] for p in data['periods']],[2,3,5])
        self.assertEqual(set(data),{'day','status','teacher','periods'})
        self.assertEqual(result.headers['cache-control'],'no-store')
        self.assertEqual(c.get('/api/teacher/timetable?day=2026-10-11').json()['periods'],[])
        self.assertEqual(c.get('/api/teacher/timetable?person=normal').status_code,422)
        self.assertEqual(c.get('/api/teacher/timetable?day=invalid').status_code,422)
        doc=appointments.empty();doc['people']['replacement']=dict(id='replacement',name='Replacement',code='',role='curricolare',classe_concorso='')
        doc['appointments']=[dict(id='cover',source='absent',person='replacement',start=DAY,end='2026-10-18')]
        with Store(str(self.path)).connect() as db:Store(str(self.path)).write(db,'teacherAppointments',doc)
        replacement=self.login('replacement')
        for day in ('2026-10-05','2026-10-19'):
            self.assertEqual(replacement.get('/api/teacher/timetable',params={'day':day}).json()['periods'],[])
        active=replacement.get('/api/teacher/timetable',params={'day':DAY}).json()
        self.assertEqual([p['hour'] for p in active['periods']],list(range(1,8)))
        self.assertEqual(active['periods'][0]['classes'],['1A'])
        with Store(str(self.path)).connect() as db:Store(str(self.path)).write(db,'teacherAppointments',appointments.empty())
        self.assertEqual(replacement.get('/api/teacher/timetable').status_code,401)

    def test_rate_limits_and_expiry(self):
        self.setup_teacher()
        c=self.client()
        for _ in range(5):self.assertEqual(c.post('/api/teacher/auth/login',json={'email':'rp@school.it','pin':'99999999'}).status_code,401)
        self.assertEqual(c.post('/api/teacher/auth/login',json={'email':'rp@school.it','pin':'00001234'}).status_code,429)
        with patch('backend.teacher_access.time.time',return_value=__import__('time').time()+901):
            result=c.post('/api/teacher/auth/login',json={'email':'rp@school.it','pin':'00001234'})
        self.assertEqual(result.status_code,200)
        c.headers['X-CSRF-Token']=result.json()['csrf']
        self.assertEqual(c.post('/api/teacher/auth/logout',json={}).status_code,200)
        self.assertEqual(c.get('/api/teacher/auth/session').status_code,401)
        c=self.login(pin='00001234')
        with self.ids.connect() as db:db.execute('UPDATE teacher_sessions SET expires=0')
        self.assertEqual(c.get('/api/teacher/auth/session').status_code,401)

    def test_non_admin_denied_and_cookies_secure(self):
        c=self.client();r=c.post('/api/auth/login',json={'username':'office','password':'a-safe-password'}).json()
        c.headers.update({'X-CSRF-Token':r['csrf'],'X-Data-Generation':str(r['generation'])})
        self.assertEqual(c.get('/api/teacher-access').status_code,403)
        self.assertEqual(c.post('/api/teacher-access',json={'rows':[]}).status_code,403)
        self.setup_teacher()
        with patch.dict('os.environ',{'APP_ORIGIN':'https://localhost'}):
            secure=TestClient(self.app,base_url='https://localhost',headers={'Origin':'https://localhost'})
            self.addCleanup(secure.close)
            result=secure.post('/api/teacher/auth/login',json={'email':'rp@school.it','pin':'00001234'})
            self.assertIn('Secure',result.headers['set-cookie']);self.assertIn('HttpOnly',result.headers['set-cookie'])
            self.assertIn('Path=/api/teacher',result.headers['set-cookie'])

    def test_limits_across_sources_identifiers_and_parallel_requests(self):
        from fastapi import HTTPException
        self.setup_teacher()
        def attempt(email, source):
            try: self.access.login(email,'99999999',source); return 200
            except HTTPException as e: return e.status_code
        with ThreadPoolExecutor(max_workers=8) as pool:
            statuses=list(pool.map(lambda n: attempt('rp@school.it',str(n)),range(8)))
        self.assertEqual(statuses.count(401),5);self.assertEqual(statuses.count(429),3)
        with self.ids.connect() as db:db.execute('DELETE FROM attempts')
        for i in range(30):self.assertEqual(attempt(f'unknown{i}@school.it','shared-source'),401)
        self.assertEqual(attempt('fresh@school.it','shared-source'),429)
        with self.ids.connect() as db:
            db.execute('UPDATE attempts SET until=0')
        self.assertEqual(attempt('fresh@school.it','shared-source'),401)

    def test_email_change_revokes_and_archive_omits_teacher_credentials(self):
        c=self.login()
        self.assertEqual(self.admin.post('/api/teacher-access',json={'rows':[self.row(email='new@school.it',enabled=True,revision=3)]}).status_code,200)
        self.assertEqual(c.get('/api/teacher/auth/session').status_code,401)
        archive=self.admin.get('/api/export')
        self.assertEqual(archive.status_code,200,archive.text)
        self.assertNotIn('new@school.it',archive.text);self.assertNotIn('teacher_accounts',archive.text)

    def test_activation_generates_only_missing_pins_and_saves_immediately(self):
        self.setup_teacher('rp')
        self.admin.post('/api/teacher-access',json={'rows':[self.row('normal','normal@school.it')]}).raise_for_status()
        before=self.access.list()
        with self.ids.connect() as db:old_pin=db.execute("SELECT pin FROM teacher_accounts WHERE person='rp'").fetchone()[0]
        with patch('backend.teacher_access.secrets.randbelow',return_value=1234):
            result=self.admin.post('/api/teacher-access/activation',json={'enabled':True,'rows':[
                dict(person='rp',revision=before['rp']['revision']),dict(person='normal',revision=1)]})
        self.assertEqual(result.status_code,200,result.text)
        data=result.json();self.assertEqual(len(data['pins']),1);self.assertEqual(data['pins'][0]['person'],'normal')
        self.assertEqual(data['pins'][0]['pin'],'00001234');self.assertTrue(data['accounts']['normal']['enabled'])
        self.login('normal',pin='00001234')
        with self.ids.connect() as db:self.assertEqual(db.execute("SELECT pin FROM teacher_accounts WHERE person='rp'").fetchone()[0],old_pin)
        active=self.login('rp',pin='00001234')
        self.admin.post('/api/teacher-access/activation',json={'enabled':False,'rows':[dict(person='rp',revision=before['rp']['revision'])]}).raise_for_status()
        self.assertEqual(active.get('/api/teacher/auth/session').status_code,401)

    def test_activation_batch_conflicts_roll_back_and_nonadmins_cannot_activate(self):
        self.admin.post('/api/teacher-access',json={'rows':[self.row(),self.row('normal','normal@school.it')]}).raise_for_status()
        result=self.admin.post('/api/teacher-access/activation',json={'enabled':True,'rows':[dict(person='rp',revision=1),dict(person='normal',revision=0)]})
        self.assertEqual(result.status_code,409)
        self.assertFalse(self.access.list()['rp']['hasPin']);self.assertFalse(self.access.list()['rp']['enabled'])
        for rows in ([dict(person='rp',revision=1)]*2,[dict(person='missing',revision=1)]):
            self.assertEqual(self.admin.post('/api/teacher-access/activation',json={'enabled':True,'rows':rows}).status_code,422)
        self.assertEqual(self.client().post('/api/teacher-access/activation',json={}).status_code,401)
        office=self.client();login=office.post('/api/auth/login',json=dict(username='office',password='a-safe-password')).json()
        office.headers.update({'X-CSRF-Token':login['csrf'],'X-Data-Generation':str(login['generation'])})
        self.assertEqual(office.post('/api/teacher-access/activation',json={'rows':[],'enabled':True}).status_code,403)

    def test_pasted_pin_whitespace_is_ignored(self):
        pin=self.setup_teacher()
        c=self.client()
        result=c.post('/api/teacher/auth/login',json={'email':' RP@school.it ','pin':' '+pin+'\n'})
        self.assertEqual(result.status_code,200,result.text)
