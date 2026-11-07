"""Small, date-effective scheduling facts used by the permit screen."""
from . import appointments, timetables, teacher_names
from .domain import SITES


def project(dataset, names):
    teachers = teacher_names.teachers(dataset['teachers'], names)
    fields = ('id', 'name', 'code', 'role', 'importedName', 'retired', 'unavailable')
    hours, sites = {}, {}
    for key, lesson in dataset['lessons'].items():
        teacher, weekday, hour = key.split('|')
        hours.setdefault(teacher, {}).setdefault(weekday, []).append(int(hour))
        if lesson.get('site') in SITES:
            sites.setdefault(teacher, set()).add(lesson['site'])
    return dict(teachers={i: {k: t[k] for k in fields if k in t} for i, t in teachers.items()},
                hours={i: {d: sorted(h) for d, h in days.items()} for i, days in hours.items()},
                sites={i: [s for s in SITES if s in values] for i, values in sites.items()})


def versions(history, names):
    # Project each boundary before resolving the next; never retain full copies.
    return [dict(effective=day, dataset=project(timetables.dataset(history, day or '0001-01-01'), names))
            for day in [None, *appointments.boundaries(history)]]
