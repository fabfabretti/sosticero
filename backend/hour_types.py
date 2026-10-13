"""Global hour policies; imported and derived identities never collide."""
import re
import secrets

DERIVED = {'lesson': 'Lezione', 'itp': 'Compresenza ITP', 'support': 'Sostegno', 'available': 'A disposizione'}
PALETTE = ('blue', 'green', 'purple', 'amber', 'rose', 'teal')


def canonical(value):
    return re.sub(r'[.\s]', '', value).upper()


def activity_codes(l):
    return l.get('activities', [l['special']] if l.get('special') else [])


def merge_types(ds, existing):
    result = dict(existing)
    labels = {'derived:' + k: v for k, v in DERIVED.items()}
    for l in (ds or {}).get('lessons', {}).values():
        labels.update({'code:' + c: c for c in activity_codes(l)})
    for key, label in labels.items():
        if key not in result:
            known = key in ('code:POT', 'code:UTC', 'code:UTS', 'code:DIS', 'derived:available')
            school = False if key == 'code:GM' else True if known or key.startswith('derived:') else None
            result[key] = dict(label=label, available=known, visible=known or key in ('derived:itp', 'derived:support'), school=school, color=secrets.choice(PALETTE))
    return result


def validate_types(data):
    if not isinstance(data, dict):
        raise ValueError('Tipi di ora non validi.')
    for key, p in data.items():
        if (not isinstance(key, str) or not key.startswith(('code:', 'derived:')) or not key.split(':', 1)[1]
                or not isinstance(p, dict) or set(p) != {'label', 'available', 'visible', 'school', 'color'}
                or not isinstance(p['label'], str) or not p['label'] or len(p['label']) > 200
                or type(p['available']) is not bool or type(p['visible']) is not bool
                or p['school'] is not None and type(p['school']) is not bool
                or p['color'] not in PALETTE):
            raise ValueError('Regola tipo di ora non valida.')
    return data
