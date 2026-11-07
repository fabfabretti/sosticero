import { useEffect, useRef, useState } from 'react';
import { requestApi } from './session';
import { Loading } from './Loading';
import { norm } from './timetables';

type Access = { person: string; email: string; enabled: boolean; hasPin: boolean; revision: number };
type Person = { id: string; name: string; role: string; classe_concorso?: string };
type View = { people: Record<string, Person>; accounts: Record<string, Access>; classCodes?: Record<string, string> };
type IssuedPin = { person: string; name: string; email: string; pin: string };
const empty = (person: string): Access => ({ person, email: '', enabled: false, hasPin: false, revision: 0 });

export function TeacherAccess({ onCreate, onDirtyChange }: { onCreate: () => void; onDirtyChange?: (dirty: boolean) => void }) {
  const [view, setView] = useState<View>();
  const [drafts, setDrafts] = useState<Record<string, Access>>({});
  const [editing, setEditing] = useState(false), [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [reveal, setReveal] = useState<IssuedPin[]>([]);
  const running = useRef(false), alive = useRef(true), pinPanel = useRef<HTMLElement>(null), toolbar = useRef<HTMLDivElement>(null);
  const dirtyCount = Object.keys(drafts).length, dirty = dirtyCount > 0, guarded = dirty || reveal.length > 0;
  const accessFor = (id: string) => view?.accounts[id] || empty(id);
  const people = Object.values(view?.people || {}).sort((a,b) => a.name.localeCompare(b.name, 'it'));
  const visible = people.filter(p => {
    const a = accessFor(p.id);
    return norm(p.name + ' ' + a.email).includes(norm(query)) && (filter === 'all' || (filter === 'missing' ? !a.email.trim() : filter === 'active' ? a.enabled : !!a.email && !a.enabled));
  });
  const eligible = people.filter(p => accessFor(p.id).email && !accessFor(p.id).enabled).map(p => p.id);
  const selectable = visible.filter(p => accessFor(p.id).email);
  const selectedVisible = selectable.filter(p => selected.includes(p.id)).length;
  const selectedEligible = selected.filter(id => eligible.includes(id));
  useEffect(() => {
    const bar = document.querySelector?.('.bar');
    if (!bar || !toolbar.current || typeof ResizeObserver === 'undefined') return;
    const measure = () => { if (toolbar.current) toolbar.current.style.top = `${bar.getBoundingClientRect().height}px`; };
    const observer = new ResizeObserver(measure); observer.observe(bar); measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => { if (reveal.length) pinPanel.current?.focus(); }, [reveal]);
  useEffect(() => { onDirtyChange?.(guarded); return () => onDirtyChange?.(false); }, [guarded, onDirtyChange]);
  const load = async () => {
    setError('');
    try { const next = await requestApi<View>('teacher-access'); if (alive.current) setView(next); }
    catch (e) { if (alive.current) setError(String(e)); }
  };
  useEffect(() => {
    alive.current = true; void load();
    const clearPins = () => setReveal([]);
    window.addEventListener('session-expired', clearPins);
    return () => { alive.current = false; window.removeEventListener('session-expired', clearPins); };
  }, []);
  useEffect(() => {
    if (!guarded) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const navigate = (e: MouseEvent) => {
      const link = (e.target as Element).closest?.('a');
      if (link && link.target !== '_blank' && !window.confirm('Uscire? Le email non salvate e i PIN visualizzati andranno persi.')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [guarded]);
  const changeEmail = (person: string, email: string) => {
    setMessage('');
    setDrafts(old => {
      const baseline = accessFor(person), next = { ...baseline, email };
      const result = { ...old, [person]: next };
      if (next.email === baseline.email) delete result[person];
      return result;
    });
  };
  const save = async () => {
    if (running.current || !dirty) return;
    running.current = true; setBusy(true); setError('');
    try {
      const result = await requestApi<{ accounts: View['accounts'] }>('teacher-access', { rows: Object.values(drafts).map(({ person, email, enabled, revision }) => ({ person, email, enabled, revision })) });
      if (!alive.current) return;
      setView(old => old && { ...old, accounts: result.accounts }); setDrafts({}); setEditing(false); setMessage('Email salvate. Ora puoi attivare gli accessi.');
    } catch (e) { if (alive.current) setError(String(e)); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const rememberPins = (pins: IssuedPin[]) => { if (pins.length) setReveal(old => [...old.filter(p => !pins.some(n => n.person === p.person)), ...pins]); };
  const activate = async (ids: string[], enabled: boolean) => {
    if (running.current || editing || !ids.length) return;
    if (ids.length > 1 && !window.confirm(`Attivare ${ids.length} accessi? Verranno generati soltanto i PIN mancanti. I PIN esistenti non cambieranno.`)) return;
    running.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await requestApi<{ accounts: View['accounts']; pins: IssuedPin[] }>('teacher-access/activation', { rows: ids.map(person => ({ person, revision: accessFor(person).revision })), enabled });
      if (!alive.current) return;
      setView(old => old && { ...old, accounts: result.accounts }); rememberPins(result.pins); setSelected([]);
      setMessage(enabled ? `${ids.length === 1 ? 'Accesso attivato' : `${ids.length} accessi attivati`}. Salvato: non servono altri passaggi.` : 'Accesso disattivato e sessioni revocate.');
    } catch (e) { if (alive.current) setError(String(e) + ' Ricarica lo stato prima di riprovare.'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const resetPin = async (person: Person) => {
    if (running.current || !window.confirm(`Reimpostare il PIN di ${person.name}? Il vecchio PIN e le sessioni attive saranno revocati.`)) return;
    running.current = true; setBusy(true); setError('');
    try {
      const result = await requestApi<{ pin: string; account: Access }>('teacher-access/pin', { person: person.id, revision: accessFor(person.id).revision });
      if (!alive.current) return;
      setView(old => old && { ...old, accounts: { ...old.accounts, [person.id]: result.account } });
      rememberPins([{ person: person.id, name: person.name, email: result.account.email, pin: result.pin }]); setMessage('PIN reimpostato. Lo stato dell’accesso non è cambiato.');
    } catch (e) { if (alive.current) setError(String(e) + ' Se la risposta non è arrivata, ricarica e reimposta esplicitamente il PIN.'); }
    finally { running.current = false; if (alive.current) setBusy(false); }
  };
  const reload = () => { if (!dirty || window.confirm('Scartare le email non salvate e ricaricare?')) { setDrafts({}); setSelected([]); void load(); } };
  const pinText = () => ['Docente\tEmail\tPIN', ...reveal.map(p => `${p.name}\t${p.email}\t${p.pin}`)].join('\n');
  const downloadPins = () => {
    const url = URL.createObjectURL(new Blob([pinText()], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'pin-docenti.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <section aria-label="Accessi docenti">
    <div className="administration-heading"><div><h2>Accessi docenti</h2><p className="settings-muted">Inserisci le email, poi attiva uno o più accessi. I PIN mancanti vengono generati automaticamente.</p></div><button className="ui-button" disabled={busy || editing} onClick={() => { if (!guarded || window.confirm('Uscire dalla tabella? Conserva prima i PIN visualizzati.')) onCreate(); }}>Nuovo docente</button></div>
    <div ref={toolbar} className="teacher-access-toolbar" aria-label="Azioni accessi docenti">
      {editing ? <><strong>Modifica email</strong><span role="status">{dirtyCount ? `${dirtyCount} email da salvare` : 'Usa Tab per passare alla riga successiva'}</span><div className="ui-actions"><button className="ui-button ui-button-primary" disabled={busy || !dirty} onClick={() => void save()}>{busy ? 'Salvataggio…' : `Salva email (${dirtyCount})`}</button><button className="ui-button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Scartare le email non salvate?')) { setDrafts({}); setEditing(false); setError(''); } }}>Annulla</button></div></> : <>
        <div className="ui-actions"><button className="ui-button ui-button-primary" disabled={busy || !view} onClick={() => { setSelected([]); setEditing(true); setMessage(''); }}>Modifica email</button>
          {selected.length ? <><button className="ui-button" disabled={busy || !selectedEligible.length} onClick={() => void activate(selectedEligible,true)}>Attiva selezionati ({selectedEligible.length})</button><button className="ui-button" disabled={busy} onClick={() => setSelected([])}>Deseleziona ({selected.length})</button></> : <button className="ui-button" disabled={busy || !eligible.length} onClick={() => void activate(eligible,true)}>Attiva tutti con email ({eligible.length})</button>}
          <a className="ui-button" href="/docenti" target="_blank" rel="noreferrer">Apri portale docenti</a>
        </div><small>Attivazione e disattivazione sono immediate. I PIN già assegnati non cambiano.</small>
      </>}
    </div>
    {busy && <Loading label="Salvataggio accessi…" />}
    {error && <p className="ui-notice ui-notice-error" role="alert">{error} <button className="ui-button" disabled={busy} onClick={reload}>Ricarica accessi</button></p>}
    {message && <p role="status" className="ui-notice">{message}</p>}
    {reveal.length > 0 && <section ref={pinPanel} tabIndex={-1} className="ui-surface teacher-pin" role="region" aria-label="PIN generati"><h3>{reveal.length === 1 ? `PIN di ${reveal[0].name}` : `${reveal.length} PIN generati`}</h3><p>Gli accessi attivati sono già salvati. Conserva questi codici prima di chiudere: sono mostrati solo ora.</p><div className="teacher-pin-list">{reveal.map(p => <div key={p.person}><strong>{p.name}</strong><span>{p.email}</span><output aria-label={`PIN di ${p.name}`}>{p.pin}</output></div>)}</div><div className="ui-actions"><button className="ui-button" onClick={() => { void navigator.clipboard.writeText(pinText()).then(() => setMessage('Elenco PIN copiato.'), () => setError('Copia non disponibile: scarica l’elenco.')); }}>Copia elenco</button><button className="ui-button" onClick={downloadPins}>Scarica elenco PIN</button><button className="ui-button" onClick={() => { if (window.confirm('Hai conservato i PIN? Dopo la chiusura non saranno più recuperabili.')) setReveal([]); }}>Chiudi PIN</button></div></section>}
    <div className="ui-actions teacher-access-filters"><label className="ui-field">Cerca docente o email<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label><label className="ui-field">Mostra<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Tutti i docenti</option><option value="missing">Senza email</option><option value="ready">Da attivare</option><option value="active">Attivi</option></select></label></div>
    {!view ? <Loading label="Caricamento accessi…" /> : <>
      <div className="teacher-access-table"><table><caption>{visible.length} di {people.length} docenti{editing ? ' · Solo le email sono in modifica' : ' · Stato salvato degli accessi'}</caption><thead><tr><th><input type="checkbox" aria-label="Seleziona tutti i docenti visibili con email" ref={node => { if (node) node.indeterminate = selectedVisible > 0 && selectedVisible < selectable.length; }} disabled={busy || editing} checked={visible.some(p => accessFor(p.id).email) && visible.filter(p => accessFor(p.id).email).every(p => selected.includes(p.id))} onChange={e => setSelected(e.target.checked ? visible.filter(p => accessFor(p.id).email).map(p => p.id) : [])} /></th><th>Docente</th><th>Email di accesso</th><th>Stato</th><th>Azioni</th></tr></thead><tbody>
        {visible.map(p => {
          const saved = accessFor(p.id), access = drafts[p.id] || saved;
          return <tr key={p.id}><td><input type="checkbox" aria-label={`Seleziona ${p.name}`} disabled={busy || editing || !saved.email} checked={selected.includes(p.id)} onChange={e => setSelected(old => e.target.checked ? [...old,p.id] : old.filter(id => id !== p.id))} /></td><th scope="row">{p.name}<small>{p.role}{p.classe_concorso && ` · ${p.classe_concorso}${view.classCodes?.[p.classe_concorso] ? ' — ' + view.classCodes[p.classe_concorso] : ''}`}</small></th>
            <td>{editing ? <input type="email" aria-label={`Email di accesso di ${p.name}`} autoComplete="off" maxLength={254} disabled={busy} value={access.email} onChange={e => changeEmail(p.id,e.target.value)} /> : <span>{saved.email || 'Email da inserire'}</span>}</td>
            <td><span className={'teacher-access-status' + (saved.enabled ? ' is-active' : '')}>{saved.enabled ? 'Attivo' : !saved.email ? 'Email mancante' : saved.hasPin ? 'Disattivato' : 'Da attivare'}</span></td>
            <td><div className="ui-actions"><button className="ui-button" disabled={busy || editing || !!selected.length || !saved.email} onClick={() => void activate([p.id],!saved.enabled)} aria-label={`${saved.enabled ? 'Disattiva' : 'Attiva accesso di'} ${p.name}`}>{saved.enabled ? 'Disattiva' : 'Attiva accesso'}</button>{saved.hasPin && <button className="ui-button" disabled={busy || editing || !!selected.length} onClick={() => void resetPin(p)}>Reimposta PIN</button>}</div>{!saved.email && !editing && <small>Usa Modifica email per preparare l’accesso.</small>}</td></tr>;
        })}
      </tbody></table></div>
      {!visible.length && <p>Nessun docente corrisponde al filtro.</p>}
    </>}
  </section>;
}
