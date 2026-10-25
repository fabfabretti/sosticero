import { useEffect, useRef, useState } from 'react';
import { useQuietRefresh } from './useQuietRefresh';
import { todayInRome } from './StatsCalendar';

export type Reception = { teacher: string; day: string; hour: number; name: string; time: string; location: string; site: string | null };
type Row = Reception & { row: number; skip: boolean; suggestions: string[]; error: string };
type Choice = { teacher?: string | null; site?: string | null; skip?: boolean };
type Impact = { generation?: number; rows: Row[]; teachers: Record<string, string>; ready: boolean; token: string; effective: string; end: string | null; days: { day: string; issues: { key: string; message: string }[] }[] };
type Document = { versions: { effective: string; rows: Reception[] }[] };
type Api = <T>(url: string, body?: unknown) => Promise<T>;

export function ReceptionImport({ api, onSummary, onImported, revision }: { api: Api; onSummary?: (value: string) => void; onImported?: () => void; revision?: number }) {
  const [effective, setEffective] = useState(todayInRome());
  const [file, setFile] = useState<{ name: string; data: string }>();
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [impact, setImpact] = useState<Impact>();
  const [reviewed, setReviewed] = useState(false);
  const [document, setDocument] = useState<Document>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [teacherQueries, setTeacherQueries] = useState<Record<number, string>>({});
  const request = useRef(0);
  useQuietRefresh(() => api<Document>('receptions'), setDocument, busy || !!file || !!impact, 'settings-receptions');
  useEffect(() => { let active = true; api<Document>('receptions').then(value => { if (active) setDocument(value); }).catch(e => { if (active) setError(String(e)); }); return () => { active = false; }; }, [api, revision]);
  useEffect(() => {
    const selected = document?.versions.filter(version => version.effective <= todayInRome()).at(-1);
    onSummary?.(error ? 'Ricevimenti: da verificare' : document ? `${selected?.rows.length || 0} ricevimenti` : 'Ricevimenti: caricamento…');
  }, [document, error, onSummary]);
  const invalidate = () => { request.current++; setReviewed(false); setError(''); setSuccess(''); };
  const body = () => ({ file: file?.data, effective, choices });
  const preview = async () => {
    if (!file) return;
    const current = ++request.current;
    setBusy(true); setError(''); setReviewed(false);
    try { const value = await api<Impact>('receptions/preview', body()); if (current === request.current) { setImpact(value); setReviewed(true); } }
    catch (e) { if (current === request.current) setError(String(e)); }
    finally { setBusy(false); }
  };
  const choose = (row: number, value: Choice) => { invalidate(); setChoices({ ...choices, [row]: { ...choices[row], ...value } }); };
  const apply = async () => {
    if (!impact || !reviewed || !impact.ready || !window.confirm(`Importare i ricevimenti dal ${effective}? Il nuovo elenco sostituisce il precedente nell’intervallo indicato. Le assegnazioni restano conservate con eventuali conflitti da verificare.`)) return;
    setBusy(true); setError('');
    try {
      const result = await api<{ backup: { filename: string } }>('receptions', { ...body(), _generation: impact.generation, token: impact.token, confirm: true });
      setDocument(await api<Document>('receptions')); setImpact(undefined); setFile(undefined); setChoices({}); setReviewed(false);
      setSuccess('Ricevimenti importati. Backup precedente: ' + result.backup.filename);
      onImported?.();
    } catch (e) { setError(String(e)); setReviewed(false); }
    finally { setBusy(false); }
  };
  const needsReview = (row: Row) => !row.skip && (!row.teacher || !!row.error);
  const unresolved = impact?.rows.filter(needsReview).length || 0;
  const previewRows = impact ? [...impact.rows].sort((a, b) => Number(needsReview(b)) - Number(needsReview(a))) : [];
  return <section className="reception-import settings-subsection" aria-label="Ricevimenti">
    <h2>Ricevimenti</h2>
    <p>Importa l’Excel con docente, giorno e ora. R compare in Orari e non può essere usato come recupero permesso. Le sedi mancanti restano da verificare.</p>
    {!!document?.versions.length && <details><summary>Versioni ricevimenti ({document.versions.length})</summary>{document.versions.map(version => <p key={version.effective}>Dal {version.effective}: {version.rows.length} ricevimenti · {version.rows.filter(row => !row.site).length} sedi da verificare</p>)}</details>}
    <div className="ui-form">
      <label>Decorrenza<input type="date" value={effective} required disabled={busy} onChange={e => { invalidate(); setEffective(e.target.value); }} /></label>
      <label>File ricevimenti XLSX<input type="file" accept=".xlsx" disabled={busy} onChange={async e => {
        invalidate(); setImpact(undefined); setFile(undefined); setChoices({}); setTeacherQueries({});
        const current = request.current, selected = e.target.files?.[0];
        if (!selected) return;
        if (selected.size > 6_000_000) { setError('File troppo grande: massimo 6 MB.'); return; }
        setBusy(true);
        try {
          const bytes = new Uint8Array(await selected.arrayBuffer());
          let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
          if (current === request.current) setFile({ name: selected.name, data: btoa(binary) });
        } catch (e) { if (current === request.current) setError(String(e)); }
        finally { setBusy(false); }
      }} /></label>
      <button className="ui-button ui-button-primary" disabled={busy || !file || !effective} onClick={preview}>{busy ? 'Elaborazione…' : 'Mostra anteprima ricevimenti'}</button>
    </div>
    {file && <p>{file.name}</p>}
    {error && !impact && <p className="ui-notice ui-notice-error" role="alert">{error}</p>}
    {success && <p className="ui-notice" role="status">{success}</p>}
    {impact && <div className="ui-surface settings-preview">
      <h3>Verifica abbinamenti</h3>
      <p>Dal {impact.effective}{impact.end ? ` fino al ${impact.end} escluso` : ' fino alla prossima versione'}. {impact.rows.length} righe · {unresolved} da risolvere nell’ultima anteprima.</p>
      <p className={`ui-notice${reviewed && unresolved ? ' ui-notice-error' : ''}`} role="status">{!reviewed ? 'Scelte modificate: clicca «Verifica abbinamenti» per controllare se puoi importare.' : unresolved ? `${unresolved} righe da risolvere: sono evidenziate e mostrate per prime.` : 'Tutti gli abbinamenti sono risolti.'}</p>
      <p>Abbina ogni docente incerto oppure scegli Salta. La sede è facoltativa: “a distanza” non identifica una sede fisica. Quando hai finito, clicca «Verifica abbinamenti» qui sotto; poi potrai confermare l’importazione.</p>
      <label>Cerca nell’anteprima<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <div className="settings-table-scroll"><table className="ui-table settings-table"><thead><tr>{['Riga / docente nel file', 'Giorno / ora', 'Docente abbinato', 'Sede', 'Esito'].map(title => <th key={title}>{title}</th>)}</tr></thead><tbody>
        {previewRows.filter(row => row.name.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(row => {
          const choice = choices[row.row], teacher = choice?.teacher === undefined ? row.teacher : choice.teacher;
          const site = choice?.site === undefined ? row.site : choice.site;
          const skip = choice?.skip === undefined ? row.skip : choice.skip;
          const label = `Riga ${row.row} ${row.name}`;
          return <tr key={row.row} className={needsReview(row) ? 'reception-row-unresolved' : undefined}>
            <td>{row.row} · {row.name}</td><td>{row.day} · {row.hour}ª<br />{row.time}</td>
            <td><input type="search" list={`reception-teachers-${row.row}`} aria-label={`Docente ${label}`} disabled={busy || skip} value={teacherQueries[row.row] ?? (teacher ? `${impact.teachers[teacher]} [${teacher}]` : '')} placeholder="Cerca e seleziona docente" onChange={e => {
              setTeacherQueries({ ...teacherQueries, [row.row]: e.target.value });
              const identifier = Object.keys(impact.teachers).find(identifier => `${impact.teachers[identifier]} [${identifier}]` === e.target.value);
              choose(row.row, { teacher: identifier || null });
              e.target.setCustomValidity(identifier || !e.target.value ? '' : 'Seleziona un docente dall’elenco.');
            }} /><datalist id={`reception-teachers-${row.row}`}>{[...new Set([...row.suggestions, ...Object.keys(impact.teachers)])].map(identifier => <option key={identifier} value={`${impact.teachers[identifier]} [${identifier}]`} />)}</datalist>
              <label><input type="checkbox" checked={skip} disabled={busy} onChange={e => choose(row.row, { skip: e.target.checked })} />Salta</label></td>
            <td><select aria-label={`Sede ${label}`} value={site || ''} disabled={busy || skip} onChange={e => choose(row.row, { site: e.target.value || null })}><option value="">Da verificare</option><option value="centrale">Centrale</option><option value="succursale">Succursale</option></select><small>{row.location || 'Nessuna sede nel file'}</small></td>
            <td>{needsReview(row) && reviewed && <strong className="reception-review-label">Da risolvere</strong>}{skip ? 'Saltata' : row.error || (!teacher ? 'Seleziona un docente dall’elenco dei suggerimenti' : reviewed ? 'Abbinato' : 'Modifica da verificare')}</td>
          </tr>;
        })}
      </tbody></table></div>
      {impact.days.filter(day => day.issues.length).map(day => <details key={day.day}><summary>{day.day}: {day.issues.length} assegnazioni da verificare</summary>{day.issues.map(issue => <p key={issue.key}>{issue.message}</p>)}</details>)}
      {error && <p className="ui-notice ui-notice-error" role="alert">Importazione non completata: {error} Le scelte sono conservate; clicca «Verifica abbinamenti» per riprovare.</p>}
      {!reviewed && <p className="ui-notice" role="status">Scelte modificate. Clicca «Verifica abbinamenti» per controllarle, poi conferma l’importazione.</p>}
      {reviewed && !impact.ready && <p className="ui-notice ui-notice-error" role="status">Importazione bloccata: risolvi o salta le {unresolved} righe evidenziate, poi clicca «Verifica abbinamenti».</p>}
      {reviewed && impact.ready && <p className="ui-notice" role="status">Verifica completata. Clicca «Conferma ricevimenti» per importare.</p>}
      <div className="ui-actions">
      <button className="ui-button ui-button-primary" disabled={busy || (reviewed && !impact.ready)} onClick={reviewed ? apply : preview}>{busy ? 'Elaborazione…' : reviewed ? 'Conferma ricevimenti' : 'Verifica abbinamenti'}</button>
      <button className="ui-button" disabled={busy} onClick={() => { invalidate(); setImpact(undefined); setFile(undefined); setChoices({}); }}>Annulla</button>
      </div>
    </div>}
  </section>;
}
