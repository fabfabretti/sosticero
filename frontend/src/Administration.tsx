import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import type { ReactNode } from 'react';

export function AdministrationLayout({ configuration = false, staffing = false, children }: { configuration?: boolean; staffing?: boolean; children: ReactNode }) {
  return <div className="administration-layout ui-scope"><aside className="administration-sidebar"><nav aria-label="Amministrazione">
    <Link to="/amministrazione/account" aria-current={!configuration && !staffing ? 'page' : undefined}>Amministrazione account</Link>
    <Link to="/amministrazione/configurazione" aria-current={configuration ? 'page' : undefined}>Configurazione</Link>
    <Link to="/amministrazione/docenti" aria-current={staffing ? 'page' : undefined}>Gestione docenti</Link>
  </nav></aside>{children}</div>;
}
import { requestApi, type Account } from './session';
import { Loading } from './Loading';

export type ManagedAccount = Account & { enabled: boolean; protected: boolean; revision: number };
type Draft = { username: string; name: string; admin: boolean; campuses: ('centrale' | 'succursale')[]; enabled: boolean; password: string };
const empty = (): Draft => ({ username: '', name: '', admin: false, campuses: [], enabled: true, password: '' });
export const permissionLabel = (account: Pick<Account, 'admin' | 'campuses'>) => [account.admin ? 'Amministratore' : '', ...account.campuses.map(c => c === 'centrale' ? 'Centrale' : 'Succursale')].filter(Boolean).join(' · ') || 'Nessun accesso assegnato';

export function Administration() {
  const [accounts, setAccounts] = useState<ManagedAccount[]>([]), [selected, setSelected] = useState<ManagedAccount>();
  const [draft, setDraft] = useState<Draft>(empty), [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [conflict, setConflict] = useState(false);
  const running = useRef(false);
  const refresh = async () => { setLoading(true); try { setAccounts(await requestApi<ManagedAccount[]>('accounts')); } catch (e) { setError(String(e)); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  const edit = (account?: ManagedAccount) => {
    setSelected(account); setDraft(account ? { ...account, password: '' } : empty());
    setEditing(true); setError(''); setMessage(''); setConflict(false);
  };
  const save = async () => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); setMessage(''); setConflict(false);
    try {
      const data = { username: draft.username, name: draft.name, admin: draft.admin, campuses: draft.campuses };
      const result = selected
        ? await requestApi<{ account: ManagedAccount; reauthenticate: boolean }>('accounts/' + selected.id, { ...data, enabled: draft.enabled, revision: selected.revision, ...(draft.password ? { password: draft.password } : {}) })
        : { account: await requestApi<ManagedAccount>('accounts', { ...data, password: draft.password }), reauthenticate: false };
      setDraft(value => ({ ...value, password: '' })); setSelected(result.account);
      setMessage('Account salvato.');
      if (result.reauthenticate) { window.dispatchEvent(new Event('session-expired')); return; }
      setEditing(false); await refresh();
    } catch (e) { setError(String(e)); setConflict((e as { status?: number }).status === 409); setDraft(value => ({ ...value, password: '' })); }
    finally { running.current = false; setBusy(false); }
  };
  return <AdministrationLayout>
    <main className="ui-page administration-page">
      <div className="administration-heading"><div><h1>Amministrazione account</h1><p className="settings-muted">Nomi, credenziali e permessi di accesso.</p></div><button className="ui-button ui-button-primary" disabled={busy} onClick={() => edit()}>Nuovo account</button></div>
      {message && <p className="ui-notice" role="status">{message}</p>}
      {error && <p className="ui-notice ui-notice-error" role="alert">{error}</p>}
      {loading && <Loading label="Caricamento account…" />}
      {!editing && <><button className="ui-button" disabled={busy || loading} onClick={() => void refresh()}>Aggiorna elenco</button><ul className="administration-accounts">{accounts.map(account => <li key={account.id}><div><strong>{account.name}</strong><span>{account.username} · {permissionLabel(account)}</span><small>{account.protected ? 'Amministratore protetto · ' : ''}{account.enabled ? 'Attivo' : 'Disabilitato'}</small></div><button className="ui-button" disabled={busy} onClick={() => edit(account)} aria-label={`Modifica ${account.name}`}>Modifica</button></li>)}</ul></>}
      {editing && <form className="administration-form" onSubmit={e => { e.preventDefault(); void save(); }}>
        <h2>{selected ? 'Modifica account' : 'Nuovo account'}</h2>
        {selected?.protected && <p className="ui-notice">Account protetto: deve restare attivo e amministratore. Nome utente, nome completo e password possono cambiare.</p>}
        <fieldset disabled={busy}>
          <label className="ui-field">Nome utente<input required autoComplete="off" pattern="[A-Za-z0-9_.\-]+" maxLength={64} value={draft.username} onChange={e => setDraft({ ...draft, username: e.target.value })} /></label>
          <label className="ui-field">Nome completo<input required maxLength={100} value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className="ui-field">{selected ? 'Nuova password (lascia vuoto per mantenerla)' : 'Password iniziale'}<input type="password" autoComplete="new-password" required={!selected} minLength={10} maxLength={256} value={draft.password} onChange={e => setDraft({ ...draft, password: e.target.value })} /></label>
          <fieldset><legend>Permessi</legend>
            <label className="administration-check"><input type="checkbox" checked={draft.admin} disabled={selected?.protected} onChange={e => setDraft({ ...draft, admin: e.target.checked })} />Amministratore</label>
            <p className="settings-muted">Sostituzione docenti: seleziona le sedi autorizzate. Nessuna sede esclude l’accesso operativo.</p>
            {(['centrale', 'succursale'] as const).map(campus => <label className="administration-check" key={campus}><input type="checkbox" checked={draft.campuses.includes(campus)} onChange={e => setDraft({ ...draft, campuses: e.target.checked ? [...draft.campuses, campus] : draft.campuses.filter(c => c !== campus) })} />{campus === 'centrale' ? 'Centrale' : 'Succursale'}</label>)}
          </fieldset>
          {selected && <label className="administration-check"><input type="checkbox" checked={draft.enabled} disabled={selected.protected} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} />Account attivo</label>}
          <p className="settings-muted">Il salvataggio disconnette le sessioni di questo account. La cronologia resta conservata.</p>
          <div className="ui-actions"><button className="ui-button ui-button-primary" disabled={conflict}>{busy ? <Loading label="Salvataggio…" /> : 'Salva account'}</button><button type="button" className="ui-button" onClick={() => { setDraft(empty()); setEditing(false); setError(''); }}>Annulla</button>
          {conflict && <button type="button" className="ui-button" onClick={async () => { try { const fresh = await requestApi<ManagedAccount[]>('accounts'); setAccounts(fresh); const account = fresh.find(a => a.id === selected?.id); if (account) edit(account); } catch (e) { setError(String(e)); } }}>Ricarica valori salvati</button>}</div>
        </fieldset>
      </form>}
    </main>
  </AdministrationLayout>;
}
