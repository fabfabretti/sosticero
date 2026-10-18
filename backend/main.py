import os
import sqlite3
from datetime import date, timedelta, datetime
from pathlib import Path
from typing import Literal
from uuid import uuid4
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, StrictInt, StrictBool, StrictStr
from .domain import normalize_dataset, rows, candidates, validate_assignment, default_availability, auto_availability, HOURS, SITES, lesson, validate_permit, CDC_NAMES
from .storage import Store, EMPTY
from . import backup, attachments
from .hour_types import merge_types, validate_types
from . import statistics, recovery, timetables, overrides
from zoneinfo import ZoneInfo
from hashlib import sha256
from copy import deepcopy


class Attachment(BaseModel):
    model_config = {"extra": "forbid"}
    mediaType: StrictStr
    data: StrictStr


class Edit(BaseModel):
    attachment: Attachment | None = None
    note: StrictStr | None = None
    classification: Literal['planned', 'last_minute', 'trip', 'strike'] | None = None
    day: date
    until: date | None = None
    group: str
    id: str
    hours: list[StrictInt] | None = None
    site: str | None = None
    future: bool = False
    defaults: bool = False


class Permit(BaseModel):
    attachment: Attachment | None = None
    note: StrictStr | None = None
    classification: Literal['planned', 'last_minute', 'trip', 'strike'] | None = None
    requested_on: date | None = None
    day: date
    id: str
    hours: list[StrictInt] | None = None
    original_day: date | None = None
    original_id: str | None = None


class Assignment(BaseModel):
    communicated: StrictBool | None = None
    replace_key: str | None = None
    exceptional: StrictBool = False
    day: date
    key: str
    value: str | None = None


class ManualPermit(BaseModel):
    model_config = {"extra": "forbid"}
    note: StrictStr | None = None
    id: str
    hours: StrictInt | None = None
    editing: StrictBool = False


class RestoreRequest(BaseModel):
    filename: str
    confirm: bool = False


DEFAULT_DATABASE = Path(__file__).resolve().parent.parent / 'data' / 'supplenze.sqlite'


def create_app(path=None, seed=None):
    app = FastAPI(title='Sosticero')
    testing = os.environ.get('APP_ENV') != 'production'

    @app.get('/api/environment')
    def environment():
        return {'testing': testing}

    selected = path or os.environ.get('DATABASE_PATH')
    if not selected:
        raise RuntimeError('Select an explicit DATABASE_PATH before starting the app.')
    database = Path(selected).resolve()
    production_marker = database.parent / '.sosticero-production'
    if testing and (database == DEFAULT_DATABASE or production_marker.exists()):
        raise RuntimeError('Testing mode cannot open the operational data directory.')
    database.parent.mkdir(parents=True, exist_ok=True)
    if not testing:
        production_marker.touch(exist_ok=True)
    seed = seed or os.environ.get('TIMETABLE_PATH')
    
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

    def read_history(db):
        value = store.read(db, 'timetables')
        if value is not None:
            value['_overrides'] = store.read(db, 'timetableOverrides', overrides.empty())
        return value

    def write_history(db, value):
        store.write(db, 'timetables', {k: v for k, v in value.items() if k != '_overrides'})
        store.write(db, 'timetableOverrides', value.get('_overrides', overrides.empty()))

    def initialize_statistics():
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds = store.read(db, 'dataset')
            if ds and read_history(db) is None:
                store.write(db, 'timetables', timetables.baseline(ds))
            if ds and store.read(db, 'statistics') is None:
                store.write(db, 'statistics', timetables.sync(read_history(db), store.read(db, 'state', EMPTY), statistics.empty(), reconstructed=True))

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

    @app.exception_handler(sqlite3.OperationalError)
    async def database_busy(_, exc):
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={'detail': 'Database occupato o non disponibile. Nessuna modifica parziale applicata; riprova.'})

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
            history = read_history(db)
            ds = timetables.dataset(history, datetime.now(ZoneInfo("Europe/Rome")).date().isoformat()) if history else store.read(db, "dataset")
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

    def load(db, day=None):
        history = read_history(db)
        ds = timetables.dataset(history, day or datetime.now(ZoneInfo('Europe/Rome')).date().isoformat()) if history else store.read(db, 'dataset')
        if ds is None:
            raise ValueError('Carica prima un orario.')
        state = store.read(db, 'state', EMPTY)
        state.setdefault('permessi', {})
        state.setdefault('permitRequests', {})
        state.setdefault('permitIds', {})
        state.setdefault('absenceKinds', {})
        state.setdefault('permitKinds', {})
        state.setdefault('absenceNotes', {})
        state.setdefault('permitNotes', {})
        state.setdefault('manualPermitNotes', {})
        state.setdefault('manualPermits', {})
        for group in attachments.GROUPS:
            state.setdefault(group, {})
        return ds, state

    def save_state(db, ds, state, days, revalidate=False):
        facts = store.read(db, 'statistics', statistics.empty())
        store.write(db, 'statistics', timetables.sync(read_history(db), state, facts, days, revalidate=revalidate))
        store.write(db, 'state', state)
        attachments.prune(db, state)

    from .inbox import Inbox
    inbox = Inbox(store, database, load, save_state)
    inbox.register(app)
    app.state.inbox = inbox

    @app.get('/api/attachments/{identifier}')
    def get_attachment(identifier: str):
        from fastapi.responses import Response
        with store.connect() as db:
            db.execute('BEGIN')
            state = store.read(db, 'state', EMPTY)
            row = db.execute('SELECT media_type, content FROM attachments WHERE id=?', (identifier,)).fetchone() if identifier in attachments.references(state) else None
        if row is None:
            raise HTTPException(status_code=404, detail='Allegato non trovato.')
        return Response(row[1], media_type=row[0], headers={'Content-Disposition': 'inline', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store'})

    @app.get('/api/stats')
    def get_stats(campus: str = 'total', period: str = 'all', start: date | None = None, end: date | None = None):
        with store.connect() as db:
            facts = store.read(db, 'statistics', statistics.empty())
        return statistics.report(facts, campus, period, start, end)

    @app.get('/api/day/{day}')
    def get_day(day: date):
        with store.connect() as db:
            ds, state = load(db, day.isoformat())
            rules = policies(db, ds)
            history = read_history(db)
            facts = store.read(db, 'statistics', statistics.empty())
        d = day.isoformat()
        rs = rows(ds, state, d)
        problems = timetables.issues(ds, state, d, rules)
        for item in problems:
            item['context'] = timetables.conflict_context(history, d, item['key'], state['asg'][d][item['key']]) or timetables.context(history, state, d, item['key'], facts)
        selected = timetables.version(history, d)
        return dict(dataset=ds, state=state, rows=rs, issues=problems, references=timetables.reference_issues(history, state, d),
                    timetable=dict(id=selected['id'], effective=selected['effective']), autoDis={d: auto_availability(ds, state, d)})

    @app.get('/api/orari')
    def get_orari(day: date | None = None):
        viewed = (day or datetime.now(ZoneInfo("Europe/Rome")).date()).isoformat()
        with store.connect() as db:
            history = read_history(db)
            if history:
                selected = timetables.version(history, viewed)
                effective, ds = selected['effective'], timetables.dataset(history, viewed)
            else:
                ds, effective = store.read(db, 'dataset'), None
                if ds is None:
                    raise ValueError('Carica prima un orario.')
        teachers = {i: dict(t, cdcName=CDC_NAMES.get(t.get('classe_concorso', ''), t.get('classe_concorso', ''))) for i, t in ds['teachers'].items()}
        return dict(effective=effective, day=viewed, version=selected['id'] if history else '', dataset=dict(ds, teachers=teachers),
                    basis=timetables.digest(history), imported=selected['dataset'] if history else ds,
                    overrides=history.get('_overrides', overrides.empty())['records'] if history else [])

    def override_plan(db, data):
        history = read_history(db)
        if not history:
            raise ValueError('Carica prima un orario.')
        if data.get('basis') != timetables.digest(history):
            raise HTTPException(status_code=409, detail='Orario modificato: ricarica e verifica la bozza.')
        document, report = overrides.propose(history['_overrides'], history, data)
        proposed = dict(history, _overrides=document)
        state = store.read(db, 'state', EMPTY)
        facts = store.read(db, 'statistics', statistics.empty())
        schedules = {}
        def schedule(source, day):
            selected = timetables.version(source, day)
            records = source['_overrides']['records']
            active = tuple(sorted((teacher, record['id'] if record else None) for teacher in {r['teacher'] for r in records}
                                  if (record := overrides.selected(source['_overrides'], teacher, day))))
            key = id(source), selected['id'], active
            if key not in schedules:
                schedules[key] = timetables.dataset(source, day)
            return schedules[key]
        rules = merge_types(schedule(proposed, data['start']), store.read(db, 'hourTypes', {}))
        evidence = dict(record=document['records'][-1]['id'], previous={}, assignments={})
        days = []
        affected = {}
        problems_by_day = {}
        affected_weekdays = {overrides.DAYS.index(key.split('|')[0]) for record in document['records'] if record['teacher'] == data['teacher']
                             for group in record['groups'] for key in group['before']}
        same_start_revision = any(r['teacher'] == data['teacher'] and r['start'] == data['start']
                                  for r in history['_overrides']['records'])
        for day in timetables.dates(state, facts):
            if day < data['start'] or (data.get('end') and day > data['end'] and not same_start_revision) or date.fromisoformat(day).weekday() not in affected_weekdays:
                continue
            before, after = schedule(history, day), schedule(proposed, day)
            if before == after:
                continue
            problems = timetables.issues(after, state, day, rules)
            affected[day] = after
            problems_by_day[day] = problems
            evidence['previous'][day] = facts['days'].get(day)
            evidence['assignments'][day] = {k: timetables.conflict_context(history, day, k, a) or timetables.context(history, state, day, k, facts, before) for k, a in state['asg'].get(day, {}).items()}
            previous_problems = timetables.issues(before, state, day, rules)
            days.append(dict(day=day, issues=[p for p in problems if p not in previous_problems], assignments=list(state['asg'].get(day, {}))))
        result = deepcopy(facts)
        for day in affected:
            result['days'].pop(day, None)
        result = statistics.sync(lambda day: affected[day], state, result, affected)
        for day, problems in problems_by_day.items():
            if day in result['days']:
                result['days'][day]['issues'] = sorted(set(result['days'][day]['issues']) | {i['key'] for i in problems})
                problem_keys = {i['key'] for i in problems}
                for demand in result['days'][day]['demand'].values():
                    if demand['key'] in problem_keys:
                        demand.update(eligible=False, valid=False, outcome='pending')
        document['evidence'].append(evidence)
        documents = db.execute('SELECT key, value FROM documents ORDER BY key').fetchall()
        # UUIDs are evidence identities, not part of the preview fingerprint.
        token = timetables.digest([documents, {k: v for k, v in data.items() if k != 'token'}])
        return document, result, dict(token=token, days=days, overrides=report)

    @app.post('/api/orari/preview')
    def preview_override(data: dict):
        with store.connect() as db:
            db.execute('BEGIN')
            _, _, impact = override_plan(db, data)
        return impact

    @app.post('/api/orari/override')
    def save_override(data: dict):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            document, facts, impact = override_plan(db, data)
            if not data.get('token') or data['token'] != impact['token']:
                raise HTTPException(status_code=409, detail='Anteprima scaduta: genera una nuova anteprima.')
            backup.backup_database(str(database), str(backup_dir))
            store.write(db, 'timetableOverrides', document)
            store.write(db, 'statistics', facts)
        return dict(ok=True)

    @app.get('/api/permessi')
    def get_permits():
        with store.connect() as db:
            ds, state = load(db)
            versions = read_history(db)['versions']
        summaries, balances = recovery.summary(state)
        manual = {p['teacher']: p for p in recovery.ledger(state).values() if p['date'] is None}
        return dict(dataset=ds, timetableVersions=[dict(effective=v['effective'], dataset=v['dataset']) for v in versions], permitAttachments=state['permitAttachments'], permessi=state['permessi'], permitRequests=state['permitRequests'], permitNotes=state['permitNotes'], permitKinds=state['permitKinds'], recoveries=summaries, balances=balances, manualPermits=manual, manualPermitNotes=state['manualPermitNotes'])

    @app.post('/api/manual-permits')
    def save_manual_permit(e: ManualPermit):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            existing = state['manualPermits'].get(e.id)
            if e.id not in ds['teachers'] or (ds['teachers'][e.id].get('retired') and not existing):
                raise ValueError('Docente non valido.')
            if e.hours is not None and (e.hours < 1 or (existing and not e.editing) or (e.editing and not existing)):
                raise ValueError('Ore non valide o saldo già presente: modifica la registrazione esistente.')
            if existing:
                p = recovery.ledger(state)[existing['id']]
                if p['recovered'] and (e.hours is None or e.hours < p['recovered']):
                    raise ValueError('Saldo con recuperi collegati: risolvi prima le assegnazioni RP interessate.')
            if e.hours is None:
                state['manualPermits'].pop(e.id, None)
                state['manualPermitNotes'].pop(e.id, None)
            else:
                state['manualPermits'][e.id] = dict(id=existing['id'] if existing else uuid4().hex, hours=e.hours)
                if 'note' in e.model_fields_set:
                    state['manualPermitNotes'].pop(e.id, None)
                    if note := (e.note or '').strip():
                        state['manualPermitNotes'][e.id] = note
            recovery.validate(state)
            store.write(db, 'state', state)
        return {'ok': True}

    @app.post('/api/permessi')
    def save_permit(e: Permit):
        if (e.original_day is None) != (e.original_id is None):
            raise ValueError('Riferimento originale incompleto.')
        d = e.day.isoformat()
        source = (e.original_day.isoformat(), e.original_id) if e.original_day else None
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db, d)
            permits = state['permessi']
            if source and source[1] not in permits.get(source[0], {}):
                raise ValueError('Permesso originale non più presente.')
            old_day, old_teacher = source or (d, e.id)
            classification = e.classification if 'classification' in e.model_fields_set else state['permitKinds'].get(old_day, {}).get(old_teacher)
            note = (e.note or '').strip() if 'note' in e.model_fields_set else state['permitNotes'].get(old_day, {}).get(old_teacher)
            attachment = state['permitAttachments'].get(old_day, {}).get(old_teacher)
            if 'attachment' in e.model_fields_set:
                attachment = attachments.insert(db, e.attachment.model_dump() if e.attachment else None)
            pid = state['permitIds'].get(old_day, {}).get(old_teacher)
            if pid:
                recovery.protect(state, pid, e.id, d, e.hours)
            if e.hours is None:
                state['permitIds'].get(d, {}).pop(e.id, None)
                permits.get(d, {}).pop(e.id, None)
                state['permitRequests'].get(d, {}).pop(e.id, None)
                state['permitNotes'].get(d, {}).pop(e.id, None)
                state['permitKinds'].get(d, {}).pop(e.id, None)
                state['permitAttachments'].get(d, {}).pop(e.id, None)
            else:
                validate_permit(ds, e.id, e.hours)
                if ds['teachers'][e.id].get('retired') and (not source or source[1] != e.id):
                    raise ValueError('Docente non più in servizio.')
                if e.id in permits.get(d, {}) and source != (d, e.id):
                    raise ValueError('Permesso già presente: modifica la registrazione esistente.')
                if source:
                    state['permitIds'].get(source[0], {}).pop(source[1], None)
                    permits[source[0]].pop(source[1])
                    state['permitRequests'].get(source[0], {}).pop(source[1], None)
                    state['permitNotes'].get(source[0], {}).pop(source[1], None)
                    state['permitKinds'].get(source[0], {}).pop(source[1], None)
                    state['permitAttachments'].get(source[0], {}).pop(source[1], None)
                permits.setdefault(d, {})[e.id] = sorted(e.hours)
                state['permitAttachments'].get(d, {}).pop(e.id, None)
                if attachment:
                    state['permitAttachments'].setdefault(d, {})[e.id] = attachment
                state['permitNotes'].get(d, {}).pop(e.id, None)
                state['permitKinds'].get(d, {}).pop(e.id, None)
                if note:
                    state['permitNotes'].setdefault(d, {})[e.id] = note
                if classification:
                    state['permitKinds'].setdefault(d, {})[e.id] = classification
                state['permitRequests'].get(d, {}).pop(e.id, None)
                if e.requested_on:
                    state['permitRequests'].setdefault(d, {})[e.id] = e.requested_on.isoformat()
            recovery.migrate(state)
            if e.hours is not None and pid:
                state['permitIds'][d][e.id] = pid
            recovery.validate(state)
            save_state(db, ds, state, {d, source[0]} if source else {d})
        return {'ok': True}

    def timetable_plan(db, data, effective):
        ds = normalize_dataset(data)
        history = read_history(db)
        state = store.read(db, 'state', EMPTY)
        for group in EMPTY:
            state.setdefault(group, {})
        facts = store.read(db, 'statistics', statistics.empty())
        rules = merge_types(ds, store.read(db, 'hourTypes', {}))
        proposed, reconciled, impact = timetables.plan(history, ds, effective, state, facts, rules)
        documents = db.execute('SELECT key, value FROM documents ORDER BY key').fetchall()
        images = [(i, media, sha256(content).hexdigest()) for i, media, content in db.execute('SELECT id, media_type, content FROM attachments ORDER BY id')]
        impact['token'] = timetables.digest([documents, images, ds, effective])
        impact['teachers'] = {i: t['name'] for i, t in ds['teachers'].items()}
        if history:
            impact['previousTeachers'] = {i: t['name'] for i, t in timetables.version(history, effective)['dataset']['teachers'].items()}
        return proposed, reconciled, impact

    @app.post('/api/timetable/preview')
    def preview_timetable(data: dict, effective: date):
        with store.connect() as db:
            db.execute('BEGIN')
            _, _, impact = timetable_plan(db, data, effective.isoformat())
        return impact

    @app.post('/api/timetable')
    def import_timetable(data: dict, confirm: bool = False, effective: date | None = None, token: str | None = None):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            history = read_history(db)
            # Initial loading remains compatible; replacing any existing timetable requires review.
            if (history or not testing) and not confirm:
                raise HTTPException(status_code=409, detail='Conferma esplicita richiesta per importare l’orario.')
            if history and (effective is None or token is None):
                raise HTTPException(status_code=409, detail='Seleziona la decorrenza e genera l’anteprima prima di confermare.')
            proposed, facts, impact = timetable_plan(db, data, effective.isoformat() if effective else None)
            if token is not None and token != impact['token']:
                raise HTTPException(status_code=409, detail='Anteprima scaduta: dati o orario modificati. Genera una nuova anteprima.')
            try:
                snapshot = backup.backup_database(str(database), str(backup_dir))
            except Exception as exc:
                raise ValueError('Backup prima dell’importazione fallito. Nessun dato modificato: ' + str(exc)) from exc
            write_history(db, proposed)
            store.write(db, 'statistics', facts)
            # Legacy dataset is a preserved baseline, never the latest scheduled version.
            if not history:
                store.write(db, 'dataset', proposed['versions'][0]['dataset'])
            policies(db, normalize_dataset(data))
        return dict(ok=True, backup=snapshot, impact=impact)

    @app.post('/api/entries')
    def edit(e: Edit):
        if 'attachment' in e.model_fields_set and e.group not in ('abs', 'dis'):
            raise ValueError('Allegati consentiti solo per assenze o disposizioni docenti.')
        if 'note' in e.model_fields_set and e.group != 'abs':
            raise ValueError('Note consentite solo per assenze docenti.')
        if 'classification' in e.model_fields_set and e.group != 'abs':
            raise ValueError('Classificazione consentita solo per assenze docenti.')
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
            days = [e.day.isoformat()]
            if e.future:
                days += [d for d in state[e.group] if d > days[0]]
            elif e.until:
                current = e.day + timedelta(days=1)
                while current <= e.until:
                    if current.weekday() < 5:
                        days.append(current.isoformat())
                    current += timedelta(days=1)
            attachment = attachments.insert(db, e.attachment.model_dump() if e.attachment else None) if 'attachment' in e.model_fields_set else None
            attachment_group = {'abs': 'absenceAttachments', 'dis': 'disAttachments'}.get(e.group)
            for d in days:
                ds, _ = load(db, d)
                active = timetables.version(read_history(db), d)['dataset']
                if e.id not in (ds['classes'] if e.group == 'cf' else ds['teachers']):
                    raise ValueError('Docente o classe sconosciuto.')
                if e.hours is not None and e.id not in state[e.group].get(d, {}) and e.id not in (active['classes'] if e.group == 'cf' else active['teachers']):
                    raise ValueError('Docente o classe non attivo nella data selezionata.')
                if attachment_group and (e.hours is None or 'attachment' in e.model_fields_set):
                    state[attachment_group].get(d, {}).pop(e.id, None)
                    if e.hours is not None and attachment:
                        state[attachment_group].setdefault(d, {})[e.id] = attachment
                entries = state[e.group].setdefault(d, {})
                if e.hours is None:
                    entries.pop(e.id, None)
                    if e.group == 'abs':
                        state['absenceNotes'].get(d, {}).pop(e.id, None)
                        state['absenceKinds'].get(d, {}).pop(e.id, None)
                    if e.group == 'dis':
                        state['disSites'].setdefault(d, {}).pop(e.id, None)
                else:
                    entries[e.id] = default_availability(ds, e.id, d) if e.defaults and e.group == "dis" else sorted(set(e.hours))
                    if e.group == 'abs' and 'note' in e.model_fields_set:
                        state['absenceNotes'].get(d, {}).pop(e.id, None)
                        if note := (e.note or '').strip():
                            state['absenceNotes'].setdefault(d, {})[e.id] = note
                    if e.group == 'abs' and 'classification' in e.model_fields_set:
                        state['absenceKinds'].get(d, {}).pop(e.id, None)
                        if e.classification:
                            state['absenceKinds'].setdefault(d, {})[e.id] = e.classification
                    if e.group == 'dis':
                        state['disSites'].setdefault(d, {})[e.id] = e.site or None
            save_state(db, ds, state, days if e.group != 'dis' else [])
        return {'ok': True}

    @app.get('/api/candidates')
    def get_candidates(day: date, key: str):
        with store.connect() as db:
            ds, state = load(db, day.isoformat())
            rules = policies(db, ds)
        row = next((r for r in rows(ds, state, day.isoformat()) if r['k'] == key), None)
        if not row:
            raise ValueError('Supplenza non presente.')
        return candidates(ds, state, day.isoformat(), row, rules)

    @app.post('/api/assignments')
    def assign(e: Assignment):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db, e.day.isoformat())
            assignments = state['asg'].setdefault(e.day.isoformat(), {})
            if e.communicated is not None:
                old = assignments.get(e.key)
                if e.value is not None or e.replace_key or not old or old['v'] not in ('ENTRA', 'ESCE'):
                    raise ValueError('Comunicato disponibile solo per entrate e uscite già registrate.')
                old['communicated'] = e.communicated
                save_state(db, ds, state, [e.day.isoformat()])
                return {'ok': True}
            if e.replace_key:
                if e.replace_key == e.key or e.replace_key not in assignments or e.key in assignments or e.value is None:
                    raise ValueError('Sostituzione del conflitto non valida o riga già assegnata.')
                assignments.pop(e.replace_key)
            if e.value is None:
                assignments.pop(e.key, None)
            else:
                old = assignments.get(e.key)
                unchanged = old and old['v'] == e.value and old.get('t') == 'RP'
                if not unchanged:
                    assignments.pop(e.key, None)
                assignments[e.key] = validate_assignment(ds, state, e.day.isoformat(), e.key, e.value, policies(db, ds), e.exceptional, saved=bool(unchanged))
            recovery.validate(state)
            save_state(db, ds, state, [e.day.isoformat()], revalidate=True)
        return {'ok': True}

    @app.get('/api/export')
    def export():
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            rules = policies(db, ds)
            facts = store.read(db, 'statistics', statistics.empty())
            history = read_history(db)
            images = attachments.export(db, state)
        return dict(schema=5, timetables={k: v for k, v in history.items() if k != '_overrides'}, timetableOverrides=history['_overrides'], attachments=images, datasetId='v1:'+','.join(sorted(ds['teachers'])), hourTypes=rules, statistics=facts, **state)

    @app.post('/api/import')
    def import_state(data: dict, preview: bool = False):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            history = timetables.validate(data.get('timetables')) if data.get('schema') in (4, 5) else read_history(db)
            retained = store.read(db, 'timetableOverrides', overrides.empty())
            document = overrides.validate(data.get('timetableOverrides'), history) if data.get('schema') == 5 else retained
            document, restore_review = overrides.reconcile(document, history)
            history['_overrides'] = document
            if data.get('schema') not in (4, 5):
                ds, _ = load(db)
            if data.get('schema') in (4, 5):
                ds = timetables.dataset(history, datetime.now(ZoneInfo('Europe/Rome')).date().isoformat())
            identifier = data.get('datasetId')
            compatible = identifier == 'v1:'+','.join(sorted(ds['teachers'])) if data.get('schema') in (4, 5) else isinstance(identifier, str) and identifier.startswith('v1:') and set(identifier[3:].split(',')) <= set(ds['teachers'])
            if type(data.get('schema')) is not int or data['schema'] not in (1, 2, 3, 4, 5) or not compatible:
                raise ValueError('Archivio non compatibile.')
            rules = validate_types(data['hourTypes']) if 'hourTypes' in data else None
            state = {k: data.get(k, {}) for k in EMPTY}
            for group, dates in state.items():
                if not isinstance(dates, dict):
                    raise ValueError('Archivio non valido.')
                if group == 'manualPermitNotes':
                    if any(i not in state['manualPermits'] or i not in ds['teachers'] or not isinstance(value, str) or not value.strip() for i, value in dates.items()):
                        raise ValueError('Nota senza saldo manuale valido.')
                    continue
                if group == 'manualPermits':
                    if any(i not in ds['teachers'] for i in dates):
                        raise ValueError('Docente saldo manuale non valido.')
                    continue
                for d, entries in dates.items():
                    if date.fromisoformat(d).isoformat() != d:
                        raise ValueError('Data archivio non valida.')
                    ds = timetables.dataset(history, d)
                    if not isinstance(entries, dict):
                        raise ValueError('Archivio non valido.')
                    for i, value in entries.items():
                        if group in attachments.GROUPS:
                            source = attachments.GROUPS[group]
                            if i not in ds['teachers'] or i not in state[source].get(d, {}) or not isinstance(value, str) or not value:
                                raise ValueError('Riferimento allegato non valido.')
                        elif group in ('absenceNotes', 'permitNotes'):
                            source = 'abs' if group == 'absenceNotes' else 'permessi'
                            if i not in state[source].get(d, {}) or i not in ds['teachers'] or not isinstance(value, str) or not value.strip():
                                raise ValueError('Nota senza assenza o permesso valido.')
                        elif group in ('absenceKinds', 'permitKinds'):
                            source = 'abs' if group == 'absenceKinds' else 'permessi'
                            if i not in state[source].get(d, {}) or i not in ds['teachers'] or not isinstance(value, str) or value not in ('planned', 'last_minute', 'trip', 'strike'):
                                raise ValueError('Classificazione assenza non valida.')
                        elif group == 'permitIds':
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
                        elif not isinstance(value, dict) or ('exceptional' in value and type(value['exceptional']) is not bool) or ('communicated' in value and (type(value['communicated']) is not bool or value.get('v') not in ('ENTRA', 'ESCE'))) or value.get('v') not in (*ds['teachers'], 'DIR', 'ENTRA', 'ESCE', 'UNCOVERED') or not isinstance(value.get('t'), str) or len(i.split('|')) != 3 or i.split('|')[0] not in ds['teachers'] or not i.split('|')[1].isdigit() or int(i.split('|')[1]) not in HOURS or value.get('c') != i.split('|')[2]:
                            raise ValueError('Assegnazione non valida.')
            if data['schema'] == 1:
                if data.get('permitIds') or any(a.get('t') == 'RP' or 'permitId' in a for entries in state['asg'].values() for a in entries.values()):
                    raise ValueError('Archivio recuperi richiede schema 2.')
                recovery.migrate(state)
            recovery.validate(state)
            facts = statistics.validate(data['statistics'], lambda day: timetables.dataset(history, day), state) if 'statistics' in data else timetables.sync(history, state, statistics.empty(), reconstructed=True)
            if preview:
                return dict(overrides=restore_review)
            attachments.import_images(db, state, data, data['schema'])
            if data['schema'] in (4, 5):
                write_history(db, history)
                store.write(db, 'dataset', history['versions'][0]['dataset'])
            if rules is not None:
                store.write(db, 'hourTypes', merge_types(ds, rules))
            store.write(db, 'state', state)
            store.write(db, 'statistics', facts)
            store.write(db, 'timetableOverrides', document)
        return {'ok': True, 'overrides': restore_review}

    @app.post('/api/import/preview')
    def preview_archive(data: dict):
        return import_state(data, preview=True)

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
            with inbox.lock:
                backup.restore_backup(str(database), backup_path)
                Store(str(database))
                inbox.initialize()
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
