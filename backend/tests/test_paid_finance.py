import copy
import tempfile
import unittest
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
from backend import paid_finance as finance, backup
from backend.main import create_app
from backend.storage import Store
from backend.tests.client import TestClient
from backend.tests.auth_client import AuthenticatedClient
from backend.tests.test_recovery import fixture, DAY


class FinanceTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'db.sqlite'
        self.client = TestClient(create_app(self.path))
        raw = fixture()
        raw['docenti'][1]['ruolo'] = 'ITP'
        self.client.post('/api/timetable', json=raw).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=list(range(1, 8)))).raise_for_status()
        token = self.client.get('/api/paid-availability').json()['concurrency']['records']
        self.client.post('/api/paid-availability', json=dict(weekday=0, id='rp', hours=[1,4,6,7], expected={'paidAvailability|0|rp': token.get('paidAvailability|0|rp','absent')})).raise_for_status()

    def configure(self, config=None, expected=None):
        current = self.client.get('/api/paid-finance').json()
        if config is None:
            config = current['config']
            config['sites']['centrale'] = dict(budget=10000, laureato=3111, diplomato=2874)
        return self.client.post('/api/paid-finance', json=dict(config=config, expected=expected or current['expected']))

    def choose(self, hour=1, value='rp', category='PAID'):
        return self.client.post('/api/assignments', json=dict(day=DAY, key=f'absent|{hour}|1A', value=value, category=category))

    def archive(self):
        return self.client.get('/api/export').json()

    def report(self, day=DAY):
        return self.client.get('/api/paid-availability', params={'day':day}).json()['finance']

    def test_permissions_validation_and_stale_save(self):
        original = self.client.get('/api/paid-finance').json()
        other = AuthenticatedClient(self.client.app, campus='succursale')
        self.assertEqual(other.get('/api/paid-finance').status_code,403)
        self.assertEqual(other.post('/api/paid-finance',json=dict(config=original['config'],expected=original['expected'])).status_code,403)
        for v in (True,-1,1.2,'3111',finance.MAX_CENTS+1):
            config=copy.deepcopy(original['config']);config['sites']['centrale']['budget']=v
            self.assertEqual(self.configure(config).status_code,422)
        config=copy.deepcopy(original['config']);config['overrides']['missing']='laureato'
        self.assertEqual(self.configure(config).status_code,422)
        self.configure().raise_for_status()
        self.assertEqual(self.configure(original['config'],original['expected']).status_code,409)
        self.assertEqual(self.client.post('/api/paid-finance',json=dict(config=original['config'],expected=None)).status_code,428)
        # Admin without operational grants still manages financial settings.
        ids=self.client.app.state.identities
        account=next(a for a in ids.list() if a['username']=='test-centrale')
        ids.update(account['id'],dict(revision=account['revision'],admin=True,campuses=[]))
        self.configure().raise_for_status()

    def test_backfill_snapshots_overrides_and_removal(self):
        self.choose().raise_for_status()
        self.assertEqual(self.report()['all']['unpriced'],1)
        self.assertNotIn('paidPrice',self.archive()['asg'][DAY]['absent|1|1A'])
        self.assertEqual(self.configure().json()['priced'],1)
        price=self.archive()['asg'][DAY]['absent|1|1A']['paidPrice']
        self.assertEqual(price,dict(cents=2874,classification='diplomato'))
        config=self.client.get('/api/paid-finance').json()['config']
        config['overrides']['rp']='laureato'
        self.assertEqual(self.configure(config).json()['priced'],1)
        price = dict(cents=3111, classification='laureato')
        self.choose().raise_for_status()
        self.client.post('/api/assignments',json=dict(day=DAY,key='absent|1|1A',notified=True)).raise_for_status()
        self.assertEqual(self.archive()['asg'][DAY]['absent|1|1A']['paidPrice'],price)
        self.choose(4).raise_for_status()
        self.assertEqual(self.report()['all']['cost'],6222)
        self.assertEqual(self.report('2027-01-04')['all'],self.report()['all'])
        self.choose(4,value=None,category=None).raise_for_status()
        self.assertEqual(self.report()['all']['cost'],3111)
        config['overrides']={};config['sites']['centrale']['diplomato']=0
        self.configure(config).raise_for_status();self.choose(4).raise_for_status()
        self.assertEqual(self.archive()['asg'][DAY]['absent|4|1A']['paidPrice']['cents'],0)
        self.assertEqual(self.configure(config).json()['priced'],0)

    def test_partial_rates_archives_and_database_backup(self):
        self.choose().raise_for_status()
        config=finance.empty();config['sites']['centrale']['laureato']=3111
        self.assertEqual(self.configure(config).json()['unpriced'],1)
        config['overrides']['rp']='laureato'
        self.assertEqual(self.configure(config).json()['priced'],1)
        archive=self.archive();self.assertEqual(archive['schema'],12)
        self.client.post('/api/import',json=archive).raise_for_status()
        self.assertEqual(self.archive()['paidFinance'],config)
        self.assertEqual(self.report()['all']['cost'],3111)
        saved=backup.backup_database(str(self.path),str(Path(self.tmp.name)/'backups'))
        with Store(saved['path']).connect() as db:
            self.assertEqual(Store(saved['path']).read(db,'paidFinance'),config)
        for change in ('badcost','nonpaid','badconfig'):
            broken=copy.deepcopy(archive)
            a=broken['asg'][DAY]['absent|1|1A']
            if change=='badcost': a['paidPrice']['cents']=True
            elif change=='nonpaid': a['t']='MANUAL'
            else: broken['paidFinance']['sites']['centrale']['budget']=-1
            self.assertEqual(self.client.post('/api/import',json=broken).status_code,422)
            self.assertEqual(self.report()['all']['cost'],3111)
        legacy=copy.deepcopy(archive);legacy['schema']=10;legacy.pop('paidFinance')
        legacy['asg'][DAY]['absent|1|1A'].pop('paidPrice')
        for day in legacy['statistics']['days'].values():
            for row in day['demand'].values():
                if row.get('assignment'):
                    row['assignment'].pop('paidPrice', None)
        self.client.post('/api/import',json=legacy).raise_for_status()
        self.assertEqual(self.report()['all']['unpriced'],1)
        self.assertEqual(self.client.get('/api/paid-finance').json()['config'],finance.empty())

    def test_rate_changes_reprice_all_saved_work(self):
        self.configure().raise_for_status()
        self.choose().raise_for_status()
        self.choose(4).raise_for_status()
        config=self.client.get('/api/paid-finance').json()['config']
        config['sites']['centrale']['diplomato']=3500
        self.assertEqual(self.configure(config).json()['priced'],2)
        self.assertEqual(self.report()['all']['cost'],7000)
        archive=self.archive()
        self.client.post('/api/import',json=archive).raise_for_status()
        self.assertEqual(self.report()['all']['cost'],7000)
        self.assertEqual(self.configure(config).json()['priced'],0)
        config['sites']['centrale']['diplomato']=None
        self.assertEqual(self.configure(config).json()['unpriced'],2)
        self.assertEqual(self.report()['all']['cost'],0)
        self.assertNotIn('paidPrice',self.archive()['asg'][DAY]['absent|1|1A'])

    def test_overrun_concurrent_initialization(self):
        self.configure().raise_for_status()
        config=self.client.get('/api/paid-finance').json()['config']
        config['sites']['centrale']['budget']=100
        self.configure(config).raise_for_status()
        result=self.choose();result.raise_for_status()
        self.assertIn('superato',result.json()['warning'])
        self.assertGreater(self.report()['sites']['centrale']['percent'],100)
        self.choose(value=None,category=None).raise_for_status()
        config['sites']['centrale']['diplomato']=None;self.configure(config).raise_for_status()
        config['sites']['centrale']['diplomato']=2874
        other=TestClient(self.client.app)
        baseline=other.get('/api/day/'+DAY).json()['concurrency']['records']
        def assign():
            return other.post('/api/assignments',json=dict(day=DAY,key='absent|4|1A',value='rp',category='PAID',expected={'asg|'+DAY+'|absent|4|1A':baseline['asg|'+DAY+'|absent|4|1A']}))
        with ThreadPoolExecutor(2) as pool:
            a=pool.submit(assign);b=pool.submit(self.configure,config)
            a.result().raise_for_status();b.result().raise_for_status()
        self.assertEqual(self.report()['all']['unpriced'],0)
        self.assertEqual(self.report()['all']['cost'],2874)


class SummaryTest(unittest.TestCase):
    def test_pricing_site_classification_and_unresolved_context(self):
        config=finance.empty();config['sites']['succursale'].update(laureato=4100,diplomato=3800)
        teacher={'rp':{'id':'rp','role':'ITP'}}
        assignment=dict(v='rp',t='PAID',paidContext={'site':'succursale'})
        self.assertTrue(finance.price(assignment,teacher,config))
        self.assertEqual(assignment['paidPrice']['cents'],3800)
        config['overrides']['rp']='laureato';finance.price(assignment,teacher,config)
        self.assertEqual(assignment['paidPrice']['cents'],4100)
        self.assertFalse(finance.price(assignment,{},config))
        assignment['paidContext']['site']='missing'
        self.assertFalse(finance.price(assignment,teacher,config))

    def test_exact_scope_zero_and_unresolved(self):
        config=finance.empty();config['sites']['centrale']=dict(budget=340612,laureato=3111,diplomato=2874)
        state={'asg':{'2027-01-01':{'a':dict(t='PAID',paidContext={'site':'centrale'},paidPrice={'cents':3111}), 'b':dict(t='PAID',paidContext={'site':'centrale'},paidPrice={'cents':2874}), 'c':dict(t='PAID',paidContext={'site':'succursale'})}}}
        report=finance.summary(state,config)
        self.assertEqual(report['sites']['centrale']['remaining'],334627)
        self.assertAlmostEqual(report['sites']['centrale']['percent'],1.76,places=2)
        self.assertEqual(report['configured'],['centrale'])
        self.assertEqual(report['overall']['unpriced'],0)
        self.assertEqual(report['all']['unpriced'],1)
        config['sites']['centrale']['budget']=0
        self.assertIsNone(finance.summary(state,config)['overall']['percent'])
        self.assertIn('superato',finance.warning(state,config,'centrale'))
        config['sites']['succursale']['budget']=10000
        self.assertEqual(finance.summary(state,config)['overall']['unpriced'],1)
