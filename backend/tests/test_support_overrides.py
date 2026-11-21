"""Support overrides through the dated API, using disposable databases only."""
import copy
from backend.tests import test_override_api as existing
from backend.tests.test_app import DAY
from backend.tests.timetable_helpers import import_version
from backend import overrides
from backend.tests.client import TestClient
from backend.main import create_app


class SupportOverrideApiTest(existing.OverrideApiTest):
    # Inherit the existing dated-override regression suite as well.
    def draft(self, start=DAY, end=None):
        return super().draft(start, end)

    def support_draft(self, start=DAY, end=None):
        data = self.orari(start)
        return dict(teacher='support', start=start, end=end, cells=overrides.cells(data['dataset'], 'support'), basis=data['basis'])

    def test_support_lifecycle_archive_restart_and_detached_basis(self):
        data = self.support_draft(end='2026-10-23')
        data['cells']['mar|3'], data['cells']['lun|2'] = data['cells']['lun|2'], None
        self.save(data)
        temporary = self.support_draft(start='2026-10-19', end='2026-10-20')
        temporary['cells']['mar|3']['classes'] = ['1A']
        self.save(temporary)
        self.assertEqual(self.orari('2026-10-20')['dataset']['lessons']['support|mar|3']['classes'], ['1A'])
        self.assertEqual(self.orari('2026-10-21')['dataset']['lessons']['support|mar|3']['classes'], ['2A'])
        self.assertIn('support|lun|2', self.orari('2026-10-24')['dataset']['lessons'])
        archive = self.client.get('/api/export').json()
        self.client.post('/api/import', json=archive).raise_for_status()
        restarted = TestClient(create_app(self.path))
        self.assertEqual(restarted.get('/api/export').json(), archive)
        legacy = copy.deepcopy(archive); legacy['schema'] = 4; legacy.pop('timetableOverrides')
        legacy['timetables']['versions'][0]['dataset']['lessons']['support|lun|2']['site'] = 'succursale'
        self.client.post('/api/import', json=legacy).raise_for_status()
        detached = self.client.get('/api/export').json()
        self.client.post('/api/import', json=detached).raise_for_status()
        self.assertTrue(self.orari()['overrides'][0]['groups'][0]['conflicts'])

    def test_support_stale_disable_reset_and_delete(self):
        data = self.support_draft()
        data['cells']['lun|2']['classes'] = ['1A']
        preview = self.client.post('/api/orari/preview', json=data).json()
        self.entry()
        self.assertEqual(self.client.post('/api/orari/override', json={**data, 'token': preview['token']}).status_code, 409)
        self.save(data)
        bad = self.support_draft(); bad['cells']['lun|2']['disabled'] = True
        before = self.client.get('/api/export').json()
        self.assertEqual(self.client.post('/api/orari/preview', json=bad).status_code, 422)
        self.assertEqual(before, self.client.get('/api/export').json())
        reset = self.support_draft(start='2026-10-19'); reset['reset'] = True
        self.save(reset)
        self.assertEqual(self.orari('2026-10-19')['dataset']['lessons']['support|lun|2']['classes'], ['2A'])
        self.assertEqual(self.orari()['dataset']['lessons']['support|lun|2']['classes'], ['1A'])
        record = self.orari('2026-10-19')['overrides'][-1]
        self.save(dict(teacher='support', start=record['start'], id=record['id'], delete=True, basis=self.orari('2026-10-19')['basis']))
        self.assertEqual(self.orari('2026-10-19')['dataset']['lessons']['support|lun|2']['classes'], ['1A'])

    def test_support_compresence_assignment_evidence_and_class_out(self):
        self.entry()
        data = self.support_draft(); data['cells']['lun|2']['classes'] = ['1A']
        self.save(data)
        c = next(c for c in self.candidates() if c['id'] == 'support')
        self.assertEqual(c['ty'], 'C')
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='support')).raise_for_status()
        before = self.client.get('/api/export').json()
        data = self.support_draft(); data['cells']['mar|3'], data['cells']['lun|2'] = data['cells']['lun|2'], None
        impact = self.save(data)
        self.assertTrue(impact['days'][0]['issues'])
        after = self.client.get('/api/export').json()
        self.assertEqual(before['asg'], after['asg'])
        self.assertEqual(before.get('recovery'), after.get('recovery'))
        self.assertTrue(after['timetableOverrides']['evidence'][-1]['assignments'])
        self.assertNotIn('support|lun|2', self.orari()['dataset']['lessons'])
        self.client.post('/api/entries', json=dict(day='2026-10-13', group='abs', id='support', hours=[3])).raise_for_status()
        day = self.client.get('/api/day/2026-10-13').json()
        self.assertTrue(any(r['c'] == '1A' and r['h'] == 3 for r in day['rows']))

    def test_support_new_import_role_conflict(self):
        data = self.support_draft(); data['cells']['lun|2']['classes'] = ['1A']
        self.save(data)
        from backend.tests.test_app import fixture
        raw = fixture()
        next(t for t in raw['docenti'] if t['id'] == 'support')['ruolo'] = 'ITP'
        import_version(self.client, raw, '2026-10-19').raise_for_status()
        result = self.orari('2026-10-19')
        self.assertEqual(result['dataset']['lessons']['support|lun|2']['classes'], ['2A'])
        self.assertTrue(result['overrides'][0]['groups'][0]['conflicts'])
        self.client.post('/api/import', json=self.client.get('/api/export').json()).raise_for_status()
