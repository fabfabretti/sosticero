import { useEffect, useState } from 'react';

export function PublicationSchedule({ api, onSummary }: { api: <T>(url: string, body?: unknown) => Promise<T>; onSummary?: (value: string) => void }) {
  const [time, setTime] = useState(''), [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => {
    let stopped = false;
    void api<{ time: string }>('publication/schedule')
      .then(value => { if (!stopped) { setTime(value.time); setSaved(value.time); } })
      .catch(e => { if (!stopped) setError(String(e)); });
    return () => { stopped = true; };
  }, [api]);
  useEffect(() => { onSummary?.(error ? 'Orario non disponibile' : saved ? `Ogni giorno alle ${saved}` : 'Automatica disattivata'); }, [saved, error, onSummary]);
  const save = async (value: string) => {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await api<{ time: string }>('publication/schedule', { time: value });
      setTime(result.time); setSaved(result.time);
      setMessage(result.time ? 'Orario salvato.' : 'Pubblicazione automatica disattivata.');
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  return <section className="settings-subsection ui-form" aria-label="Pubblicazione automatica">
    <h2>Pubblicazione automatica</h2>
    <p className="settings-muted">Ogni giorno il sito pubblico viene aggiornato all’orario scelto con entrambe le sedi. L’orario segue Europe/Rome.</p>
    <label>Orario<input type="time" value={time} onChange={e => setTime(e.target.value)} disabled={busy} /></label>
    <div className="ui-actions">
      <button className="ui-button ui-button-primary" type="button" disabled={busy || time === saved} onClick={() => void save(time)}>{busy ? 'Salvataggio…' : 'Salva orario'}</button>
      {saved && <button className="ui-button" type="button" disabled={busy} onClick={() => void save('')}>Disattiva</button>}
    </div>
    {message && <p className="ui-notice" role="status">{message}</p>}
    {error && <p className="ui-notice ui-notice-error" role="alert">{error}</p>}
  </section>;
}
