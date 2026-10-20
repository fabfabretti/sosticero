"""Presentation-only teacher names; imported identities and records stay untouched."""
import unicodedata


def empty():
    return dict(schema=1, teachers={})


def validate(document, catalog):
    if not isinstance(document, dict) or set(document) != {'schema', 'teachers'} or type(document['schema']) is not int or document['schema'] != 1 or not isinstance(document['teachers'], dict):
        raise ValueError('Nomi personalizzati non validi.')
    for identifier, names in document['teachers'].items():
        if identifier not in catalog or not isinstance(names, dict) or set(names) != {'name', 'originalName'}:
            raise ValueError('Riferimento docente o nome personalizzato non valido.')
        for value in names.values():
            if not isinstance(value, str) or not value.strip() or value != value.strip() or len(value) > 200 or any(unicodedata.category(c).startswith('C') for c in value):
                raise ValueError('Inserisci nomi validi, fino a 200 caratteri e senza caratteri di controllo.')
    return document


def catalog(history):
    return {i for v in history['versions'] for i in v['dataset']['teachers']} if history else set()


def teachers(source, document):
    result = {}
    for identifier, teacher in source.items():
        names = document['teachers'].get(identifier)
        result[identifier] = dict(teacher, importedName=teacher['name'], nameOverride=names,
                                  name=f"{names['name']} ({names['originalName']})") if names else dict(teacher)
    return result


def dataset(source, document):
    return dict(source, teachers=teachers(source['teachers'], document))


def normalize(value):
    return ' '.join(value.casefold().split())


def matches(source, document, value):
    wanted = normalize(value)
    presented = teachers(source, document)
    return [i for i, teacher in source.items() if wanted in {
        normalize(label) for label in [teacher['name'], presented[i]['name'],
                                      *document['teachers'].get(i, {}).values()]}]
