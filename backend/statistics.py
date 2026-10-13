"""Dated operational facts and reporting; no database or HTTP dependencies."""
from collections import Counter
from copy import deepcopy
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from .domain import HOURS, SITES, absences, lesson, validate_assignment

OUTCOMES = ('covered', 'uncovered', 'late', 'early', 'pending')
MANUAL = {'UNCOVERED': 'uncovered', 'ENTRA': 'late', 'ESCE': 'early'}


def empty():
    return dict(schema=1, days={})


def sync(ds, state, facts, days=None, reconstructed=False):
    """Refresh only affected dates, keeping context for unchanged absence slots."""
    result = deepcopy(facts)
    if days is None:
        days = set(state['abs']) | set(state.get('permessi', {})) | set(state['asg']) | set(facts['days'])
    for day in days:
        old = result['days'].get(day, {})
        slots = {}
        for teacher, hours in absences(state, day).items():
            for h in hours:
                key = f'{teacher}|{h}'
                context = old.get('absences', {}).get(key)
                if context is None:
                    l = lesson(ds, teacher, day, h)
                    context = dict(teacher=teacher, h=h, classes=l['classes'][:] if l else [],
                                   site=l.get('site') if l else None,
                                   provenance='reconstructed' if reconstructed else 'recorded')
                slots[key] = dict(context, manual=h in state['abs'].get(day, {}).get(teacher, []),
                                  permit=h in state.get('permessi', {}).get(day, {}).get(teacher, []))
        demands = {}
        for slot in slots.values():
            for cls in slot['classes']:
                if slot['h'] in state['cf'].get(day, {}).get(cls, []):
                    continue
                key = f"{slot['h']}|{cls}"
                row = demands.setdefault(key, dict(h=slot['h'], c=cls, ids=[], site=None))
                row['ids'].append(slot['teacher'])
        assignments = state['asg'].get(day, {})
        used = set()
        issues = []
        for key, row in demands.items():
            row['ids'].sort()
            canonical = row['ids'][0]
            row['site'] = slots[f"{canonical}|{row['h']}"]['site']
            row['key'] = f"{canonical}|{row['h']}|{row['c']}"
            a = assignments.get(row['key'])
            row.update(outcome='pending', assignment=deepcopy(a), eligible=True, valid=True)
            if a:
                used.add(row['key'])
                previous = old.get('demand', {}).get(key)
                # A replacement timetable cannot invalidate previously captured cover.
                if previous and previous.get('assignment') == a:
                    row['eligible'] = previous['eligible']
                else:
                    try:
                        validate_assignment(ds, state, day, row['key'], a['v'], exceptional=True, saved=True)
                    except ValueError:
                        row['eligible'] = False
                row['valid'] = row['eligible']
                if a['v'] not in (*MANUAL, 'DIR'):
                    absent = row['h'] in absences(state, day).get(a['v'], [])
                    booked = any(k != row['key'] and int(k.split('|')[1]) == row['h'] and v['v'] == a['v'] for k, v in assignments.items())
                    if absent or booked:
                        row['valid'] = False
                if row['valid']:
                    row['outcome'] = MANUAL.get(a['v'], 'covered')
                else:
                    issues.append(row['key'])
        issues.extend(k for k in assignments if k not in used)
        if slots or assignments:
            result['days'][day] = dict(absences=slots, demand=demands, issues=sorted(issues))
        else:
            result['days'].pop(day, None)
    return result


def validate(facts, ds, state):
    """Validate saved context and derived values without using today's timetable."""
    try:
        if not isinstance(facts, dict) or set(facts) != {'schema', 'days'} or type(facts['schema']) is not int or facts['schema'] != 1 or not isinstance(facts['days'], dict):
            raise ValueError()
        expected = {(d, f'{i}|{h}') for d in set(state['abs']) | set(state.get('permessi', {}))
                    for i, hours in absences(state, d).items() for h in hours}
        actual = set()
        for d, day in facts['days'].items():
            if date.fromisoformat(d).isoformat() != d or set(day) != {'absences', 'demand', 'issues'}:
                raise ValueError()
            for k, slot in day['absences'].items():
                if set(slot) != {'teacher', 'h', 'classes', 'site', 'provenance', 'manual', 'permit'}:
                    raise ValueError()
                if slot['teacher'] not in ds['teachers'] or type(slot['h']) is not int or slot['h'] not in HOURS or k != f"{slot['teacher']}|{slot['h']}":
                    raise ValueError()
                if slot['site'] not in (*SITES, None) or slot['provenance'] not in ('recorded', 'reconstructed'):
                    raise ValueError()
                if not isinstance(slot['classes'], list) or len(set(slot['classes'])) != len(slot['classes']) or any(not isinstance(c, str) or not c or '|' in c for c in slot['classes']):
                    raise ValueError()
                if any(type(slot[s]) is not bool for s in ('manual', 'permit')):
                    raise ValueError()
                actual.add((d, k))
            for row in day['demand'].values():
                if type(row.get('valid')) is not bool or type(row.get('eligible')) is not bool or row.get('outcome') not in OUTCOMES:
                    raise ValueError()
        if expected != actual or sync(ds, state, facts) != facts:
            raise ValueError()
    except (ValueError, TypeError, KeyError, AttributeError, IndexError):
        raise ValueError('Fatti statistici non validi o incoerenti con l’archivio.') from None
    return facts


def report(facts, campus='total', period='all', start=None, end=None, today=None):
    today = today or datetime.now(ZoneInfo('Europe/Rome')).date()
    if campus not in ('total', *SITES) or period not in ('all', 'week', 'month', 'custom'):
        raise ValueError('Filtro statistiche non valido.')
    dates = sorted(d for d, f in facts['days'].items() if f['absences'] and d <= today.isoformat())
    if period == 'custom':
        if start is None or end is None or start > end:
            raise ValueError('Seleziona un intervallo di date valido.')
    else:
        start = (today - timedelta(days=today.weekday()) if period == 'week' else
                 today.replace(day=1) if period == 'month' else date.fromisoformat(dates[0]) if dates else today)
        end = today
    dates = [d for d in dates if start.isoformat() <= d <= end.isoformat()]
    types = Counter()
    classes = Counter()
    unknown = dict(teacherHours=0, demand=0)
    provenance = Counter()
    issues = 0
    exceptional = 0
    daily = []
    hour_counts = {h: Counter() for h in HOURS}
    cells = {(w, h): Counter() for w in range(7) for h in HOURS}
    observations = {(w, h): [] for w in range(7) for h in HOURS}
    for d in dates:
        f = facts['days'][d]
        all_slots = list(f['absences'].values())
        all_rows = list(f['demand'].values())
        unknown['teacherHours'] += sum(s['site'] is None for s in all_slots)
        unknown['demand'] += sum(r['site'] is None for r in all_rows)
        slots = [s for s in all_slots if campus == 'total' or s['site'] == campus]
        rows = [r for r in all_rows if campus == 'total' or r['site'] == campus]
        provenance.update(s['provenance'] for s in slots)
        issues += len(f['issues'])
        count = dict(date=d, teachers=len({s['teacher'] for s in slots}), teacherHours=len(slots), demand=len(rows),
                     **{o: sum(r['outcome'] == o for r in rows) for o in OUTCOMES})
        daily.append(count)
        weekday = date.fromisoformat(d).weekday()
        for h in HOURS:
            selected = [s for s in slots if s['h'] == h]
            counts = dict(teachers=len({s['teacher'] for s in selected}), teacherHours=len(selected),
                          demand=sum(r['h'] == h for r in rows))
            hour_counts[h].update(counts)
            cells[weekday, h].update(counts)
            observations[weekday, h].append(dict(date=d, **counts))
        for r in rows:
            classes[r['c']] += 1
            if r['outcome'] == 'covered':
                types[r['assignment']['t']] += 1
                exceptional += bool(r['assignment'].get('exceptional'))
    metrics = ('teachers', 'teacherHours', 'demand', *OUTCOMES)
    totals = {k: sum(d[k] for d in daily) for k in metrics}
    average = lambda n, denominator: n / denominator if denominator else None
    weekdays = []
    heatmap = []
    for w in range(7):
        days = [d for d in daily if date.fromisoformat(d['date']).weekday() == w]
        weekdays.append(dict(weekday=w, days=len(days), **{k: average(sum(d[k] for d in days), len(days)) for k in metrics}))
        for h in HOURS:
            heatmap.append(dict(weekday=w, hour=h, days=len(days), observations=observations[w, h], **{k: average(cells[w, h][k], len(days)) for k in ('teachers', 'teacherHours', 'demand')}))
    return dict(campus=campus, period=period, start=start.isoformat(), end=end.isoformat(), days=len(dates),
                totals=totals, averages={k: average(v, len(dates)) for k, v in totals.items()},
                coverage=average(totals['covered'] * 100, totals['demand']), daily=daily, weekdays=weekdays,
                hours=[dict(hour=h, **{k: average(hour_counts[h][k], len(dates)) for k in ('teachers', 'teacherHours', 'demand')}) for h in HOURS],
                heatmap=heatmap, types=dict(types), exceptional=exceptional,
                classes=[dict(name=c, demand=n) for c, n in classes.most_common()],
                worst=sorted(daily, key=lambda d: (-d['demand'], d['date']))[:10],
                unknown=unknown, provenance=dict(provenance), issues=issues)
