"""Content preconditions for operational records; checked inside write transactions."""
import hashlib
import json
from datetime import timedelta
from fastapi import HTTPException
from .domain import rows

METADATA = {
    'abs': ('absenceNotes', 'absenceKinds', 'absenceAttachments'),
    'cf': (),
    'dis': ('disSites', 'disAttachments'),
    'permessi': ('permitIds', 'permitRequests', 'permitNotes', 'permitKinds', 'permitAttachments'),
}


def key(group, day, identifier):
    return f'{group}|{day}|{identifier}'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def snapshot(state, ds=None, day=None):
    records = {}
    for group, metadata in METADATA.items():
        for d, entries in state[group].items():
            for identifier, value in entries.items():
                records[key(group, d, identifier)] = digest([value, *[state.get(m, {}).get(d, {}).get(identifier) for m in metadata]])
    for identifier, value in state['manualPermits'].items():
        records[key('manualPermits', '', identifier)] = digest([value, state['manualPermitNotes'].get(identifier)])
    if ds is not None:
        current_rows = {r['k']: r for r in rows(ds, state, day)}
        for identifier in current_rows.keys() | state['asg'].get(day, {}).keys():
            records[key('asg', day, identifier)] = digest([state['asg'].get(day, {}).get(identifier), current_rows.get(identifier)])
    return dict(records=records, dates={g: sorted(state[g]) for g in ('abs', 'cf', 'dis')})


def entry_days(e, state):
    start = e.day.isoformat()
    if e.future:
        return [start, *sorted(d for d in state[e.group] if d > start)]
    result = [start]
    current = e.day + timedelta(days=1)
    while e.until and current <= e.until:
        if current.weekday() < 5:
            result.append(current.isoformat())
        current += timedelta(days=1)
    return result


def check(expected, current, references):
    if expected is None:
        raise HTTPException(428, detail=dict(code='precondition_required', message='Ricarica la pagina prima di salvare.'))
    wanted = {ref: current['records'].get(ref, 'absent') for ref in references}
    if expected != wanted:
        raise HTTPException(409, detail=dict(code='record_changed', message='Dati modificati da un’altra operazione. Ricarica i valori salvati prima di riprovare.', records=list(wanted)))
