import copy
import tempfile
import unittest
from pathlib import Path
from backend import appointments, timetables, recovery
from backend.domain import normalize_dataset, rows, absences
from backend.storage import EMPTY, Store
from backend.main import create_app
from backend.tests.client import TestClient
from backend.tests.test_recovery import fixture, DAY


def document():
    doc = appointments.empty()
    doc['people']['sicoli'] = dict(id='sicoli', name='Sicoli', code='', role='curricolare', classe_concorso='')
    doc['absences'] = [dict(id='maternity', person='absent', start='2026-10-01', end=None)]
    doc['appointments'] = [dict(id='coverage', source='absent', person='sicoli', start=DAY, end='2026-10-18')]
    return doc


class ModelTest(unittest.TestCase):
    def setUp(self):
        raw = fixture()
        raw['orario'].append(dict(docente='absent', giorno='lun', ora=1, classi=[], attivita_riconosciute=['POT']))
        # Replace existing period, not duplicate it.
        raw['orario'] = [l for l in raw['orario'] if not (l['docente']=='absent' and l['ora']==1 and l.get('classi'))]
        self.history = timetables.baseline(normalize_dataset(raw))
        self.doc = document()
        appointments.validate(self.doc, self.history)

    def test_lifecycle_and_personal_absence(self):
        h = dict(self.history, _appointments=self.doc)
        original = copy.deepcopy(h)
        state = copy.deepcopy(EMPTY)
        before = timetables.dataset(h, '2026-10-05')
        self.assertEqual(len(rows(before, state, '2026-10-05')), 6)
        active = timetables.dataset(h, DAY)
        self.assertNotIn('sicoli|lun|1', active['lessons'])
        self.assertIn('sicoli|lun|1', active['excludedPOT'])
        self.assertEqual(rows(active, state, DAY), [])
        state['abs'][DAY] = {'absent': [2], 'sicoli': [2]}
        self.assertEqual(absences(state, DAY, active), {'sicoli': [2]})
        self.assertEqual(rows(active, state, DAY)[0]['id'], 'sicoli')
        self.assertTrue(timetables.dataset(h, '2026-10-18')['teachers']['absent']['coveredBy'])
        self.assertEqual(len(rows(timetables.dataset(h, '2026-10-19'), state, '2026-10-19')), 6)
        self.assertEqual(h, original)

    def test_appointment_removes_only_obsolete_covers_in_its_period(self):
        current = copy.deepcopy(self.doc)
        current['appointments'] = []
        history = dict(self.history, _appointments=current)
        state = copy.deepcopy(EMPTY)
        key = 'absent|2|1A'
        for day in ('2026-10-05', DAY, '2026-10-19'):
            state['asg'][day] = {key: dict(v='normal', t='POT', c='1A')}
        before = copy.deepcopy(state)
        result = appointments.preview(history, state, dict(schema=1, days={}), self.doc, DAY)
        self.assertTrue(result['ready'], result['issues'])
        self.assertEqual([(r['day'], r['key']) for r in result['removals']], [(DAY, key)])
        self.assertEqual(state, before)

    def test_invalid_periods_and_conflicts(self):
        for mutate in [lambda d: d['appointments'].append(dict(d['appointments'][0], id='overlap')),
                       lambda d: d['appointments'][0].update(person='absent'),
                       lambda d: d['appointments'][0].update(person='rp'),
                       lambda d: d['appointments'][0].update(end='2026-01-01'),
                       lambda d: d['appointments'][0].update(source='missing')]:
            d = copy.deepcopy(self.doc); mutate(d)
            with self.assertRaises(ValueError): appointments.validate(d, self.history)

    def test_empty_document_is_identity(self):
        before = timetables.dataset(self.history, DAY)
        self.assertEqual(before, timetables.dataset(dict(self.history, _appointments=appointments.empty()), DAY))

    def test_mixed_pot_keeps_other_activities(self):
        self.history['versions'][0]['dataset']['lessons']['absent|lun|1']['activities']=['POT','PE']
        active = timetables.dataset(dict(self.history, _appointments=self.doc), DAY)
        self.assertEqual(active['lessons']['sicoli|lun|1']['activities'], ['PE'])

    def test_removing_referenced_person_is_still_blocked(self):
        current = appointments.empty()
        current['people']['managed'] = dict(self.doc['people']['sicoli'], id='managed')
        history = dict(self.history, _appointments=current)
        for group, entries in [
            ('manualPermits', {'managed': {'id': 'balance', 'hours': 1}}),
            ('manualPermitNotes', {'managed': 'Historical note'}),
            *[(g, {DAY: {'managed': [1]}}) for g in ('abs', 'permessi', 'dis', 'paidAvailability')],
            ('asg', {DAY: {'managed|1|1A': {'v': 'normal', 't': 'D', 'c': '1A'}}}),
            ('asg', {DAY: {'absent|1|1A': {'v': 'managed', 't': 'D', 'c': '1A'}}}),
        ]:
            with self.subTest(group=group, entries=entries):
                state = copy.deepcopy(EMPTY)
                state[group] = entries
                with self.assertRaisesRegex(ValueError, 'eliminerebbe una persona'):
                    appointments.preview(history, state, dict(schema=1, days={}), appointments.empty(), DAY)

    def test_existing_unknown_references_do_not_block_unrelated_staffing(self):
        state = copy.deepcopy(EMPTY)
        state['manualPermits']['legacy'] = dict(id='balance', hours=1)
        state['manualPermitNotes']['legacy'] = 'Historical note'
        for group in ('abs', 'permessi', 'dis'):
            state[group][DAY] = {'legacy': [1]}
        state['paidAvailability'] = {'0': {'legacy': [1]}}
        state['asg'][DAY] = {'legacy|1|1A': dict(v='legacy', t='D', c='1A')}
        before = copy.deepcopy(state)
        proposed = appointments.empty()
        proposed['absences'] = [dict(id='prolonged', person='absent', start=DAY, end=None)]
        result = appointments.preview(self.history, state, dict(schema=1, days={}), proposed, DAY)
        self.assertTrue(result['ready'])
        self.assertEqual(state, before)

    def test_preview_does_not_revalidate_unchanged_historical_dates(self):
        from unittest.mock import patch
        state = copy.deepcopy(EMPTY)
        state['abs']['2026-10-05'] = {'absent': [1]}
        state['abs'][DAY] = {'bottom': [2]}
        current = document()
        history = dict(self.history, _appointments=current)
        proposed = copy.deepcopy(current)
        proposed['absences'].append(dict(id='later', person='bottom', start=DAY, end=None))
        with patch.object(timetables, 'issues', wraps=timetables.issues) as issues:
            appointments.preview(history, state, dict(schema=1, days={}), proposed, DAY)
        self.assertEqual([call.args[2] for call in issues.call_args_list], [DAY, DAY])

    def test_daily_rows_compute_prolonged_absences_once(self):
        from unittest.mock import patch
        from backend import domain
        ds = timetables.dataset(dict(self.history, _appointments=self.doc), '2026-10-19')
        with patch.object(domain, 'absences', wraps=domain.absences) as compute:
            self.assertTrue(domain.rows(ds, copy.deepcopy(EMPTY), '2026-10-19'))
        self.assertEqual(compute.call_count, 1)

    def test_existing_cover_of_absent_teacher_is_preserved(self):
        from unittest.mock import patch
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2]}
        state['asg'][DAY] = {'absent|2|1A': dict(v='normal', t='POT', c='1A')}
        before = copy.deepcopy(state)
        proposed = appointments.empty()
        proposed['absences'] = [dict(id='long', person='absent', start=DAY, end=None)]
        with patch.object(timetables, 'validate_assignment') as validate:
            result = appointments.preview(self.history, state, dict(schema=1, days={}), proposed, DAY)
            validate.assert_not_called()
        self.assertTrue(result['ready'])
        cover = next(r for r in result['records'] if r['group']=='asg')
        self.assertEqual((cover['person'], cover['substitute']), ('absent', 'normal'))
        self.assertEqual(state, before)

    def test_affected_assignments_include_changed_substitute_lessons_and_shared_rows(self):
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2], 'bottom': [2]}
        state['asg'][DAY] = {'absent|2|1A': dict(v='normal', t='POT', c='1A')}
        before = timetables.dataset(self.history, DAY)
        after = copy.deepcopy(before)
        after['lessons']['normal|lun|2']['classes'] = ['9A']
        self.assertEqual(appointments.affected_assignments(before, after, state, DAY), {'absent|2|1A'})
        after = copy.deepcopy(before)
        after['lessons']['bottom|lun|2']['classes'] = ['1A']
        self.assertEqual(appointments.affected_assignments(before, after, state, DAY), {'absent|2|1A'})

    def test_absent_teacher_covering_someone_else_is_visible_even_if_already_invalid(self):
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2], 'normal': [2]}
        state['asg'][DAY] = {'absent|2|1A': dict(v='normal', t='POT', c='1A')}
        proposed = appointments.empty()
        proposed['absences'] = [dict(id='long', person='normal', start=DAY, end=None)]
        result = appointments.preview(self.history, state, dict(schema=1, days={}), proposed, DAY)
        self.assertFalse(result['ready'])
        self.assertEqual(result['issues'][0]['key'], 'absent|2|1A')
        self.assertIn('normal', result['issues'][0]['message'])
        self.assertIn('1A', result['issues'][0]['message'])
        self.assertFalse(any(r['group']=='asg' for r in result['records']))
        proposed['absences'][0]['start']='2026-10-13'
        self.assertTrue(appointments.preview(self.history, state, dict(schema=1, days={}), proposed, DAY)['ready'])
        current = copy.deepcopy(proposed)
        current['absences'][0]['start'] = '2026-10-11'
        proposed['absences'][0]['start'] = DAY
        history = dict(self.history, _appointments=current)
        self.assertFalse(appointments.preview(history, state, dict(schema=1, days={}), proposed, DAY)['ready'])

    def test_batch_assignment_checks_build_daily_rows_once(self):
        from unittest.mock import patch
        from backend import domain, statistics
        state = copy.deepcopy(EMPTY)
        state['abs'][DAY] = {'absent': [2, 3]}
        state['asg'][DAY] = {f'absent|{h}|1A': dict(v='normal', t='POT', c='1A') for h in (2, 3)}
        ds = timetables.dataset(self.history, DAY)
        with patch.object(timetables, 'rows', wraps=domain.rows) as compute:
            self.assertEqual(timetables.issues(ds, state, DAY), [])
            self.assertEqual(compute.call_count, 1)
        with patch.object(statistics, 'rows', wraps=domain.rows) as compute:
            facts = statistics.sync(ds, state, statistics.empty(), [DAY], revalidate=True)
            self.assertEqual(compute.call_count, 1)
        self.assertTrue(all(r['valid'] for r in facts['days'][DAY]['demand'].values()))

    def test_resolver_reuses_only_identical_effective_periods(self):
        from unittest.mock import patch
        history = copy.deepcopy(self.history)
        second = copy.deepcopy(history['versions'][0])
        second.update(id='changed', effective='2026-10-17')
        second['dataset']['lessons']['normal|lun|2']['site'] = 'succursale'
        history['versions'].append(second)
        history['_appointments'] = self.doc
        history['_receptions'] = dict(schema=1, versions=[dict(effective='2026-10-13', rows=[dict(teacher='normal', day='lun', hour=1, name='normal', time='08:00', location='', site='centrale')])])
        lesson = copy.deepcopy(history['versions'][0]['dataset']['lessons']['normal|lun|1'])
        history['_overrides'] = dict(schema=1, evidence=[], records=[dict(id='patch', teacher='normal', start='2026-10-14', end='2026-10-15', reset=False,
            groups=[dict(before={'lun|1': lesson}, after={'lun|1': dict(lesson, disabled=True)}, conflicts=[])])])
        days = ['2026-09-30', '2026-10-01', '2026-10-05', DAY, '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18', '2026-10-19', '2026-10-20']
        expected = {day: timetables.dataset(history, day) for day in days}
        with patch.object(timetables, 'dataset', wraps=timetables.dataset) as compute:
            resolve = timetables.resolver(history)
            self.assertEqual({day: resolve(day) for day in days}, expected)
            self.assertEqual(compute.call_count, 8)


class ApiTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(); self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name)/'test.sqlite'
        self.app = create_app(self.path)
        self.client = TestClient(self.app)
        self.client.post('/api/timetable', json=fixture()).raise_for_status()

    def test_apply_removes_previewed_covers_and_refreshes_statistics(self):
        current = document()
        current['appointments'] = []
        self.apply(current).raise_for_status()
        key = 'absent|2|1A'
        with Store(self.path).connect() as db:
            state = Store(self.path).read(db, 'state', EMPTY)
            state['asg'][DAY] = {key: dict(v='normal', t='POT', c='1A')}
            Store(self.path).write(db, 'state', state)
        result = self.preview(document()).json()
        self.assertTrue(result['ready'], result['issues'])
        self.assertEqual(result['removals'][0]['key'], key)
        self.apply(document()).raise_for_status()
        with Store(self.path).connect() as db:
            self.assertEqual(Store(self.path).read(db, 'state')['asg'][DAY], {})
            facts = Store(self.path).read(db, 'statistics')
            self.assertNotIn(DAY, facts['days'])

    def preview(self, doc, day=DAY):
        return self.client.post('/api/staffing/preview', json=dict(document=doc, day=day, revision=self.client.get('/api/staffing').json()['revision']))

    def apply(self, doc):
        result = self.preview(doc); result.raise_for_status()
        return self.client.post('/api/staffing/apply', json=dict(document=doc, day=DAY, revision=self.client.get('/api/staffing').json()['revision'], token=result.json()['token']))

    def test_ownership_permits_archive_and_idempotence(self):
        self.client.post('/api/permessi', json=dict(day='2026-10-05', id='absent', hours=[2], note='Gambato')).raise_for_status()
        before = self.client.get('/api/export').json()
        d = document(); d['people']['absent'] = dict(id='absent', name='Gambato', code='', role='curricolare', classe_concorso='')
        self.apply(d).raise_for_status()
        after = self.client.get('/api/export').json()
        self.assertEqual(recovery.ledger(before), recovery.ledger(after))
        self.assertEqual(after['permitNotes'], before['permitNotes'])
        self.apply(d).raise_for_status()
        self.assertEqual(self.client.get('/api/day/'+DAY).json()['rows'], [])
        self.client.post('/api/permessi', json=dict(day=DAY, id='sicoli', hours=[2])).raise_for_status()
        day = self.client.get('/api/day/'+DAY).json()
        self.assertEqual(day['rows'][0]['id'], 'sicoli')
        permits=self.client.get('/api/permessi').json()
        self.assertEqual(permits['balances']['absent']['remaining'], 1)
        self.assertEqual(permits['balances']['sicoli']['remaining'], 1)
        archive=self.client.get('/api/export').json()
        self.client.post('/api/import', json=archive).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json()['teacherAppointments'], d)
        broken=copy.deepcopy(archive); broken['teacherAppointments']['appointments'][0]['person']='missing'
        self.assertEqual(self.client.post('/api/import',json=broken).status_code,422)
        self.assertEqual(self.client.get('/api/export').json(),archive)

    def test_absences_stats_and_locks(self):
        d = document(); d['appointments']=[]
        self.apply(d).raise_for_status()
        day=self.client.get('/api/day/'+DAY).json()
        self.assertEqual(day['continuousAbsences']['absent'], list(range(1,8)))
        self.assertEqual(len(day['rows']),7)
        empty_day=self.client.get('/api/day/2026-10-13').json()
        self.assertEqual(empty_day['continuousAbsences'],{})
        self.assertEqual(empty_day['effectiveAbsences'],{})
        stats=self.client.get('/api/stats').json()
        self.assertEqual(self.client.get('/api/stats').status_code,200)
        archive=self.client.get('/api/export').json()
        self.client.post('/api/import',json=archive).raise_for_status()

    def test_prolonged_absence_preserves_unrelated_unknown_legacy_record(self):
        store = Store(self.path)
        with store.connect() as db:
            state = store.read(db, 'state', EMPTY)
            state['abs']['2026-10-05'] = {'legacy-missing': [1, 2]}
            store.write(db, 'state', state)
        before = self.client.get('/api/export').json()
        proposed = appointments.empty()
        proposed['absences'] = [dict(id='prolonged', person='absent', start=DAY, end=None)]
        self.apply(proposed).raise_for_status()
        after = self.client.get('/api/export').json()
        self.assertEqual(after['abs'], before['abs'])
        self.assertEqual(after['teacherAppointments'], proposed)
        self.assertEqual(self.client.get('/api/day/'+DAY).json()['continuousAbsences']['absent'], list(range(1, 8)))

    def test_save_preserves_existing_cover_without_revalidating_it(self):
        from unittest.mock import patch
        from backend import statistics
        self.client.post('/api/entries', json=dict(day=DAY, group='abs', id='absent', hours=[2])).raise_for_status()
        self.client.post('/api/assignments', json=dict(day=DAY, key='absent|2|1A', value='normal')).raise_for_status()
        before = self.client.get('/api/export').json()
        proposed = appointments.empty()
        proposed['absences'] = [dict(id='long', person='absent', start=DAY, end=None)]
        with patch.object(statistics, 'validate_assignment', side_effect=AssertionError('Unchanged cover was revalidated')):
            self.apply(proposed).raise_for_status()
        after = self.client.get('/api/export').json()
        self.assertEqual(after['asg'], before['asg'])
        self.assertEqual(after['statistics']['days'][DAY]['demand']['2|1A'], before['statistics']['days'][DAY]['demand']['2|1A'])

    def test_permissions_stale_preview_and_invalid_document(self):
        other=TestClient(self.app,campus='succursale')
        self.assertEqual(other.get('/api/staffing').status_code,403)
        self.assertEqual(other.post('/api/staffing/preview',json=dict(document=document(),day=DAY)).status_code,403)
        preview=self.preview(document()).json()
        self.client.post('/api/entries',json=dict(day=DAY,group='abs',id='bottom',hours=[2])).raise_for_status()
        result=self.client.post('/api/staffing/apply',json=dict(document=document(),day=DAY,revision=self.client.get('/api/staffing').json()['revision'],token=preview['token']))
        self.assertEqual(result.status_code,409)
        self.assertEqual(self.client.get('/api/staffing').json()['document'],appointments.empty())
        self.assertEqual(self.preview({}).status_code,422)

    def test_existing_assignment_is_removed_only_on_confirmation(self):
        self.client.post('/api/entries',json=dict(day=DAY,group='abs',id='absent',hours=[1])).raise_for_status()
        self.client.post('/api/assignments',json=dict(day=DAY,key='absent|1|1A',value='normal')).raise_for_status()
        before=self.client.get('/api/export').json()
        preview = self.preview(document()).json()
        self.assertTrue(preview['ready'])
        self.assertEqual(preview['removals'][0]['key'], 'absent|1|1A')
        self.assertEqual(self.client.get('/api/export').json(), before)
        self.apply(document()).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json()['asg'][DAY], {})

    def test_successor_and_wrong_person_rp(self):
        d=document(); d['people']['next']=dict(id='next',name='Successore',code='',role='curricolare',classe_concorso='')
        d['appointments'].append(dict(id='next-period',source='absent',person='next',start='2026-10-19',end=None))
        self.apply(d).raise_for_status()
        self.client.post('/api/entries',json=dict(day=DAY,group='abs',id='bottom',hours=[2])).raise_for_status()
        self.client.post('/api/manual-permits',json=dict(id='absent',hours=3)).raise_for_status()
        choices=self.client.get('/api/candidates',params=dict(day=DAY,key='bottom|2|3A')).json()
        self.assertNotIn('absent',[c['id'] for c in choices])
        for category in (None,'MANUAL','PAID'):
            response=self.client.post('/api/assignments',json=dict(day=DAY,key='bottom|2|3A',value='absent',category=category,exceptional=True))
            self.assertEqual(response.status_code,422)
        self.assertEqual(self.client.post('/api/assignments',json=dict(day=DAY,key='bottom|2|3A',value='sicoli')).status_code,422)
        view=self.client.get('/api/orari',params=dict(day='2026-10-19')).json()['dataset']
        self.assertIn('next|lun|2',view['lessons'])
        self.assertTrue(view['teachers']['sicoli']['unavailable'])
        self.assertNotIn('next',self.client.get('/api/permessi').json()['balances'])

    def test_import_aliases_and_recovery_roundtrip_after_import(self):
        from backend.tests.timetable_helpers import import_version
        self.apply(document()).raise_for_status()
        self.client.post('/api/permessi',json=dict(day=DAY,id='sicoli',hours=[2])).raise_for_status()
        raw=fixture()
        for t in raw['docenti']:
            if t['id']=='absent': t['id']='new-source'
        for l in raw['orario']:
            if l['docente']=='absent': l['docente']='new-source'
        self.assertEqual(self.client.post('/api/timetable/preview',params=dict(effective='2026-10-13'),json=raw).status_code,422)
        raw['teacherSources']={'new-source':'absent'}
        import_version(self.client,raw,'2026-10-13').raise_for_status()
        day=self.client.get('/api/orari',params=dict(day='2026-10-14')).json()['dataset']
        self.assertEqual(day['teachers']['sicoli']['replaces'],'absent')
        archive=self.client.get('/api/export').json()
        self.client.post('/api/import',json=archive).raise_for_status()
        self.assertEqual(self.client.get('/api/export').json(),archive)

    def test_backup_and_admin_without_operational_access(self):
        from backend import backup
        d=document(); self.apply(d).raise_for_status()
        snapshot=backup.backup_database(str(self.path),str(Path(self.tmp.name)/'copies'))
        self.apply(appointments.empty()).raise_for_status()
        backup.restore_backup(str(self.path),snapshot['path'])
        self.assertEqual(self.client.get('/api/staffing').json()['document'],d)
        self.app.state.identities.change('test-centrale','campuses',[])
        self.assertEqual(self.client.get('/api/staffing').status_code,200)
        self.assertEqual(self.client.get('/api/orari').status_code,403)

    def test_inbox_person_review_and_boundary_range(self):
        from backend.tests.test_inbox import response
        self.apply(document()).raise_for_status()
        with Store(self.path).connect() as db:
            item=dict(raw=response(name='absent',day='12/10/2026'),teacher=None)
            result=self.app.state.inbox.preview(db,item)
            self.assertIn('conferma esplicitamente',result['error'])
            self.assertEqual(self.app.state.inbox.preview(db,item,selected='absent')['error'],'')
            replacement=dict(raw=response(name='Sicoli',day='12/10/2026'),teacher=None)
            self.assertEqual(self.app.state.inbox.preview(db,replacement)['teacher'],'sicoli')
            across=dict(raw=response(case=1,name='Sicoli',day='12/10/2026',end='19/10/2026'),teacher=None)
            self.assertIn('diverse supplenze',self.app.state.inbox.preview(db,across)['error'])

    def test_draft_revision_rejects_lost_update_before_preview(self):
        revision=self.client.get('/api/staffing').json()['revision']
        self.apply(document()).raise_for_status()
        result=self.client.post('/api/staffing/preview',json=dict(document=appointments.empty(),day=DAY,revision=revision))
        self.assertEqual(result.status_code,409)
        self.assertEqual(self.client.get('/api/staffing').json()['document'],document())

    def test_display_and_history_share_effective_owner(self):
        from backend import display
        self.apply(document()).raise_for_status()
        self.client.post('/api/entries',json=dict(day=DAY,group='abs',id='sicoli',hours=[2])).raise_for_status()
        self.client.post('/api/assignments',json=dict(day=DAY,key='sicoli|2|1A',value='normal')).raise_for_status()
        daily=self.client.get('/api/day/'+DAY).json()
        visible=display.project(daily['dataset'],daily['state'],DAY,'centrale')
        self.assertIn('Sicoli',str(visible))
        self.assertNotIn('absent',str(visible))
        history=self.client.get('/api/permessi').json()['timetableVersions']
        active=next(v for v in history if v['effective']==DAY)['dataset']
        self.assertIn('sicoli|lun|2',active['lessons'])
        self.assertNotIn('absent|lun|2',active['lessons'])
        self.assertEqual(daily['references'],[])
