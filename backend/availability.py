"""On-paper timetable capacity; daily scheduling state only supplies the RP ledger."""
from datetime import timedelta

from . import recovery, timetables, receptions, paid
from .domain import HOURS, SITES, lesson, rp_context
from .hour_types import activity_codes, merge_types

POT_FAMILY = {'POT', 'ALF', 'PE'}
# UTC/UTS are office duties and SOS an external service: never disposable teaching time.
NOT_DISPOSABLE = {'UTC', 'UTS', 'SOS'}


def campus_of(l):
    codes = activity_codes(l)
    return ('centrale' if any(c in ('DIS', 'UTC') for c in codes) else
            'succursale' if 'UTS' in codes else l.get('site'))


def report(history, state, policies, selected, campus='total'):
    if campus not in ('total', *SITES):
        raise ValueError('Sede non valida.')
    if not history:
        raise ValueError('Carica prima un orario.')
    monday = selected - timedelta(days=selected.weekday())
    dates = [(monday + timedelta(days=n)).isoformat() for n in range(5)]
    permits = recovery.ledger(state)
    neutral = dict(abs={}, permessi={}, asg={}, cf={})
    cells, versions = [], []
    total = enabled = unknown = unknown_pot = 0
    for weekday, d in enumerate(dates):
        ds = timetables.dataset(history, d)
        rules = merge_types(ds, policies)
        versions.append(dict(date=d, id=timetables.version(history, d)['id'],
                             effective=timetables.version(history, d)['effective']))
        active = {i: t for i, t in ds['teachers'].items() if not t.get('retired')}
        debt = {i for i in active if recovery.eligible(permits, i, d)}
        for h in HOURS:
            ordinary, rp, payment = [], [], []
            for i, teacher in active.items():
                l = lesson(ds, i, d, h)
                if l:
                    codes = activity_codes(l)
                    if not codes or NOT_DISPOSABLE.intersection(codes):
                        continue
                    site = campus_of(l)
                    family = bool(POT_FAMILY.intersection(codes))
                    if site is None:
                        unknown += 1
                        unknown_pot += int(family)
                    available = not l.get('disabled') and all(rules['code:' + c]['available'] for c in codes)
                    if campus != 'total' and campus != site:
                        continue
                    if family:
                        total += 1
                        enabled += int(available)
                    if available:
                        ordinary.append(dict(id=i, name=teacher['name'], activities=codes, sites=[site] if site else []))
                elif i in debt and not receptions.at(ds, i, d, h):
                    sites = [s for s in SITES if (campus == 'total' or campus == s) and
                             rp_context(ds, neutral, d, dict(h=h, sede=s, k=''), i)[0]]
                    if sites:
                        rp.append(dict(id=i, name=teacher['name'], activities=['RP'], sites=sites))
            theoretical = dict(neutral, paidAvailability=state.get('paidAvailability', {}))
            for i, teacher in active.items():
                info = paid.slot(ds, theoretical, d, h, i)
                sites = [s for s in info['sites'] if campus == 'total' or s == campus]
                if not info['why'] and sites:
                    payment.append(dict(id=i, name=teacher['name'], activities=['PAID'], sites=sites, uncertain=info['uncertain']))
            by_name = lambda t: (t['name'].casefold(), t['id'])
            cells.append(dict(date=d, weekday=weekday,
                              hour=h, available=sorted(ordinary, key=by_name), recovery=sorted(rp, key=by_name), paid=sorted(payment, key=by_name)))
    return dict(campus=campus, start=dates[0], end=dates[-1], dates=dates, versions=versions,
                cells=cells, pot=dict(enabled=enabled, total=total, percentage=100 * enabled / total if total else None, reference=40),
                unknown=dict(hours=unknown, pot=unknown_pot))
