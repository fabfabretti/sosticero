import copy
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.tests.test_app import fixture, DAY
from backend.tests.timetable_helpers import import_version
from backend import overrides, timetables

class OverrideApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'test.sqlite'
        with patch.dict(os.environ, {'BACKUP_ON_STARTUP': 'false'}):
            self.client = TestClient(create_app(self.path))
        self.client.post('/api/timetable', json=fixture()).raise_for_status()

    def orari(self, day=DAY):
        return self.client.get('/api/orari', params={'day': day}).json()

    def draft(self, start=DAY, end=None):
        data = self.orari(start)
        return dict(teacher='pot', start=start, end=end, cells=overrides.cells(data['dataset'], 'pot'), basis=data['basis'])

    def save(self, data):
        p = self.client.post('/api/orari/preview', json=data)
        p.raise_for_status()
        r = self.client.post('/api/orari/override', json={**data, 'token': p.json()['token']})
        r.raise_for_status()
        return p.json()

    def entry(self, day=DAY):
        self.client.post('/api/entries', json=dict(day=day, group='abs', id='absent', hours=[2])).raise_for_status()

    def candidates(self, day=DAY):
        return self.client.get('/api/candidates', params=dict(day=day, key='absent|2|1A')).json()

    def test_move_is_dated_and_original_and_archive_preserved(self):
        original = self.client.get('/api/export').json()['timetables']
        data = self.draft(end='2026-10-16')
        data['cells']['mar|3'], data['cells']['lun|2'] = data['cells']['lun|2'], None
        self.save(data)
        self.assertIn('pot|mar|3', self.orari()['dataset']['lessons'])
        self.assertIn('pot|lun|2', self.orari('2026-10-19')['dataset']['lessons'])
        archive = self.client.get('/api/export').json()
        self.assertEqual(original, archive['timetables'])
        self.assertEqual(archive['schema'], 7)
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertIn('pot|mar|3', self.orari()['dataset']['lessons'])
        invalid = copy.deepcopy(archive)
        invalid['timetableOverrides']['records'][0]['groups'][0]['after']['mar|3']['site'] = 'invalid'
        before = self.client.get('/api/export').json()
        self.assertEqual(self.client.post('/api/import', json=invalid).status_code, 422)
        self.assertEqual(before, self.client.get('/api/export').json())

    def test_disabled_exception_manual_hidden_and_saved_evidence(self):
        self.entry()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).raise_for_status()
        before = self.client.get('/api/export').json()
        data = self.draft(); data['cells']['lun|2']['disabled'] = True
        impact = self.save(data)
        self.assertEqual(len(impact['days'][0]['issues']), 1)
        after = self.client.get('/api/export').json()
        self.assertEqual(before['asg'], after['asg'])
        self.assertTrue(after['timetableOverrides']['evidence'][0]['assignments'])
        self.assertTrue(self.client.get('/api/day/'+DAY).json()['issues'])
        self.client.post('/api/entries', json=dict(day=DAY, group='dis', id='pot', hours=[2])).raise_for_status()
        cs = self.candidates()
        pot = next(c for c in cs if c['id'] == 'pot')
        self.assertTrue(pot['exceptional']); self.assertIn('disabilitata', pot['typeLabel'])
        self.assertEqual(self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).status_code, 422)
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot', exceptional=True)).raise_for_status()
        self.client.post('/api/hour-types', json=dict(id='code:POT', available=True, visible=False, school=True)).raise_for_status()
        self.assertNotIn('pot', [c['id'] for c in self.candidates()])
        self.assertEqual(self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot', exceptional=True)).status_code, 422)
        self.client.post('/api/import', json=after).raise_for_status()

    def test_preview_stale_tokens_and_failure_atomicity(self):
        data = self.draft(); data['cells']['lun|2']['disabled'] = True
        before = self.client.get('/api/export').json()
        p = self.client.post('/api/orari/preview', json=data).json()
        self.assertEqual(before, self.client.get('/api/export').json())
        self.entry()
        self.assertEqual(self.client.post('/api/orari/override', json={**data, 'token': p['token']}).status_code, 409)
        self.assertFalse(self.orari()['overrides'])
        self.save(data)
        self.assertEqual(self.client.post('/api/orari/preview', json=data).status_code, 409)
        bad = self.draft(); bad['end'] = '2026-01-01'
        self.assertEqual(self.client.post('/api/orari/preview', json=bad).status_code, 422)

    def test_import_compatibility_review_discard_and_legacy_restore(self):
        data = self.draft(); data['cells']['lun|2']['disabled'] = True
        self.save(data)
        raw = fixture(); raw['orario'][0]['classi'] = ['9Z']
        response = import_version(self.client, raw, '2026-10-19'); response.raise_for_status()
        self.assertTrue(self.orari('2026-10-19')['dataset']['lessons']['pot|lun|2']['disabled'])
        raw['orario'][3]['sede'] = 'succursale'
        response = import_version(self.client, raw, '2026-10-26'); response.raise_for_status()
        self.assertTrue(any(r['review'] for r in response.json()['impact']['overrides']))
        self.assertNotIn('disabled', self.orari('2026-10-26')['dataset']['lessons']['pot|lun|2'])
        # Saving the imported effective state explicitly discards suspended edits.
        self.save(self.draft('2026-10-26'))
        self.assertFalse(overrides.selected(dict(records=self.orari()['overrides']), 'pot', '2026-10-26')['groups'])
        archive = self.client.get('/api/export').json(); archive['schema'] = 4; archive.pop('timetableOverrides')
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertTrue(self.orari()['overrides'])

    def test_reset_and_stale_drafts_after_import(self):
        data = self.draft(); data['cells']['lun|2']['disabled'] = True
        self.save(data)
        old = self.draft('2026-10-26')
        reset = self.draft('2026-10-19'); reset.update(reset=True, end=None)
        self.save(reset)
        self.assertNotIn('disabled', self.orari('2026-10-19')['dataset']['lessons']['pot|lun|2'])
        self.assertTrue(self.orari()['dataset']['lessons']['pot|lun|2']['disabled'])
        self.assertEqual(self.client.post('/api/orari/preview', json=old).status_code, 409)

    def test_malformed_input_and_backup_restart(self):
        for value in ([], {}, False, 0, ''):
            bad = self.draft(); bad['cells']['mar|3'] = value
            self.assertEqual(self.client.post('/api/orari/preview', json=bad).status_code, 422)
        bad = self.draft(); bad['teacher'] = []
        self.assertEqual(self.client.post('/api/orari/preview', json=bad).status_code, 422)
        data = self.draft(); data['cells']['lun|2']['disabled'] = True
        self.save(data)
        archive = self.client.get('/api/export').json()
        before = self.client.get('/api/backups').json()
        snapshot = self.client.post('/api/backups').json()
        reset = self.draft('2026-10-12'); reset['reset'] = True
        self.save(reset)
        self.client.post('/api/backups/restore', json=dict(filename=snapshot['filename'], confirm=True)).raise_for_status()
        self.assertTrue(self.orari()['dataset']['lessons']['pot|lun|2']['disabled'])
        with patch.dict(os.environ, {'BACKUP_ON_STARTUP': 'false'}):
            restarted = TestClient(create_app(self.path))
        self.assertEqual(archive['timetableOverrides'], restarted.get('/api/export').json()['timetableOverrides'])
        check = restarted.post('/api/import/preview', json=archive)
        check.raise_for_status()
        self.assertEqual(archive, restarted.get('/api/export').json())

    def test_legacy_timeline_replacement_retains_detached_override_basis(self):
        data = self.draft(); data['cells']['lun|2']['disabled'] = True
        self.save(data)
        archive = self.client.get('/api/export').json()
        legacy = copy.deepcopy(archive); legacy['schema'] = 4; legacy.pop('timetableOverrides')
        legacy['timetables']['versions'][0]['dataset']['lessons']['pot|lun|2']['site'] = 'succursale'
        self.client.post('/api/import', json=legacy).raise_for_status()
        detached = self.client.get('/api/export').json()
        self.client.post('/api/import', json=detached).raise_for_status()
        self.assertTrue(self.orari()['overrides'][0]['groups'][0]['conflicts'])

    def test_preview_omits_preexisting_unrelated_assignment_issues(self):
        self.entry()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='pot', hours=[2])).raise_for_status()
        self.assertTrue(self.client.get('/api/day/'+DAY).json()['issues'])
        data = self.draft(); data['teacher'] = 'utc'
        data['cells'] = overrides.cells(self.orari()['dataset'], 'utc')
        data['cells']['lun|2']['disabled'] = True
        result = self.client.post('/api/orari/preview', json=data)
        result.raise_for_status()
        self.assertTrue(result.json()['days'])
        self.assertTrue(all(not d['issues'] for d in result.json()['days']))

    def test_preview_checks_only_dates_and_weekdays_the_override_can_change(self):
        for day in ('2026-10-05', DAY, '2026-10-13', '2026-10-19', '2026-10-26'):
            self.entry(day)
        data = self.draft(end='2026-10-19')
        data['cells']['lun|2']['disabled'] = True
        with patch('backend.timetables.dataset', wraps=timetables.dataset) as resolved:
            preview = self.client.post('/api/orari/preview', json=data)
        preview.raise_for_status()
        self.assertEqual([d['day'] for d in preview.json()['days']], [DAY, '2026-10-19'])
        self.assertEqual(resolved.call_count, 2)  # One imported and one edited weekly schedule.
        data['start'] = '2026-10-05'
        data['basis'] = self.orari()['basis']
        earlier = self.client.post('/api/orari/preview', json=data)
        earlier.raise_for_status()
        self.assertEqual([d['day'] for d in earlier.json()['days']], ['2026-10-05', DAY, '2026-10-19'])

    def test_same_start_revision_can_change_dates_after_its_end(self):
        for day in (DAY, '2026-10-19'):
            self.entry(day)
        first = self.draft()
        first['cells']['lun|2']['disabled'] = True
        self.save(first)
        revised = self.draft(end=DAY)
        revised['cells']['lun|2'].pop('disabled')
        preview = self.client.post('/api/orari/preview', json=revised)
        preview.raise_for_status()
        self.assertEqual([d['day'] for d in preview.json()['days']], [DAY, '2026-10-19'])

    def test_delete_removes_all_revisions_and_restores_original_without_erasing_assignments(self):
        self.entry()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).raise_for_status()
        first = self.draft()
        first['cells']['lun|2']['disabled'] = True
        self.save(first)
        second = self.draft()
        second['cells']['lun|2'].pop('disabled')
        second['cells']['mar|3'] = second['cells'].pop('lun|2')
        second['cells']['lun|2'] = None
        self.save(second)
        before = self.client.get('/api/export').json()
        self.assertEqual(len(before['timetableOverrides']['records']), 2)
        record = self.orari()['overrides'][-1]
        request = dict(delete=True, id=record['id'], teacher='pot', start=DAY, basis=self.orari()['basis'])
        preview = self.client.post('/api/orari/preview', json=request)
        preview.raise_for_status()
        self.assertEqual(self.client.post('/api/orari/override', json={**request, 'token': 'stale'}).status_code, 409)
        self.assertEqual(before, self.client.get('/api/export').json())
        self.client.post('/api/orari/override', json={**request, 'token': preview.json()['token']}).raise_for_status()
        after = self.client.get('/api/export').json()
        self.assertEqual(after['timetableOverrides'], overrides.empty())
        self.assertEqual(after['timetables'], before['timetables'])
        self.assertEqual(after['asg'], before['asg'])
        self.assertEqual(self.orari()['dataset']['lessons']['pot|lun|2'], self.orari()['imported']['lessons']['pot|lun|2'])
        self.assertFalse(self.client.get('/api/day/'+DAY).json()['issues'])
        self.assertEqual(self.client.post('/api/orari/preview', json=request).status_code, 409)
        self.client.post('/api/import', json=after).raise_for_status()

    def test_delete_reset_reactivates_earlier_patch_and_checks_new_issues(self):
        self.entry('2026-10-19')
        self.client.post('/api/assignments', json=dict(day='2026-10-19', key='absent|2|1A', value='pot')).raise_for_status()
        first = self.draft()
        first['cells']['lun|2']['disabled'] = True
        self.save(first)
        reset = self.draft('2026-10-19')
        reset.update(reset=True, end=None)
        self.save(reset)
        record = self.orari('2026-10-19')['overrides'][-1]
        request = dict(delete=True, id=record['id'], teacher='pot', start='2026-10-19', basis=self.orari()['basis'])
        preview = self.client.post('/api/orari/preview', json=request)
        preview.raise_for_status()
        self.assertEqual([d['day'] for d in preview.json()['days']], ['2026-10-19'])
        self.assertEqual(len(preview.json()['days'][0]['issues']), 1)
        self.client.post('/api/orari/override', json={**request, 'token': preview.json()['token']}).raise_for_status()
        self.assertTrue(self.orari('2026-10-19')['dataset']['lessons']['pot|lun|2']['disabled'])
        self.assertEqual(len(self.orari()['overrides']), 1)

    def test_delete_rejects_wrong_or_superseded_revision(self):
        data = self.draft()
        data['cells']['lun|2']['disabled'] = True
        self.save(data)
        record = self.orari()['overrides'][-1]
        request = dict(delete=True, id=record['id'], teacher='pot', start=DAY, basis=self.orari()['basis'])
        for bad in ({**request, 'id': 'wrong'}, {**request, 'teacher': 'utc'}, {**request, 'start': '2026-10-19'}):
            self.assertEqual(self.client.post('/api/orari/preview', json=bad).status_code, 422)
        revised = self.draft()
        revised['cells']['lun|2'].pop('disabled')
        self.save(revised)
        request['basis'] = self.orari()['basis']
        self.assertEqual(self.client.post('/api/orari/preview', json=request).status_code, 422)

    def test_pot_class_validation_dates_moves_and_portability(self):
        for classes, disabled in [(['missing'], True), (['1A', '2A'], True), (['1A'], False)]:
            data = self.draft()
            data['cells']['lun|2'].update(classes=classes, disabled=disabled)
            self.assertEqual(self.client.post('/api/orari/preview', json=data).status_code, 422)
        data = self.draft(end='2026-10-16')
        data['cells']['lun|2'].update(classes=['1A'], disabled=True)
        self.save(data)
        self.assertEqual(self.orari()['dataset']['lessons']['pot|lun|2']['classes'], ['1A'])
        self.assertEqual(self.orari('2026-10-19')['dataset']['lessons']['pot|lun|2']['classes'], [])
        restarted = TestClient(create_app(self.path))
        self.assertEqual(restarted.get('/api/orari', params={'day': DAY}).json()['dataset']['lessons']['pot|lun|2']['classes'], ['1A'])
        archive = self.client.get('/api/export').json()
        self.client.post('/api/import', json=archive).raise_for_status()
        snapshot = self.client.post('/api/backups').json()
        moved = self.draft()
        moved['cells']['mar|3'], moved['cells']['lun|2'] = moved['cells']['lun|2'], None
        self.save(moved)
        self.assertEqual(self.orari()['dataset']['lessons']['pot|mar|3']['classes'], ['1A'])
        self.client.post('/api/backups/restore', json=dict(filename=snapshot['filename'], confirm=True)).raise_for_status()
        self.assertEqual(self.orari()['dataset']['lessons']['pot|lun|2']['classes'], ['1A'])

    def test_pot_compresence_and_class_out(self):
        self.entry()
        data = self.draft()
        data['cells']['lun|2'].update(classes=['1A'], disabled=True)
        self.save(data)
        choice = next(c for c in self.candidates() if c['id'] == 'pot')
        self.assertEqual(choice['ty'], 'CP')
        self.assertEqual(choice['typeLabel'], 'Compresenza - POT')
        self.assertFalse(choice['exceptional'])
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json()['asg'][DAY]['absent|2|1A']['t'], 'CP')
        report = self.client.get('/api/stats', params=dict(period='custom', start=DAY, end=DAY)).json()
        self.assertEqual(report['types']['CP'], 1)
        self.assertNotIn('POT', report['types'])
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value=None)).raise_for_status()
        self.client.post('/api/entries', json=dict(day=DAY, group='cf', id='1A', hours=[2])).raise_for_status()
        from backend.domain import auto_availability, eligibility
        from backend.hour_types import merge_types
        from backend.storage import EMPTY
        ds = self.orari()['dataset']
        state = copy.deepcopy(EMPTY)
        state['cf'][DAY] = {'1A': [2]}
        self.assertIn(2, auto_availability(ds, state, DAY)['pot'])
        row = dict(k='support|2|2A', ids=['support'], h=2, c='2A', sede='centrale', aula=None)
        c = eligibility(ds, state, DAY, row, ds['teachers']['pot'], merge_types(ds, {}))
        self.assertEqual(c['ty'], 'D')
        self.assertFalse(c['exceptional'])

    def test_pot_absence_rows_and_hard_restrictions(self):
        from backend.domain import rows, eligibility
        from backend.hour_types import merge_types
        from backend.storage import EMPTY
        ds = self.orari()['dataset']
        ds['lessons']['pot|lun|2'].update(classes=['1A'], disabled=True)
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'pot': [2]}
        self.assertEqual(rows(ds, state, DAY), [])
        state['abs'][DAY].update(absent=[2], co=[2], wrongcampus=[2])
        row = rows(ds, state, DAY)[0]
        self.assertEqual(set(row['ids']), {'pot', 'absent', 'co', 'wrongcampus'})
        for teacher in ('absent', 'co', 'wrongcampus'):
            ds['lessons'].pop(f'{teacher}|lun|2')
        self.assertEqual(rows(ds, state, DAY)[0]['ids'], ['pot'])
        state['abs'][DAY] = {'absent': [2]}
        row = dict(k='absent|2|1A', ids=['absent'], h=2, c='1A', sede='centrale', aula=None)
        policies = merge_types(ds, {})
        state['abs'][DAY]['pot'] = [2]
        self.assertEqual(eligibility(ds, state, DAY, row, ds['teachers']['pot'], policies)['why'], 'Assente')
        state['abs'][DAY].pop('pot')
        state['asg'][DAY] = {'support|2|2A': dict(v='pot', t='CP', c='2A')}
        self.assertIn('Già assegnato', eligibility(ds, state, DAY, row, ds['teachers']['pot'], policies)['why'])
        row['c'] = '2A'
        self.assertTrue(eligibility(ds, state, DAY, row, ds['teachers']['pot'], policies)['exceptional'])

    def test_pot_association_reset_reimport_and_assignment_review(self):
        self.entry()
        data = self.draft()
        data['cells']['lun|2'].update(classes=['1A'], disabled=True)
        self.save(data)
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='pot')).raise_for_status()
        reset = self.draft(); reset['reset'] = True
        self.save(reset)
        self.assertEqual(self.orari()['dataset']['lessons']['pot|lun|2']['classes'], [])
        self.assertEqual(self.client.get('/api/export').json()['asg'][DAY]['absent|2|1A']['t'], 'CP')
        data = self.draft()
        data['cells']['lun|2'].update(classes=['1A'], disabled=True)
        self.save(data)
        raw = fixture()
        import_version(self.client, raw, '2026-10-19').raise_for_status()
        self.assertEqual(self.orari('2026-10-19')['dataset']['lessons']['pot|lun|2']['classes'], ['1A'])
        raw['orario'][3]['sede'] = 'succursale'
        response = import_version(self.client, raw, '2026-10-26')
        response.raise_for_status()
        self.assertTrue(any(r['review'] for r in response.json()['impact']['overrides']))
        self.assertEqual(self.orari('2026-10-26')['dataset']['lessons']['pot|lun|2']['classes'], [])
        self.assertEqual(self.client.get('/api/export').json()['asg'][DAY]['absent|2|1A']['t'], 'CP')

    def test_pot_campus_edit_and_future_override_deletion(self):
        data = self.draft(start='2099-10-19')
        data['cells']['lun|2'].update(site='succursale', disabled=True, classes=['1A'])
        self.save(data)
        future = self.orari('2099-10-19')
        self.assertEqual(future['dataset']['lessons']['pot|lun|2']['site'], 'succursale')
        self.assertEqual(self.orari()['dataset']['lessons']['pot|lun|2']['site'], 'centrale')
        archive = self.client.get('/api/export').json()
        self.client.post('/api/import', json=archive).raise_for_status()
        record = future['overrides'][-1]
        request = dict(delete=True, id=record['id'], teacher='pot', start=record['start'], basis=self.orari()['basis'])
        preview = self.client.post('/api/orari/preview', json=request)
        preview.raise_for_status()
        self.client.post('/api/orari/override', json={**request, 'token': preview.json()['token']}).raise_for_status()
        self.assertEqual(self.orari()['overrides'], [])
        bad = self.draft(); bad['cells']['lun|2']['site'] = 'invalid'
        self.assertEqual(self.client.post('/api/orari/preview', json=bad).status_code, 422)

    def test_alf_class_campus_compresence_and_release(self):
        raw = fixture(); raw['orario'][3]['attivita_originale'] = 'ALF'
        import_version(self.client, raw, '2026-10-19').raise_for_status()
        day = '2026-10-19'
        self.client.post('/api/hour-types', json=dict(id='code:ALF', available=True, visible=True, school=True)).raise_for_status()
        self.entry(day)
        data = self.draft(start=day)
        data['cells']['lun|2'].update(classes=['1A'], disabled=True, site='centrale')
        self.save(data)
        choices = {c['id']: c for c in self.candidates(day)}
        self.assertEqual(choices['pot']['typeLabel'], 'Compresenza - ALF')
        self.assertFalse(choices['pot']['exceptional'])
        self.client.post('/api/assignments', json=dict(day=day, key='absent|2|1A', value='pot')).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json()['asg'][day]['absent|2|1A']['t'], 'CA')
        self.client.post('/api/assignments', json=dict(day=day, key='absent|2|1A', value=None)).raise_for_status()
        archive = self.client.get('/api/export').json()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.client.post('/api/entries', json=dict(day=day, group='cf', id='1A', hours=[2])).raise_for_status()
        self.assertIn('2', self.client.get('/api/day/'+day).json()['autoDis'][day]['pot'])
