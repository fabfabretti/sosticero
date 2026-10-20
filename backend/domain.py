"""Scheduling rules: plain Python values, no HTTP or database dependencies."""
from collections import Counter
from enum import IntEnum
from datetime import date
import re
from .hour_types import canonical, activity_codes
from . import recovery

HOURS = list(range(1, 8))
DAYS = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']
SITES = ('centrale', 'succursale')
class CandidateTier(IntEnum):
    COMPRESENZA = 1
    ENTRY_EXIT = 2
    AVAILABLE = 3
    SAME_CAMPUS = 4
    OFFICE = 5
    OTHER_CAMPUS = 6
    UNKNOWN_CAMPUS = 7
    RECOVERY = 8
    EXCEPTIONAL = 9
    UNCOVERED = 10


LABELS = {'CA': 'Compresenza - ALF', 'CP': 'Compresenza - POT', 'C': 'Compresenza', 'POT': 'POT', 'D': 'A disposizione', 'UTC': 'UTC',
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
        labels = (l.get('attivita_riconosciute') or []) + [l.get('attivita_originale') or '']
        if any(not isinstance(v, str) or len(v) > 200 for v in labels):
            raise ValueError('Attività non valida.')
        original = l.get('attivita_originale') or ''
        code_labels = l.get('attivita_riconosciute') or []
        # Original text also contains teacher names and room/class annotations.
        if not code_labels and original.strip() and (not classes or re.fullmatch(r'[A-Za-z.]{2,8}', original.strip())):
            code_labels = [original]
        tokens = list(dict.fromkeys(canonical(v) for v in code_labels if canonical(v)))
        lessons[key] = dict(classes=classes, room=l.get('aula'), site=l.get('sede'),
                            special=next((v for v in tokens if v in ('POT', 'UTC', 'UTS', 'DIS')), ''),
                            activities=tokens, activityLabels=labels)
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


def absences(state, day):
    manual = state['abs'].get(day, {})
    permits = state.get('permessi', {}).get(day, {})
    return {i: sorted(set(manual.get(i, []) + permits.get(i, []))) for i in manual.keys() | permits.keys()}


def validate_permit(ds, teacher, hours):
    if teacher not in ds['teachers'] or not isinstance(hours, list) or not hours or any(type(h) is not int or h not in HOURS for h in hours) or len(set(hours)) != len(hours):
        raise ValueError('Docente o ore di permesso non validi.')


def class_commitment(l):
    return bool(l and l.get('disabled') and l.get('classes') and activity_codes(l) in (['POT'], ['ALF']))


def rows(ds, state, day):
    groups = {}
    for i, hours in absences(state, day).items():
        for h in hours:
            l = lesson(ds, i, day, h)
            for c in l['classes'] if l else []:
                if class_commitment(l) and any(other != i and not t.get('retired') and h not in absences(state, day).get(other, []) and c in (lesson(ds, other, day, h) or {}).get('classes', []) for other, t in ds['teachers'].items()):
                    continue
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
    ty = candidate['ty']
    if ty == 'UNCOVERED':
        return CandidateTier.UNCOVERED
    if candidate.get('exceptional'):
        return CandidateTier.EXCEPTIONAL
    if ty in ('C', 'CP', 'CA'):
        return CandidateTier.COMPRESENZA
    if ty == 'SPECIAL':
        return CandidateTier.ENTRY_EXIT
    if ty in ('D', 'DIS'):
        return CandidateTier.AVAILABLE
    if ty == 'DIR':
        return CandidateTier.OFFICE
    if ty == 'RP':
        return CandidateTier.RECOVERY
    loc = candidate['loc']
    if not loc or not row['sede']:
        return CandidateTier.UNKNOWN_CAMPUS
    if loc != row['sede']:
        return CandidateTier.OTHER_CAMPUS
    return CandidateTier.OFFICE if ty in ('UTC', 'UTS') else CandidateTier.SAME_CAMPUS


def candidate_order(candidate):
    return (candidate['tier'],
            not candidate.get('convenient', False) if candidate['ty'] == 'RP' else False,
            not (candidate.get('inClass') or candidate.get('sameCdc')),
            candidate['today'], candidate['total'], candidate['name'].casefold(), candidate['id'])


def eligibility(ds, state, day, row, teacher, policies=None):
    i, h = teacher['id'], row['h']
    if i in row['ids'] or teacher.get('retired'):
        return None
    l = lesson(ds, i, day, h)
    same_room = not l or not l.get('room') or not row.get('aula') or l['room'] == row['aula']
    manual = h in state['dis'].get(day, {}).get(i, [])
    ty = ''
    keys = []
    released = l and l['classes'] and all(class_out(state, day, c, h, row['k']) for c in l['classes'])
    disabled = bool(l and l.get('disabled'))
    same_class_activity = class_commitment(l) and row['c'] in l['classes'] and l['site'] and l['site'] == row['sede'] and same_room
    if (manual or released) and (not disabled or released and class_commitment(l)):
        ty, keys = 'D', ['derived:available']
    elif same_class_activity:
        code = activity_codes(l)[0]
        ty, keys = ('CP' if code == 'POT' else 'CA'), ['code:' + code]
    elif l and activity_codes(l):
        ty = min(activity_codes(l), key=lambda code: (code not in ('DIS', 'UTC', 'UTS'), code))
        keys = ['code:' + code for code in activity_codes(l)]
    elif l and row['c'] in l['classes'] and l['site'] and l['site'] == row['sede'] and same_room:
        ty, keys = 'C', ['derived:co-support' if teacher['role'] == 'sostegno' else 'derived:itp']
    elif l and l['classes'] and teacher['role'] == 'sostegno':
        ty, keys = 'TC', ['derived:support']
    elif l and l['classes'] and teacher['role'].upper() == 'ITP':
        shared = any(k != f"{i}|{DAYS[date.fromisoformat(day).weekday()]}|{h}" and k.endswith(f"|{DAYS[date.fromisoformat(day).weekday()]}|{h}") and set(other['classes']) & set(l['classes']) for k, other in ds['lessons'].items())
        if shared:
            if row['c'] not in l['classes'] or not l['site'] or l['site'] != row['sede'] or not same_room:
                if policies is None:
                    return None
                ty, keys = 'TC', ['derived:itp']
            else:
                ty, keys = 'C', ['derived:itp']
    if not ty and policies is not None and l and l['classes']:
        ty, keys = 'LESSON', ['derived:lesson']
    if not ty:
        return None
    policy = [policies[k] for k in keys] if policies is not None else []
    if policy and not all(p['visible'] for p in policy):
        return None
    # Staying in the covered class does not release a teacher from another lesson.
    exceptional = (disabled and ty not in ('CP', 'CA', 'D')) or (ty == 'TC' and policies is None) or bool(ty not in ('C', 'CP', 'CA') and policy and not all(p['available'] for p in policy))
    if exceptional and policy and not all(p['school'] is True for p in policy):
        return None
    loc = state['disSites'].get(day, {}).get(i) if manual else None
    loc = loc or ('centrale' if ty in ('UTC', 'DIS') else 'succursale' if ty == 'UTS' else l['site'] if l else None)
    why = 'Assente' if h in absences(state, day).get(i, []) else ''
    if not why and any(k != row['k'] and int(k.split('|')[1]) == h and a['v'] == i for k, a in state['asg'].get(day, {}).items()):
        why = 'Già assegnato in questa ora'
    label = ' / '.join(p['label'] for p in policy) or LABELS.get(ty, ty)
    if ty in ('CP', 'CA'):
        label = LABELS[ty]
    if disabled and ty not in ('CP', 'CA', 'D'):
        label += ' · Ora disabilitata'
    if ty == 'C' and teacher['role'] not in ('sostegno', 'ITP'):
        label = LABELS['C']
    return dict(id=i, name=teacher['name'], ty=ty, loc=loc, why=why, tag=why or ('Occupato · ' if exceptional else '') + label,
                typeLabel=label, color=policy[0]['color'] if policy else None, exceptional=exceptional)


def rp_context(ds, state, day, row, teacher):
    h, site = row['h'], row['sede']
    commitments, teaching = {}, {}
    absent = absences(state, day).get(teacher, [])
    for period in HOURS:
        l = lesson(ds, teacher, day, period)
        if not l or period in absent:
            continue
        if l['classes'] and all(class_out(state, day, c, period, row['k']) for c in l['classes']):
            continue
        commitments[period] = l['site']
        if l['classes'] and not activity_codes(l):
            teaching[period] = l['site']
    for key, a in state['asg'].get(day, {}).items():
        if key != row['k'] and a['v'] == teacher:
            period = int(key.split('|')[1])
            origin = lesson(ds, key.split('|')[0], day, period)
            commitments[period] = origin['site'] if origin else None
    sides = []
    before = [p for p in commitments if p < h]
    after = [p for p in commitments if p > h]
    if before:
        sides.append(max(before))
    if after:
        sides.append(min(after))
    for period in sides:
        other = commitments[period]
        if site and other and site != other and not any(min(h, period) <= b < max(h, period) for b in (2, 4)):
            return False, 'Cambio sede senza intervallo', ''
    near = h - 1 in teaching or h + 1 in teaching or (any(p < h for p in teaching) and any(p > h for p in teaching))
    known = bool(site) and bool(teaching) and all(teaching[p] for p in teaching if p == h - 1 or p == h + 1)
    known = known and all(commitments[p] for p in sides)
    explanation = 'Sede da verificare' if near and not known else 'Ora favorevole' if near else 'Fuori dalle ore favorevoli'
    return bool(near and known), '', explanation


def rp_candidate(ds, state, day, row, teacher, permits):
    i, h = teacher['id'], row['h']
    if i in row['ids'] or teacher.get('retired') or lesson(ds, i, day, h) or h in state['dis'].get(day, {}).get(i, []):
        return None
    available = recovery.eligible(permits, i, day)
    if not available:
        return None
    convenient, why, explanation = rp_context(ds, state, day, row, i)
    if h in absences(state, day).get(i, []):
        why = 'Assente'
    elif any(k != row['k'] and int(k.split('|')[1]) == h and a['v'] == i for k, a in state['asg'].get(day, {}).items()):
        why = 'Già assegnato in questa ora'
    balance = sum(p['remaining'] for p in available)
    return dict(id=i, name=teacher['name'], ty='RP', loc=None, why=why,
                tag=why or f'{explanation} · {balance} ' + ('ora disponibile' if balance == 1 else 'ore disponibili'), typeLabel='RP · Recupero permesso',
                convenient=convenient, rpHours=balance, permitId=available[0]['id'])


def candidates(ds, state, day, row, policies=None, selected=None):
    weekly = {}
    for k, l in ds['lessons'].items():
        if selected is None or k.startswith(f'{selected}|'):
            weekly.setdefault(k.split('|')[0], set()).update(l['classes'])
    result = []
    target_cdc = ds['teachers'][row['id']].get('classe_concorso', '')
    daily_load = Counter(a['v'] for a in state['asg'].get(day, {}).values())
    total_load = Counter(a['v'] for assignments in state['asg'].values() for a in assignments.values())
    permits = recovery.ledger(state, (day, row['k']))
    for t in ds['teachers'].values():
        if selected is not None and t['id'] != selected:
            continue
        c = eligibility(ds, state, day, row, t, policies) or rp_candidate(ds, state, day, row, t, permits)
        if not c:
            continue
        cls = sorted(weekly.get(t['id'], set()))
        cdc = t.get('classe_concorso', '')
        result.append(dict(c, role=t['role'], cdc=cdc, cdcName=CDC_NAMES.get(cdc, cdc),
                           clsWeek=cls, inClass=row['c'] in cls, sameCdc=bool(cdc and cdc == target_cdc)))
    if selected in (None, 'DIR'):
        result.append(dict(id='DIR', name='Dirigente', ty='DIR', loc='centrale', why='', tag='Opzione manuale, da verificare'))
    if selected in (None, 'UNCOVERED'):
        result.append(dict(id='UNCOVERED', name='Scoperta', ty='UNCOVERED', loc=None, why='', tag='Emergenza: nessun supplente trovato'))
    effective = [h for h in HOURS if any(row['c'] in (lesson(ds, i, day, h) or {}).get('classes', []) for i in ds['teachers']) and not class_out(state, day, row['c'], h, row['k'])] if selected in (None, 'ENTRA', 'ESCE') else []
    if effective:
        info = f'La classe entra alle {effective[0]} ed esce alle {effective[-1]}'
        for cid, title, boundary in [('ENTRA', 'Entra dopo', effective[0]), ('ESCE', 'Esce prima', effective[-1])]:
            if selected in (None, cid):
                result.append(dict(id=cid, name=title, ty='SPECIAL', loc=None, why='', tag='Da verificare',
                                   enable=row['h'] == boundary, info=info))
    for c in result:
        c['today'] = daily_load[c['id']] if c['id'] in ds['teachers'] else 0
        c['total'] = total_load[c['id']] if c['id'] in ds['teachers'] else 0
        c['tier'] = rank_candidate(c, row)
    return sorted(result, key=candidate_order)


def validate_assignment(ds, state, day, key, value, policies=None, exceptional=False, saved=False):
    row = next((r for r in rows(ds, state, day) if r['k'] == key), None)
    if not row:
        raise ValueError('Supplenza non più presente nell’orario o nelle assenze.')
    old = state['asg'].get(day, {}).get(key)
    if saved and old and old.get('t') == 'RP' and old['v'] == value:
        recovery.validate(state)
        if value not in ds['teachers'] or ds['teachers'][value].get('retired') or lesson(ds, value, day, row['h']) or row['h'] in state['dis'].get(day, {}).get(value, []):
            raise ValueError('Recupero da verificare: docente non attivo o impegnato nell’orario.')
        _, why, _ = rp_context(ds, state, day, row, value)
        if why:
            raise ValueError(why)
        if row['h'] in absences(state, day).get(value, []):
            raise ValueError('Assente')
        if any(k != key and int(k.split('|')[1]) == row['h'] and a['v'] == value for k, a in state['asg'].get(day, {}).items()):
            raise ValueError('Già assegnato in questa ora')
        return dict(old)
    c = next((c for c in candidates(ds, state, day, row, policies, selected=value) if c['id'] == value), None)
    if not c or c['why']:
        raise ValueError(c['why'] if c else 'Candidato non disponibile.')
    if c.get('exceptional') and not exceptional:
        raise ValueError('Occupato: conferma esplicita necessaria.')
    if value == 'ENTRA' and not c.get('enable'):
        raise ValueError('Entra dopo disponibile solo alla prima ora effettiva della classe.')
    if value == 'ESCE' and not c.get('enable'):
        raise ValueError('Esce prima disponibile solo all’ultima ora effettiva della classe.')
    result = dict(v=value, t=c['ty'], c=row['c'])
    if c['ty'] == 'RP':
        result['permitId'] = c['permitId']
    if c.get('exceptional'):
        result['exceptional'] = True
    return result


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
            if not l or not l['classes'] or h in absences(state, day).get(i, []):
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
