import { useEffect, useRef, useState } from 'react';
import { Loading } from './Loading';

type Session = { account: { id: string; person: string; email: string }; csrf: string };
type Timetable = { day: string; status: 'ready' | 'no_timetable'; teacher: { name: string } | null; periods: { hour: number; classes: string[]; activities: string[]; room?: string; site?: string }[] };
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
export const moveDate = (day: string, offset: number) => { const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + offset); return date.toISOString().slice(0,10); };
const dateLabel = (day: string) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'full', timeZone: 'Europe/Rome' }).format(new Date(day + 'T12:00:00Z'));

export function TeacherPortal() {
  const [session, setSession] = useState<Session>();
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [email, setEmail] = useState(''), [pin, setPin] = useState(''), [error, setError] = useState('');
  const [day, setDay] = useState(today), [data, setData] = useState<Timetable>();
  const [loading, setLoading] = useState(false);
  const owner = useRef<Session | undefined>(undefined), request = useRef(0), action = useRef(false);
  const alive = useRef(true);
  const expire = () => { owner.current = undefined; ++request.current; setSession(undefined); setData(undefined); setPin(''); setReady(true); };
  const call = async <T,>(route: string, body?: unknown): Promise<T> => {
    const startedOwner = owner.current;
    const response = await fetch('/api/teacher/' + route, { cache: 'no-store', ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json', ...(owner.current ? { 'X-CSRF-Token': owner.current.csrf } : {}) }, body: JSON.stringify(body) }) });
    const result = await response.json();
    if (!response.ok) {
      if (response.status === 401 && route !== 'auth/login' && alive.current && owner.current === startedOwner) expire();
      throw new Error(typeof result.detail === 'string' ? result.detail : 'Richiesta non valida.');
    }
    return result as T;
  };
  useEffect(() => {
    alive.current = true;
    void call<Session>('auth/session').then(value => { if (alive.current) { owner.current = value; setSession(value); } }).catch(e => { if (alive.current && String(e) !== 'Error: Accesso richiesto.') setError(String(e)); }).finally(() => { if (alive.current) setReady(true); });
    return () => { alive.current = false; ++request.current; owner.current = undefined; };
  }, []);
  useEffect(() => {
    if (!session) return;
    let active = true, running = false;
    const load = async () => {
      if (running || action.current || document.visibilityState === 'hidden') return;
      running = true; const n = ++request.current, id = session.account.id;
      setLoading(true);
      try {
        const value = await call<Timetable>('timetable?' + new URLSearchParams({ day }));
        if (active && alive.current && n === request.current && owner.current?.account.id === id) { setData(value); setError(''); }
      } catch (e) { if (active && alive.current && n === request.current) setError(String(e)); }
      finally { running = false; if (active && alive.current && n === request.current) setLoading(false); }
    };
    setData(undefined); void load();
    const focus = () => { void load(); };
    const timer = setInterval(focus,15000);
    window.addEventListener('focus',focus); document.addEventListener('visibilitychange',focus);
    return () => { active = false; ++request.current; clearInterval(timer); window.removeEventListener('focus',focus); document.removeEventListener('visibilitychange',focus); };
  }, [session?.account.id, day]);
  const login = async () => {
    if (action.current) return;
    action.current = true; setBusy(true); setError('');
    try {
      const value = await call<Session>('auth/login', { email: email.trim(), pin: pin.trim() });
      if (alive.current) { ++request.current; owner.current = value; setData(undefined); setSession(value); setDay(today()); setPin(''); }
    } catch (e) { if (alive.current) { setError(String(e)); } }
    finally { action.current = false; if (alive.current) setBusy(false); }
  };
  const logout = async () => {
    if (action.current) return;
    action.current = true; setBusy(true); setError(''); ++request.current; setData(undefined);
    try { await call('auth/logout', {}); if (alive.current) expire(); }
    catch (e) { if (alive.current) setError(String(e)); }
    finally { action.current = false; if (alive.current) setBusy(false); }
  };
  const selectDay = (value: string) => { if (/^\d{4}-\d{2}-\d{2}$/.test(value)) { ++request.current; setData(undefined); setError(''); setDay(value); } };
  return <div className="ui-scope teacher-portal">
    <header className="teacher-portal-header"><a href="/docenti" className="teacher-portal-brand">Sosticero <span>Portale docenti</span></a>{session && <button className="ui-button" disabled={busy} onClick={() => void logout()}>Esci</button>}</header>
    <main className="ui-page teacher-portal-main">
      {!ready ? <Loading label="Accesso in corso…" /> : !session ? <section className="ui-surface teacher-portal-login" aria-labelledby="teacher-login-title"><h1 id="teacher-login-title">Accedi al tuo orario</h1><p className="settings-muted">Usa l’email istituzionale e il PIN ricevuto dalla scuola.</p>
        <form onSubmit={e => { e.preventDefault(); void login(); }}>
          <label className="ui-field">Email istituzionale<input type="email" autoComplete="username" autoFocus required maxLength={254} disabled={busy} value={email} onChange={e => setEmail(e.target.value)} /></label>
          <label className="ui-field">PIN personale<input type={showPin ? 'text' : 'password'} inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={32} autoComplete="current-password" required disabled={busy} value={pin} onChange={e => setPin(e.target.value.trim())} aria-describedby="teacher-pin-help" /></label>
          <button className="ui-button teacher-pin-visibility" type="button" aria-pressed={showPin} onClick={() => setShowPin(value => !value)}>{showPin ? 'Nascondi PIN' : 'Mostra PIN'}</button>
          {error && <p className="ui-notice ui-notice-error" role="alert">{error}</p>}
          <button className="ui-button ui-button-primary" disabled={busy}>{busy ? 'Accesso in corso…' : 'Accedi'}</button>
        </form><p id="teacher-pin-help" className="settings-muted">PIN dimenticato? Chiedi all’amministratore di reimpostarlo.</p><div className="auth-alternative"><p>Personale di segreteria?</p><a className="ui-button" href="/">Accedi agli uffici</a></div>
      </section> : <>
        <div className="teacher-portal-title"><h1>Il mio orario</h1><p>{data?.teacher?.name || session.account.email}</p></div>
        <nav className="teacher-date-nav" aria-label="Data dell’orario"><button className="ui-button" aria-label="Giorno precedente" onClick={() => selectDay(moveDate(day,-1))}>←</button><label className="ui-field">Data<input type="date" required value={day} onChange={e => selectDay(e.target.value)} /></label><button className="ui-button" aria-label="Giorno successivo" onClick={() => selectDay(moveDate(day,1))}>→</button><button className="ui-button" onClick={() => selectDay(today())}>Oggi</button></nav>
        <h2 className="teacher-date-label">{dateLabel(day)}</h2>
        {error && <p className="ui-notice ui-notice-error" role="alert">{error} L’aggiornamento verrà ritentato automaticamente.</p>}
        {loading && !data && <Loading label="Caricamento orario…" />}
        {data?.day === day && (data.status === 'no_timetable' ? <p className="ui-notice">Orario non ancora disponibile.</p> : !data.periods.length ? <p className="ui-surface teacher-empty">Nessuna lezione o attività prevista per questa data.</p> : <ol className="teacher-day">
          {data.periods.map(period => <li key={period.hour} className="ui-surface"><div className="teacher-period">{period.hour}<span>ora</span></div><div><h3>{period.classes.join(', ') || period.activities.join(' · ') || 'Attività'}</h3>{!!period.classes.length && !!period.activities.length && <p>{period.activities.join(' · ')}</p>}<p className="settings-muted">{[period.room && `Aula ${period.room}`, period.site === 'centrale' ? 'Centrale' : period.site === 'succursale' ? 'Succursale' : period.site].filter(Boolean).join(' · ') || 'Aula e sede non indicate'}</p></div></li>)}
        </ol>)}
      </>}
    </main>
  </div>;
}
