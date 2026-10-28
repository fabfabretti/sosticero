"""Minimal public projection of today's assigned substitute teachers."""
import unicodedata

from .domain import rows


def project(dataset, state, day, campus):
    current = {row['k']: row for row in rows(dataset, state, day)}
    teachers = {}
    changes = {}
    incomplete = False
    for key, assignment in state['asg'].get(day, {}).items():
        row = current.get(key)
        if not row or row['sede'] not in ('centrale', 'succursale'):
            incomplete = True
            continue
        if row['sede'] != campus:
            continue
        teacher = dataset['teachers'].get(assignment['v'])
        if assignment['v'] in ('ENTRA', 'ESCE'):
            changes.setdefault((row['c'], assignment['v']), []).append(row['h'])
            continue
        if assignment['v'] in ('DIR', 'UNCOVERED'):
            continue
        if not teacher:
            incomplete = True
            continue
        item = teachers.setdefault(assignment['v'], dict(name=teacher['name'], slots=[]))
        item['slots'].append(dict(period=row['h'], classe=row['c'], room=row['aula'] or 'Aula n.d.',
                                  replaced=[dataset['teachers'][i]['name'] for i in row['ids']]))
    for teacher in teachers.values():
        teacher['slots'].sort(key=lambda slot: (slot['period'], slot['classe']))
    ordered = sorted(teachers.values(), key=lambda t: ''.join(
        c for c in unicodedata.normalize('NFD', t['name'].casefold()) if not unicodedata.combining(c)))
    schedule = [dict(classe=classe, action=action, period=(max if action == 'ENTRA' else min)(hours))
                for (classe, action), hours in sorted(changes.items())]
    return dict(teachers=ordered, changes=schedule, incomplete=incomplete)
