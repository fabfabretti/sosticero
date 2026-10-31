"""Recurring paid availability and assignment-derived accounting."""
from collections import Counter
from datetime import date, timedelta


def validate_hours(hours):
    if not isinstance(hours, list) or any(type(h) is not int or h not in range(1, 8) for h in hours) or len(hours) != len(set(hours)):
        raise ValueError('Ore a pagamento non valide.')


def migrate(declarations):
    """Convert pre-attribution hours once; the legacy creator is unknown."""
    if not isinstance(declarations, dict):
        raise ValueError('Disponibilità a pagamento non valide.')
    changed = False
    for entries in declarations.values():
        if not isinstance(entries, dict):
            raise ValueError('Disponibilità a pagamento non valide.')
        for teacher, value in entries.items():
            if isinstance(value, list):
                validate_hours(value)
                entries[teacher] = {str(h): dict(createdBy=None, createdFrom='centrale') for h in value}
                changed = True
    return changed


def validate(declarations, teachers):
    if not isinstance(declarations, dict):
        raise ValueError('Disponibilità a pagamento non valide.')
    for weekday, entries in declarations.items():
        if weekday not in ('0', '1', '2', '3', '4') or not isinstance(entries, dict):
            raise ValueError('Giorno disponibilità non valido.')
        for teacher, records in entries.items():
            if teacher not in teachers or not isinstance(records, dict):
                raise ValueError('Docente o ore a pagamento non validi.')
            for hour, record in records.items():
                if hour not in tuple(map(str, range(1, 8))) or not isinstance(record, dict) or set(record) != {'createdBy', 'createdFrom'}:
                    raise ValueError('Disponibilità a pagamento non valida.')
                if record['createdFrom'] not in ('centrale', 'succursale') or record['createdBy'] is not None and (not isinstance(record['createdBy'], str) or not 1 <= len(record['createdBy']) <= 64):
                    raise ValueError('Autore disponibilità non valido.')


def hours(state, weekday, teacher):
    records = state.get('paidAvailability', {}).get(str(weekday), {}).get(teacher, {})
    return sorted(int(h) for h in records)


def edit(state, weekday, teacher, selected, account):
    validate_hours(selected)
    entries = state['paidAvailability'].setdefault(str(weekday), {})
    previous = entries.get(teacher, {})
    if selected:
        entries[teacher] = {str(h): previous.get(str(h), dict(createdBy=account['id'], createdFrom=account['campus'])) for h in selected}
    else:
        entries.pop(teacher, None)


def slot(ds, state, day, hour, teacher, key='', declared=True):
    from .domain import lesson, absences, rp_context, SITES
    from .receptions import at
    t = ds['teachers'].get(teacher)
    if not t or t.get('retired'):
        return dict(sites=[], uncertain=False, why='Docente non attivo')
    if declared and hour not in hours(state, date.fromisoformat(day).weekday(), teacher):
        return dict(sites=[], uncertain=False, why='Disponibilità a pagamento non dichiarata')
    why = ('Impegnato nell’orario' if lesson(ds, teacher, day, hour) or at(ds, teacher, day, hour) else
           'Assente' if hour in absences(state, day).get(teacher, []) else
           'A disposizione' if hour in state.get('dis', {}).get(day, {}).get(teacher, []) else
           'Già assegnato in questa ora' if any(k != key and int(k.split('|')[1]) == hour and a['v'] == teacher for k, a in state['asg'].get(day, {}).items()) else '')
    if why:
        return dict(sites=[], uncertain=False, why=why)
    sites, uncertain = [], False
    for site in SITES:
        _, blocked, _, unknown = rp_context(ds, state, day, dict(h=hour, sede=site, k=key), teacher, details=True)
        if not blocked:
            sites.append(site)
            uncertain = uncertain or unknown
    return dict(sites=sites, uncertain=uncertain, why='' if sites else 'Cambio sede senza intervallo')


def candidate(ds, state, day, row, teacher):
    i = teacher['id']
    if teacher.get('retired') or i in row['ids'] or row['h'] not in hours(state, date.fromisoformat(day).weekday(), i):
        return None
    info = slot(ds, state, day, row['h'], i, row['k'])
    why = info['why'] or ('Cambio sede senza intervallo' if row['sede'] and row['sede'] not in info['sites'] else '')
    count = totals(state)[i]
    return dict(id=i, name=teacher['name'], ty='PAID', loc=info['sites'][0] if len(info['sites']) == 1 else None,
                why=why, tag=why or ('Sede da verificare' if info['uncertain'] else ' / '.join(info['sites'])),
                typeLabel='A pagamento', paidCount=count, sites=info['sites'], uncertain=info['uncertain'])


def totals(state):
    return Counter(a['v'] for entries in state['asg'].values() for a in entries.values() if a['t'] == 'PAID')


def metadata(state, teachers):
    for entries in state['asg'].values():
        for key, a in entries.items():
            if a.get('t') != 'PAID':
                if any(k in a for k in ('notified', 'assignedBy', 'paidContext')):
                    raise ValueError('Metadati pagamento senza assegnazione a pagamento.')
                continue
            ctx = a.get('paidContext')
            if a['v'] not in teachers or 'permitId' in a or 'accepted' in a or 'communicated' in a or type(a.get('notified')) is not bool or a.get('assignedBy') not in ('centrale', 'succursale') or not isinstance(ctx, dict):
                raise ValueError('Metadati assegnazione a pagamento non validi.')
            if set(ctx) != {'site', 'room', 'class'} or ctx['site'] not in ('centrale', 'succursale') or ctx['class'] != a['c'] or ctx['room'] is not None and not isinstance(ctx['room'], str):
                raise ValueError('Contesto pagamento non valido.')


def report(history, state, selected):
    from . import timetables
    monday = selected - timedelta(days=selected.weekday())
    cells, teachers = [], {}
    neutral = dict(abs={}, permessi={}, asg={}, cf={}, paidAvailability=state.get('paidAvailability', {}))
    dates = [(monday + timedelta(days=w)).isoformat() for w in range(5)]
    for w, day in enumerate(dates):
        ds = timetables.dataset(history, day)
        teachers.update(ds['teachers'])
        for h in range(1, 8):
            entries = [dict(id=i, name=ds['teachers'][i]['name'], addedBy=records[str(h)]['createdFrom'], **slot(ds, neutral, day, h, i))
                       for i, records in state.get('paidAvailability', {}).get(str(w), {}).items() if h in hours(state, w, i)]
            cells.append(dict(date=day, weekday=w, hour=h, teachers=sorted(entries, key=lambda t: (t['name'].casefold(), t['id']))))
    records = [dict(date=d, key=k, teacher=a['v'], name=teachers.get(a['v'], {}).get('name', a['v']), hour=int(k.split('|')[1]), **a)
               for d, entries in state['asg'].items() for k, a in entries.items() if a['t'] == 'PAID']
    return dict(dates=dates, cells=cells, teachers=teachers, declarations={w: {i: hours(state, w, i) for i in entries} for w, entries in state.get('paidAvailability', {}).items()},
                records=sorted(records, key=lambda r: (r['date'], r['hour'], r['key']), reverse=True), totals=totals(state))
