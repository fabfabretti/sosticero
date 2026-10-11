import os
from datetime import date, timedelta
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, StrictInt
from .domain import normalize_dataset, rows, candidates, validate_assignment, default_availability, HOURS, SITES
from .storage import Store, EMPTY


class Edit(BaseModel):
    day: date
    until: date | None = None
    group: str
    id: str
    hours: list[StrictInt] | None = None
    site: str | None = None
    future: bool = False
    defaults: bool = False


class Assignment(BaseModel):
    day: date
    key: str
    value: str | None = None


DEFAULT_DATABASE = Path(__file__).resolve().parent.parent / 'data' / 'supplenze.sqlite'


def create_app(path=None, seed=None):
    app = FastAPI(title='Supplenze')
    database = Path(path or os.environ.get('DATABASE_PATH', DEFAULT_DATABASE))
    database.parent.mkdir(parents=True, exist_ok=True)
    store = Store(str(database))
    with store.connect() as db:
        if store.read(db, 'dataset') is None and seed:
            import json
            store.write(db, 'dataset', normalize_dataset(json.loads(Path(seed).read_text())))

    @app.exception_handler(ValueError)
    async def invalid(_, exc):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=422, content={'detail': str(exc)})

    def load(db):
        ds = store.read(db, 'dataset')
        if ds is None:
            raise ValueError('Carica prima un orario.')
        return ds, store.read(db, 'state', EMPTY)

    @app.get('/api/day/{day}')
    def get_day(day: date):
        with store.connect() as db:
            ds, state = load(db)
        d = day.isoformat()
        rs = rows(ds, state, d)
        issues = []
        for k, a in state['asg'].get(d, {}).items():
            try:
                validate_assignment(ds, state, d, k, a['v'])
            except ValueError as e:
                issues.append({'key': k, 'message': str(e)})
        return dict(dataset=ds, state=state, rows=rs, issues=issues)

    @app.post('/api/timetable')
    def import_timetable(data: dict):
        ds = normalize_dataset(data)
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            old = store.read(db, 'dataset')
            # Retired teachers remain addressable by stable ID for historical records.
            if old:
                for i, t in old['teachers'].items():
                    if i not in ds['teachers']:
                        ds['teachers'][i] = dict(t, retired=True)
            store.write(db, 'dataset', ds)
        return {'ok': True}

    @app.post('/api/entries')
    def edit(e: Edit):
        if e.group not in ('abs', 'cf', 'dis'):
            raise ValueError('Gruppo non valido.')
        if e.hours is not None and any(type(h) is not int or h not in HOURS for h in e.hours):
            raise ValueError('Ore non valide.')
        if e.site not in (*SITES, None, ''):
            raise ValueError('Sede non valida.')
        if e.until and (e.until < e.day or (e.until-e.day).days > 366):
            raise ValueError('Intervallo massimo: un anno.')
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            if e.id not in (ds['classes'] if e.group == 'cf' else ds['teachers']):
                raise ValueError('Docente o classe sconosciuto.')
            days = [e.day.isoformat()]
            if e.future:
                days += [d for d in state[e.group] if d > days[0]]
            elif e.until:
                current = e.day + timedelta(days=1)
                while current <= e.until:
                    if current.weekday() < 5:
                        days.append(current.isoformat())
                    current += timedelta(days=1)
            for d in days:
                entries = state[e.group].setdefault(d, {})
                if e.hours is None:
                    entries.pop(e.id, None)
                    if e.group == 'dis':
                        state['disSites'].setdefault(d, {}).pop(e.id, None)
                else:
                    entries[e.id] = default_availability(ds, e.id, d) if e.defaults and e.group == "dis" else sorted(set(e.hours))
                    if e.group == 'dis':
                        state['disSites'].setdefault(d, {})[e.id] = e.site or None
            store.write(db, 'state', state)
        return {'ok': True}

    @app.get('/api/candidates')
    def get_candidates(day: date, key: str):
        with store.connect() as db:
            ds, state = load(db)
        row = next((r for r in rows(ds, state, day.isoformat()) if r['k'] == key), None)
        if not row:
            raise ValueError('Supplenza non presente.')
        return candidates(ds, state, day.isoformat(), row)

    @app.post('/api/assignments')
    def assign(e: Assignment):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            assignments = state['asg'].setdefault(e.day.isoformat(), {})
            if e.value is None:
                assignments.pop(e.key, None)
            else:
                assignments[e.key] = validate_assignment(ds, state, e.day.isoformat(), e.key, e.value)
            store.write(db, 'state', state)
        return {'ok': True}

    @app.get('/api/export')
    def export():
        with store.connect() as db:
            ds, state = load(db)
        return dict(schema=1, datasetId='v1:'+','.join(sorted(ds['teachers'])), **state)

    @app.post('/api/import')
    def import_state(data: dict):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, _ = load(db)
            if data.get('schema') != 1 or data.get('datasetId') != 'v1:'+','.join(sorted(ds['teachers'])):
                raise ValueError('Archivio non compatibile.')
            state = {k: data.get(k, {}) for k in EMPTY}
            for group, dates in state.items():
                if not isinstance(dates, dict):
                    raise ValueError('Archivio non valido.')
                for d, entries in dates.items():
                    date.fromisoformat(d)
                    if not isinstance(entries, dict):
                        raise ValueError('Archivio non valido.')
                    for i, value in entries.items():
                        if group in ('abs', 'dis', 'cf'):
                            if i not in (ds['classes'] if group == 'cf' else ds['teachers']) or not isinstance(value, list) or any(type(h) is not int or h not in HOURS for h in value):
                                raise ValueError('Ore o riferimento non valido.')
                        elif group == 'disSites':
                            if i not in ds['teachers'] or value not in (*SITES, None, ''):
                                raise ValueError('Sede non valida.')
                        elif not isinstance(value, dict) or value.get('v') not in (*ds['teachers'], 'DIR', 'ENTRA', 'ESCE') or not isinstance(value.get('t'), str) or len(i.split('|')) != 3 or i.split('|')[0] not in ds['teachers'] or not i.split('|')[1].isdigit() or int(i.split('|')[1]) not in HOURS or value.get('c') != i.split('|')[2]:
                            raise ValueError('Assegnazione non valida.')
            store.write(db, 'state', state)
        return {'ok': True}

    static = Path(os.environ.get('STATIC_PATH', 'frontend/dist'))
    if static.exists():
        app.mount('/', StaticFiles(directory=static, html=True), name='frontend')
    return app


app = create_app(seed=os.environ.get('TIMETABLE_PATH', 'references/orari.json'))
