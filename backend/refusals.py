"""Refusing professors belong to a dated row, independently of its assignment."""
from datetime import date
from .domain import HOURS


def validate(history):
    if not isinstance(history, dict):
        raise ValueError('Cronologia rifiuti non valida.')
    for day, entries in history.items():
        if date.fromisoformat(day).isoformat() != day or not isinstance(entries, dict):
            raise ValueError('Data o righe rifiuti non valide.')
        for key, records in entries.items():
            parts = key.split('|')
            if len(parts) != 3 or not parts[0] or parts[1] not in {str(h) for h in HOURS} or not parts[2] or not isinstance(records, list) or not records:
                raise ValueError('Riga rifiuto non valida.')
            seen = set()
            for record in records:
                if not isinstance(record, dict) or set(record) != {'teacher', 'name'} or any(not isinstance(record[f], str) or not record[f].strip() or len(record[f]) > 500 or any(ord(c) < 32 for c in record[f]) for f in ('teacher', 'name')):
                    raise ValueError('Docente rifiuto non valido.')
                if record['teacher'] in seen:
                    raise ValueError('Docente rifiuto duplicato.')
                seen.add(record['teacher'])


def record(state, day, key, teacher, name):
    records = state.setdefault('substitutionRefusals', {}).setdefault(day, {}).setdefault(key, [])
    if not any(r['teacher'] == teacher for r in records):
        records.append(dict(teacher=teacher, name=name))
