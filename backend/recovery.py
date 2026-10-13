"""Permit identities and recovery accounting, independent of the timetable."""
from calendar import monthrange
from datetime import date, datetime
from uuid import uuid4
from zoneinfo import ZoneInfo


def deadline(day):
    d = date.fromisoformat(day)
    year, month = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    return date(year, month, min(d.day, monthrange(year, month)[1])).isoformat()


def migrate(state):
    ids = state.setdefault('permitIds', {})
    changed = False
    for day, teachers in state.get('permessi', {}).items():
        for teacher in teachers:
            if teacher not in ids.get(day, {}):
                ids.setdefault(day, {})[teacher] = uuid4().hex
                changed = True
    return changed


def ledger(state, exclude=None):
    permits = {}
    for day, teachers in state.get('permessi', {}).items():
        for teacher, hours in teachers.items():
            pid = state.get('permitIds', {}).get(day, {}).get(teacher)
            if pid:
                permits[pid] = dict(id=pid, teacher=teacher, date=day, deadline=deadline(day),
                                    hours=len(hours), recoveries=[])
    for day, assignments in state['asg'].items():
        for key, a in assignments.items():
            if (day, key) == exclude or a.get('t') != 'RP':
                continue
            p = permits.get(a.get('permitId'))
            if p:
                p['recoveries'].append(dict(date=day, h=int(key.split('|')[1]), key=key))
    for p in permits.values():
        p['recoveries'].sort(key=lambda r: (r['date'], r['h'], r['key']))
        p['recovered'] = len(p['recoveries'])
        p['remaining'] = p['hours'] - p['recovered']
    return permits


def eligible(permits, teacher, day):
    return sorted((p for p in permits.values() if p['teacher'] == teacher and p['remaining'] > 0
                   and p['date'] <= day <= p['deadline']), key=lambda p: (p['date'], p['id']))


def summary(state, today=None):
    today = today or datetime.now(ZoneInfo('Europe/Rome')).date().isoformat()
    result, teachers = {}, {}
    for p in ledger(state).values():
        p['expired'] = p['deadline'] < today and p['remaining'] > 0
        result.setdefault(p['date'], {})[p['teacher']] = p
        t = teachers.setdefault(p['teacher'], dict(remaining=0, expired=0, eligible=0))
        t['remaining'] += p['remaining']
        t['expired'] += p['remaining'] if p['expired'] else 0
        t['eligible'] += p['remaining'] if p['date'] <= today <= p['deadline'] else 0
    return result, teachers


def validate(state):
    """Validate ledger integrity without reapplying today's timetable rules."""
    try:
        ids = state.get('permitIds', {})
        expected = {(d, t) for d, ts in state.get('permessi', {}).items() for t in ts}
        if not isinstance(ids, dict) or any(not isinstance(ts, dict) for ts in ids.values()):
            raise ValueError()
        actual = {(d, t) for d, ts in ids.items() for t in ts}
        values = [v for ts in ids.values() for v in ts.values()]
        if actual != expected or any(not isinstance(v, str) or not v or len(v) > 100 for v in values) or len(values) != len(set(values)):
            raise ValueError()
        permits = ledger(state)
        for day, assignments in state['asg'].items():
            for a in assignments.values():
                if a.get('t') != 'RP':
                    if 'permitId' in a:
                        raise ValueError()
                    continue
                p = permits.get(a.get('permitId'))
                if not p or p['teacher'] != a['v'] or not p['date'] <= day <= p['deadline'] or p['remaining'] < 0:
                    raise ValueError()
    except (ValueError, TypeError, KeyError, AttributeError):
        raise ValueError('Recuperi non validi: verificare riferimenti, scadenze e ore disponibili.') from None


def protect(state, pid, teacher, day, hours):
    p = ledger(state).get(pid)
    if p and p['recoveries'] and (hours is None or teacher != p['teacher'] or len(hours) < p['recovered']
            or any(not day <= r['date'] <= deadline(day) for r in p['recoveries'])):
        raise ValueError('Permesso con recuperi collegati: risolvi prima le assegnazioni RP interessate.')
