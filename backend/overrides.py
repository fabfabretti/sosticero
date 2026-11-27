"""Validated dated timetable patches; imports have no database side effects."""
from collections import Counter
from copy import deepcopy
from datetime import date
from uuid import uuid4
from .domain import DAYS as WEEKDAYS, HOURS, activity_codes, class_commitment, SITES, CLASS_ACTIVITIES

DAYS = WEEKDAYS[:5]


def empty():
    return dict(schema=1, records=[], evidence=[])


def iso(value):
    if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
        raise ValueError('Data modifica non valida.')
    return value


def special(value):
    return isinstance(value, dict) and (not value.get('classes') or value.get('disabled') and class_commitment(value)) and bool(activity_codes(value))


def support(value, role):
    return role == 'sostegno' and isinstance(value, dict) and bool(value.get('classes')) and not activity_codes(value)


def editable(value, role):
    return special(value) or support(value, role)


def clean(value, role=None):
    if not value:
        return None
    result = {k: v for k, v in value.items() if k != 'disabled'}
    if activity_codes(value) in ([code] for code in CLASS_ACTIVITIES):
        result.pop('site', None)
    if value.get('disabled') and class_commitment(value) or support(value, role):
        result['classes'] = []
    if support(value, role):
        result.pop('site', None)
    return result


def signature(value, role=None):
    import json
    return json.dumps(clean(value, role), sort_keys=True)


def cells(ds, teacher):
    return {f'{d}|{h}': deepcopy(ds['lessons'].get(f'{teacher}|{d}|{h}')) for d in DAYS for h in HOURS}


def groups(base, target, classes=None, role=None):
    if not isinstance(target, dict) or set(target) != set(base):
        raise ValueError('Invia tutte le celle del docente.')
    changed = set()
    for key, value in target.items():
        if value == base[key]:
            continue
        if (base[key] is not None and not editable(base[key], role)) or (value is not None and not editable(value, role)):
            raise ValueError('Si possono modificare solo attività speciali e lezioni di sostegno.')
        if support(value, role) and value.get('disabled'):
            raise ValueError('Le ore di sostegno non possono essere disabilitate.')
        if value and 'disabled' in value and type(value['disabled']) is not bool:
            raise ValueError('Stato ora non valido.')
        if value and (support(value, role) or activity_codes(value) in ([code] for code in CLASS_ACTIVITIES)) and value.get('site') not in (*SITES, None):
            raise ValueError('Sede attività non valida.')
        if value and value.get('classes'):
            cs = value['classes']
            unchanged_classes = support(value, role) and any(support(v, role) and v['classes'] == cs and signature(v, role) == signature(value, role) for v in base.values())
            if not unchanged_classes and (not isinstance(cs, list) or len(cs) != 1 or not isinstance(cs[0], str) or (classes is not None and cs[0] not in classes)):
                raise ValueError('Classe attività non valida.')
        changed.add(key)
    if Counter(signature(v, role) for v in base.values() if editable(v, role)) != Counter(signature(v, role) for v in target.values() if editable(v, role)):
        raise ValueError('Le ore e le attività devono essere conservate.')
    # Connect all cells sharing moved payloads, including identical activities.
    result = []
    while changed:
        connected = {changed.pop()}
        while True:
            payloads = {signature(v, role) for k in connected for v in (base[k], target[k]) if v}
            linked = {k for k in changed if any(v and signature(v, role) in payloads for v in (base[k], target[k]))}
            if not linked:
                break
            connected |= linked
            changed -= linked
        result.append(dict(before={k: base[k] for k in sorted(connected)}, after={k: target[k] for k in sorted(connected)}, conflicts=[]))
    return result


def full_groups(base, target, classes, codes, role=None, links=None, rules=None, preserved_classes=()):
    """Validate normalized cells and build patches against the imported week."""
    if not isinstance(target, dict) or set(target) != set(base):
        raise ValueError('Invia tutte le celle del docente.')
    from .timetables import validate_dataset
    for value in target.values():
        if value is None:
            continue
        if not isinstance(value, dict) or ('disabled' in value and type(value['disabled']) is not bool):
            raise ValueError('Stato ora non valido.')
        lesson = {k: v for k, v in value.items() if k != 'disabled'}
        cs = lesson.get('classes')
        if not isinstance(cs, list) or any(not isinstance(c, str) or c not in classes for c in cs):
            raise ValueError('Classe attività non valida.')
        if len(cs) > 1 and cs not in preserved_classes and not any(v and v.get('classes') == cs for v in base.values()):
            raise ValueError('Classe attività non valida.')
        if not isinstance(lesson.get('activities', []), list) or any(not isinstance(c, str) or c not in codes for c in activity_codes(lesson)):
            raise ValueError('Tipo ora non valido.')
        if not cs and not activity_codes(lesson):
            raise ValueError('Seleziona una classe o un tipo di attività.')
        if value.get('disabled') and rules is not None:
            keys = ['code:' + c for c in activity_codes(lesson)] or ['derived:support' if role == 'sostegno' else 'derived:itp' if (role or '').upper() == 'ITP' else 'derived:lesson']
            if not all(rules.get(k, {}).get('available', False) for k in keys):
                raise ValueError('Questo tipo di ora non è disponibile per supplenze.')
        teacher = dict(id='teacher', name='teacher', code='', role='curricolare', classe_concorso='')
        validate_dataset(dict(teachers={'teacher': teacher}, lessons={'teacher|lun|1': lesson}, classes=sorted(set(cs)), warnings=[]))
    changed = {k for k in base if base[k] != target[k]}
    if links is not None and (not isinstance(links, list) or any(not isinstance(link, list) or len(link) < 2 or any(not isinstance(k, str) or k not in base for k in link) or len(set(link)) != len(link) for link in links)):
        raise ValueError('Collegamenti tra ore non validi.')
    result = []
    while changed:
        connected = {changed.pop()}
        traversed = set(connected)
        while True:
            if links is None:
                payloads = {signature(v, role) for k in connected for v in (base[k], target[k]) if v}
                linked = {k for k in changed if any(v and signature(v, role) in payloads for v in (base[k], target[k]))}
            else:
                neighbours = {k for link in links if traversed.intersection(link) for k in link} - traversed
                traversed |= neighbours
                linked = neighbours & changed
                if neighbours and not linked:
                    continue
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


def blocked(group, version, ds, teacher, legacy=True):
    suspended = any(v['effective'] is None or v['effective'] <= (version['effective'] or '') for v in group['conflicts'])
    needs_support = any(support(v, 'sostegno') for v in group['before'].values())
    wrong_role = legacy and needs_support and ds['teachers'].get(teacher, {}).get('role') != 'sostegno'
    return suspended or wrong_role or teacher not in ds['teachers'] or any(ds['lessons'].get(f'{teacher}|{k}') != v for k, v in group['before'].items())


def apply(document, version, ds, day):
    result = dict(ds, lessons=dict(ds['lessons']))
    for teacher in ds['teachers']:
        record = selected(document, teacher, day)
        if not record or record['reset']:
            continue
        for group in record['groups']:
            if blocked(group, version, ds, teacher, record.get('format') != 2):
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
                conflict = blocked(group, version, version['dataset'], record['teacher'], record.get('format') != 2)
                if conflict and not any(c['id'] == version['id'] for c in group['conflicts']):
                    group['conflicts'].append(dict(id=version['id'], effective=version['effective']))
                report.append(dict(teacher=record['teacher'], start=record['start'], version=version['id'], group=index, review=bool(conflict)))
    return result, report


def propose(document, history, data, rules=None):
    from .timetables import version
    if set(data) - {'teacher', 'start', 'end', 'cells', 'reset', 'basis', 'token', 'links'}:
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
    codes = set(CLASS_ACTIVITIES) | {'UTC', 'UTS'} | {c for v in history['versions'] for lesson in v['dataset']['lessons'].values() for c in activity_codes(lesson)}
    codes |= {key[5:] for key in (rules or {}) if key.startswith('code:')}
    from .hour_types import merge_types
    rule_lessons = dict(imported['lessons'])
    if isinstance(data.get('cells'), dict):
        rule_lessons.update({f'edit-{k}': v for k, v in data['cells'].items() if isinstance(v, dict) and isinstance(v.get('activities', []), list) and all(isinstance(c, str) for c in v.get('activities', [])) and isinstance(v.get('special', ''), str)})
    known_rules = merge_types(dict(imported, lessons=rule_lessons), rules or {}) if rules is not None else None
    classes = {c for v in history['versions'] for c in v['dataset']['classes']}
    edits = [] if reset else full_groups(cells(imported, teacher), data.get('cells'), classes, codes, imported['teachers'][teacher]['role'], data.get('links'), known_rules)
    result = deepcopy(document)
    result['records'].append(dict(id=uuid4().hex, teacher=teacher, start=start, end=end, reset=reset, groups=edits, format=2))
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


def validate(document, history, rules=None):
    try:
        if not isinstance(document, dict) or set(document) != {'schema', 'records', 'evidence'} or type(document['schema']) is not int or document['schema'] != 1 or not isinstance(document['records'], list) or not isinstance(document['evidence'], list):
            raise ValueError()
        ids = set()
        catalog = {i for v in history['versions'] for i in v['dataset']['teachers']}
        versions = {v['id']: v for v in history['versions']}
        for r in document['records']:
            legacy = 'format' not in r
            if set(r) != ({'id', 'teacher', 'start', 'end', 'reset', 'groups'} if legacy else {'id', 'teacher', 'start', 'end', 'reset', 'groups', 'format'}) or (not legacy and (type(r['format']) is not int or r['format'] != 2)) or not isinstance(r['id'], str) or not r['id'] or r['id'] in ids or r['teacher'] not in catalog or type(r['reset']) is not bool or not isinstance(r['groups'], list):
                raise ValueError()
            ids.add(r['id'])
            iso(r['start'])
            if r['end'] is not None and iso(r['end']) < r['start'] or r['reset'] and (r['end'] is not None or r['groups']):
                raise ValueError()
            from .timetables import version
            teacher = version(history, r['start'])['dataset']['teachers'].get(r['teacher'])
            if teacher is None:
                teacher = next(v['dataset']['teachers'][r['teacher']] for v in reversed(history['versions']) if r['teacher'] in v['dataset']['teachers'])
            used = set()
            for g in r['groups']:
                if set(g) != {'before', 'after', 'conflicts'} or not isinstance(g['before'], dict) or not g['before'] or set(g['before']) != set(g['after']) or used & set(g['before']) or set(g['before']) - {f'{d}|{h}' for d in DAYS for h in HOURS}:
                    raise ValueError()
                used |= set(g['before'])
                if legacy and any(v is not None and not editable(v, teacher['role']) for v in g['before'].values()):
                    raise ValueError()
                classes = {c for v in history['versions'] for c in v['dataset']['classes']} | {c for lesson in g['before'].values() if lesson for c in lesson.get('classes', [])}
                codes = set(CLASS_ACTIVITIES) | {'UTC', 'UTS'} | {c for v in history['versions'] for lesson in v['dataset']['lessons'].values() for c in activity_codes(lesson)} | {c for lesson in g['before'].values() if lesson for c in activity_codes(lesson)}
                codes |= {key[5:] for key in (rules or {}) if key.startswith('code:')}
                preserved_classes = [lesson['classes'] for v in history['versions'] for lesson in v['dataset']['lessons'].values() if lesson.get('classes')]
                rebuilt = groups(g['before'], g['after'], classes, teacher['role']) if legacy else full_groups(g['before'], g['after'], classes, codes, teacher['role'], preserved_classes=preserved_classes)
                if not rebuilt or any(c != dict(id=c['id'], effective=versions[c['id']]['effective']) for c in g['conflicts']):
                    raise ValueError()
                # A legacy restore can replace the imported basis; validate detached originals too.
                from .timetables import validate_dataset
                validate_dataset(dict(teachers={r['teacher']: teacher}, lessons={f"{r['teacher']}|{k}": v for k, v in g['before'].items() if v is not None}, classes=sorted({c for lesson in g['before'].values() if lesson for c in lesson.get('classes', [])}), warnings=[]))
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
