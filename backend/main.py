import os
from datetime import date, timedelta, datetime
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, StrictInt, StrictBool
from .domain import normalize_dataset, rows, candidates, validate_assignment, default_availability, auto_availability, HOURS, SITES, lesson, validate_permit
from .storage import Store, EMPTY
from . import backup
from .hour_types import merge_types, validate_types
from . import statistics, recovery


class Edit(BaseModel):
    day: date
    until: date | None = None
    group: str
    id: str
    hours: list[StrictInt] | None = None
    site: str | None = None
    future: bool = False
    defaults: bool = False


class Permit(BaseModel):
    requested_on: date | None = None
    day: date
    id: str
    hours: list[StrictInt] | None = None
    original_day: date | None = None
    original_id: str | None = None


class Assignment(BaseModel):
    exceptional: StrictBool = False
    day: date
    key: str
    value: str | None = None


class RestoreRequest(BaseModel):
    filename: str
    confirm: bool = False


DEFAULT_DATABASE = Path(__file__).resolve().parent.parent / 'data' / 'supplenze.sqlite'


def create_app(path=None, seed=None):
    app = FastAPI(title='Supplenze')
    database = Path(path or os.environ.get('DATABASE_PATH', DEFAULT_DATABASE))
    database.parent.mkdir(parents=True, exist_ok=True)
    
    # Backup configuration
    backup_dir = Path(os.environ.get('BACKUP_DIR', str(database.parent / 'backups')))
    retention_count = int(os.environ.get('BACKUP_RETENTION_COUNT', '10'))
    retention_days = int(os.environ.get('BACKUP_RETENTION_DAYS', '7'))
    backup_on_startup = os.environ.get('BACKUP_ON_STARTUP', 'true').lower() == 'true'
    
    store = Store(str(database))
    with store.connect() as db:
        if store.read(db, 'dataset') is None and seed:
            import json
            store.write(db, 'dataset', normalize_dataset(json.loads(Path(seed).read_text())))

    def initialize_statistics():
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds = store.read(db, 'dataset')
            if ds and store.read(db, 'statistics') is None:
                store.write(db, 'statistics', statistics.sync(ds, store.read(db, 'state', EMPTY), statistics.empty(), reconstructed=True))

    # Perform startup backup if enabled
    if backup_on_startup and database.exists():
        try:
            today = datetime.now().date()
            # Check if backup already exists for today
            backups = backup.list_backups(str(backup_dir))
            today_backed_up = any(
                datetime.fromisoformat(b['created_at']).date() == today
                for b in backups
            )
            if not today_backed_up:
                backup.backup_database(str(database), str(backup_dir))
                backup.prune_backups(str(backup_dir), retention_count, retention_days)
        except Exception as e:
            # Don't prevent app from starting on backup failure
            print(f'Backup failed: {e}')

    with store.connect() as db:
        db.execute('BEGIN IMMEDIATE')
        state = store.read(db, 'state', EMPTY)
        if recovery.migrate(state):
            store.write(db, 'state', state)

    initialize_statistics()

    @app.exception_handler(ValueError)
    async def invalid(_, exc):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=422, content={'detail': str(exc)})

    def policies(db, ds):
        old = store.read(db, "hourTypes", {})
        merged = merge_types(ds, old)
        if merged != old:
            store.write(db, "hourTypes", merged)
        return merged

    @app.get("/api/hour-types")
    def get_types():
        with store.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            ds = store.read(db, "dataset")
            return dict(types=policies(db, ds), needsReimport=bool(ds and any("activities" not in l for l in ds["lessons"].values())))

    @app.post("/api/hour-types")
    def update_type(data: dict):
        with store.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            current = policies(db, store.read(db, "dataset"))
            key = data.get("id")
            if not isinstance(key, str) or key not in current or set(data) != {"id", "available", "visible", "school"}:
                raise ValueError("Tipo di ora non valido.")
            value = dict(current[key], **{k: data[k] for k in ("available", "visible", "school")})
            validate_types({key: value})
            current[key] = value
            store.write(db, "hourTypes", current)
            return current

    def load(db):
        ds = store.read(db, 'dataset')
        if ds is None:
            raise ValueError('Carica prima un orario.')
        state = store.read(db, 'state', EMPTY)
        state.setdefault('permessi', {})
        state.setdefault('permitRequests', {})
        state.setdefault('permitIds', {})
        return ds, state

    def save_state(db, ds, state, days):
        facts = store.read(db, 'statistics', statistics.empty())
        store.write(db, 'statistics', statistics.sync(ds, state, facts, days))
        store.write(db, 'state', state)

    @app.get('/api/stats')
    def get_stats(campus: str = 'total', period: str = 'all', start: date | None = None, end: date | None = None):
        with store.connect() as db:
            facts = store.read(db, 'statistics', statistics.empty())
        return statistics.report(facts, campus, period, start, end)

    @app.get('/api/day/{day}')
    def get_day(day: date):
        with store.connect() as db:
            ds, state = load(db)
            rules = policies(db, ds)
        d = day.isoformat()
        rs = rows(ds, state, d)
        issues = []
        for k, a in state['asg'].get(d, {}).items():
            try:
                validate_assignment(ds, state, d, k, a['v'], saved=True)
            except ValueError as e:
                issues.append({'key': k, 'message': str(e)})
        return dict(dataset=ds, state=state, rows=rs, issues=issues, autoDis={d: auto_availability(ds, state, d)})

    @app.get('/api/permessi')
    def get_permits():
        with store.connect() as db:
            ds, state = load(db)
        summaries, balances = recovery.summary(state)
        return dict(dataset=ds, permessi=state['permessi'], permitRequests=state['permitRequests'], recoveries=summaries, balances=balances)

    @app.post('/api/permessi')
    def save_permit(e: Permit):
        if (e.original_day is None) != (e.original_id is None):
            raise ValueError('Riferimento originale incompleto.')
        d = e.day.isoformat()
        source = (e.original_day.isoformat(), e.original_id) if e.original_day else None
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            permits = state['permessi']
            if source and source[1] not in permits.get(source[0], {}):
                raise ValueError('Permesso originale non più presente.')
            old_day, old_teacher = source or (d, e.id)
            pid = state['permitIds'].get(old_day, {}).get(old_teacher)
            if pid:
                recovery.protect(state, pid, e.id, d, e.hours)
            if e.hours is None:
                state['permitIds'].get(d, {}).pop(e.id, None)
                permits.get(d, {}).pop(e.id, None)
                state['permitRequests'].get(d, {}).pop(e.id, None)
            else:
                validate_permit(ds, e.id, e.hours)
                if ds['teachers'][e.id].get('retired') and (not source or source[1] != e.id):
                    raise ValueError('Docente non più in servizio.')
                if e.id in permits.get(d, {}) and source != (d, e.id):
                    raise ValueError('Permesso già presente: modifica la registrazione esistente.')
                maximum = sum(lesson(ds, e.id, d, h) is not None for h in HOURS) // 2
                if len(e.hours) > maximum:
                    raise ValueError(f'Massimo giornaliero: {maximum} ore di permesso.')
                if source:
                    state['permitIds'].get(source[0], {}).pop(source[1], None)
                    permits[source[0]].pop(source[1])
                    state['permitRequests'].get(source[0], {}).pop(source[1], None)
                permits.setdefault(d, {})[e.id] = sorted(e.hours)
                state['permitRequests'].get(d, {}).pop(e.id, None)
                if e.requested_on:
                    state['permitRequests'].setdefault(d, {})[e.id] = e.requested_on.isoformat()
            recovery.migrate(state)
            if e.hours is not None and pid:
                state['permitIds'][d][e.id] = pid
            recovery.validate(state)
            save_state(db, ds, state, {d, source[0]} if source else {d})
        return {'ok': True}

    @app.post('/api/timetable')
    def import_timetable(data: dict):
        ds = normalize_dataset(data)
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            old = store.read(db, 'dataset')
            if store.read(db, 'statistics') is None:
                store.write(db, 'statistics', statistics.sync(old or ds, store.read(db, 'state', EMPTY), statistics.empty(), reconstructed=True))
            # Retired teachers remain addressable by stable ID for historical records.
            if old:
                for i, t in old['teachers'].items():
                    if i not in ds['teachers']:
                        ds['teachers'][i] = dict(t, retired=True)
            store.write(db, 'dataset', ds)
            policies(db, ds)
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
            save_state(db, ds, state, days if e.group != 'dis' else [])
        return {'ok': True}

    @app.get('/api/candidates')
    def get_candidates(day: date, key: str):
        with store.connect() as db:
            ds, state = load(db)
            rules = policies(db, ds)
        row = next((r for r in rows(ds, state, day.isoformat()) if r['k'] == key), None)
        if not row:
            raise ValueError('Supplenza non presente.')
        return candidates(ds, state, day.isoformat(), row, rules)

    @app.post('/api/assignments')
    def assign(e: Assignment):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            assignments = state['asg'].setdefault(e.day.isoformat(), {})
            if e.value is None:
                assignments.pop(e.key, None)
            else:
                old = assignments.get(e.key)
                unchanged = old and old['v'] == e.value and old.get('t') == 'RP'
                if not unchanged:
                    assignments.pop(e.key, None)
                assignments[e.key] = validate_assignment(ds, state, e.day.isoformat(), e.key, e.value, policies(db, ds), e.exceptional, saved=bool(unchanged))
            recovery.validate(state)
            save_state(db, ds, state, [e.day.isoformat()])
        return {'ok': True}

    @app.get('/api/export')
    def export():
        with store.connect() as db:
            ds, state = load(db)
            rules = policies(db, ds)
            facts = store.read(db, 'statistics', statistics.empty())
        return dict(schema=2, datasetId='v1:'+','.join(sorted(ds['teachers'])), hourTypes=rules, statistics=facts, **state)

    @app.post('/api/import')
    def import_state(data: dict):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, _ = load(db)
            if type(data.get('schema')) is not int or data['schema'] not in (1, 2) or data.get('datasetId') != 'v1:'+','.join(sorted(ds['teachers'])):
                raise ValueError('Archivio non compatibile.')
            rules = validate_types(data['hourTypes']) if 'hourTypes' in data else None
            state = {k: data.get(k, {}) for k in EMPTY}
            for group, dates in state.items():
                if not isinstance(dates, dict):
                    raise ValueError('Archivio non valido.')
                for d, entries in dates.items():
                    date.fromisoformat(d)
                    if not isinstance(entries, dict):
                        raise ValueError('Archivio non valido.')
                    for i, value in entries.items():
                        if group == 'permitIds':
                            if i not in state['permessi'].get(d, {}) or not isinstance(value, str):
                                raise ValueError('Identità permesso non valida.')
                        elif group == 'permitRequests':
                            if i not in state['permessi'].get(d, {}) or not isinstance(value, str):
                                raise ValueError('Data richiesta senza permesso valido.')
                            date.fromisoformat(value)
                        elif group == 'permessi':
                            validate_permit(ds, i, value)
                        elif group in ('abs', 'dis', 'cf'):
                            if i not in (ds['classes'] if group == 'cf' else ds['teachers']) or not isinstance(value, list) or any(type(h) is not int or h not in HOURS for h in value):
                                raise ValueError('Ore o riferimento non valido.')
                        elif group == 'disSites':
                            if i not in ds['teachers'] or value not in (*SITES, None, ''):
                                raise ValueError('Sede non valida.')
                        elif not isinstance(value, dict) or ('exceptional' in value and type(value['exceptional']) is not bool) or value.get('v') not in (*ds['teachers'], 'DIR', 'ENTRA', 'ESCE', 'UNCOVERED') or not isinstance(value.get('t'), str) or len(i.split('|')) != 3 or i.split('|')[0] not in ds['teachers'] or not i.split('|')[1].isdigit() or int(i.split('|')[1]) not in HOURS or value.get('c') != i.split('|')[2]:
                            raise ValueError('Assegnazione non valida.')
            if data['schema'] == 1:
                if data.get('permitIds') or any(a.get('t') == 'RP' or 'permitId' in a for entries in state['asg'].values() for a in entries.values()):
                    raise ValueError('Archivio recuperi richiede schema 2.')
                recovery.migrate(state)
            recovery.validate(state)
            facts = statistics.validate(data['statistics'], ds, state) if 'statistics' in data else statistics.sync(ds, state, statistics.empty(), reconstructed=True)
            if rules is not None:
                store.write(db, 'hourTypes', merge_types(ds, rules))
            store.write(db, 'state', state)
            store.write(db, 'statistics', facts)
        return {'ok': True}

    @app.get('/api/backups')
    def list_backups_endpoint():
        try:
            return backup.list_backups(str(backup_dir))
        except Exception as e:
            raise ValueError(str(e))

    @app.post('/api/backups')
    def create_backup_endpoint():
        try:
            res = backup.backup_database(str(database), str(backup_dir))
            backup.prune_backups(str(backup_dir), retention_count, retention_days)
            return res
        except Exception as e:
            raise ValueError(str(e))

    @app.post('/api/backups/restore')
    def restore_backup_endpoint(req: RestoreRequest):
        try:
            if not req.confirm:
                raise ValueError('Conferma richiesta per il ripristino')
            backups = backup.list_backups(str(backup_dir))
            backup_path = None
            for b in backups:
                if b['filename'] == req.filename:
                    backup_path = b['path']
                    break
            if not backup_path:
                raise ValueError('Backup non trovato')
            backup.restore_backup(str(database), backup_path)
            with store.connect() as db:
                db.execute('BEGIN IMMEDIATE')
                state = store.read(db, 'state', EMPTY)
                if recovery.migrate(state):
                    store.write(db, 'state', state)
            initialize_statistics()
            return {'ok': True}
        except Exception as e:
            raise ValueError(str(e))

    static = Path(os.environ.get('STATIC_PATH', 'frontend/dist'))
    if static.exists():
        app.mount('/', StaticFiles(directory=static, html=True), name='frontend')
    return app


app = create_app(seed=os.environ.get('TIMETABLE_PATH', 'references/orari.json'))
