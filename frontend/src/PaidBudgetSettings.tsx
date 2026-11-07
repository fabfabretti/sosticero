import { useEffect, useRef, useState } from 'react';
import { SettingsGroup } from './SettingsGroup';
import { TeacherPicker } from './TeacherPicker';
import { Loading } from './Loading';
import { useQuietRefresh } from './useQuietRefresh';
import type { Teacher } from './types';
import { amountInput, campusName, parseEuro, sites, type FinancialConfig, type PayClass } from './paid-finance';
import './paid.css';

type Inventory = { config: FinancialConfig; teachers: Record<string, Teacher>; expected: Record<string, string>; generation?: number };
type Draft = Record<string, { budget: string; laureato: string; diplomato: string }>;
type Api = <T>(path: string, body?: unknown) => Promise<T>;
export function PaidBudgetSettings({ api, revision }: { api: Api; revision: number }) {
  const [data, setData] = useState<Inventory>();
  const [draft, setDraft] = useState<Draft>({});
  const [overrides, setOverrides] = useState<Record<string, PayClass>>({});
  const [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [conflict, setConflict] = useState(false);
  const [teacher, setTeacher] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const running = useRef(false);
  const { refresh, invalidate, loading, loadError } = useQuietRefresh(() => api<Inventory>('paid-finance'), setData, editing || busy, 'paid-finance:' + revision);
  useEffect(() => { void refresh().catch(() => {}); }, [revision]);
  const edit = () => {
    if (!data) return;
    setDraft(Object.fromEntries(sites.map(s => [s, { budget: amountInput(data.config.sites[s].budget), laureato: amountInput(data.config.sites[s].laureato), diplomato: amountInput(data.config.sites[s].diplomato) }])));
    setOverrides({ ...data.config.overrides }); setEditing(true); setConflict(false); setError(''); setMessage('');
  };
  const save = async () => {
    if (!data || running.current || conflict) return;
    setError(''); setMessage('');
    try {
      const config: FinancialConfig = { sites: Object.fromEntries(sites.map(s => [s, { budget: parseEuro(draft[s].budget), laureato: parseEuro(draft[s].laureato), diplomato: parseEuro(draft[s].diplomato) }])), overrides };
      running.current = true; setBusy(true); invalidate();
      const result = await api<{ priced: number; unpriced: number }>('paid-finance', { config, expected: { ...data.expected, ...(data.generation === undefined ? {} : { __generation__: String(data.generation) }) } });
      setMessage(`Configurazione salvata. ${result.priced} ore ricalcolate; ${result.unpriced} ancora da valorizzare.`);
      setEditing(false);
      try { await refresh(); } catch { setError('Salvato. Impossibile aggiornare i dati: usa Riprova.'); }
    } catch (e) { setError(String(e)); setConflict((e as { status?: number }).status === 409); }
    finally { running.current = false; setBusy(false); }
  };
  const config = editing ? overrides : data?.config.overrides;
  return <SettingsGroup title="Supplenze a pagamento" description="Budget facoltativi per sede e tariffe orarie." status={loading ? 'Caricamento…' : data ? `${sites.filter(s => data.config.sites[s].budget !== null).length} budget configurati` : 'Non disponibile'}>
    {loading && <Loading label="Caricamento budget…" />}
    {(error || loadError) && <p className="ui-notice ui-notice-error" role="alert">{error || loadError}</p>}
    {message && <p className="ui-notice" role="status">{message}</p>}
    {!data && !loading && <button className="ui-button" onClick={() => void refresh().catch(() => {})}>Riprova</button>}
    {data && <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <p className="settings-muted">I budget coprono tutte le ore registrate, anche future. Lo sforamento segnala un avviso e consente comunque l’assegnazione.</p>
      <fieldset disabled={!editing || busy} className="settings-permissions">
        <div className="paid-budget-fields">{sites.map(s => <fieldset key={s}><legend>{campusName(s)}</legend>
          {(['budget', 'laureato', 'diplomato'] as const).map(key => <label className="ui-field" key={key}>{key === 'budget' ? 'Budget disponibile (€)' : `Tariffa docente ${key} (€/ora)`}<input inputMode="decimal" value={editing ? draft[s]?.[key] || '' : amountInput(data.config.sites[s][key])} placeholder="Non configurato" onBlur={e => { try { parseEuro(e.target.value); e.target.setCustomValidity(''); } catch (err) { e.target.setCustomValidity(String(err)); e.target.reportValidity(); } }} onChange={e => { e.target.setCustomValidity(''); setDraft({ ...draft, [s]: { ...draft[s], [key]: e.target.value } }); }} /></label>)}
        </fieldset>)}</div>
        <p className="settings-muted">Lascia vuoto per non configurare un importo; zero è un valore esplicito. Ogni salvataggio ricalcola anche i costi delle ore già registrate. Senza tariffa, le ore risultano da valorizzare.</p>
        <h3>Classificazione economica docenti</h3>
        <p className="settings-muted">ITP → diplomato; altri docenti → laureato. Puoi impostare un’eccezione senza modificare il ruolo nell’orario.</p>
        <TeacherPicker id="paid-class-teacher" label="Docente da verificare" teachers={Object.values(data.teachers)} value={teacher} onChange={setTeacher} />
        {teacher && <label className="ui-field">Classificazione<select value={(editing ? overrides : data.config.overrides)[teacher] || ''} onChange={e => { const next = { ...overrides }; if (e.target.value) next[teacher] = e.target.value as PayClass; else delete next[teacher]; setOverrides(next); }}><option value="">Automatica ({data.teachers[teacher]?.role.toUpperCase() === 'ITP' ? 'diplomato' : 'laureato'})</option><option value="laureato">Laureato</option><option value="diplomato">Diplomato</option></select></label>}
        {!!Object.keys(config || {}).length && <ul>{Object.entries(config || {}).map(([id, value]) => <li key={id}>{data.teachers[id]?.name || id}: {value} {editing && <button type="button" className="ui-button" onClick={() => { const next = { ...overrides }; delete next[id]; setOverrides(next); }}>Ripristina automatica</button>}</li>)}</ul>}
      </fieldset>
      <div className="ui-actions">{!editing ? <button type="button" className="ui-button" disabled={busy} onClick={edit}>Modifica budget e tariffe</button> : <><button type="submit" className="ui-button ui-button-primary" disabled={busy || conflict}>{busy ? 'Salvataggio…' : 'Salva budget e tariffe'}</button><button type="button" className="ui-button" disabled={busy} onClick={() => { setEditing(false); setError(''); setConflict(false); }}>Annulla</button></>}
        {(conflict || loadError) && <button type="button" className="ui-button" disabled={busy} onClick={async () => { try { await refresh(); setEditing(false); setConflict(false); setError(''); } catch { /* Keep draft and local error. */ } }}>Ricarica valori salvati</button>}
      </div>
    </form>}
  </SettingsGroup>;
}
