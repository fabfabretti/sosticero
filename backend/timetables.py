"""Date-effective timetables and import plans; no database side effects."""
from copy import deepcopy
from datetime import date, timedelta
from hashlib import sha256
import json

from .domain import normalize_dataset, lesson, rows, validate_assignment, HOURS, SITES
from . import statistics, overrides, receptions


def digest(value):
    return sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode()).hexdigest()


def baseline(ds):
    return dict(schema=1, versions=[dict(id=digest(ds), effective=None, dataset=deepcopy(ds))], corrections=[])


def version(history, day):
    return next(v for v in reversed(history['versions']) if v['effective'] is None or v['effective'] <= day)


def dataset(history, day):
    """Keep historical IDs addressable without making inactive teachers candidates."""
    chosen = version(history, day)
    active = overrides.apply(history.get('_overrides', overrides.empty()), chosen, chosen['dataset'], day)
    selected = dict(active, teachers=dict(active['teachers']))
    teachers = {}
    classes = set()
    for v in history['versions']:
        teachers.update(v['dataset']['teachers'])
        classes.update(v['dataset']['classes'])
    for i, teacher in teachers.items():
        if i not in selected['teachers']:
            selected['teachers'][i] = dict(teacher, retired=True)
    selected['classes'] = sorted(classes)
    selected['receptions'] = receptions.on_day(history.get('_receptions', receptions.empty()), day)
    return selected


def dates(state, facts):
    return sorted(set(facts['days']).union(*(set(v) for k, v in state.items() if k not in ('manualPermits', 'manualPermitNotes', 'paidAvailability'))))


def sync(history, state, facts, days=None, reconstructed=False, revalidate=False):
    result = deepcopy(facts)
    for day in days if days is not None else dates(state, facts):
        result = statistics.sync(dataset(history, day), state, result, [day], reconstructed=reconstructed, revalidate=revalidate)
    return result


def issues(ds, state, day, policies=None):
    result = []
    for key, a in state['asg'].get(day, {}).items():
        try:
            validate_assignment(ds, state, day, key, a['v'], policies, exceptional=bool(a.get('exceptional')), saved=True)
        except ValueError as exc:
            result.append(dict(key=key, message=str(exc)))
    return result


def context(history, state, day, key, facts, ds=None):
    ds = ds if ds is not None else dataset(history, day)
    teacher, h, cls = key.split('|')
    l = lesson(ds, teacher, day, int(h)) or {}
    slot = facts['days'].get(day, {}).get('absences', {}).get(f'{teacher}|{h}', {})
    a = state['asg'][day][key]
    return dict(teacher=teacher, teacherName=ds['teachers'][teacher]['name'], h=int(h), c=cls,
                site=slot.get('site', l.get('site')) or a.get('paidContext', {}).get('site'), substitute=a['v'],
                substituteName=ds['teachers'].get(a['v'], {}).get('name', a['v']), assignment=deepcopy(a))


def conflict_context(history, day, key, assignment):
    for correction in reversed(history.get('_overrides', overrides.empty())['evidence'] + history['corrections']):
        saved = correction['assignments'].get(day, {}).get(key)
        if saved and saved['assignment'] == assignment:
            return saved
    return None


def reference_issues(history, state, day):
    active = version(history, day)['dataset']
    messages = []
    for group in ('abs', 'permessi', 'dis', 'cf'):
        for identifier in state[group].get(day, {}):
            if identifier not in (active['classes'] if group == 'cf' else active['teachers']):
                messages.append(dict(group=group, id=identifier, message='Classe o docente non presente nella versione di orario attiva. Registrazione conservata.'))
    return messages


def plan(history, ds, effective, state, facts, policies):
    if effective and date.fromisoformat(effective).isoformat() != effective:
        raise ValueError('Data di decorrenza non valida.')
    if history and effective is None:
        raise ValueError('Seleziona la data di decorrenza e genera l’anteprima.')
    if history and any(v['effective'] == effective for v in history['versions']):
        raise ValueError('Esiste già una versione con questa decorrenza.')
    if not history:
        proposed = baseline(ds)
        return proposed, facts, dict(effective=effective, end=None, initial=True, days=[], added=list(ds['teachers']), removed=[], changedTeachers=[], changedLessons=len(ds['lessons']))
    proposed = deepcopy(history)
    new = dict(id=digest([effective, ds]), effective=effective, dataset=ds)
    proposed['versions'].append(new)
    proposed['versions'].sort(key=lambda v: v['effective'] or '')
    proposed['_overrides'], override_report = overrides.reconcile(proposed.get('_overrides', overrides.empty()), proposed)
    later = next((v['effective'] for v in proposed['versions'] if v['effective'] and v['effective'] > effective), None)
    affected = [d for d in dates(state, facts) if d >= effective and (later is None or d < later)]
    old_ds = version(history, effective)['dataset']
    result = deepcopy(facts)
    changes = []
    evidence = dict(version=new['id'], previous={}, assignments={})
    for day in affected:
        before = dataset(history, day)
        after = dataset(proposed, day)
        problems = issues(after, state, day, policies)
        evidence['previous'][day] = dict(version=version(history, day)['id'], facts=deepcopy(facts['days'].get(day)))
        evidence['assignments'][day] = {k: conflict_context(history, day, k, state['asg'][day][k]) or context(history, state, day, k, facts) for k in state['asg'].get(day, {})}
        # A timetable correction deliberately replaces snapshot context only in its interval.
        result['days'].pop(day, None)
        result = statistics.sync(after, state, result, [day])
        for item in problems:
            for demand in result['days'].get(day, {}).get('demand', {}).values():
                if demand['key'] == item['key']:
                    demand.update(eligible=False, valid=False, outcome='pending')
        if day in result['days']:
            result['days'][day]['issues'] = sorted(set(result['days'][day]['issues']) | {i['key'] for i in problems})
        old_rows = {r['k']: r for r in rows(before, state, day)}
        new_rows = {r['k']: r for r in rows(after, state, day)}
        changes.append(dict(day=day, before=list(old_rows.values()), after=list(new_rows.values()), issues=problems,
                            references=reference_issues(proposed, state, day)))
    proposed['corrections'].append(evidence)
    return proposed, result, dict(effective=effective, end=(date.fromisoformat(later)-timedelta(days=1)).isoformat() if later else None,
        initial=False, days=changes, overrides=override_report, added=sorted(set(ds['teachers'])-set(old_ds['teachers'])),
        removed=sorted(set(old_ds['teachers'])-set(ds['teachers'])),
        changedTeachers=sorted(i for i in set(ds['teachers']) & set(old_ds['teachers']) if ds['teachers'][i] != old_ds['teachers'][i]),
        changedLessons=sum(old_ds['lessons'].get(k) != ds['lessons'].get(k) for k in old_ds['lessons'].keys() | ds['lessons'].keys()))


def validate_dataset(ds):
    """Validate normalized archive data without silently accepting unknown fields."""
    if not isinstance(ds, dict) or set(ds) != {'teachers', 'lessons', 'classes', 'warnings'} or not isinstance(ds['teachers'], dict) or not isinstance(ds['lessons'], dict):
        raise ValueError('Dataset storico non valido.')
    teachers = []
    for i, t in ds['teachers'].items():
        if not isinstance(t, dict) or t.get('id') != i or set(t) - {'id', 'name', 'code', 'role', 'classe_concorso', 'retired'} or not all(isinstance(t.get(k), str) for k in ('name', 'code', 'role', 'classe_concorso')) or ('retired' in t and type(t['retired']) is not bool):
            raise ValueError('Anagrafica storica non valida.')
        teachers.append(dict(id=i, nome_originale=t['name'], sigla_untis=t['code'], ruolo=t['role'], classe_concorso=t['classe_concorso']))
    lessons = []
    for key, l in ds['lessons'].items():
        parts = key.split('|')
        if len(parts) != 3 or not isinstance(l, dict) or set(l) - {'classes', 'room', 'site', 'special', 'activities', 'activityLabels'}:
            raise ValueError('Lezione storica non valida.')
        if not isinstance(l.get('activityLabels', []), list) or any(not isinstance(v, str) for v in l.get('activityLabels', [])) or not isinstance(l.get('special', ''), str):
            raise ValueError('Attività storica non valida.')
        try:
            hour = int(parts[2])
        except ValueError:
            raise ValueError('Ora storica non valida.') from None
        if str(hour) != parts[2]:
            raise ValueError('Ora storica non valida.')
        lessons.append(dict(docente=parts[0], giorno=parts[1], ora=hour, classi=l.get('classes'), aula=l.get('room'), sede=l.get('site'), attivita_riconosciute=l.get('activities', [])))
    normalized = normalize_dataset(dict(docenti=teachers, orario=lessons, anomalie=ds['warnings']))
    for key, l in ds['lessons'].items():
        if not {'classes', 'room', 'site', 'special'} <= set(l):
            raise ValueError('Lezione storica incompleta.')
        if 'activities' in l and (l['activities'] != normalized['lessons'][key]['activities'] or l['special'] != normalized['lessons'][key]['special']):
            raise ValueError('Codici attività storici incoerenti.')
    if normalized['classes'] != ds['classes']:
        raise ValueError('Classi storiche non valide.')
    return ds


def validate(history):
    try:
        if not isinstance(history, dict) or set(history) != {'schema', 'versions', 'corrections'} or type(history['schema']) is not int or history['schema'] != 1 or not isinstance(history['versions'], list) or not history['versions'] or not isinstance(history['corrections'], list):
            raise ValueError()
        ids, effective = set(), []
        for n, v in enumerate(history['versions']):
            if not isinstance(v, dict) or set(v) != {'id', 'effective', 'dataset'} or not isinstance(v['id'], str) or not v['id'] or v['id'] in ids:
                raise ValueError()
            ids.add(v['id'])
            if n == 0:
                if v['effective'] is not None:
                    raise ValueError()
            elif not isinstance(v['effective'], str) or date.fromisoformat(v['effective']).isoformat() != v['effective']:
                raise ValueError()
            else:
                effective.append(v['effective'])
            validate_dataset(v['dataset'])
        if effective != sorted(set(effective)):
            raise ValueError()
        corrected = set()
        versions_by_id = {v['id']: v for v in history['versions']}
        for correction in history['corrections']:
            if not isinstance(correction, dict) or set(correction) != {'version', 'previous', 'assignments'} or correction['version'] not in ids or not isinstance(correction['previous'], dict) or not isinstance(correction['assignments'], dict):
                raise ValueError()
            if correction['version'] in corrected or versions_by_id[correction['version']]['effective'] is None:
                raise ValueError()
            corrected.add(correction['version'])
            if set(correction['assignments']) != set(correction['previous']):
                raise ValueError()
            for day, entry in correction['previous'].items():
                if date.fromisoformat(day).isoformat() != day or set(entry) != {'version', 'facts'} or entry['version'] not in ids:
                    raise ValueError()
                if versions_by_id[correction['version']]['effective'] > day or (versions_by_id[entry['version']]['effective'] or '') > day or correction['version'] == entry['version']:
                    raise ValueError()
                if entry['facts'] is not None:
                    validate_evidence_facts(entry['facts'], dataset(history, day))
            for day, entries in correction['assignments'].items():
                if day not in correction['previous'] or not isinstance(entries, dict):
                    raise ValueError()
                for key, c in entries.items():
                    if not isinstance(c, dict) or set(c) != {'teacher', 'teacherName', 'h', 'c', 'site', 'substitute', 'substituteName', 'assignment'} or key != f"{c['teacher']}|{c['h']}|{c['c']}" or type(c['h']) is not int or c['h'] not in HOURS or c['site'] not in (*SITES, None):
                        raise ValueError()
                    catalog = dataset(history, day)['teachers']
                    if c['teacher'] not in catalog or c['substitute'] not in (*catalog, 'DIR', 'ENTRA', 'ESCE', 'UNCOVERED') or not all(isinstance(c[k], str) for k in ('teacherName', 'substituteName', 'c')) or not isinstance(c['assignment'], dict) or c['assignment'].get('v') != c['substitute'] or c['assignment'].get('c') != c['c']:
                        raise ValueError()
        if corrected != {v['id'] for v in history['versions'][1:]}:
            raise ValueError()
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ValueError('Cronologia orari non valida o riferimenti storici incoerenti.') from None
    return history


def validate_evidence_facts(facts, ds):
    if not isinstance(facts, dict) or set(facts) != {'absences', 'demand', 'issues'} or not isinstance(facts['absences'], dict) or not isinstance(facts['demand'], dict) or not isinstance(facts['issues'], list):
        raise ValueError('Fatti storici non validi.')
    for key, slot in facts['absences'].items():
        if not isinstance(slot, dict) or slot.get('teacher') not in ds['teachers'] or type(slot.get('h')) is not int or slot['h'] not in HOURS or key != f"{slot['teacher']}|{slot['h']}" or slot.get('site') not in (*SITES, None):
            raise ValueError('Fatti storici non validi.')

    for issue in facts['issues']:
        if not isinstance(issue, str) or len(issue.split('|')) != 3:
            raise ValueError('Conflitto storico non valido.')
    candidate = facts
    for slot in candidate['absences'].values():
        if set(slot) != {'teacher', 'h', 'classes', 'site', 'provenance', 'manual', 'permit'} or not isinstance(slot['classes'], list) or any(not isinstance(c, str) or not c or '|' in c for c in slot['classes']) or slot['provenance'] not in ('recorded', 'reconstructed') or any(type(slot[f]) is not bool for f in ('manual', 'permit')):
            raise ValueError('Contesto storico non valido.')
    for key, row in candidate['demand'].items():
        if set(row) != {'h', 'c', 'ids', 'site', 'key', 'outcome', 'assignment', 'eligible', 'valid'} or type(row['h']) is not int or row['h'] not in HOURS or not isinstance(row['c'], str) or key != f"{row['h']}|{row['c']}" or row['site'] not in (*SITES, None) or row['outcome'] not in statistics.OUTCOMES or type(row['eligible']) is not bool or type(row['valid']) is not bool or not isinstance(row['ids'], list) or not row['ids'] or any(i not in ds['teachers'] for i in row['ids']) or row['key'] != f"{min(row['ids'])}|{row['h']}|{row['c']}":
            raise ValueError('Domanda storica non valida.')
