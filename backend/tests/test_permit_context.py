import copy
import unittest
from datetime import date, timedelta
from unittest.mock import patch

from backend import permit_context, timetables, teacher_names, overrides
from backend.domain import normalize_dataset
from backend.tests.test_appointments import document
from backend.tests.test_recovery import fixture


class PermitContextTest(unittest.TestCase):
    def test_compact_history_matches_effective_scheduling_and_names(self):
        history = timetables.baseline(normalize_dataset(fixture()))
        initial = history['versions'][0]['dataset']
        initial['lessons']['absent|lun|1'].update(activities=['POT', 'PE'], disabled=True)
        later = copy.deepcopy(initial)
        later['lessons']['normal|mar|7'] = dict(classes=[], site='succursale', activities=['DIS'])
        later['teachers'].pop('bottom')
        later['lessons'] = {k: l for k, l in later['lessons'].items() if not k.startswith('bottom|')}
        history['versions'].append(dict(id='later', effective='2026-10-15', dataset=later))
        history['_appointments'] = document()
        history['_appointments']['absences'][0]['end'] = '2026-10-25'
        history['_overrides'] = overrides.empty()
        history['_overrides']['records'].append(dict(id='override', teacher='normal', start='2026-10-20', end='2026-10-22', reset=True, groups=[]))
        names = dict(schema=1, teachers={'normal': dict(name='Displayed', originalName='Original')})
        before = copy.deepcopy(history)
        with patch.object(timetables, 'dataset', wraps=timetables.dataset) as resolver:
            compact = permit_context.versions(history, names)
            self.assertEqual(resolver.call_count, len(compact))
        days = {'0001-01-01', '2099-01-01'}
        for entry in compact:
            if entry['effective']:
                day = date.fromisoformat(entry['effective'])
                days.update((day.isoformat(), (day - timedelta(days=1)).isoformat()))
        for day in sorted(days):
            with self.subTest(day=day):
                full = timetables.dataset(history, day)
                context = next(v['dataset'] for v in reversed(compact) if not v['effective'] or v['effective'] <= day)
                self.assertNotIn('lessons', context)
                shown = teacher_names.teachers(full['teachers'], names)
                for identifier, teacher in shown.items():
                    for field in ('id', 'name', 'code', 'role', 'importedName', 'retired', 'unavailable'):
                        self.assertEqual(context['teachers'][identifier].get(field), teacher.get(field))
                    sites = [s for s in ('centrale', 'succursale') if any(k.split('|')[0] == identifier and l.get('site') == s for k, l in full['lessons'].items())]
                    self.assertEqual(context['sites'].get(identifier, []), sites)
                    for weekday in ('lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'):
                        scheduled = [h for h in range(1, 8) if f'{identifier}|{weekday}|{h}' in full['lessons']]
                        self.assertEqual(context['hours'].get(identifier, {}).get(weekday, []), scheduled)
        self.assertEqual(history, before)

    def test_saved_override_hours_change_only_in_its_window(self):
        history = timetables.baseline(normalize_dataset(fixture()))
        cells = overrides.cells(history['versions'][0]['dataset'], 'normal')
        cells['mar|7'], cells['lun|2'] = cells['lun|2'], None
        history['_overrides'] = overrides.propose(overrides.empty(), history, dict(
            teacher='normal', start='2026-10-20', end='2026-10-22', cells=cells, reset=False))[0]
        contexts = permit_context.versions(history, teacher_names.empty())
        for day, moved in [('2026-10-19', False), ('2026-10-20', True), ('2026-10-22', True), ('2026-10-23', False)]:
            context = next(v['dataset'] for v in reversed(contexts) if not v['effective'] or v['effective'] <= day)
            self.assertEqual(7 in context['hours']['normal'].get('mar', []), moved)
            self.assertEqual(2 in context['hours']['normal'].get('lun', []), not moved)

    def test_projection_keeps_disabled_slots_and_exact_identity(self):
        dataset = dict(teachers={i: dict(id=i, name=i, code='', role='curricolare') for i in ('a', 'ab')}, lessons={
            'a|lun|2': dict(classes=[], activities=['POT'], disabled=True, site='centrale'),
            'a|mar|4': dict(classes=[], site='succursale'),
            'ab|lun|1': dict(classes=['1A'], site='unknown'),
        })
        context = permit_context.project(dataset, teacher_names.empty())
        self.assertEqual(context['hours']['a'], {'lun': [2], 'mar': [4]})
        self.assertEqual(context['sites']['a'], ['centrale', 'succursale'])
        self.assertNotIn('ab', context['sites'])
