"""Scheduling rules: plain Python values, no HTTP or database dependencies."""
from datetime import date
import re

HOURS = list(range(1, 8))
DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
SITES = ('centrale', 'succursale')
# Category + campus tier; ties use daily load, total load, name, stable ID.
PRIORITIES = {'C': (0, 0, 0), 'POT': (10, 50, 70), 'D': (10, 50, 70),
              'UTC': (15, 55, 72), 'UTS': (15, 55, 72), 'DIS': (15, 55, 72),
              'TC': (20, 60, 74), 'DIR': (30, 65, 76), 'SPECIAL': (40, 40, 40)}
LABELS = {'C': 'Compresenza', 'POT': 'POT', 'D': 'A disposizione', 'UTC': 'UTC',
          'UTS': 'UTS', 'DIS': 'DI.S', 'TC': 'Rottura compresenza', 'DIR': 'Dirigente', 'SPECIAL': 'Entrata / uscita'}
# Denominazioni ufficiali classi di concorso (A/B: DPR 19/2016, AS: DM 255/2023). Codici non in tabella restano così come sono.
CDC_NAMES = {
    'A020': 'Fisica',
    'A021': 'Geografia',
    'A026': 'Matematica',
    'A034': 'Scienze e tecnologie chimiche',
    'A037': 'Costruzioni, tecnologie e tecniche di rappresentazione grafica',
    'A040': 'Tecnologie elettriche ed elettroniche',
    'A041': 'Scienze e tecnologie informatiche',
    'A042': 'Scienze e tecnologie meccaniche',
    'A045': 'Scienze economico-aziendali',
    'A046': 'Scienze giuridico-economiche',
    'A047': 'Scienze matematiche applicate',
    'A050': 'Scienze naturali, chimiche e biologiche',
    'A051': 'Scienze e tecnologie agrarie',
    'AB24': 'Lingue e culture straniere - inglese (secondaria di II grado)',
    'AC24': 'Lingue e culture straniere - spagnolo (secondaria di II grado)',
    'AS12': 'Discipline letterarie (secondaria di II grado)',
    'AS2A': 'Lingue e culture straniere - francese (secondaria di II grado)',
    'AS2B': 'Lingue e culture straniere - inglese (secondaria di II grado)',
    'AS2D': 'Lingue e culture straniere - tedesco (secondaria di II grado)',
    'AS48': 'Scienze motorie e sportive',
    'ADSS': 'Sostegno (secondaria di II grado)',
    'SOS': 'Sostegno',
    'IRC': 'Insegnamento della religione cattolica',
    'B003': 'Laboratori di fisica',
    'B012': 'Laboratori di scienze e tecnologie chimiche e microbiologiche',
    'B014': 'Laboratori di scienze e tecnologie delle costruzioni',
    'B015': 'Laboratori di scienze e tecnologie elettriche ed elettroniche',
    'B016': 'Laboratori di scienze e tecnologie informatiche',
    'B017': 'Laboratori di scienze e tecnologie meccaniche',
}


def normalize_dataset(data):
    if not isinstance(data, dict) or not isinstance(data.get('docenti'), list) or not isinstance(data.get('orario'), list):
        raise ValueError('Sono necessari docenti e orario.')
    teachers, lessons = {}, {}
    for t in data['docenti']:
        if not isinstance(t, dict):
            raise ValueError('Docente non valido.')
        i = t.get('id')
        if not isinstance(i, str) or not i or i in teachers or '|' in i:
            raise ValueError('ID docente mancante, duplicato o non valido.')
        if any(t.get(k) is not None and not isinstance(t[k], str) for k in ('nome_originale', 'sigla_untis', 'ruolo', 'classe_concorso')):
            raise ValueError('Anagrafica docente non valida.')
        teachers[i] = dict(id=i, name=t.get('nome_originale') or t.get('sigla_untis') or i,
                           code=t.get('sigla_untis', ''), role=t.get('ruolo', 'curricolare'),
                           classe_concorso=t.get('classe_concorso', ''))
    for l in data['orario']:
        if not isinstance(l, dict):
            raise ValueError('Lezione non valida.')
        i, d, h = l.get('docente'), l.get('giorno'), l.get('ora')
        if not isinstance(i, str) or not isinstance(d, str) or i not in teachers or d not in DAYS[:5] or type(h) is not int or h not in HOURS:
            raise ValueError('Docente, giorno o ora non valido.')
        key = f'{i}|{d}|{h}'
        if key in lessons:
            raise ValueError('Lezione duplicata: ' + key)
        classes = l.get('classi', [])
        if not isinstance(classes, list) or any(not isinstance(c, str) or not c or '|' in c for c in classes):
            raise ValueError('Classi non valide.')
        if l.get('sede') is not None and (not isinstance(l['sede'], str) or l['sede'] not in SITES):
            raise ValueError('Sede non valida.')
        if not isinstance(l.get('attivita_riconosciute') or [], list) or l.get('aula') is not None and not isinstance(l['aula'], str):
            raise ValueError('Attività o aula non valida.')
        tokens = [re.sub(r'[.\s]', '', str(v)).upper() for v in (l.get('attivita_riconosciute') or []) + [l.get('attivita_originale', '')]]
        lessons[key] = dict(classes=classes, room=l.get('aula'), site=l.get('sede'),
                            special=next((v for v in tokens if v in ('POT', 'UTC', 'UTS', 'DIS')), ''))
    warnings = data.get('anomalie') or []
    if not isinstance(warnings, list):
        raise ValueError('Anomalie non valide.')
    antonelli = [t['id'] for t in teachers.values() if t['name'].lower().startswith('antonelli ')]
    if len(antonelli) > 1:
        warnings = [*warnings, 'Possibile anagrafica duplicata Antonelli: ' + ', '.join(antonelli)]
    return dict(teachers=teachers, lessons=lessons, classes=sorted({c for l in lessons.values() for c in l['classes']}), warnings=warnings)


def lesson(ds, teacher, day, hour):
    return ds['lessons'].get(f'{teacher}|{DAYS[date.fromisoformat(day).weekday()]}|{hour}')


def class_out(state, day, cls, hour, exclude=''):
    return hour in state['cf'].get(day, {}).get(cls, []) or any(
        k != exclude and a['c'] == cls and int(k.split('|')[1]) == hour and a['v'] in ('ENTRA', 'ESCE')
        for k, a in state['asg'].get(day, {}).items())


def rows(ds, state, day):
    groups = {}
    for i, hours in state['abs'].get(day, {}).items():
        for h in hours:
            l = lesson(ds, i, day, h)
            for c in l['classes'] if l else []:
                k = f'{i}|{h}|{c}'
                if not class_out(state, day, c, h, k):
                    groups.setdefault((h, c), []).append((i, l))
    result = []
    for (h, c), members in groups.items():
        # One class and period is one room: co-absent teachers share one row.
        members.sort(key=lambda m: (ds['teachers'][m[0]]['name'].casefold(), m[0]))
        canon = min(members, key=lambda m: m[0])
        result.append(dict(id=canon[0], ids=[m[0] for m in members], h=h, c=c,
                           k=f'{canon[0]}|{h}|{c}', aula=canon[1]['room'], sede=canon[1]['site']))
    return sorted(result, key=lambda r: (r['h'], r['c'], ds['teachers'][r['id']]['name']))


def rank_candidate(candidate, row):
    loc = candidate['loc']
    index = 0 if loc and loc == row['sede'] else 1 if loc and row['sede'] else 2
    return PRIORITIES[candidate['ty']][index]


def eligibility(ds, state, day, row, teacher):
    i, h = teacher['id'], row['h']
    if i in row['ids']:
        return None
    l = lesson(ds, i, day, h)
    manual = h in state['dis'].get(day, {}).get(i, [])
    ty = ''
    if manual:
        ty = 'D'
    elif l and row['c'] in l['classes'] and l['site'] and l['site'] == row['sede']:
        ty = 'C'
    elif l and l['classes'] and all(class_out(state, day, c, h, row['k']) for c in l['classes']):
        ty = 'D'
    elif l and not l['classes'] and l['special']:
        ty = l['special']
    elif l and l['classes'] and teacher['role'] == 'sostegno':
        ty = 'TC'
    if not ty:
        return None
    loc = state['disSites'].get(day, {}).get(i) if manual else None
    loc = loc or ('centrale' if ty == 'UTC' else 'succursale' if ty == 'UTS' else l['site'] if l else None)
    why = 'Assente' if h in state['abs'].get(day, {}).get(i, []) else ''
    if not why and any(k != row['k'] and int(k.split('|')[1]) == h and a['v'] == i for k, a in state['asg'].get(day, {}).items()):
        why = 'Già assegnato in questa ora'
    return dict(id=i, name=teacher['name'], ty=ty, loc=loc, why=why, tag=why or LABELS[ty])


def candidates(ds, state, day, row):
    weekly = {}
    for k, l in ds['lessons'].items():
        weekly.setdefault(k.split('|')[0], set()).update(l['classes'])
    result = []
    for t in ds['teachers'].values():
        c = eligibility(ds, state, day, row, t)
        if not c:
            continue
        cls = sorted(weekly.get(t['id'], set()))
        cdc = t.get('classe_concorso', '')
        result.append(dict(c, role=t['role'], cdc=cdc, cdcName=CDC_NAMES.get(cdc, cdc),
                           clsWeek=cls, inClass=row['c'] in cls))
    result.append(dict(id='DIR', name='Dirigente', ty='DIR', loc='centrale', why='', tag='Opzione manuale, da verificare'))
    effective = [h for h in HOURS if any(row['c'] in (lesson(ds, i, day, h) or {}).get('classes', []) for i in ds['teachers']) and not class_out(state, day, row['c'], h, row['k'])]
    if effective:
        info = f'La classe entra alle {effective[0]} ed esce alle {effective[-1]}'
        for cid, title, boundary in [('ENTRA', 'Entra dopo', effective[0]), ('ESCE', 'Esce prima', effective[-1])]:
            result.append(dict(id=cid, name=title, ty='SPECIAL', loc=None, why='', tag='Da verificare',
                               enable=row['h'] == boundary, info=info))
    for c in result:
        c['today'] = sum(a['v'] == c['id'] for a in state['asg'].get(day, {}).values())
        c['total'] = sum(a['v'] == c['id'] for assignments in state['asg'].values() for a in assignments.values())
        c['tier'] = rank_candidate(c, row)
    return sorted(result, key=lambda c: (bool(c['why']), c['tier'], c['today'], c['total'], c['name'].casefold(), c['id']))


def validate_assignment(ds, state, day, key, value):
    row = next((r for r in rows(ds, state, day) if r['k'] == key), None)
    if not row:
        raise ValueError('Supplenza non più presente nell’orario o nelle assenze.')
    c = next((c for c in candidates(ds, state, day, row) if c['id'] == value), None)
    if not c or c['why']:
        raise ValueError(c['why'] if c else 'Candidato non disponibile.')
    if value == 'ENTRA' and not c.get('enable'):
        raise ValueError('Entra dopo disponibile solo alla prima ora effettiva della classe.')
    if value == 'ESCE' and not c.get('enable'):
        raise ValueError('Esce prima disponibile solo all’ultima ora effettiva della classe.')
    return dict(v=value, t=c['ty'], c=row['c'])


def out_reason(state, day, cls, hour):
    for k, a in state['asg'].get(day, {}).items():
        if a['c'] == cls and int(k.split('|')[1]) == hour and a['v'] in ('ENTRA', 'ESCE'):
            return f'{cls} entra dopo' if a['v'] == 'ENTRA' else f'{cls} esce prima'
    return f'{cls} classe fuori'


def auto_availability(ds, state, day):
    """Ore/cause in cui un docente è libero perché tutte le sue classi dell'ora sono fuori."""
    result = {}
    for i, t in ds['teachers'].items():
        if t.get('retired'):
            continue
        hours = {}
        for h in HOURS:
            l = lesson(ds, i, day, h)
            if (not l or not l['classes'] or h in state['abs'].get(day, {}).get(i, [])
                    or any(a['v'] == i and int(k.split('|')[1]) == h for k, a in state['asg'].get(day, {}).items())):
                continue
            reasons = []
            for c in l['classes']:
                if class_out(state, day, c, h):
                    reasons.append(out_reason(state, day, c, h))
                else:
                    break
            else:
                hours[h] = reasons
        if hours:
            result[i] = hours
    return result


def default_availability(ds, teacher, day):
    return [h for h in HOURS if not (lesson(ds, teacher, day, h) or {}).get('classes')]
