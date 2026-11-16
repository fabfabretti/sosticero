"""Dated partial-class commitments. Source classes never become lesson classes."""
from copy import deepcopy
from datetime import date, timedelta


def empty():
    return dict(schema=1, records=[])


def iso(value):
    if not isinstance(value, str) or date.fromisoformat(value).isoformat() != value:
        raise ValueError('Data gruppo non valida.')
    return value


def validate(document, teachers=None, classes=None):
    from .domain import DAYS, HOURS, SITES
    if not isinstance(document, dict) or set(document) != {'schema', 'records'} or type(document['schema']) is not int or document['schema'] != 1 or not isinstance(document['records'], list) or len(document['records']) > 5000:
        raise ValueError('Archivio gruppi non valido.')
    ids, periods = set(), {}
    for r in document['records']:
        if not isinstance(r, dict) or set(r) != {'id', 'teacher', 'day', 'hour', 'site', 'room', 'sources', 'start', 'end'}:
            raise ValueError('Gruppo non valido.')
        if any(not isinstance(r[k], str) or not r[k].strip() or len(r[k]) > 200 or '|' in r[k] for k in ('id', 'teacher')) or r['id'] in ids:
            raise ValueError('Identità gruppo non valida o duplicata.')
        ids.add(r['id'])
        if not isinstance(r['day'], str) or r['day'] not in DAYS[:5] or type(r['hour']) is not int or r['hour'] not in HOURS or r['site'] not in SITES or not isinstance(r['room'], str) or len(r['room']) > 200:
            raise ValueError('Giorno, ora, sede o aula gruppo non validi.')
        start, end = iso(r['start']), iso(r['end']) if r['end'] is not None else '9999-12-31'
        if end < start:
            raise ValueError('Fine gruppo precedente alla decorrenza.')
        if teachers is not None and r['teacher'] not in teachers:
            raise ValueError('Docente gruppo non presente nel catalogo.')
        if not isinstance(r['sources'], list) or not r['sources'] or len(r['sources']) > 100:
            raise ValueError('Indica le classi di provenienza.')
        seen = set()
        for source in r['sources']:
            if not isinstance(source, dict) or set(source) != {'class', 'count'} or not isinstance(source['class'], str) or not source['class'].strip() or len(source['class']) > 100 or '|' in source['class'] or source['class'] in seen:
                raise ValueError('Classe di provenienza non valida o duplicata.')
            seen.add(source['class'])
            if classes is not None and source['class'] not in classes:
                raise ValueError('Classe gruppo non presente nel catalogo: ' + source['class'])
            if source['count'] is not None and (type(source['count']) is not int or not 1 <= source['count'] <= 1000):
                raise ValueError('Numero alunni non valido; lascia vuoto se ignoto.')
        key = r['teacher'], r['day'], r['hour']
        for a, b in periods.setdefault(key, []):
            if start <= b and a <= end:
                raise ValueError('Gruppi sovrapposti per lo stesso docente e ora.')
        periods[key].append((start, end))
    return document


def on_day(document, day):
    return [deepcopy(r) for r in document['records'] if r['start'] <= day and (r['end'] is None or day <= r['end'])]


def at(ds, teacher, day, hour):
    from .domain import DAYS
    weekday = DAYS[date.fromisoformat(day).weekday()]
    return next((r for r in ds.get('studentGroups', []) if r['teacher'] == teacher and r['day'] == weekday and r['hour'] == hour and r['start'] <= day and (not r['end'] or day <= r['end'])), None)


def boundaries(document):
    return {r['start'] for r in document['records']} | {(date.fromisoformat(r['end']) + timedelta(days=1)).isoformat() for r in document['records'] if r['end'] and r['end'] != '9999-12-31'}


def reviews(ds, state, day):
    from .domain import absences, DAYS
    absent = absences(state, day, ds)
    return [dict(r, status='Da valutare', key=f"{day}|{r['id']}") for r in ds.get('studentGroups', []) if r['day'] == DAYS[date.fromisoformat(day).weekday()] and r['hour'] in absent.get(r['teacher'], [])]


def conflicts(ds):
    result = []
    for r in ds.get('studentGroups', []):
        key = f"{r['teacher']}|{r['day']}|{r['hour']}"
        reasons = []
        if ds['teachers'].get(r['teacher'], {}).get('retired') or r['teacher'] not in ds['teachers']:
            reasons.append('Docente non presente nell’orario attivo')
        if key in ds['lessons']:
            reasons.append('Sovrapposizione con attività in orario')
        if any(x['teacher'] == r['teacher'] and x['day'] == r['day'] and x['hour'] == r['hour'] for x in ds.get('receptions', [])):
            reasons.append('Sovrapposizione con ricevimento')
        if any(s['class'] not in ds['classes'] for s in r['sources']):
            reasons.append('Classe non presente nel catalogo')
        if reasons:
            result.append(dict(id=r['id'], messages=reasons))
    return result
