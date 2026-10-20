"""Validated dated special-hour patches; imports have no database side effects."""
from collections import Counter
from copy import deepcopy
from datetime import date
from uuid import uuid4
from .domain import DAYS as WEEKDAYS, HOURS, activity_codes, class_commitment, SITES

DAYS = WEEKDAYS[:5]


def empty():
    return dict(schema=1, records=[], evidence=[])


def iso(value):
    if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
        raise ValueError('Data modifica non valida.')
    return value


def special(value):
    return isinstance(value, dict) and (not value.get('classes') or class_commitment(value)) and bool(activity_codes(value))


def clean(value):
    if not value:
        return None
    result = {k: v for k, v in value.items() if k != 'disabled'}
    if activity_codes(value) in (['POT'], ['ALF']):
        result.pop('site', None)
    if class_commitment(value):
        result['classes'] = []
    return result


def signature(value):
    import json
    return json.dumps(clean(value), sort_keys=True)


def cells(ds, teacher):
    return {f'{d}|{h}': deepcopy(ds['lessons'].get(f'{teacher}|{d}|{h}')) for d in DAYS for h in HOURS}


def groups(base, target, classes=None):
    if not isinstance(target, dict) or set(target) != set(base):
        raise ValueError('Invia tutte le celle del docente.')
    changed = set()
    for key, value in target.items():
        if value == base[key]:
            continue
        if (base[key] is not None and not special(base[key])) or (value is not None and not special(value)):
            raise ValueError('Le lezioni con classi non possono essere modificate.')
        if value and 'disabled' in value and type(value['disabled']) is not bool:
            raise ValueError('Stato ora non valido.')
        if value and activity_codes(value) in (['POT'], ['ALF']) and value.get('site') not in (*SITES, None):
            raise ValueError('Sede attività non valida.')
        if value and value.get('classes'):
            cs = value['classes']
            if not isinstance(cs, list) or len(cs) != 1 or not isinstance(cs[0], str) or (classes is not None and cs[0] not in classes):
                raise ValueError('Classe attività non valida.')
        changed.add(key)
    if Counter(signature(v) for v in base.values() if special(v)) != Counter(signature(v) for v in target.values() if special(v)):
        raise ValueError('Le attività e le sedi devono essere conservate.')
    # Connect all cells sharing moved payloads, including identical activities.
    result = []
    while changed:
        connected = {changed.pop()}
        while True:
            payloads = {signature(v) for k in connected for v in (base[k], target[k]) if v}
            linked = {k for k in changed if any(v and signature(v) in payloads for v in (base[k], target[k]))}
            if not linked:
                break
            connected |= linked
            changed -= linked
        result.append(dict(before={k: base[k] for k in sorted(connected)}, after={k: target[k] for k in sorted(connected)}, conflicts=[]))
    return result


def selected(document, teacher, day):
    records = [r for r in document['records'] if r['teacher'] == teacher]
    latest = {}
    for r in records:
        latest[r['start']] = r
    reset = max((r['start'] for r in latest.values() if r['reset'] and r['start'] <= day), default='')
    applicable = [r for r in latest.values() if reset <= r['start'] <= day and (r['end'] is None or day <= r['end'])]
    return max(applicable, key=lambda r: r['start'], default=None)


def blocked(group, version, ds, teacher):
    suspended = any(v['effective'] is None or v['effective'] <= (version['effective'] or '') for v in group['conflicts'])
    return suspended or teacher not in ds['teachers'] or any(ds['lessons'].get(f'{teacher}|{k}') != v for k, v in group['before'].items())


def apply(document, version, ds, day):
    result = dict(ds, lessons=dict(ds['lessons']))
    for teacher in ds['teachers']:
        record = selected(document, teacher, day)
        if not record or record['reset']:
            continue
        for group in record['groups']:
            if blocked(group, version, ds, teacher):
                continue
            for key, value in group['after'].items():
                slot = f'{teacher}|{key}'
                if value is None:
                    result['lessons'].pop(slot, None)
                else:
                    result['lessons'][slot] = deepcopy(value)
    return result


def reconcile(document, history):
    result = deepcopy(document)
    report = []
    for record in result['records']:
        for version in history['versions']:
            start = version['effective'] or ''
            following = next((v['effective'] for v in history['versions'] if v['effective'] and v['effective'] > start), None)
            if (record['end'] and start > record['end']) or (following and following <= record['start']):
                continue
            for index, group in enumerate(record['groups']):
                conflict = blocked(group, version, version['dataset'], record['teacher'])
                if conflict and not any(c['id'] == version['id'] for c in group['conflicts']):
                    group['conflicts'].append(dict(id=version['id'], effective=version['effective']))
                report.append(dict(teacher=record['teacher'], start=record['start'], version=version['id'], group=index, review=bool(conflict)))
    return result, report


def propose(document, history, data):
    from .timetables import version
    if set(data) - {'teacher', 'start', 'end', 'cells', 'reset', 'basis', 'token'}:
        raise ValueError('Campi modifica non validi.')
    teacher, start, end = data.get('teacher'), iso(data.get('start')), data.get('end')
    if end is not None and iso(end) < start:
        raise ValueError('La fine precede l’inizio.')
    imported = version(history, start)['dataset']
    if not isinstance(teacher, str) or teacher not in imported['teachers']:
        raise ValueError('Docente non presente nell’orario.')
    reset = data.get('reset', False)
    if type(reset) is not bool or (reset and end is not None):
        raise ValueError('Ripristino non valido.')
    edits = [] if reset else groups(cells(imported, teacher), data.get('cells'), imported['classes'])
    result = deepcopy(document)
    result['records'].append(dict(id=uuid4().hex, teacher=teacher, start=start, end=end, reset=reset, groups=edits))
    return reconcile(result, history)


def remove(document, data):
    if set(data) - {'teacher', 'start', 'id', 'basis', 'token', 'delete'} or data.get('delete') is not True:
        raise ValueError('Richiesta eliminazione non valida.')
    teacher, start, identifier = data.get('teacher'), iso(data.get('start')), data.get('id')
    latest = next((r for r in reversed(document['records']) if r['teacher'] == teacher and r['start'] == start), None)
    if not latest or latest['id'] != identifier:
        raise ValueError('Modifica non trovata o già aggiornata.')
    result = deepcopy(document)
    deleted = {r['id'] for r in result['records'] if r['teacher'] == teacher and r['start'] == start}
    result['records'] = [r for r in result['records'] if r['id'] not in deleted]
    result['evidence'] = [e for e in result['evidence'] if e['record'] not in deleted]
    return result, []


def validate(document, history):
    try:
        if not isinstance(document, dict) or set(document) != {'schema', 'records', 'evidence'} or type(document['schema']) is not int or document['schema'] != 1 or not isinstance(document['records'], list) or not isinstance(document['evidence'], list):
            raise ValueError()
        ids = set()
        catalog = {i for v in history['versions'] for i in v['dataset']['teachers']}
        versions = {v['id']: v for v in history['versions']}
        for r in document['records']:
            if set(r) != {'id', 'teacher', 'start', 'end', 'reset', 'groups'} or not isinstance(r['id'], str) or not r['id'] or r['id'] in ids or r['teacher'] not in catalog or type(r['reset']) is not bool or not isinstance(r['groups'], list):
                raise ValueError()
            ids.add(r['id'])
            iso(r['start'])
            if r['end'] is not None and iso(r['end']) < r['start'] or r['reset'] and (r['end'] is not None or r['groups']):
                raise ValueError()
            used = set()
            for g in r['groups']:
                if set(g) != {'before', 'after', 'conflicts'} or not isinstance(g['before'], dict) or not g['before'] or set(g['before']) != set(g['after']) or used & set(g['before']) or set(g['before']) - {f'{d}|{h}' for d in DAYS for h in HOURS}:
                    raise ValueError()
                used |= set(g['before'])
                if any(v is not None and not special(v) for v in g['before'].values()):
                    raise ValueError()
                rebuilt = groups(g['before'], g['after'], {c for v in history['versions'] for c in v['dataset']['classes']})
                if not rebuilt or any(c != dict(id=c['id'], effective=versions[c['id']]['effective']) for c in g['conflicts']):
                    raise ValueError()
                # A legacy restore can replace the imported basis; validate detached originals too.
                from .timetables import validate_dataset
                teacher = next(v['dataset']['teachers'][r['teacher']] for v in history['versions'] if r['teacher'] in v['dataset']['teachers'])
                validate_dataset(dict(teachers={r['teacher']: teacher}, lessons={f"{r['teacher']}|{k}": v for k, v in g['before'].items() if v is not None}, classes=[], warnings=[]))
        for evidence in document['evidence']:
            if set(evidence) != {'record', 'previous', 'assignments'} or evidence['record'] not in ids or not isinstance(evidence['previous'], dict) or not isinstance(evidence['assignments'], dict):
                raise ValueError()
            for day, fact in evidence['previous'].items():
                iso(day)
                if fact is not None:
                    from .timetables import validate_evidence_facts, dataset
                    validate_evidence_facts(fact, dataset(history, day))
            for day, entries in evidence['assignments'].items():
                iso(day)
                if day not in evidence['previous'] or not isinstance(entries, dict):
                    raise ValueError()
                for key, value in entries.items():
                    if not isinstance(value, dict) or key != f"{value['teacher']}|{value['h']}|{value['c']}" or value['teacher'] not in catalog or value['substitute'] not in catalog | {'DIR', 'ENTRA', 'ESCE', 'UNCOVERED'} or value['assignment']['v'] != value['substitute']:
                        raise ValueError()
    except (ValueError, KeyError, TypeError, AttributeError):
        raise ValueError('Modifiche orario non valide.') from None
    return document
