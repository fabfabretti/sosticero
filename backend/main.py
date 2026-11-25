from . import attribution, campus_notices, refusals
import os
import re
import sqlite3
from datetime import date, timedelta, datetime
from pathlib import Path
from typing import Literal
from uuid import uuid4
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.gzip import GZipMiddleware
from pydantic import BaseModel, Field, StrictInt, StrictBool, StrictStr
from .domain import DAYS, absences, normalize_dataset, rows, candidates, manual_candidates, consultation, validate_assignment, default_availability, auto_availability, HOURS, SITES, lesson, validate_permit, CDC_NAMES
from .storage import Store, EMPTY
from . import backup, attachments, concurrency, auth, display, publication, teacher_access
from .hour_types import merge_types, validate_types
from . import statistics, recovery, timetables, overrides, teacher_names, availability, receptions, paid, appointments, paid_finance, permit_context, student_groups
from zoneinfo import ZoneInfo
from hashlib import sha256
from copy import deepcopy


class Attachment(BaseModel):
    model_config = {"extra": "forbid"}
    mediaType: StrictStr
    data: StrictStr


class ConditionalWrite(BaseModel):
    expected: dict[str, str] | None = None


class Edit(ConditionalWrite):
    attachment: Attachment | None = None
    note: StrictStr | None = None
    classification: Literal['planned', 'last_minute', 'trip', 'strike', 'assembly'] | None = None
    day: date
    until: date | None = None
    group: str
    id: str
    hours: list[StrictInt] | None = None
    site: str | None = None
    future: bool = False
    defaults: bool = False


class Permit(ConditionalWrite):
    attachment: Attachment | None = None
    note: StrictStr | None = None
    classification: Literal['planned', 'last_minute', 'trip', 'strike', 'assembly'] | None = None
    requested_on: date | None = None
    day: date
    id: str
    hours: list[StrictInt] | None = None
    original_day: date | None = None
    original_id: str | None = None


class PaidAvailability(ConditionalWrite):
    weekday: StrictInt
    id: StrictStr
    hours: list[StrictInt]


class Assignment(ConditionalWrite):
    note: StrictStr | None = Field(default=None, max_length=2000)
    category: StrictStr | None = None
    campus_notice: StrictBool = False
    refused: StrictBool = False
    notified: StrictBool | None = None
    accepted: StrictBool | None = None
    communicated: StrictBool | None = None
    replace_key: str | None = None
    exceptional: StrictBool = False
    day: date
    key: str
    value: str | None = None


class ManualPermit(ConditionalWrite):
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
    app.add_middleware(GZipMiddleware, minimum_size=1000)
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
    
    identities = auth.Identities(os.environ.get('AUTH_DATABASE_PATH') or database.parent / 'auth.sqlite', testing=testing)
    if not testing: identities.require_admin()
    app.state.identities = identities
    auth.install(app, identities)
    store = Store(str(database))
    with store.connect() as db:
        if store.read(db, 'dataset') is None and seed:
            import json
            store.write(db, 'dataset', normalize_dataset(json.loads(Path(seed).read_text())))

    def read_history(db):
        value = store.read(db, 'timetables')
        if value is not None:
            value['_overrides'] = store.read(db, 'timetableOverrides', overrides.empty())
            value['_receptions'] = store.read(db, 'receptions', receptions.empty())
            value['_studentGroups'] = store.read(db, 'studentGroupHours', student_groups.empty())
            value['_appointments'] = store.read(db, 'teacherAppointments', appointments.empty())
        return value

    def name_overrides(db):
        return store.read(db, 'teacherNameOverrides', teacher_names.empty())

    def presented(db, ds):
        return teacher_names.dataset(ds, name_overrides(db))

    def write_history(db, value):
        state = store.read(db, 'state', EMPTY)
        for day in state['asg']:
            campus_notices.reconcile(timetables.dataset(value, day), state, day)
        store.write(db, 'state', state)
        store.write(db, 'timetables', {k: v for k, v in value.items() if not k.startswith('_')})
        store.write(db, 'timetableOverrides', value.get('_overrides', overrides.empty()))

    def initialize_statistics():
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            state = store.read(db, 'state', EMPTY)
            paid_changed = paid.migrate(state.get('paidAvailability', {}))
            if attribution.migrate(state, *identities.authors()) or paid_changed:
                store.write(db, 'state', state)
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
            return dict(versions={k:concurrency.digest(v) for k,v in policies(db, ds).items()}, types=policies(db, ds), needsReimport=bool(ds and any("activities" not in l for l in ds["lessons"].values())))

    @app.post("/api/hour-types")
    def update_type(data: dict):
        with store.connect() as db:
            db.execute("BEGIN IMMEDIATE")
            current = policies(db, store.read(db, "dataset"))
            key = data.get("id")
            expected = data.pop('expected', None)
            if isinstance(key, str) and key in current and expected != concurrency.digest(current[key]):
                raise HTTPException(409, 'Regola modificata: ricarica i valori salvati.')
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
        return ds, load_state(db)

    def load_state(db):
        state = store.read(db, 'state', EMPTY)
        state.setdefault('substitutionRefusals', {})
        state.setdefault('paidAvailability', {})
        state.setdefault('permessi', {})
        state.setdefault('permitRequests', {})
        state.setdefault('permitIds', {})
        state.setdefault('absenceKinds', {})
        state.setdefault('classAbsenceKinds', {})
        state.setdefault('permitKinds', {})
        state.setdefault('permitCreators', {})
        state.setdefault('absenceNotes', {})
        state.setdefault('classAbsenceNotes', {})
        state.setdefault('permitNotes', {})
        state.setdefault('manualPermitNotes', {})
        state.setdefault('manualPermits', {})
        for group in attachments.GROUPS:
            state.setdefault(group, {})
        paid.migrate(state.get('paidAvailability', {}))
        attribution.migrate(state, *identities.authors())
        return state

    def save_state(db, ds, state, days, revalidate=False):
        history = read_history(db)
        for day in state['asg']:
            campus_notices.reconcile(timetables.dataset(history, day) if history else ds, state, day)
        facts = store.read(db, 'statistics', statistics.empty())
        store.write(db, 'statistics', timetables.sync(read_history(db), state, facts, days, revalidate=revalidate))
        store.write(db, 'state', state)
        attachments.prune(db, state)

    from .inbox import Inbox
    inbox = Inbox(store, database, load, save_state, identities=identities)
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
            db.execute('BEGIN')
            facts = store.read(db, 'statistics', statistics.empty())
            state = store.read(db, 'state', EMPTY)
            history = read_history(db)
            teachers = teacher_names.teachers(appointments.catalog(history), name_overrides(db)) if history else {}
            if history:
                today = datetime.now(ZoneInfo('Europe/Rome')).date().isoformat()
                days = appointments.absence_dates(history, today)
                facts = timetables.sync(history, state, facts, days)
        return statistics.report(facts, campus, period, start, end, state=state, teachers=teachers)

    @app.get('/api/paid-availability')
    def get_paid(day: date | None = None):
        selected = day or datetime.now(ZoneInfo('Europe/Rome')).date()
        with store.connect() as db:
            db.execute('BEGIN')
            ds, state = load(db, selected.isoformat())
            result = paid.report(read_history(db), state, selected)
            result['finance'] = paid_finance.summary(state, store.read(db, 'paidFinance', paid_finance.empty()))
            accounts, _ = identities.authors()
            result['teachers'] = teacher_names.teachers(result['teachers'], name_overrides(db))
            for cell in result['cells']:
                for teacher in cell['teachers']:
                    teacher['name'] = result['teachers'][teacher['id']]['name']
                    teacher['addedBy'] = attribution.resolve(teacher.get('addedBy'), accounts)
                cell['teachers'].sort(key=lambda t: (t['name'].casefold(), t['id']))
            for record in result['records']:
                record['name'] = result['teachers'].get(record['teacher'], {}).get('name', record['teacher'])
                record['assignedBy'] = attribution.resolve(record.get('assignedBy'), accounts)
            return dict(result, concurrency=concurrency.snapshot(state))

    @app.get('/api/paid-finance')
    def get_paid_finance():
        with store.connect() as db:
            db.execute('BEGIN')
            history = read_history(db)
            config = store.read(db, 'paidFinance', paid_finance.empty())
            teachers = teacher_names.teachers(appointments.catalog(history), name_overrides(db)) if history else {}
            return dict(config=config, teachers=teachers, expected={'paidFinance': concurrency.digest(config)})

    @app.post('/api/paid-finance')
    def edit_paid_finance(data: dict):
        if set(data) != {'config', 'expected'}:
            raise ValueError('Configurazione economica non valida.')
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            history = read_history(db)
            config = paid_finance.validate(data['config'], appointments.catalog(history) if history else {})
            current = store.read(db, 'paidFinance', paid_finance.empty())
            concurrency.check(data['expected'], {'records': {'paidFinance': concurrency.digest(current)}}, ['paidFinance'])
            state = store.read(db, 'state', EMPTY)
            priced = paid_finance.recalculate(history, state, config)
            store.write(db, 'paidFinance', config)
            if priced:
                ds, _ = load(db)
                save_state(db, ds, state, list(state['asg']))
            return dict(ok=True, priced=priced, unpriced=paid_finance.summary(state, config)['all']['unpriced'])

    @app.post('/api/paid-availability')
    def edit_paid(e: PaidAvailability, request: Request):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            if e.weekday not in range(5) or e.id not in ds['teachers'] or (e.hours and (ds['teachers'][e.id].get('retired') or ds['teachers'][e.id].get('unavailable'))):
                raise ValueError('Docente o giorno non valido.')
            weekday = str(e.weekday)
            concurrency.check(e.expected, concurrency.snapshot(state), [concurrency.key('paidAvailability', weekday, e.id)])
            paid.edit(state, weekday, e.id, e.hours, request.state.account)
            paid.validate(state['paidAvailability'], ds['teachers'])
            save_state(db, ds, state, [], revalidate=False)
            return {'ok': True}

    @app.get('/api/stats/availability')
    def get_availability(day: date | None = Query(default=None, alias='date'), campus: str = 'total'):
        selected = day or datetime.now(ZoneInfo("Europe/Rome")).date()
        with store.connect() as db:
            db.execute('BEGIN')
            history = read_history(db)
            if history:
                history = dict(history, versions=[dict(v, dataset=presented(db, v['dataset'])) for v in history['versions']])
            state = store.read(db, 'state', EMPTY)
            rules = store.read(db, 'hourTypes', {})
            return availability.report(history, state, rules, selected, campus)

    @app.get('/api/day/{day}')
    def get_day(day: date):
        with store.connect() as db:
            db.execute('BEGIN')
            ds, state = load(db, day.isoformat())
            rules = policies(db, ds)
            history = read_history(db)
            facts = store.read(db, 'statistics', statistics.empty())
            display = presented(db, ds)
        d = day.isoformat()
        rs = rows(ds, state, d)
        problems = timetables.issues(ds, state, d, rules)
        for item in problems:
            item['context'] = timetables.conflict_context(history, d, item['key'], state['asg'][d][item['key']]) or timetables.context(history, state, d, item['key'], facts)
        selected = timetables.version(history, d)
        return dict(groupReviews=student_groups.reviews(ds, state, d), campusNotices=campus_notices.groups(ds, state, d), continuousAbsences=appointments.derived(ds, d), effectiveAbsences=absences(state, d, ds), concurrency=concurrency.snapshot(state, ds, d), dataset=display, state=state, rows=rs, issues=problems, references=timetables.reference_issues(history, state, d),
                    recoveryRequests=recovery.request_details(state, d),
                    timetable=dict(id=selected['id'], effective=selected['effective']), autoDis={d: auto_availability(ds, state, d)})

    @app.get('/api/display')
    def get_display(campus: Literal['centrale', 'succursale']):
        today = datetime.now(ZoneInfo('Europe/Rome'))
        day = today.date().isoformat()
        with store.connect() as db:
            db.execute('BEGIN')
            try:
                ds, state = load(db, day)
            except ValueError:
                raise HTTPException(503, 'Orario non disponibile.')
            result = display.project(presented(db, ds), state, day, campus)
        return dict(day=day, campus=campus, updated=today.isoformat(), **result)

    def capture_publication(day, campus):
        now = datetime.now(ZoneInfo('Europe/Rome'))
        if day != now.date().isoformat():
            raise HTTPException(422, 'Puoi pubblicare soltanto le supplenze di oggi.')
        with store.connect() as db:
            db.execute('BEGIN')
            try:
                ds, state = load(db, day)
            except ValueError:
                raise HTTPException(503, 'Orario non disponibile.')
            result = display.project(presented(db, ds), state, day, campus)
        return dict(day=day, campus=campus, updated=now.isoformat(), **result)

    def publication_schedule():
        with store.connect() as db:
            return store.read(db, 'publicationSchedule', {}).get('time', '')

    publisher = publication.Publisher(database.parent / 'publication',
        os.environ.get('PUBLICATION_STATIC_PATH', str(Path(__file__).resolve().parent.parent / 'frontend/publication-dist')),
        capture_publication, publication_schedule)
    publisher.register(app)
    app.state.publisher = publisher

    @app.get('/api/publication')
    def publication_status(request: Request, campus: Literal['centrale','succursale']):
        if campus not in request.state.account['campuses']: raise HTTPException(403, 'Sede non autorizzata.')
        return publisher.status(campus)

    @app.get('/api/publication/schedule')
    def get_publication_schedule():
        return {'time': publication_schedule()}

    @app.post('/api/publication/schedule')
    def set_publication_schedule(data: dict):
        time = data.get('time')
        if not isinstance(time, str) or (time and not re.fullmatch(r'([01]\d|2[0-3]):[0-5]\d', time)):
            raise ValueError('Orario non valido: usa HH:MM.')
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            store.write(db, 'publicationSchedule', {'time': time})
        return {'time': time}

    @app.post('/api/publication', status_code=202)
    def publish_display(request: Request, data: dict):
        campus = data.get('campus')
        if set(data) - {'day', 'campus'} or campus not in request.state.account['campuses']:
            raise HTTPException(403, 'Puoi pubblicare soltanto la tua sede.')
        day = data.get('day')
        if day != datetime.now(ZoneInfo('Europe/Rome')).date().isoformat():
            raise HTTPException(422, 'Puoi pubblicare soltanto le supplenze di oggi.')
        publisher.start(day, campus)
        return {'started': True, 'campus': campus}

    teacher_identities = teacher_access.TeacherAccess(identities)

    def portal_people():
        with store.connect() as db:
            history = read_history(db)
            return teacher_names.teachers(appointments.catalog(history), name_overrides(db)) if history else {}

    @app.get('/api/teacher-access')
    def list_teacher_access():
        return dict(people=portal_people(), accounts=teacher_identities.list(), classCodes=CDC_NAMES)

    @app.post('/api/teacher-access')
    def save_teacher_access(data: dict):
        if set(data) != {'rows'}: raise ValueError('Campi accesso docenti non validi.')
        return dict(accounts=teacher_identities.save(data['rows'], portal_people()))

    @app.post('/api/teacher-access/activation')
    def activate_teacher_access(data: dict):
        if set(data) != {'rows', 'enabled'}: raise ValueError('Campi attivazione non validi.')
        return teacher_identities.activate(data['rows'], data['enabled'], portal_people())

    @app.post('/api/teacher-access/pin')
    def issue_teacher_pin(data: dict):
        if set(data) != {'person', 'revision'} or not isinstance(data['person'], str) or data['person'] not in portal_people():
            raise ValueError('Docente non valido.')
        return teacher_identities.issue(data['person'], data['revision'])

    @app.post('/api/teacher/auth/login')
    def teacher_login(request: Request, data: dict):
        from fastapi.responses import JSONResponse
        token = teacher_identities.login(data.get('email'), data.get('pin'), request.client.host if request.client else 'local',
                                         request.cookies.get(teacher_access.COOKIE))
        user = teacher_identities.session(token)
        if user['person'] not in portal_people():
            teacher_identities.revoke(token)
            raise HTTPException(401, 'Credenziali non valide.')
        response = JSONResponse(dict(account={k: user[k] for k in ('id', 'person', 'email')}, csrf=user['csrf']))
        response.set_cookie(teacher_access.COOKIE, token, max_age=43200, httponly=True,
                            secure=request.state.secure_cookie, samesite='lax', path=teacher_access.COOKIE_PATH)
        return response

    @app.get('/api/teacher/auth/session')
    def teacher_session(request: Request):
        user = request.state.teacher
        if user['person'] not in portal_people(): raise HTTPException(401, 'Accesso non disponibile. Contatta l’amministratore.')
        return dict(account={k: user[k] for k in ('id', 'person', 'email')}, csrf=user['csrf'])

    @app.post('/api/teacher/auth/logout')
    def teacher_logout(request: Request):
        from fastapi.responses import JSONResponse
        teacher_identities.revoke(request.cookies.get(teacher_access.COOKIE))
        response = JSONResponse({'ok': True})
        response.delete_cookie(teacher_access.COOKIE, path=teacher_access.COOKIE_PATH)
        return response

    @app.get('/api/teacher/timetable')
    def teacher_timetable(request: Request, day: date | None = None):
        if set(request.query_params) - {'day'}: raise HTTPException(422, 'Selettore non consentito.')
        viewed = day or datetime.now(ZoneInfo('Europe/Rome')).date()
        person = request.state.teacher['person']
        with store.connect() as db:
            db.execute('BEGIN')
            history = read_history(db)
            if not history:
                return dict(day=viewed.isoformat(), status='no_timetable', teacher=None, periods=[])
            if person not in appointments.catalog(history):
                raise HTTPException(401, 'Accesso non disponibile. Contatta l’amministratore.')
            ds = presented(db, timetables.dataset(history, viewed.isoformat()))
            teacher = ds['teachers'].get(person)
            if not teacher: raise HTTPException(401, 'Accesso non disponibile. Contatta l’amministratore.')
            weekday = ('lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom')[viewed.weekday()]
            periods = []
            for hour in HOURS:
                cell = ds['lessons'].get(f'{person}|{weekday}|{hour}')
                group = student_groups.at(ds, person, viewed.isoformat(), hour)
                if cell or group:
                    cell = cell or {}
                    periods.append(dict(hour=hour, group=group, classes=cell.get('classes', []), room=cell.get('room'),
                                        site=cell.get('site'), activities=cell.get('activities') or ([cell['special']] if cell.get('special') else []), groups=[group] if group else []))
            return dict(day=viewed.isoformat(), status='ready', teacher=dict(name=teacher['name']), periods=periods)

    @app.get('/api/staffing')
    def get_staffing(day: date | None = None):
        viewed = (day or datetime.now(ZoneInfo('Europe/Rome')).date()).isoformat()
        with store.connect() as db:
            db.execute('BEGIN')
            history = read_history(db)
            if not history:
                return dict(document=appointments.empty(), revision=timetables.digest(appointments.empty()), people={}, sources={}, classCodes=CDC_NAMES, dataset=None)
            resolved = timetables.dataset(history, viewed)
            return dict(document=history['_appointments'], revision=timetables.digest(history['_appointments']), people=teacher_names.teachers(resolved['teachers'], name_overrides(db)), classCodes=CDC_NAMES,
                        sources={i: t for v in history['versions'] for i, t in v['dataset']['teachers'].items()},
                        dataset=resolved)

    def staffing_plan(db, data):
        if set(data) - {'document', 'day', 'token', 'revision'}:
            raise ValueError('Richiesta di gestione docenti non valida.')
        viewed = appointments.iso(data.get('day'))
        history = read_history(db)
        if not history: raise ValueError('Carica prima un orario.')
        if data.get('revision') != timetables.digest(history['_appointments']):
            raise HTTPException(409, 'Gestione docenti modificata: ricarica prima di generare una nuova anteprima.')
        state = store.read(db, 'state', EMPTY)
        facts = store.read(db, 'statistics', statistics.empty())
        result = appointments.preview(history, state, facts, data.get('document'), viewed)
        documents = db.execute("SELECT key,value FROM documents WHERE key NOT IN ('googleSheetsStatus','googleSheets') ORDER BY key").fetchall()
        result['token'] = timetables.digest([documents, data['document'], viewed])
        return history, state, facts, result

    @app.post('/api/staffing/preview')
    def preview_staffing(data: dict):
        with store.connect() as db:
            db.execute('BEGIN')
            *_, result = staffing_plan(db, data)
            return result

    @app.post('/api/staffing/apply')
    def apply_staffing(data: dict):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            history, state, facts, result = staffing_plan(db, data)
            if data.get('token') != result['token']:
                raise HTTPException(409, 'Anteprima scaduta: ricarica e verifica i dati.')
            if not result['ready']:
                raise ValueError('Risolvere le registrazioni incompatibili prima di salvare.')
            backup.backup_database(str(database), str(backup_dir))
            for removal in result['removals']:
                state['asg'][removal['day']].pop(removal['key'])
            store.write(db, 'state', state)
            previous = dict(history)
            history['_appointments'] = result['document']
            before_dataset, after_dataset = timetables.resolver(previous), timetables.resolver(history)
            # Drop only changed slot context; unrelated captured facts retain provenance.
            days = []
            for d in timetables.dates(state, facts):
                before, after = before_dataset(d), after_dataset(d)
                if before == after:
                    continue
                days.append(d)
                affected = appointments.affected_assignments(before, after, state, d)
                demand = facts['days'].get(d, {}).get('demand', {})
                for key, row in list(demand.items()):
                    if row['key'] in affected:
                        demand.pop(key)
                for key, slot in list(facts['days'].get(d, {}).get('absences', {}).items()):
                    i, h = slot['teacher'], slot['h']
                    if lesson(before, i, d, h) != lesson(after, i, d, h):
                        facts['days'][d]['absences'].pop(key)
            updated = timetables.sync(history, state, facts, days)
            for day in state['asg']:
                campus_notices.reconcile(after_dataset(day), state, day)
            store.write(db, 'state', state)
            store.write(db, 'teacherAppointments', result['document'])
            store.write(db, 'statistics', updated)
            identities.generation(advance=True)
        return dict(ok=True)

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
            labels = name_overrides(db)
            ds = dict(ds, receptions=receptions.on_day(store.read(db, 'receptions', receptions.empty()), viewed))
        teachers = {i: dict(t, cdcName=CDC_NAMES.get(t.get('classe_concorso', ''), t.get('classe_concorso', ''))) for i, t in teacher_names.teachers(ds['teachers'], labels).items()}
        return JSONResponse(dict(effective=effective, day=viewed, version=selected['id'] if history else '', dataset=dict(ds, teachers=teachers),
                    basis=timetables.digest(history), imported=selected['dataset'] if history else ds,
                    overrides=history.get('_overrides', overrides.empty())['records'] if history else []))

    @app.get('/api/student-groups')
    def get_student_groups(day: date | None = None):
        viewed = (day or datetime.now(ZoneInfo('Europe/Rome')).date()).isoformat()
        with store.connect() as db:
            db.execute('BEGIN')
            ds, _ = load(db, viewed)
            history = read_history(db)
            document = history['_studentGroups']
            return dict(document=document, revision=timetables.digest(document),
                        teachers=presented(db, ds)['teachers'], classes=ds['classes'], conflicts=student_groups.conflicts(ds))

    @app.post('/api/student-groups')
    def save_student_groups(data: dict, request: Request):
        if set(data) != {'document', 'revision'}:
            raise ValueError('Richiesta gruppi non valida.')
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            history = read_history(db)
            if not history:
                raise ValueError('Carica prima un orario.')
            previous = history['_studentGroups']
            if data['revision'] != timetables.digest(previous):
                raise HTTPException(409, 'Gruppi modificati da un altro utente. Ricarica prima di salvare.')
            document = student_groups.validate(data['document'])
            catalog = teacher_names.catalog(history)
            classes = {c for v in history['versions'] for c in v['dataset']['classes']}
            old = {r['id']: r for r in previous['records']}
            new = {r['id']: r for r in document['records']}
            for identifier in old.keys() | new.keys():
                before, after = old.get(identifier), new.get(identifier)
                if before == after:
                    continue
                if any(r and r['site'] not in request.state.account['campuses'] for r in (before, after)):
                    raise HTTPException(403, 'Sede gruppo non autorizzata.')
                if after:
                    student_groups.validate(dict(schema=1, records=[after]), catalog, classes)
            if document == previous:
                return dict(ok=True)
            try:
                snapshot = backup.backup_database(str(database), str(backup_dir))
            except Exception as exc:
                raise ValueError('Backup prima del salvataggio fallito. Nessun dato modificato.') from exc
            history['_studentGroups'] = document
            state = store.read(db, 'state', EMPTY)
            facts = store.read(db, 'statistics', statistics.empty())
            changed = [r for identifier in old.keys() | new.keys() if old.get(identifier) != new.get(identifier) for r in (old.get(identifier), new.get(identifier)) if r]
            affected = [d for d in timetables.dates(state, facts) if any(r['day'] == DAYS[date.fromisoformat(d).weekday()] and r['start'] <= d and (not r['end'] or d <= r['end']) for r in changed)]
            for d in affected:
                campus_notices.reconcile(timetables.dataset(history, d), state, d)
            from copy import deepcopy
            facts = deepcopy(facts)
            for d in affected:
                current = timetables.dataset(history, d)
                for slot in facts['days'].get(d, {}).get('absences', {}).values():
                    group = student_groups.at(current, slot['teacher'], d, slot['h'])
                    if group and 'group' not in slot:
                        slot['group'] = deepcopy(group)
                        if not slot['classes']:
                            slot['site'] = group['site']
            updated = timetables.sync(history, state, facts, affected, revalidate=True)
            identities.generation(advance=True)
            store.write(db, 'studentGroupHours', document)
            store.write(db, 'state', state)
            store.write(db, 'statistics', updated)
        return dict(ok=True, backup=snapshot)

    @app.get('/api/receptions')
    def get_receptions():
        with store.connect() as db:
            return store.read(db, 'receptions', receptions.empty())

    def reception_plan(db, data):
        if not isinstance(data.get('effective'), str):
            raise ValueError('Seleziona una decorrenza.')
        effective = data['effective']
        if date.fromisoformat(effective).isoformat() != effective:
            raise ValueError('Decorrenza non valida.')
        ds, state = load(db, effective)
        reviewed, entries, ready = receptions.review(receptions.parse(data.get('file')), ds['teachers'], name_overrides(db), data.get('choices', {}))
        history = read_history(db)
        proposed = receptions.replace(history['_receptions'], effective, entries)
        receptions.validate(proposed, teacher_names.catalog(history))
        after = dict(history, _receptions=proposed)
        facts = store.read(db, 'statistics', statistics.empty())
        next_date = next((v['effective'] for v in proposed['versions'] if v['effective'] > effective), None)
        days = []
        rules = store.read(db, 'hourTypes', {})
        for day in timetables.dates(state, facts):
            if day < effective or next_date and day >= next_date:
                continue
            before_issues = timetables.issues(timetables.dataset(history, day), state, day, merge_types(timetables.dataset(history, day), rules))
            changed = timetables.dataset(after, day)
            issues = timetables.issues(changed, state, day, merge_types(changed, rules))
            days.append(dict(day=day, issues=[item for item in issues if item not in before_issues]))
        # Background Sheets polling must not expire a reviewed reception import.
        documents = db.execute('''SELECT key, value FROM documents
            WHERE key IN ('dataset', 'timetables', 'timetableOverrides', 'receptions',
                          'teacherNameOverrides', 'teacherAppointments', 'hourTypes', 'state', 'statistics')
            ORDER BY key''').fetchall()
        token = timetables.digest([documents, {k: v for k, v in data.items() if k not in ('token', 'confirm')}])
        teachers = {i: t['name'] for i, t in presented(db, ds)['teachers'].items() if not t.get('retired')}
        return proposed, after, state, facts, dict(rows=reviewed, ready=ready, teachers=teachers, token=token, days=days, effective=effective, end=next_date)

    @app.post('/api/receptions/preview')
    def preview_receptions(data: dict):
        with store.connect() as db:
            db.execute('BEGIN')
            *_, impact = reception_plan(db, data)
        return impact

    @app.post('/api/receptions')
    def import_receptions(data: dict):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            document, history, state, facts, impact = reception_plan(db, data)
            if data.get('confirm') is not True or not data.get('token') or data['token'] != impact['token']:
                raise HTTPException(409, 'Conferma richiesta o anteprima scaduta: genera una nuova anteprima.')
            if not impact['ready']:
                raise ValueError('Abbina o salta tutte le righe prima di importare.')
            try:
                snapshot = backup.backup_database(str(database), str(backup_dir))
            except Exception as exc:
                raise ValueError('Backup prima dell’importazione fallito. Nessun dato modificato.') from exc
            affected = [item['day'] for item in impact['days']]
            updated = timetables.sync(history, state, facts, affected, revalidate=True)
            identities.generation(advance=True)
            store.write(db, 'receptions', document)
            store.write(db, 'statistics', updated)
        return dict(ok=True, backup=snapshot)

    @app.post('/api/orari/name')
    def save_teacher_name(data: dict):
        if set(data) != {'teacher', 'value', 'previous'} or not isinstance(data['teacher'], str):
            raise ValueError('Modifica nome non valida.')
        identifier, value = data['teacher'], data['value']
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            history = read_history(db)
            if identifier in history['_appointments']['people']:
                raise ValueError('Identità personale gestita in Amministrazione.')
            catalog = teacher_names.catalog(history)
            if identifier not in catalog:
                raise ValueError('Docente non valido.')
            document = name_overrides(db)
            if document['teachers'].get(identifier) != data['previous']:
                raise HTTPException(409, 'Nome modificato da un altro utente. Ricarica gli orari.')
            if value is None:
                document['teachers'].pop(identifier, None)
            else:
                if not isinstance(value, dict) or set(value) != {'name', 'originalName'} or any(not isinstance(v, str) for v in value.values()):
                    raise ValueError('Nome personalizzato non valido.')
                document['teachers'][identifier] = {k: v.strip() for k, v in value.items()}
            teacher_names.validate(document, catalog)
            store.write(db, 'teacherNameOverrides', document)
        return {'ok': True}

    def override_plan(db, data):
        history = read_history(db)
        if not history:
            raise ValueError('Carica prima un orario.')
        if data.get('basis') != timetables.digest(history):
            raise HTTPException(status_code=409, detail='Orario modificato: ricarica e verifica la bozza.')
        deleting = data.get('delete') is True
        document, report = overrides.remove(history['_overrides'], data) if deleting else overrides.propose(history['_overrides'], history, data)
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
        evidence = dict(record=document['records'][-1]['id'], previous={}, assignments={}) if not deleting else None
        days = []
        affected = {}
        problems_by_day = {}
        affected_weekdays = {overrides.DAYS.index(key.split('|')[0]) for record in history['_overrides']['records'] + document['records'] if record['teacher'] == data['teacher']
                             for group in record['groups'] for key in group['before']}
        same_start_revision = any(r['teacher'] == data['teacher'] and r['start'] == data['start']
                                  for r in history['_overrides']['records'])
        for day in timetables.dates(state, facts):
            if day < data['start'] or (not deleting and data.get('end') and day > data['end'] and not same_start_revision) or date.fromisoformat(day).weekday() not in affected_weekdays:
                continue
            before, after = schedule(history, day), schedule(proposed, day)
            if before == after:
                continue
            problems = timetables.issues(after, state, day, rules)
            affected[day] = after
            problems_by_day[day] = problems
            if evidence is not None:
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
        if evidence is not None:
            document['evidence'].append(evidence)
        documents = db.execute("SELECT key,value FROM documents WHERE key NOT IN ('googleSheetsStatus','googleSheets') ORDER BY key").fetchall()
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
            history = read_history(db)
            state = load_state(db)
            for day in state['asg']:
                campus_notices.reconcile(timetables.dataset(history, day), state, day)
            store.write(db, 'state', state)
            store.write(db, 'statistics', facts)
        return dict(ok=True)

    @app.get('/api/permessi')
    def get_permits():
        with store.connect() as db:
            db.execute('BEGIN')
            history = read_history(db)
            names = name_overrides(db)
            if history:
                versions = permit_context.versions(history, names)
                today = datetime.now(ZoneInfo('Europe/Rome')).date().isoformat()
                ds = next(v['dataset'] for v in reversed(versions) if not v['effective'] or v['effective'] <= today)
            else:
                source = store.read(db, 'dataset')
                if source is None:
                    raise ValueError('Carica prima un orario.')
                ds = permit_context.project(source, names)
                versions = []
            state = load_state(db)
        summaries, balances = recovery.summary(state)
        manual = {p['teacher']: p for p in recovery.ledger(state).values() if p['date'] is None}
        accounts, _ = identities.authors()
        creators = {day: {teacher: attribution.resolve(author, accounts) for teacher, author in entries.items()} for day, entries in state['permitCreators'].items()}
        return JSONResponse(dict(concurrency=concurrency.snapshot(state), dataset=ds, timetableVersions=[dict(effective=v['effective'], dataset=v['dataset']) for v in versions], permitAttachments=state['permitAttachments'], permessi=state['permessi'], permitRequests=state['permitRequests'], permitNotes=state['permitNotes'], permitKinds=state['permitKinds'], permitCreators=creators, recoveries=summaries, balances=balances, manualPermits=manual, manualPermitNotes=state['manualPermitNotes']))

    @app.post('/api/manual-permits')
    def save_manual_permit(e: ManualPermit):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            concurrency.check(e.expected, concurrency.snapshot(state), [concurrency.key('manualPermits', '', e.id)])
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
        return {'ok': True, 'concurrency': concurrency.snapshot(state)}

    @app.post('/api/permessi')
    def save_permit(e: Permit, request: Request):
        if (e.original_day is None) != (e.original_id is None):
            raise ValueError('Riferimento originale incompleto.')
        d = e.day.isoformat()
        source = (e.original_day.isoformat(), e.original_id) if e.original_day else None
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db, d)
            references = [concurrency.key('permessi', d, e.id)]
            if source:
                references.append(concurrency.key('permessi', *source))
            concurrency.check(e.expected, concurrency.snapshot(state), references)
            permits = state['permessi']
            if source and source[1] not in permits.get(source[0], {}):
                raise ValueError('Permesso originale non più presente.')
            old_day, old_teacher = source or (d, e.id)
            creator = state['permitCreators'].get(old_day, {}).get(old_teacher) if source else attribution.snapshot(request.state.account)
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
                state['permitCreators'].get(d, {}).pop(e.id, None)
                state['permitAttachments'].get(d, {}).pop(e.id, None)
            else:
                validate_permit(ds, e.id, e.hours)
                if ds['teachers'][e.id].get('unavailable') and not source:
                    raise ValueError('Docente non attivo nella data selezionata.')
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
                    state['permitCreators'].get(source[0], {}).pop(source[1], None)
                    state['permitAttachments'].get(source[0], {}).pop(source[1], None)
                permits.setdefault(d, {})[e.id] = sorted(e.hours)
                state['permitAttachments'].get(d, {}).pop(e.id, None)
                if attachment:
                    state['permitAttachments'].setdefault(d, {})[e.id] = attachment
                state['permitNotes'].get(d, {}).pop(e.id, None)
                state['permitKinds'].get(d, {}).pop(e.id, None)
                state['permitCreators'].get(d, {}).pop(e.id, None)
                if note:
                    state['permitNotes'].setdefault(d, {})[e.id] = note
                if creator:
                    state['permitCreators'].setdefault(d, {})[e.id] = creator
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
        return {'ok': True, 'concurrency': concurrency.snapshot(state)}

    def timetable_plan(db, data, effective):
        ds = normalize_dataset(data)
        history = read_history(db)
        if history and 'teacherSources' in data:
            mappings = data['teacherSources']
            if not isinstance(mappings, dict) or any(i not in ds['teachers'] or not isinstance(person, str) or person not in appointments.catalog(history) for i, person in mappings.items()):
                raise ValueError('Abbinamenti delle sorgenti non validi.')
            if any(i in appointments.catalog(history) and person != history['_appointments']['sources'].get(i, i) for i, person in mappings.items()):
                raise ValueError('Un ID già noto non può cambiare persona durante l’importazione: correggi l’abbinamento in Amministrazione con verifica della cronologia.')
            history = deepcopy(history)
            history['_appointments']['sources'].update(mappings)
        state = store.read(db, 'state', EMPTY)
        for group in EMPTY:
            state.setdefault(group, {})
        facts = store.read(db, 'statistics', statistics.empty())
        rules = merge_types(ds, store.read(db, 'hourTypes', {}))
        proposed, reconciled, impact = timetables.plan(history, ds, effective, state, facts, rules)
        staffing = proposed.get('_appointments', appointments.empty())
        if staffing != appointments.empty():
            review = appointments.preview(proposed, state, facts, staffing, effective)
            if review['issues']:
                raise ValueError('Riconciliare prima le sorgenti in Amministrazione: ' + review['issues'][0]['message'])
        documents = db.execute("SELECT key,value FROM documents WHERE key NOT IN ('googleSheetsStatus','googleSheets') ORDER BY key").fetchall()
        images = [(i, media, sha256(content).hexdigest()) for i, media, content in db.execute('SELECT id, media_type, content FROM attachments ORDER BY id')]
        impact['token'] = timetables.digest([documents, images, ds, effective, proposed.get('_appointments', appointments.empty())])
        impact['teachers'] = {i: t['name'] for i, t in presented(db, ds)['teachers'].items()}
        if history:
            impact['previousTeachers'] = {i: t['name'] for i, t in presented(db, timetables.version(history, effective)['dataset'])['teachers'].items()}
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
            identities.generation(advance=True)
            write_history(db, proposed)
            if '_appointments' in proposed:
                store.write(db, 'teacherAppointments', proposed['_appointments'])
            store.write(db, 'statistics', facts)
            # Legacy dataset is a preserved baseline, never the latest scheduled version.
            if not history:
                store.write(db, 'dataset', proposed['versions'][0]['dataset'])
            policies(db, normalize_dataset(data))
        return dict(ok=True, backup=snapshot, impact=impact)

    @app.post('/api/entries')
    def edit(e: Edit):
        if 'attachment' in e.model_fields_set and e.group not in ('abs', 'cf', 'dis'):
            raise ValueError('Allegati consentiti solo per assenze o disposizioni docenti.')
        if 'note' in e.model_fields_set and e.group not in ('abs', 'cf'):
            raise ValueError('Note consentite solo per assenze docenti.')
        if 'classification' in e.model_fields_set and e.group not in ('abs', 'cf'):
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
            days = concurrency.entry_days(e, state)
            concurrency.check(e.expected, concurrency.snapshot(state), [concurrency.key(e.group, d, e.id) for d in days])
            attachment = attachments.insert(db, e.attachment.model_dump() if e.attachment else None) if 'attachment' in e.model_fields_set else None
            attachment_group = {'abs': 'absenceAttachments', 'cf': 'classAbsenceAttachments', 'dis': 'disAttachments'}.get(e.group)
            for d in days:
                ds, _ = load(db, d)
                active = timetables.dataset(read_history(db), d)
                if e.id not in (ds['classes'] if e.group == 'cf' else ds['teachers']):
                    raise ValueError('Docente o classe sconosciuto.')
                if e.hours is not None and e.id not in state[e.group].get(d, {}) and e.id not in (active['classes'] if e.group == 'cf' else active['teachers']):
                    raise ValueError('Docente o classe non attivo nella data selezionata.')
                if e.group != 'cf' and e.hours and (ds['teachers'][e.id].get('unavailable') or ds['teachers'][e.id].get('retired')):
                    raise ValueError('Docente non attivo: gestisci assenze prolungate e supplenze in Amministrazione.')
                if attachment_group and (e.hours is None or 'attachment' in e.model_fields_set):
                    state[attachment_group].get(d, {}).pop(e.id, None)
                    if e.hours is not None and attachment:
                        state[attachment_group].setdefault(d, {})[e.id] = attachment
                entries = state[e.group].setdefault(d, {})
                if e.hours is None:
                    entries.pop(e.id, None)
                    if e.group in ('abs', 'cf'):
                        state['absenceNotes' if e.group == 'abs' else 'classAbsenceNotes'].get(d, {}).pop(e.id, None)
                        state['absenceKinds' if e.group == 'abs' else 'classAbsenceKinds'].get(d, {}).pop(e.id, None)
                    if e.group == 'dis':
                        state['disSites'].setdefault(d, {}).pop(e.id, None)
                else:
                    entries[e.id] = default_availability(ds, e.id, d) if e.defaults and e.group == "dis" else sorted(set(e.hours))
                    if e.group in ('abs', 'cf') and 'note' in e.model_fields_set:
                        state['absenceNotes' if e.group == 'abs' else 'classAbsenceNotes'].get(d, {}).pop(e.id, None)
                        if note := (e.note or '').strip():
                            state['absenceNotes' if e.group == 'abs' else 'classAbsenceNotes'].setdefault(d, {})[e.id] = note
                    if e.group in ('abs', 'cf') and 'classification' in e.model_fields_set:
                        state['absenceKinds' if e.group == 'abs' else 'classAbsenceKinds'].get(d, {}).pop(e.id, None)
                        if e.classification:
                            state['absenceKinds' if e.group == 'abs' else 'classAbsenceKinds'].setdefault(d, {})[e.id] = e.classification
                    if e.group == 'dis':
                        state['disSites'].setdefault(d, {})[e.id] = e.site or None
            save_state(db, ds, state, days if e.group != 'dis' else [])
        return {'ok': True, 'concurrency': concurrency.snapshot(state, ds, e.day.isoformat())}

    @app.get('/api/availability')
    def get_availability(day: date, hour: int = Query(ge=1, le=7), campus: Literal['centrale', 'succursale', 'all'] = 'all'):
        with store.connect() as db:
            ds, state = load(db, day.isoformat())
            rules = policies(db, ds)
            labels = teacher_names.teachers(ds['teachers'], name_overrides(db))
        return [dict(c, name=labels[c['id']]['name'])
                for c in consultation(ds, state, day.isoformat(), hour, campus, rules)]

    @app.get('/api/candidates')
    def get_candidates(day: date, key: str, include_manual: bool = False):
        with store.connect() as db:
            ds, state = load(db, day.isoformat())
            rules = policies(db, ds)
            labels = teacher_names.teachers(ds['teachers'], name_overrides(db))
        row = next((r for r in rows(ds, state, day.isoformat()) if r['k'] == key), None)
        if not row:
            raise ValueError('Supplenza non presente.')
        return [dict(c, name=labels[c['id']]['name']) if c['id'] in labels else c
                for c in (candidates(ds, state, day.isoformat(), row, rules) + (manual_candidates(ds, state, day.isoformat(), row) if include_manual else []))]

    @app.post('/api/assignments')
    def assign(e: Assignment, request: Request):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db, e.day.isoformat())
            current_rows = {r['k']: r for r in rows(ds, state, e.day.isoformat())}
            history = read_history(db)
            facts = store.read(db, 'statistics', statistics.empty())
            for key in filter(None, (e.key, e.replace_key)):
                row = current_rows.get(key)
                context = row and {'site': row['sede']}
                old = state['asg'].get(e.day.isoformat(), {}).get(key)
                if not context and old:
                    context = timetables.conflict_context(history, e.day.isoformat(), key, old) or timetables.context(history, state, e.day.isoformat(), key, facts)
                if not context and not old:
                    raise ValueError('Supplenza non più presente nell’orario o nelle assenze.')
                if not context or context.get('site') not in request.state.account['campuses']:
                    raise HTTPException(403, 'Assegnazione riservata alla sede della riga; verifica anche la sede delle assegnazioni da risolvere.')
            references = [concurrency.key('asg', e.day.isoformat(), e.key)]
            if e.campus_notice:
                references.append(concurrency.key('campusNotice', e.day.isoformat(), e.key))
            if e.replace_key:
                references.append(concurrency.key('asg', e.day.isoformat(), e.replace_key))
            concurrency.check(e.expected, concurrency.snapshot(state, ds, e.day.isoformat()), references)
            assignments = state['asg'].setdefault(e.day.isoformat(), {})
            if 'refused' in e.model_fields_set and not e.refused:
                raise ValueError('Il rifiuto deve essere confermato come azione.')
            if e.refused:
                if any(field in e.model_fields_set for field in ('value', 'category', 'replace_key', 'note', 'notified', 'accepted', 'communicated', 'exceptional')):
                    raise ValueError('Il rifiuto non può essere combinato con altre modifiche.')
                old = assignments.get(e.key)
                notice = campus_notices.groups(ds, state, e.day.isoformat()).get(e.key) if e.campus_notice else None
                if e.key not in current_rows or not old or (not notice if e.campus_notice else old.get('t') not in ('RP', 'PAID')):
                    raise ValueError('Rifiuto disponibile solo per recuperi, ore a pagamento o cambi sede già assegnati.')
                members = notice['rows'] if notice else [current_rows[e.key]]
                teachers = presented(db, ds)['teachers']
                for row in members:
                    if row['sede'] not in request.state.account['campuses']:
                        raise HTTPException(403, 'Assegnazione riservata alla sede della riga.')
                for row in members:
                    teacher = assignments[row['k']]['v']
                    refusals.record(state, e.day.isoformat(), row['k'], teacher, teachers[teacher]['name'])
                    assignments.pop(row['k'])
                save_state(db, ds, state, [e.day.isoformat()], revalidate=True)
                return {'ok': True, 'concurrency': concurrency.snapshot(state, ds, e.day.isoformat())}
            if e.campus_notice:
                notice = campus_notices.groups(ds, state, e.day.isoformat()).get(e.key)
                fields = [f for f in ('communicated', 'accepted') if f in e.model_fields_set]
                if not notice or len(fields) != 1 or getattr(e, fields[0]) is None or e.value is not None or e.replace_key or e.category is not None or e.exceptional or 'notified' in e.model_fields_set:
                    raise ValueError('Comunicazione cambio sede non valida.')
                metadata = {f: notice[f] for f in ('fingerprint', 'communicated', 'accepted')}
                metadata[fields[0]] = getattr(e, fields[0])
                for row in notice['rows']:
                    assignments[row['k']]['campusNotice'] = dict(metadata)
                save_state(db, ds, state, [e.day.isoformat()])
                return {'ok': True, 'concurrency': concurrency.snapshot(state, ds, e.day.isoformat())}
            if 'notified' in e.model_fields_set:
                old = assignments.get(e.key)
                if e.notified is None or e.value is not None or e.replace_key or e.category is not None or e.accepted is not None or e.communicated is not None or e.exceptional or not old or old.get('t') != 'PAID':
                    raise ValueError('Avvisato disponibile solo per assegnazioni a pagamento registrate.')
                old['notified'] = e.notified
                old['communicated'] = e.notified
                save_state(db, ds, state, [e.day.isoformat()])
                return {'ok': True, 'concurrency': concurrency.snapshot(state, ds, e.day.isoformat())}
            if 'accepted' in e.model_fields_set:
                old = assignments.get(e.key)
                if e.category is not None or e.accepted is None or e.value is not None or e.replace_key or e.communicated is not None or e.exceptional or not old or old.get('t') not in ('RP', 'PAID'):
                    raise ValueError('Accettata disponibile solo per recuperi permesso e ore a pagamento già registrati, senza altre modifiche.')
                old['accepted'] = e.accepted
                save_state(db, ds, state, [e.day.isoformat()])
                return {'ok': True, 'concurrency': concurrency.snapshot(state, ds, e.day.isoformat())}
            if e.communicated is not None:
                old = assignments.get(e.key)
                if e.category is not None or e.value is not None or e.replace_key or e.exceptional or not old or (old['v'] not in ('ENTRA', 'ESCE') and old.get('t') not in ('RP', 'PAID')):
                    raise ValueError('Comunicato disponibile solo per entrate, uscite, recuperi permesso e ore a pagamento già registrati.')
                old['communicated'] = e.communicated
                if old.get('t') == 'PAID':
                    old['notified'] = e.communicated
                save_state(db, ds, state, [e.day.isoformat()])
                return {'ok': True, 'concurrency': concurrency.snapshot(state, ds, e.day.isoformat())}
            if e.replace_key:
                if e.replace_key == e.key or e.replace_key not in assignments or e.key in assignments or e.value is None:
                    raise ValueError('Sostituzione del conflitto non valida o riga già assegnata.')
                assignments.pop(e.replace_key)
            if e.value is None:
                assignments.pop(e.key, None)
            else:
                old = assignments.get(e.key)
                unchanged = old and old['v'] == e.value and old.get('t') in ('RP', 'PAID') and (e.category is None or e.category == old['t'] and not old.get('manualPaid') or e.category == 'MANUAL_PAID' and old.get('manualPaid') is True)
                if not unchanged:
                    assignments.pop(e.key, None)
                assignments[e.key] = validate_assignment(ds, state, e.day.isoformat(), e.key, e.value, policies(db, ds), e.exceptional, saved=bool(unchanged), category=e.category)
                if old and old['v'] == e.value and old.get('t') == assignments[e.key]['t'] and 'campusNotice' in old:
                    assignments[e.key]['campusNotice'] = old['campusNotice']
                if assignments[e.key]['t'] == 'MANUAL' or assignments[e.key].get('manualPaid'):
                    if 'note' in e.model_fields_set:
                        assignments[e.key].pop('note', None)
                        if e.note and e.note.strip():
                            assignments[e.key]['note'] = e.note.strip()
                if assignments[e.key]['t'] == 'PAID' and not unchanged:
                    row = current_rows[e.key]
                    assignments[e.key].update(assignedBy=attribution.snapshot(request.state.account), notified=False,
                                              paidContext=dict(site=row['sede'], room=row['aula'], **{'class': row['c']}))
                    paid_finance.price(assignments[e.key], ds['teachers'], store.read(db, 'paidFinance', paid_finance.empty()))
            recovery.validate(state)
            save_state(db, ds, state, [e.day.isoformat()], revalidate=True)
            saved = assignments.get(e.key, {})
            budget_warning = paid_finance.warning(state, store.read(db, 'paidFinance', paid_finance.empty()), saved.get('paidContext', {}).get('site')) if saved.get('t') == 'PAID' else None
        return {'ok': True, 'concurrency': concurrency.snapshot(state, ds, e.day.isoformat()), 'warning': budget_warning}

    @app.get('/api/settings/overview')
    def settings_overview():
        with store.connect() as db:
            db.execute('BEGIN')
            history = read_history(db)
            ds = timetables.dataset(history, datetime.now(ZoneInfo('Europe/Rome')).date().isoformat()) if history else store.read(db, 'dataset')
            return dict(teacherCount=len(ds['teachers']) if ds else 0, classCount=len(ds['classes']) if ds else 0, warnings=ds.get('warnings', []) if ds else [])

    @app.get('/api/export')
    def export():
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            ds, state = load(db)
            rules = policies(db, ds)
            facts = store.read(db, 'statistics', statistics.empty())
            history = read_history(db)
            images = attachments.export(db, state)
            labels = name_overrides(db)
            finance = store.read(db, 'paidFinance', paid_finance.empty())
        return dict(schema=13, studentGroupHours=history['_studentGroups'], paidFinance=finance, teacherAppointments=history['_appointments'], receptions=history['_receptions'], teacherNameOverrides=labels, timetables={k: v for k, v in history.items() if not k.startswith('_')}, timetableOverrides=history['_overrides'], attachments=images, datasetId='v1:'+','.join(sorted(ds['teachers'])), hourTypes=rules, statistics=facts, **state)

    @app.post('/api/import')
    def import_state(data: dict, preview: bool = False):
        with store.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            history = timetables.validate(data.get('timetables'), data.get('teacherAppointments') if data.get('schema') in (10, 11, 12, 13) else None) if data.get('schema') in (4, 5, 6, 7, 8, 9, 10, 11, 12, 13) else read_history(db)
            history['_appointments'] = appointments.validate(data.get('teacherAppointments', appointments.empty()) if data.get('schema') in (10, 11, 12, 13) else appointments.empty(), history)
            retained = store.read(db, 'timetableOverrides', overrides.empty())
            document = overrides.validate(data.get('timetableOverrides'), history) if data.get('schema') in (5, 6, 7, 8, 9, 10, 11, 12, 13) else retained
            document, restore_review = overrides.reconcile(document, history)
            history['_overrides'] = document
            reception_document = receptions.validate(data.get('receptions', receptions.empty()) if data.get('schema') in (7, 8, 9, 10, 11, 12, 13) else receptions.empty(), teacher_names.catalog(history))
            history['_studentGroups'] = student_groups.validate(data.get('studentGroupHours')) if data.get('schema') == 13 else store.read(db, 'studentGroupHours', student_groups.empty())
            history['_receptions'] = reception_document
            labels = teacher_names.validate(data.get('teacherNameOverrides') if data.get('schema') in (6, 7, 8, 9, 10, 11, 12, 13) else name_overrides(db), teacher_names.catalog(history))
            if data.get('schema') not in (4, 5, 6, 7, 8, 9, 10, 11, 12, 13):
                ds, _ = load(db)
            if data.get('schema') in (4, 5, 6, 7, 8, 9, 10, 11, 12, 13):
                ds = timetables.dataset(history, datetime.now(ZoneInfo('Europe/Rome')).date().isoformat())
            identifier = data.get('datasetId')
            compatible = identifier == 'v1:'+','.join(sorted(ds['teachers'])) if data.get('schema') in (4, 5, 6, 7, 8, 9, 10, 11, 12, 13) else isinstance(identifier, str) and identifier.startswith('v1:') and set(identifier[3:].split(',')) <= set(ds['teachers'])
            if type(data.get('schema')) is not int or data['schema'] not in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13) or not compatible:
                raise ValueError('Archivio non compatibile.')
            rules = validate_types(data['hourTypes']) if 'hourTypes' in data else None
            from copy import deepcopy
            state = deepcopy({k: data.get(k, {}) for k in EMPTY})
            if data['schema'] < 12:
                state['substitutionRefusals'] = {}
            refusals.validate(state['substitutionRefusals'])
            for group, dates in state.items():
                if group == 'substitutionRefusals':
                    continue
                if not isinstance(dates, dict):
                    raise ValueError('Archivio non valido.')
                if group == 'paidAvailability':
                    if data['schema'] < 8:
                        paid.migrate(dates)
                    paid.validate(dates, ds['teachers'])
                    continue
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
                            if i not in (ds['classes'] if source == 'cf' else ds['teachers']) or i not in state[source].get(d, {}) or not isinstance(value, str) or not value:
                                raise ValueError('Riferimento allegato non valido.')
                        elif group in ('absenceNotes', 'classAbsenceNotes', 'permitNotes'):
                            source = {'absenceNotes': 'abs', 'classAbsenceNotes': 'cf', 'permitNotes': 'permessi'}[group]
                            if i not in state[source].get(d, {}) or i not in (ds['classes'] if source == 'cf' else ds['teachers']) or not isinstance(value, str) or not value.strip():
                                raise ValueError('Nota senza assenza o permesso valido.')
                        elif group in ('absenceKinds', 'classAbsenceKinds', 'permitKinds'):
                            source = {'absenceKinds': 'abs', 'classAbsenceKinds': 'cf', 'permitKinds': 'permessi'}[group]
                            if i not in state[source].get(d, {}) or i not in (ds['classes'] if source == 'cf' else ds['teachers']) or not isinstance(value, str) or value not in ('planned', 'last_minute', 'trip', 'strike', 'assembly'):
                                raise ValueError('Classificazione assenza non valida.')
                        elif group == 'permitCreators':
                            if i not in state['permessi'].get(d, {}) or not attribution.valid(value):
                                raise ValueError('Sede inserimento permesso non valida.')
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
                        elif not isinstance(value, dict) or ('exceptional' in value and type(value['exceptional']) is not bool) or ('communicated' in value and (type(value['communicated']) is not bool or (value.get('v') not in ('ENTRA', 'ESCE') and value.get('t') not in ('RP', 'PAID')))) or value.get('v') not in (*ds['teachers'], 'DIR', 'ENTRA', 'ESCE', 'UNCOVERED') or not isinstance(value.get('t'), str) or len(i.split('|')) != 3 or i.split('|')[0] not in ds['teachers'] or not i.split('|')[1].isdigit() or int(i.split('|')[1]) not in HOURS or value.get('c') != i.split('|')[2]:
                            raise ValueError('Assegnazione non valida.')
            if data['schema'] == 1:
                if data.get('permitIds') or any(a.get('t') == 'RP' or 'permitId' in a for entries in state['asg'].values() for a in entries.values()):
                    raise ValueError('Archivio recuperi richiede schema 2.')
                recovery.migrate(state)
            attribution.migrate(state)
            recovery.validate(state)
            campus_notices.validate(state)
            paid.metadata(state, ds['teachers'])
            paid_finance.validate_prices(state)
            finance = paid_finance.validate(data.get('paidFinance', paid_finance.empty()) if data['schema'] >= 11 else paid_finance.empty(), appointments.catalog(history))
            facts = statistics.validate(data['statistics'], lambda day: timetables.dataset(history, day), state) if 'statistics' in data else timetables.sync(history, state, statistics.empty(), reconstructed=True)
            if preview:
                return dict(overrides=restore_review)
            identities.generation(advance=True)
            attachments.import_images(db, state, data, data['schema'])
            if data['schema'] in (4, 5, 6, 7, 8, 9, 10, 11, 12, 13):
                write_history(db, history)
                store.write(db, 'dataset', history['versions'][0]['dataset'])
            if rules is not None:
                store.write(db, 'hourTypes', merge_types(ds, rules))
            store.write(db, 'state', state)
            store.write(db, 'statistics', facts)
            store.write(db, 'timetableOverrides', document)
            store.write(db, 'teacherNameOverrides', labels)
            store.write(db, 'studentGroupHours', history['_studentGroups'])
            store.write(db, 'receptions', reception_document)
            store.write(db, 'teacherAppointments', history['_appointments'])
            store.write(db, 'paidFinance', finance)
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
            safety = backup.backup_database(str(database), str(backup_dir))
            identities.generation(advance=True)
            identities.revoke()
            with inbox.lock:
                try:
                    backup.restore_backup(str(database), backup_path)
                    Store(str(database))
                    inbox.initialize()
                    with store.connect() as db:
                        db.execute('BEGIN IMMEDIATE')
                        state = store.read(db, 'state', EMPTY)
                        if recovery.migrate(state):
                            store.write(db, 'state', state)
                    initialize_statistics()
                except Exception:
                    backup.restore_backup(str(database), safety['path'])
                    raise
            return {'ok': True}
        except Exception as e:
            raise ValueError(str(e))

    static = Path(os.environ.get('STATIC_PATH', 'frontend/dist'))
    if static.exists():
        @app.get('/', include_in_schema=False)
        @app.get('/index.html', include_in_schema=False)
        @app.get('/display', include_in_schema=False)
        @app.get('/docenti', include_in_schema=False)
        def display_page():
            return FileResponse(static / 'index.html', headers={'Cache-Control': 'no-store'})

        @app.get('/build-info.json', include_in_schema=False)
        def build_info():
            return FileResponse(static / 'build-info.json', headers={'Cache-Control': 'no-store'})

        app.mount('/', StaticFiles(directory=static, html=True), name='frontend')
    return app
