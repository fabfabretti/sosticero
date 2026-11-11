"""Grouped communication for cross-campus availability assignments."""
import hashlib
import json
import re
from .domain import rows, eligibility, SITES


def groups(ds, state, day):
    assignments = state['asg'].get(day, {})
    grouped = {}
    for row in rows(ds, state, day):
        a = assignments.get(row['k'], {})
        teacher = ds['teachers'].get(a.get('v'))
        if a.get('t') != 'D' or not teacher:
            continue
        candidate = eligibility(ds, state, day, row, teacher)
        origin = candidate.get('loc') if candidate else None
        if not candidate or candidate['ty'] != 'D' or candidate['why'] or origin not in SITES or row['sede'] not in SITES or origin == row['sede']:
            continue
        identity = (a['v'], origin, row['sede'])
        grouped.setdefault(identity, []).append(row)
    result = {}
    for (teacher, origin, destination), members in grouped.items():
        members.sort(key=lambda r: (r['h'], r['k']))
        content = dict(day=day, teacher=teacher, origin=origin, destination=destination, rows=members)
        fingerprint = hashlib.sha256(json.dumps(content, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        metadata = [assignments[r['k']].get('campusNotice', {}) for r in members]
        notice = dict(content, fingerprint=fingerprint, **{field: all(m.get('fingerprint') == fingerprint and m.get(field) is True for m in metadata) for field in ('communicated', 'accepted')})
        for row in members:
            result[row['k']] = notice
    return result


def reconcile(ds, state, day):
    if not any('campusNotice' in a for a in state['asg'].get(day, {}).values()):
        return
    notices = groups(ds, state, day)
    for key, assignment in state['asg'].get(day, {}).items():
        metadata = assignment.get('campusNotice')
        if metadata is not None and (key not in notices or metadata.get('fingerprint') != notices[key]['fingerprint']):
            assignment.pop('campusNotice', None)
    # One changed member invalidates the entire notice, including remaining members.
    for key, notice in notices.items():
        metadata = state['asg'][day][key].get('campusNotice')
        if metadata is not None:
            metadata.update(communicated=notice['communicated'], accepted=notice['accepted'])


def validate(state):
    for assignments in state['asg'].values():
        for a in assignments.values():
            if 'campusNotice' not in a:
                continue
            m = a['campusNotice']
            if a.get('t') != 'D' or not isinstance(m, dict) or set(m) != {'fingerprint', 'communicated', 'accepted'} or not isinstance(m['fingerprint'], str) or not re.fullmatch('[0-9a-f]{64}', m['fingerprint']) or any(type(m[f]) is not bool for f in ('communicated', 'accepted')):
                raise ValueError('Comunicazione cambio sede non valida.')
