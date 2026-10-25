import { useRef, useState } from 'react';
import { todayInRome } from './StatsCalendar';

type Impact = { generation?: number;
  overrides?: { teacher: string; start: string; version: string; group: number; review: boolean }[];
  token: string; effective: string; end: string | null; initial: boolean;
  changedLessons: number; added: string[]; removed: string[]; changedTeachers: string[];
  teachers: Record<string, string>; previousTeachers?: Record<string, string>;
  days: { day: string; before: { k: string; h: number; c: string; sede: string | null }[]; after: { k: string; h: number; c: string; sede: string | null }[]; issues: { key: string; message: string }[]; references: { id: string; message: string }[] }[];
};

export function TimetableImport({ api, onImported }: { api: <T>(url: string, body?: unknown) => Promise<T>; onImported: () => void }) {
  const [effective, setEffective] = useState(todayInRome()), [file, setFile] = useState<{name: string; data: unknown}>(),
    [impact, setImpact] = useState<Impact>(), [error, setError] = useState(''), [busy, setBusy] = useState(false), [success, setSuccess] = useState('');
  const request = useRef(0);
  const invalidate = () => { request.current++; setImpact(undefined); setError(''); setSuccess(''); };
  const preview = async () => {
    if (!file || !effective) return;
    const n = ++request.current;
    setBusy(true); setError(''); setImpact(undefined); setSuccess('');
    try {
      const next = await api<Impact>('timetable/preview?' + new URLSearchParams({effective}), file.data);
      if (n === request.current) setImpact(next);
    } catch (e) { if (n === request.current) setError(String(e)); }
    finally { setBusy(false); }
  };
  const apply = async () => {
    if (!impact || !file) return;
    if (!window.confirm(`Importare ${file.name} con decorrenza ${effective}? Le registrazioni coinvolte saranno ricalcolate e le assegnazioni conservate, con eventuali conflitti da risolvere.`)) return;
    setBusy(true); setError('');
    try {
      const result = await api<{backup: {filename: string}}>('timetable?' + new URLSearchParams({effective, token: impact.token, confirm: 'true'}), { ...(file.data as object), _generation: impact.generation });
      setImpact(undefined); setFile(undefined); setSuccess('Orario importato. Backup precedente: ' + result.backup.filename); onImported();
    } catch (e) { setError(String(e)); setImpact(undefined); }
    finally { setBusy(false); }
  };
  const names = (ids: string[], old = false) => ids.map(id => `${(old ? impact?.previousTeachers?.[id] : impact?.teachers[id]) || id} (${id})`).join(', ') || 'Nessuno';
  return <section className="timetable-import" aria-label="Importa versione orario">
    <h2>Orario</h2>
    <p>Seleziona il JSON completo di docenti e lezioni. Ogni versione vale dalla decorrenza fino alla successiva; gli ID dei docenti devono restare stabili.</p>
    <label>Decorrenza <input type="date" value={effective} disabled={busy} required onChange={e => { invalidate(); setEffective(e.target.value); }} /></label>
    <label>Orario JSON completo <input type="file" accept=".json,application/json" disabled={busy} onChange={async e => {
      invalidate(); setFile(undefined); const n = request.current, selected = e.target.files?.[0];
      if (!selected) return;
      try { const data = JSON.parse(await selected.text()); if (n === request.current) setFile({name: selected.name, data}); }
      catch { if (n === request.current) setError('File JSON non valido.'); }
    }} /></label>
    {file && <p>{file.name}</p>}
    <button className="permit-save" disabled={busy || !file || !effective} onClick={preview}>{busy ? 'Elaborazione…' : 'Mostra anteprima'}</button>
    {error && <p role="alert">{error} Genera nuovamente l’anteprima prima di confermare.</p>}
    {success && <p role="status">{success}</p>}
    {impact && <div className="timetable-preview" aria-label="Anteprima importazione">
      <h3>Impatto dell’importazione</h3>
      <p>{impact.initial ? 'Primo orario: sarà la versione iniziale anche per le date precedenti.' : `Dal ${impact.effective} ${impact.end ? 'al ' + impact.end : 'fino alla prossima versione'}.`} Le date fuori da questo intervallo restano invariate.</p>
      {effective < todayInRome() && <p role="alert">Decorrenza nel passato: confermando correggi anche le giornate già registrate nell’intervallo.</p>}
      <p>{impact.changedLessons} lezioni settimanali cambiate · {impact.days.length} giornate registrate coinvolte.</p>
      <p>Docenti aggiunti: {names(impact.added)}</p><p>Docenti rimossi: {names(impact.removed, true)}</p><p>Anagrafiche modificate: {names(impact.changedTeachers)}</p>
      {(impact.added.length > 0 || impact.removed.length > 0) && <p>Controlla gli ID: rimozioni e aggiunte non trasferiscono le registrazioni tra docenti. Verifica che il file sia completo.</p>}
      {!!impact.overrides?.length && <details><summary>Modifiche manuali: {impact.overrides.filter(r => r.review).length} da verificare, {impact.overrides.filter(r => !r.review).length} compatibili</summary>{impact.overrides.map((r, n) => <p key={n}>{impact.teachers[r.teacher] || impact.previousTeachers?.[r.teacher] || r.teacher} · dal {r.start} · {r.review ? 'Da verificare: verranno usate le ore importate per questa modifica' : 'Modifica conservata'}</p>)}</details>}
      {impact.days.map(d => <details key={d.day}>
        <summary>{d.day}: {d.before.length} → {d.after.length} righe, {d.issues.length} assegnazioni da verificare</summary>
        <p>Prima: {d.before.map(r => `${r.h}ª ${r.c} (${r.sede || 'sede ignota'})`).join(', ') || 'Nessuna riga'}</p>
        <p>Dopo: {d.after.map(r => `${r.h}ª ${r.c} (${r.sede || 'sede ignota'})`).join(', ') || 'Nessuna riga'}</p>
        {d.issues.map(i => <p key={i.key}>{i.key}: {i.message}</p>)}
        {d.references.map((r, n) => <p key={n}>{r.id}: {r.message}</p>)}
      </details>)}
      <p>Un backup verificato sarà creato prima dell’applicazione. Le assegnazioni non vengono cancellate o spostate automaticamente.</p>
      <button className="permit-save" disabled={busy} onClick={apply}>Conferma importazione</button>{' '}
      <button disabled={busy} onClick={() => { invalidate(); setFile(undefined); }}>Annulla</button>
    </div>}
  </section>;
}
