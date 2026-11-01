import { useEffect, useState } from 'react';
import { requestApi } from './session';
import { Loading } from './Loading';
import { nextMidnight, romeDay } from './display';

type Status = { configured: boolean; busy: boolean; uncertain: boolean; error: string | null; updated?: string; day?: string; campus: string; url: string };
export function Publication({ day, campus, disabled }: { day: string; campus: string; disabled: boolean }) {
  const [today, setToday] = useState(romeDay), [status, setStatus] = useState<Status>();
  const [error, setError] = useState(''), [sending, setSending] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refreshDay = () => setToday(romeDay());
    const timer = setTimeout(refreshDay, Math.max(1, nextMidnight() - Date.now()));
    document.addEventListener('visibilitychange', refreshDay);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', refreshDay); };
  }, [today]);
  useEffect(() => {
    if (day !== today) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const data = await requestApi<Status>('publication');
        if (!stopped) { setStatus(data); setError(''); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : String(e)); }
      if (!stopped) timer = setTimeout(refresh, 5000);
    };
    void refresh();
    return () => { stopped = true; clearTimeout(timer); };
  }, [day, today, campus, revision]);
  if (day !== today) return null;
  const publish = async () => {
    if (sending) return;
    setSending(true); setError('');
    try { await requestApi('publication', { day }); setRevision(v => v + 1); }
    catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setSending(false); }
  };
  return <div className="publication ui-scope" aria-label="Pubblicazione supplenze">
    <button type="button" className="ui-button ui-button-primary" disabled={disabled || sending || !status?.configured || status.busy || status.uncertain} onClick={() => void publish()}>
      {sending || status?.busy ? <Loading label="Pubblicazione…" reserve="Pubblica" /> : 'Pubblica'}
    </button>
    <div className="publication-meta"><span>{campus === 'centrale' ? 'Centrale' : 'Succursale'}</span>
    {status?.configured && <a href={status.url} target="_blank" rel="noopener noreferrer">Apri display pubblico</a>}</div>
    {status?.updated && <span>Ultima pubblicazione: {new Date(status.updated).toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}</span>}
    {status && !status.configured && <span role="status">Pubblicazione non configurata sul server.</span>}
    {(error || status?.error || status?.uncertain) && <span role="alert">{error || status?.error || 'Esito da verificare.'} <button type="button" className="ui-button" onClick={() => setRevision(v => v + 1)}>Aggiorna stato</button></span>}
  </div>;
}
