"""Personal identities and dated cattedra ownership; no storage side effects."""
from copy import deepcopy
from datetime import date, timedelta
from .hour_types import activity_codes


def empty():
    return dict(schema=1, people={}, sources={}, absences=[], appointments=[])


def catalog(history):
    result = {i: t for v in history['versions'] for i, t in v['dataset']['teachers'].items()}
    result.update(history.get('_appointments', empty())['people'])
    return result


def active(record, day):
    return record['start'] <= day and (not record['end'] or day <= record['end'])


def overlaps(a, b):
    return a['start'] <= (b['end'] or '9999-12-31') and b['start'] <= (a['end'] or '9999-12-31')


def iso(value):
    if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
        raise ValueError('Data non valida.')
    return value


def validate(document, history):
    try:
        if not isinstance(document, dict) or set(document) != set(empty()) or type(document['schema']) is not int or document['schema'] != 1:
            raise ValueError()
        if not isinstance(document['people'], dict) or not isinstance(document['sources'], dict):
            raise ValueError()
        imported = {i: t for v in history['versions'] for i, t in v['dataset']['teachers'].items()}
        people = {**imported, **document['people']}
        for i, t in document['people'].items():
            if not isinstance(i, str) or not i or '|' in i or not isinstance(t, dict) or set(t) != {'id', 'name', 'code', 'role', 'classe_concorso'} or t['id'] != i:
                raise ValueError()
            if any(not isinstance(v, str) or len(v) > 200 or any(ord(c) < 32 for c in v) for v in t.values()) or not t['name'].strip() or t['name'] != t['name'].strip():
                raise ValueError()
        for source, person in document['sources'].items():
            if source not in imported or not isinstance(person, str) or person not in people:
                raise ValueError()
        for group, field in [('absences', 'person'), ('appointments', 'source')]:
            records = document[group]
            if not isinstance(records, list): raise ValueError()
            ids = set()
            for r in records:
                fields = {'id', field, 'start', 'end'} | ({'person'} if group == 'appointments' else set())
                if not isinstance(r, dict) or set(r) != fields or not isinstance(r['id'], str) or not r['id'] or r['id'] in ids:
                    raise ValueError()
                ids.add(r['id'])
                iso(r['start'])
                if r['end'] is not None and iso(r['end']) < r['start']: raise ValueError()
                if not isinstance(r['person'], str) or r['person'] not in people or group == 'appointments' and r['source'] not in imported:
                    raise ValueError()
            for n, r in enumerate(records):
                for other in records[n + 1:]:
                    if overlaps(r, other) and (r[field] == other[field] or group == 'appointments' and r['person'] == other['person']):
                        raise ValueError('Periodi sovrapposti.')
        for n, r in enumerate(document['appointments']):
            for other in document['appointments'][n + 1:]:
                if overlaps(r, other) and document['sources'].get(r['source'], r['source']) == document['sources'].get(other['source'], other['source']):
                    raise ValueError('Periodi sovrapposti sulla stessa cattedra.')
        for v in history['versions']:
            owners = {}
            for source in {k.split('|')[0] for k in v['dataset']['lessons']}:
                person = document['sources'].get(source, source)
                if person in owners:
                    raise ValueError('Sorgenti duplicate per la stessa persona: riconciliare prima l’importazione.')
                owners[person] = source
        for r in document['appointments']:
            original = document['sources'].get(r['source'], r['source'])
            if original == r['person']: raise ValueError('Il supplente deve essere una persona distinta.')
            for v in history['versions']:
                # Verify each version whose effective interval intersects this appointment.
                n = history['versions'].index(v)
                end = history['versions'][n + 1]['effective'] if n + 1 < len(history['versions']) else None
                if end and end <= r['start'] or r['end'] and v['effective'] and v['effective'] > r['end']: continue
                for k in v['dataset']['lessons']:
                    source = k.split('|')[0]
                    if source != r['source'] and document['sources'].get(source, source) == r['person']:
                        raise ValueError('Il supplente ha già un orario autonomo: riconciliare la sorgente prima di assegnarlo.')
        return document
    except (KeyError, TypeError, AttributeError):
        raise ValueError('Anagrafica o periodi di supplenza non validi.') from None


def resolve(ds, document, day):
    if document == empty(): return ds
    result = deepcopy(ds)
    teachers = result['teachers']
    teachers.update({i: dict(deepcopy(t), managedPerson=True) for i, t in document['people'].items()})
    mapping = document['sources']
    owners = {mapping.get(r['source'], r['source']): r for r in document['appointments'] if active(r, day)}
    managed = {r['person'] for r in document['appointments']}
    originals = set(owners)
    current = {r['person'] for r in owners.values()}
    scheduled = {mapping.get(k.split('|')[0], k.split('|')[0]) for k in ds['lessons']}
    absent = {r['person'] for r in document['absences'] if active(r, day)}
    for i, t in teachers.items():
        if i in mapping and mapping[i] != i:
            t['retired'] = True
            t['unavailable'] = True
        if i in document['people']:
            t['retired'] = i not in current and i not in scheduled
        if i in managed and i not in current and i not in scheduled or i in originals or i in absent:
            t['unavailable'] = True
        if i in originals:
            t['coveredBy'] = owners[i]['person']
            t['staffingPeriod'] = owners[i]
        if i in absent:
            t['continuousAbsence'] = True
            if not t.get('staffingPeriod'):
                t['staffingPeriod'] = next(r for r in document['absences'] if r['person'] == i and active(r, day))
    lessons, excluded = {}, {}
    for key, l in ds['lessons'].items():
        source, slot = key.split('|', 1)
        r = owners.get(mapping.get(source, source))
        person = r['person'] if r else mapping.get(source, source)
        value = deepcopy(l)
        if r:
            original = mapping.get(source, source)
            teachers[person].update(retired=False, replaces=original, staffingPeriod=r)
            if 'POT' in activity_codes(l):
                excluded[f'{person}|{slot}'] = deepcopy(l)
                codes = [c for c in activity_codes(l) if c != 'POT']
                if not codes: continue
                value.update(activities=codes, special=next((c for c in codes if c in ('UTC', 'UTS', 'DIS')), ''), activityLabels=codes)
        target = f'{person}|{slot}'
        if target in lessons: raise ValueError('Orari sovrapposti: riconciliare le sorgenti.')
        lessons[target] = value
    result.update(lessons=lessons, excludedPOT=excluded, staffing=True)
    return result


def derived(ds, day):
    from .domain import DAYS
    weekday = DAYS[date.fromisoformat(day).weekday()]
    result = {i: sorted(int(k.rsplit('|', 1)[1]) for k in ds['lessons'] if k.startswith(f'{i}|{weekday}|'))
            for i, t in ds['teachers'].items() if t.get('continuousAbsence') and not t.get('coveredBy') and not t.get('retired')}
    return {i: hours for i, hours in result.items() if hours}


def boundaries(history):
    doc = history.get('_appointments', empty())
    days = {v['effective'] for v in history['versions'] if v['effective']}
    for r in doc['appointments'] + doc['absences']:
        days.add(r['start'])
        if r['end'] and r['end'] < '9999-12-31': days.add((date.fromisoformat(r['end']) + timedelta(days=1)).isoformat())
    for r in history.get('_overrides', {}).get('records', []):
        days.add(r['start'])
        if r['end'] and r['end'] < '9999-12-31': days.add((date.fromisoformat(r['end']) + timedelta(days=1)).isoformat())
    return sorted(days)


def timetable_versions(history):
    from . import timetables
    return [dict(effective=d, dataset=timetables.dataset(history, d or '0001-01-01')) for d in [None, *boundaries(history)]]


def absence_dates(history, through):
    days = set()
    for r in history.get('_appointments', empty())['absences']:
        start, end = date.fromisoformat(r['start']), min(date.fromisoformat(r['end'] or through), date.fromisoformat(through))
        while start <= end:
            if start.weekday() < 5: days.add(start.isoformat())
            start += timedelta(days=1)
    return days


def affected_assignments(before, after, state, day):
    from .domain import rows
    assignments = state['asg'].get(day, {})
    if not assignments:
        return set()
    changed = {i for i in before['teachers'].keys() | after['teachers'].keys()
               if before['teachers'].get(i) != after['teachers'].get(i)}
    changed.update(k.split('|')[0] for k in before['lessons'].keys() | after['lessons'].keys()
                   if before['lessons'].get(k) != after['lessons'].get(k))
    old_rows = {r['k']: r for r in rows(before, state, day)}
    new_rows = {r['k']: r for r in rows(after, state, day)}
    return {k for k, a in assignments.items() if a['v'] in changed or old_rows.get(k) != new_rows.get(k)}


def preview(history, state, facts, document, day):
    """Compare saved activity; a staffing edit never rewrites operational ownership."""
    from . import timetables, paid
    validate(document, history)
    proposed = dict(history, _appointments=document)
    before_dataset, after_dataset = timetables.resolver(history), timetables.resolver(proposed)
    problems, records = [], []
    removed = set(catalog(history)) - set(catalog(proposed))
    for group in ('manualPermits', 'manualPermitNotes'):
        if any(i in removed for i in state.get(group, {})):
            raise ValueError('La modifica eliminerebbe una persona con dati personali.')
    for group in ('abs', 'permessi', 'dis', 'paidAvailability'):
        if any(i in removed for entries in state.get(group, {}).values() for i in entries):
            raise ValueError('La modifica eliminerebbe una persona con registrazioni.')
    for entries in state['asg'].values():
        for key, a in entries.items():
            if key.split('|')[0] in removed or a['v'] in removed:
                raise ValueError('La modifica eliminerebbe una persona con assegnazioni.')
    dates = set(timetables.dates(state, facts))
    for d in sorted(dates):
        before, after = before_dataset(d), after_dataset(d)
        if before == after:
            continue
        changed = {i for i in after['teachers'] if before['teachers'].get(i) != after['teachers'][i]}
        for key, a in state['asg'].get(d, {}).items():
            if a['v'] in changed or key.split('|')[0] in changed:
                records.append(dict(day=d, key=key, group='asg', person=key.split('|')[0], substitute=a['v'], hours=[int(key.split('|')[1])]))
            if a['v'] in changed and after['teachers'][a['v']].get('unavailable'):
                _, hour, cls = key.split('|')
                problems.append(dict(day=d, key=key, message=f"{after['teachers'][a['v']]['name']}: copertura della classe {cls}, ora {hour}, incompatibile con l’assenza prolungata o la supplenza nel periodo."))
        affected = affected_assignments(before, after, state, d)
        old = timetables.issues(before, state, d, keys=affected)
        for item in timetables.issues(after, state, d, keys=affected):
            if item not in old and not any(p['day'] == d and p['key'] == item['key'] for p in problems):
                problems.append(dict(day=d, **item))
        for group in ('abs', 'permessi', 'dis'):
            for i, hours in state.get(group, {}).get(d, {}).items():
                keys = [f'{i}|{weekday}|{h}' for weekday in ('lun','mar','mer','gio','ven') for h in hours]
                if i in changed or any(before['lessons'].get(k) != after['lessons'].get(k) for k in keys):
                    records.append(dict(day=d, group=group, person=i, hours=hours))
                    # Personal historical permits remain readable; no schedule revalidation.
                    if group == 'dis' and after['teachers'].get(i, {}).get('unavailable'):
                        problems.append(dict(day=d, key=i, message='Disponibilità manuale incompatibile: risolvere prima la registrazione.'))
    # Verify imports and recurring declarations at every effective boundary and weekday.
    for start in sorted(set([day, *boundaries(proposed)])):
        for n in range(7):
            d = (date.fromisoformat(start) + timedelta(days=n)).isoformat()
            ds = after_dataset(d)
            if date.fromisoformat(d).weekday() > 4: continue
            for source, r in {r['source']: r for r in document['appointments'] if active(r, d)}.items():
                original = document['sources'].get(source, source)
                raw = timetables.version(proposed, d)['dataset']
                matches = [s for s in raw['teachers'] if document['sources'].get(s, s) == original]
                if len(matches) != 1:
                    problems.append(dict(day=d, key=source, message='Sorgente mancante o duplicata: abbinare gli ID importati in Amministrazione.'))
            before = before_dataset(d)
            for i in state.get('paidAvailability', {}).get(str(date.fromisoformat(d).weekday()), {}):
                if ds['teachers'].get(i, {}).get('unavailable') and not before['teachers'].get(i, {}).get('unavailable'):
                    problems.append(dict(day=d, key=i, message='Disponibilità a pagamento incompatibile: risolvere prima la dichiarazione.'))
    review_people = set(document['people']) | set(document['sources'].values())
    for i in review_people:
        if i in state.get('manualPermits', {}): records.append(dict(day=None, group='manualPermits', person=i, hours=state['manualPermits'][i]['hours']))
    ds = after_dataset(day)
    conflicts = {(p['day'], p['key']) for p in problems}
    records = [r for r in records if (r['day'], r.get('key')) not in conflicts]
    return dict(ready=not problems, issues=problems, records=records, dataset=ds, document=document)
