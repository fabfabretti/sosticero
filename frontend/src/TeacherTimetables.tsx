import { useQuietRefresh } from './useQuietRefresh';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { buildTeacherTimetables, norm, teacherSearchText, DAYS, HOURS } from './timetables';
import { generateTimetablePdf, projectTimetableExport } from './timetablePdf';
import { HourHelp } from './Tooltip';
import type { Reception } from './Receptions';

export type Lesson = { room?: string | null; classes?: string[]; activities?: string[]; special?: string; site?: string | null; disabled?: boolean };
type Dataset = {
  teachers: Record<string, { id: string; name: string; importedName?: string; nameOverride?: NameOverride; code?: string; retired?: boolean }>;
  lessons: Record<string, Lesson>;
  receptions?: Reception[];
};
type Group = { before: Record<string, Lesson | null>; after: Record<string, Lesson | null>; conflicts: { id: string; effective: string | null }[] };
type Override = { id: string; teacher: string; start: string; end: string | null; reset: boolean; groups: Group[] };
type Orari = { generation?: number; effective: string | null; day: string; basis: string; version: string; imported: Dataset; dataset: Dataset; overrides: Override[] };
type Draft = { _generation?: number; teacher: string; start: string; end: string; cells: Record<string, Lesson | null>; basis: string; reset: boolean };
type Impact = { generation?: number; token: string; days: { day: string; assignments: string[]; issues: { key: string; message: string }[] }[] };
type Deletion = { record: Override; basis: string; impact: Impact };
type NameOverride = { name: string; originalName: string };
type NameDraft = NameOverride & { _generation?: number; teacher: string; previous: NameOverride | null };
const DAY_LABELS: Record<string, string> = { lun: 'Lun', mar: 'Mar', mer: 'Mer', gio: 'Gio', ven: 'Ven' };
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' }).format(new Date());
const dateLabel = (s: string) => s.split('-').reverse().join('/');
export const isClassActivity = (l: Lesson | null | undefined) => !!l && ['POT', 'ALF', 'PE', 'RIT', 'DIS'].includes((l.activities?.length ? l.activities.join(',') : l.special) || '');
export const editableHour = (l: Lesson | null | undefined) => !!l && (!l.classes?.length || (isClassActivity(l) && !!l.disabled)) && !!(l.activities?.length || l.special);
export function moveHour(cells: Draft['cells'], source: string, target: string) {
  if (!(source in cells) || !(target in cells) || source === target || !editableHour(cells[source]) || (cells[target] && !editableHour(cells[target]))) return cells;
  return { ...cells, [source]: cells[target], [target]: cells[source] };
}
const week = (ds: Dataset, teacher: string) => Object.fromEntries(DAYS.flatMap(d => HOURS.map(h => [`${d}|${h}`, ds.lessons[`${teacher}|${d}|${h}`] || null])));
export function activeOverride(records: Override[], teacher: string, day: string) {
  const revisions = new Map<string, Override>();
  records.filter(r => r.teacher === teacher).forEach(r => revisions.set(r.start, r));
  const all = [...revisions.values()];
  const reset = all.filter(r => r.reset && r.start <= day).map(r => r.start).sort().at(-1) || '';
  return all.filter(r => r.start >= reset && r.start <= day && (!r.end || r.end >= day)).sort((a, b) => b.start.localeCompare(a.start))[0];
}

export function TeacherTimetables({ api }: { api: <T>(url: string, body?: unknown) => Promise<T> }) {
  const [data, setData] = useState<Orari>();
  const [viewDay, setViewDay] = useState(today);
  const [classEdit, setClassEdit] = useState<{ teacher: string; slot: string; value: string; site: string; query?: string }>();
  const activityDialog = useRef<HTMLDialogElement>(null);
  const activityTrigger = useRef<HTMLButtonElement | null>(null);
  const [classIndex, setClassIndex] = useState(0);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft>();
  const [nameDraft, setNameDraft] = useState<NameDraft>();
  const [nameStatus, setNameStatus] = useState('');
  const [impact, setImpact] = useState<Impact>();
  const [deletion, setDeletion] = useState<Deletion>();
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number; slot: string; target: string }>();
  const pointer = useRef<{ teacher: string; slot: string; x: number; y: number; moved: boolean } | undefined>(undefined);
  const suppressClick = useRef(false);
  const request = useRef(0);
  const baseline = useRef<Draft | undefined>(undefined);
  const tables = useRef(new Map<string, HTMLTableElement>());
  const scrollAnchor = useRef<{ teacher: string; top: number } | undefined>(undefined);
  const rememberTimetable = (teacher: string | undefined) => {
    const table = teacher && tables.current.get(teacher);
    if (table) scrollAnchor.current = { teacher, top: table.getBoundingClientRect().top };
  };
  useLayoutEffect(() => {
    const anchor = scrollAnchor.current;
    if (!anchor) return;
    scrollAnchor.current = undefined;
    const frame = requestAnimationFrame(() => {
      const table = tables.current.get(anchor.teacher);
      if (table) window.scrollBy({ top: table.getBoundingClientRect().top - anchor.top, behavior: 'instant' });
    });
    return () => cancelAnimationFrame(frame);
  }, [draft?.teacher, nameDraft?.teacher]);
  const dirty = !!draft || !!nameDraft;
  const endpoint = (day: string) => 'orari?' + new URLSearchParams({ day });
  const { refresh: quietRefresh, invalidate: invalidateRefresh } = useQuietRefresh(
    () => api<Orari>(endpoint(viewDay)),
    next => setData(old => JSON.stringify(old) === JSON.stringify(next) && old?.generation === next.generation ? old : next),
    dirty || busy || !!classEdit || !!impact || !!deletion || !!drag,
    viewDay,
  );
  useEffect(() => { void quietRefresh().catch(e => setError(String(e))); }, [api, viewDay]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    const navigate = (e: MouseEvent) => {
      const link = (e.target as Element).closest?.('a');
      if (link && !window.confirm('Uscire e scartare le modifiche non salvate?')) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty]);
  useEffect(() => { if (classEdit && activityDialog.current && !activityDialog.current.open) { activityDialog.current.showModal(); activityDialog.current.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus(); } }, [classEdit]);
  const displayed = useMemo(() => {
    if (!data || !draft) return data?.dataset;
    const lessons = { ...data.dataset.lessons };
    for (const [k, v] of Object.entries(draft.cells)) {
      if (v) lessons[`${draft.teacher}|${k}`] = v; else delete lessons[`${draft.teacher}|${k}`];
    }
    return { ...data.dataset, lessons };
  }, [data, draft]);
  const receptionsBySlot = useMemo(() => {
    const slots = new Map<string, Reception[]>();
    for (const reception of data?.dataset.receptions || []) {
      const key = `${reception.teacher}|${reception.day}|${reception.hour}`;
      slots.set(key, [...(slots.get(key) || []), reception]);
    }
    return slots;
  }, [data]);
  const grids = useMemo(() => displayed ? buildTeacherTimetables(displayed) : [], [displayed]);
  const filtered = useMemo(() => {
    const q = norm(query);
    return q ? grids.filter(g => norm(teacherSearchText(g)).includes(q)) : grids;
  }, [grids, query]);
  const name = (id: string) => data?.dataset.teachers[id]?.name || id;
  const discard = () => { rememberTimetable(draft?.teacher || nameDraft?.teacher); setClassEdit(undefined); request.current++; baseline.current = undefined; setDraft(undefined); setNameDraft(undefined); setImpact(undefined); setDeletion(undefined); setDrag(undefined); setError(''); };
  const beginName = (teacher: string) => {
    if (!data || busy || (dirty && !window.confirm('Scartare la bozza corrente?'))) return;
    discard(); setNameStatus('');
    rememberTimetable(teacher);
    const previous = data.dataset.teachers[teacher].nameOverride || null;
    setNameDraft({ _generation: data.generation, teacher, previous, name: previous?.name || '', originalName: previous?.originalName || '' });
  };
  const saveName = async (remove = false) => {
    if (!nameDraft || busy) return;
    setBusy(true); setError(''); setNameStatus('');
    try {
      invalidateRefresh();
      await api('orari/name', { _generation: nameDraft._generation, teacher: nameDraft.teacher, previous: nameDraft.previous,
        value: remove ? null : { name: nameDraft.name, originalName: nameDraft.originalName } });
      setData(await api<Orari>(endpoint(viewDay)));
      rememberTimetable(nameDraft.teacher); setNameDraft(undefined);
      setNameStatus(remove ? 'Nome importato ripristinato.' : 'Nome aggiornato.');
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  const begin = (teacher: string) => {
    if (!data || busy || (dirty && !window.confirm('Scartare la bozza corrente?'))) return;
    rememberTimetable(teacher);
    setClassEdit(undefined);
    setNameDraft(undefined); setNameStatus('');
    const current = activeOverride(data.overrides || [], teacher, viewDay);
    const next = { _generation: data.generation, teacher, start: viewDay, end: current?.end || '', cells: week(data.dataset, teacher), basis: data.basis, reset: false };
    baseline.current = next;
    setDraft(next);
    setImpact(undefined); setDeletion(undefined); setDrag(undefined); setError('');
  };
  const change = (values: Partial<Draft>) => { setDraft(d => d && ({ ...d, ...values })); setImpact(undefined); setError(''); };
  const startAt = async (start: string) => {
    if (!draft || !start || start === draft.start) return;
    const changed = draft.reset !== baseline.current?.reset || draft.end !== baseline.current?.end || JSON.stringify(draft.cells) !== JSON.stringify(baseline.current?.cells);
    if (changed && !window.confirm('Scartare le modifiche non salvate e cambiare la decorrenza?')) return;
    setBusy(true); setError('');
    try {
      const result = await api<Orari>(endpoint(start));
      const current = activeOverride(result.overrides || [], draft.teacher, start);
      const next = { _generation: result.generation, teacher: draft.teacher, start, end: current?.end || '', cells: week(result.dataset, draft.teacher), basis: result.basis, reset: false };
      setData(result); setViewDay(start);
      baseline.current = next;
      setDraft(next);
      setImpact(undefined); setDrag(undefined);
    } catch (e) { setError(String(e)); }
    finally { setBusy(false); }
  };
  const move = (teacher: string, from: string, to: string) => {
    if (!draft || draft.teacher !== teacher || busy) return;
    setClassEdit(undefined);
    const next = moveHour(draft.cells, from, to);
    if (next === draft.cells) { setError('Sposta solo ore speciali verso celle vuote o altre ore speciali dello stesso docente.'); return; }
    change({ cells: next, reset: false }); setDrag(undefined);
  };
  const toggle = (teacher: string, slot: string) => {
    if (!draft || draft.teacher !== teacher || busy) return;
    if (suppressClick.current) { suppressClick.current = false; return; }
    const value = draft.cells[slot];
    if (editableHour(value)) {
      setClassEdit(undefined);
      const next = { ...value };
      if (next.disabled) { delete next.disabled; if (isClassActivity(next)) next.classes = []; } else next.disabled = true;
      change({ cells: { ...draft.cells, [slot]: next }, reset: false });
    }
  };
  const apply = async (result: Impact) => {
    if (!draft) return;
    invalidateRefresh();
    await api('orari/override', { ...draft, end: draft.end || null, token: result.token });
    const updated = await api<Orari>(endpoint(viewDay)); setData(updated); discard();
  };
  const save = async (confirmed?: Impact) => {
    if (!draft) return;
    const n = ++request.current;
    setBusy(true); setError(''); setImpact(undefined);
    try {
      const result = confirmed || await api<Impact>('orari/preview', { ...draft, end: draft.end || null });
      if (n !== request.current) return;
      if (!confirmed && result.days.some(d => d.issues.length > 0)) setImpact(result);
      else await apply(result);
    } catch (e) { if (n === request.current) setError(String(e)); }
    finally { setBusy(false); }
  };
  const remove = async (record: Override, confirmed?: Deletion) => {
    if (!data || busy || (!confirmed && !window.confirm(`${dirty ? 'Scartare la bozza corrente ed eliminare' : 'Eliminare'} la modifica dal ${dateLabel(record.start)} e tutte le sue revisioni?`))) return;
    if (!confirmed && dirty) discard();
    const n = ++request.current;
    const basis = confirmed?.basis || data.basis;
    const body = { _generation: confirmed?.impact.generation ?? data.generation, delete: true, id: record.id, teacher: record.teacher, start: record.start, basis };
    setBusy(true); setError(''); if (!confirmed) setDeletion(undefined);
    try {
      const result = confirmed?.impact || await api<Impact>('orari/preview', body);
      if (n !== request.current) return;
      if (!confirmed && result.days.some(d => d.issues.length > 0)) { setDeletion({ record, basis, impact: result }); return; }
      await api('orari/override', { ...body, token: result.token });
      const updated = await api<Orari>(endpoint(viewDay));
      if (n === request.current) { setData(updated); setDeletion(undefined); }
    } catch (e) { if (n === request.current) setError(String(e)); }
    finally { setBusy(false); }
  };
  const editedHour = classEdit && draft?.teacher === classEdit.teacher ? draft.cells[classEdit.slot] : undefined;
  const editedActivity = editedHour?.activities?.[0] || editedHour?.special || '';
  const classSuggestions = classEdit?.query ? [...new Set(Object.values(data?.dataset.lessons || {}).flatMap(l => l.classes || []))]
    .filter(c => norm(c).includes(norm(classEdit.query!)))
    .sort((a, b) => Number(!norm(a).startsWith(norm(classEdit.query!))) - Number(!norm(b).startsWith(norm(classEdit.query!))) || a.localeCompare(b))
    .slice(0, 6) : [];
  const chooseClass = (value: string) => { if (classEdit) setClassEdit({ ...classEdit, value, query: undefined }); setClassIndex(0); };
  const closeActivityEditor = () => { activityDialog.current?.close(); setClassEdit(undefined); activityTrigger.current?.focus({ preventScroll: true }); };
  const dragged = drag && draft?.cells[drag.slot];
  return <section className="ui-page orari" aria-labelledby="orari-title">
    <h2 className="ui-title" id="orari-title">Orari</h2>
    <p className="sub">{data ? data.effective ? `Orario dal ${dateLabel(data.effective)}` : 'Orario attuale' : 'Caricamento…'}</p>
    <div className="ui-surface orari-toolbar">
      <label className="orari-filter">Cerca docente<input type="search" aria-label="Cerca docente" value={query} onChange={e => setQuery(e.target.value)} /></label>
      <label>Orario al<input type="date" value={viewDay} disabled={busy} onChange={e => {
        if (!e.target.value || (dirty && !window.confirm('Scartare la bozza e cambiare data?'))) return;
        discard(); setData(undefined); setViewDay(e.target.value);
      }} /></label>
      <button type="button" className="ui-button" disabled={!data || data.day !== viewDay || dirty || busy || exporting || !grids.length} onClick={() => {
        if (!data || data.day !== viewDay || dirty || busy || exporting) return;
        setExporting(true); setError('');
        try { generateTimetablePdf(projectTimetableExport(data.dataset), data.day, data.effective).save(`orari-${data.day}.pdf`); }
        catch (e) { setError(`Impossibile generare il PDF: ${e instanceof Error ? e.message : String(e)}`); }
        finally { setExporting(false); }
      }}>{exporting ? 'Generazione…' : 'Scarica PDF completo'}</button>
      <span className="sub">Salva o annulla le modifiche prima di esportare.</span>
    </div>
    <div className="orari-legend" aria-label="Legenda sedi">
      <span className="campus-centrale"><i aria-hidden="true" />C · Centrale</span>
      <span className="campus-succursale"><i aria-hidden="true" />S · Succursale</span>
      <span className="campus-unknown"><i aria-hidden="true" />? · Sede ignota</span>
    </div>
    {error && <p className="ui-notice ui-notice-error" role="alert">{error}</p>}
    {nameStatus && <p className="ui-notice" role="status">{nameStatus}</p>}
    {data && !filtered.length && <p>Nessun docente trovato.</p>}
    <div className="orari-grids">{filtered.map(g => {
      const editing = draft?.teacher === g.id;
      const current = activeOverride(data?.overrides || [], g.id, viewDay);
      const records = (data?.overrides || []).filter(r => r.teacher === g.id).filter((r, i, all) => !all.slice(i + 1).some(other => other.start === r.start));
      const upcoming = records.filter(r => r.start > viewDay && !r.reset && r.groups.length).sort((a, b) => a.start.localeCompare(b.start))[0];
      const marker = current?.groups.length ? current : upcoming;
      const review = current?.groups.some(group => group.conflicts.some(c => !c.effective || c.effective <= viewDay));
      return <div className={'ui-surface orari-card' + (editing ? ' orari-editing' : '')} key={g.id}>
        <div className="orari-card-header"><h3>{g.importedName && <><del className="orari-imported-name">{g.importedName}</del>{' '}</>}{g.name} <small>{g.code}</small></h3><div className="orari-card-actions">
          {marker && <span className="orari-modified">MODIFICATO · dal {dateLabel(marker.start)}{marker.end ? ` al ${dateLabel(marker.end)}` : ''}{marker.start > viewDay ? ' · programmato' : ''}</span>}
          {review && <span className="orari-review">Da verificare</span>}
          <button className="ui-button" disabled={busy || editing} onClick={() => begin(g.id)} aria-label={`Modifica orario di ${g.name}`}>Modifica orario</button>
          <button className="ui-button" disabled={busy} onClick={() => beginName(g.id)} aria-label={`Modifica nome di ${g.name}`}>Modifica nome</button>
        </div></div>
        {nameDraft?.teacher === g.id && <form className="orari-name-editor" aria-label={`Modifica nome di ${g.name}`} onSubmit={e => { e.preventDefault(); void saveName(); }}>
          <p className="sub">Nome importato: {data?.dataset.teachers[g.id].importedName || g.name}</p>
          <div className="orari-name-fields">
            <label>Nome da mostrare<input autoFocus required maxLength={200} value={nameDraft.name} disabled={busy} onChange={e => setNameDraft({ ...nameDraft, name: e.target.value })} /></label>
            <label>Docente originale<input required maxLength={200} value={nameDraft.originalName} disabled={busy} onChange={e => setNameDraft({ ...nameDraft, originalName: e.target.value })} /></label>
          </div>
          <p className="sub">Cambia solo il nome, anche nelle giornate passate. Permessi e recuperi restano sullo stesso conto.</p>
          <div className="orari-name-actions">
            <button className="ui-button ui-button-primary" disabled={busy || !nameDraft.name.trim() || !nameDraft.originalName.trim()}>{busy ? 'Salvataggio…' : 'Salva nome'}</button>
            {nameDraft.previous && <button type="button" className="ui-button" disabled={busy} onClick={() => void saveName(true)}>Rimuovi nome personalizzato</button>}
            <button type="button" className="ui-button" disabled={busy} onClick={() => { rememberTimetable(g.id); setNameDraft(undefined); setError(''); }}>Annulla</button>
          </div>
        </form>}
        {g.cdcName && <p className="orari-cdc" title={`${g.cdc ? g.cdc + ' · ' : ''}${g.cdcName}`}>{g.cdc ? `${g.cdc} · ` : ''}{g.cdcName}</p>}
        {!!records.length && <details className="orari-history" open={!!upcoming || editing}><summary>Modifiche salvate ({records.length})</summary>{records.map(r => <div className="orari-history-row" key={r.id}><button disabled={busy || editing} onClick={() => { if (r.start === viewDay) { begin(g.id); } else { discard(); setData(undefined); setViewDay(r.start); } }}>{r.reset ? 'Ripristino' : 'Modifica'} dal {dateLabel(r.start)}{r.end ? ` al ${dateLabel(r.end)}` : ''}</button><button className="ui-button" disabled={busy} aria-label={`Elimina modifica di ${g.name} dal ${dateLabel(r.start)}`} onClick={() => remove(r)}>Elimina</button></div>)}</details>}
        {deletion?.record.teacher === g.id && <div className="orari-impact" aria-label="Conferma eliminazione"><p>Eliminare la modifica dal {dateLabel(deletion.record.start)}? {deletion.impact.days.reduce((sum, d) => sum + d.issues.length, 0)} assegnazioni da verificare. Le assegnazioni restano conservate.</p><details><summary>Mostra dettagli</summary>{deletion.impact.days.filter(d => d.issues.length > 0).map(d => <div key={d.day}><p>{dateLabel(d.day)}</p>{d.issues.map(i => <p key={i.key}>{i.key}: {i.message}</p>)}</div>)}</details><button className="ui-button ui-button-primary" disabled={busy} onClick={() => remove(deletion.record, deletion)}>Conferma ed elimina</button> <button className="ui-button" disabled={busy} onClick={() => setDeletion(undefined)}>Annulla</button></div>}
        {editing && draft && <>
          <div className="orari-edit-toolbar" role="group" aria-label={`Modifica orario di ${g.name}`}>
            <label>Dal<input type="date" required value={draft.start} disabled={busy} onChange={e => startAt(e.target.value)} /></label>
            <label>Al<input aria-label="Fino al (facoltativo)" type="date" min={draft.start} value={draft.end} disabled={busy || draft.reset} onChange={e => change({ end: e.target.value })} /></label>
            <button className="ui-button ui-button-primary" disabled={busy || (!!draft.end && draft.end < draft.start)} onClick={() => save()}>{busy ? 'Salvataggio…' : 'Salva'}</button>
            <button className="ui-button" disabled={busy} onClick={() => { if (data) change({ reset: true, end: '', cells: week(data.imported, g.id) }); }}>Ripristina</button>
            <button className="ui-button" disabled={busy} onClick={discard}>Annulla</button>
          </div>
          <p className="orari-edit-hint">Trascina per spostare o scambiare · Clicca su POT, ALF, PE, RIT o DIS per modificare classe e sede</p>
          <span className="sr-only">Per spostare con la tastiera: Alt e frecce su un’ora speciale.</span>
          {review && <details className="orari-conflicts"><summary>Modifiche sospese dopo l’importazione</summary><p>Ricrea le modifiche sulla nuova base oppure salva per scartarle.</p>{current?.groups.filter(group => group.conflicts.some(c => !c.effective || c.effective <= viewDay)).map((group, i) => <p key={i}>{Object.entries(group.after).map(([slot, l]) => `${DAY_LABELS[slot.split('|')[0]]} ${slot.split('|')[1]}ª: ${l ? (l.activities || [l.special]).join('/') : 'vuota'}`).join(' · ')}</p>)}</details>}
          {draft.reset && <p className="orari-edit-hint" role="status">Ripristino dell’orario originale dal {dateLabel(draft.start)} · Salva per confermare</p>}
          {impact && <div className="orari-impact" aria-label="Conferma modifica"><p>{impact.days.reduce((sum, d) => sum + d.issues.length, 0)} assegnazioni da verificare. Le assegnazioni restano conservate.</p><details><summary>Mostra dettagli</summary>{impact.days.filter(d => d.issues.length > 0).map(d => <div key={d.day}><p>{dateLabel(d.day)}</p>{d.issues.map(i => <p key={i.key}>{i.key}: {i.message}</p>)}</div>)}</details><button className="ui-button ui-button-primary" disabled={busy} onClick={() => save(impact)}>Conferma e salva</button> <button className="ui-button" disabled={busy} onClick={() => setImpact(undefined)}>Indietro</button></div>}
        </>}
        <table ref={node => { if (node) tables.current.set(g.id, node); else tables.current.delete(g.id); }} className="orari-grid" aria-label={`Orario di ${g.name}`}><thead><tr><th scope="col">Ora</th>{DAYS.map(d => <th key={d} scope="col">{DAY_LABELS[d]}</th>)}</tr></thead><tbody>{HOURS.map((h, hi) => <tr key={h}><th scope="row">{h}ª</th>{DAYS.map((d, di) => {
          const cell = g.cells[di][hi], slot = `${d}|${h}`, value = editing ? draft?.cells[slot] : displayed?.lessons[`${g.id}|${slot}`];
          const activity = value?.activities?.[0] || value?.special || '';
          const special = editableHour(value), disabled = !!value?.disabled;
          const label = cell ? [...cell.classes, ...cell.codes].join(' · ') : '';
          const site = cell?.site === 'centrale' ? 'C' : cell?.site === 'succursale' ? 'S' : '?';
          const content = cell && <><span title={`${label} · ${site === 'C' ? 'Centrale' : site === 'S' ? 'Succursale' : 'Sede ignota'}`} className={`orari-session campus-${cell.site || 'unknown'}${special ? ' orari-special' : ''}${disabled ? ' orari-disabled' : ''}`}><span className="orari-session-label">{label}</span><span className="orari-session-meta">{cell.partners.length > 0 && <span className="orari-partners">Comp.</span>}<span className="orari-site" title={site === 'C' ? 'Centrale' : site === 'S' ? 'Succursale' : 'Sede ignota'}>{site}</span></span></span>{disabled && <span className="sr-only">Ora disabilitata: solo in caso di necessità</span>}</>;
          const destination = editing && drag?.target === slot;
          return <td key={d} data-timetable-slot={slot} data-teacher={g.id} className={(cell?.partners.length ? 'orari-shared ' : '') + (destination ? 'orari-destination' : '')}>
            {receptionsBySlot.get(`${g.id}|${d}|${h}`)?.map(reception => <HourHelp key={`${d}|${h}`} text={`Ricevimento · ${DAY_LABELS[d]} ${h}ª · ${reception.time || 'Orario non specificato'} · ${reception.site || 'Sede da verificare'}${reception.location ? ' · ' + reception.location : ''}${cell ? ' · Sovrapposizione con attività in orario' : ''}`}><span className="orari-reception">R{cell ? ' · Sovrapposizione' : ''}</span></HourHelp>)}
            {editing && special ? <><button type="button" className={'orari-cell-button' + (drag?.slot === slot ? ' orari-drag-source' : '')} disabled={busy} aria-pressed={isClassActivity(value) ? undefined : disabled} aria-label={`${isClassActivity(value) ? 'Modifica ' + activity : disabled ? 'Riattiva' : 'Disabilita'} ${DAY_LABELS[d]} ${h}ª ${label}`}
              onKeyDown={e => {
                if (!e.altKey || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
                e.preventDefault();
                const nextDay = di + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0);
                const nextHour = h + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0);
                if (DAYS[nextDay] && HOURS.includes(nextHour)) move(g.id, slot, `${DAYS[nextDay]}|${nextHour}`);
              }}
              onPointerDown={e => {
                if (!special || busy || e.button !== 0) return;
                pointer.current = { teacher: g.id, slot, x: e.clientX, y: e.clientY, moved: false };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={e => {
                const p = pointer.current;
                if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) < 8) return;
                p.moved = true; suppressClick.current = true; e.preventDefault();
                const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('td[data-timetable-slot]');
                const targetSlot = target?.dataset.timetableSlot || '';
                const legal = target?.dataset.teacher === p.teacher && targetSlot !== p.slot && draft && (draft.cells[targetSlot] === null || editableHour(draft.cells[targetSlot]));
                setDrag({ x: e.clientX, y: e.clientY, slot: p.slot, target: legal ? targetSlot : '' });
              }}
              onPointerUp={e => {
                const p = pointer.current; pointer.current = undefined;
                if (!p?.moved) return;
                const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('td[data-timetable-slot]');
                if (target?.dataset.teacher === p.teacher && target.dataset.timetableSlot) move(p.teacher, p.slot, target.dataset.timetableSlot);
                setDrag(undefined); setTimeout(() => { suppressClick.current = false; }, 0);
              }}
              onPointerCancel={() => { pointer.current = undefined; setDrag(undefined); suppressClick.current = false; }}
              onDoubleClick={e => { if (e?.currentTarget) activityTrigger.current = e.currentTarget; if (isClassActivity(value)) setClassEdit({ teacher: g.id, slot, value: value?.classes?.[0] || '', site: value?.site || '' }); }}
              onClick={e => {
                if (e?.currentTarget) activityTrigger.current = e.currentTarget;
                if (suppressClick.current) { suppressClick.current = false; return; }
                if (isClassActivity(value)) setClassEdit({ teacher: g.id, slot, value: value?.classes?.[0] || '', site: value?.site || '' });
                else toggle(g.id, slot);
              }}>{content}</button>
              {isClassActivity(value) && <button type="button" className="ui-button" disabled={busy} aria-pressed={disabled} aria-label={`${disabled ? 'Riattiva' : 'Disabilita'} ${DAY_LABELS[d]} ${h}ª ${label}`} onClick={() => toggle(g.id, slot)}>{disabled ? 'Riattiva' : 'Disabilita'}</button>}
              </>
              : cell?.partners.length ? <HourHelp text={'Compresenza: ' + cell.partners.map(name).join(', ')}>{content}</HourHelp> : content}
          </td>;
        })}</tr>)}</tbody></table>
      </div>;
    })}</div>
    {classEdit && editedHour && <dialog ref={activityDialog} className="orari-activity-editor" aria-labelledby="activity-editor-title" onCancel={closeActivityEditor}>
      <div className="orari-activity-header"><div><h3 id="activity-editor-title">Modifica {editedActivity}</h3><p className="sub">{name(classEdit.teacher)} · {DAY_LABELS[classEdit.slot.split('|')[0]]} {classEdit.slot.split('|')[1]}ª ora</p></div><button type="button" className="x" aria-label="Chiudi editor attività" onClick={closeActivityEditor}>×</button></div>
      <label className="orari-class-label" htmlFor="activity-class">Classe</label>
      <div className="sw">
        <input id="activity-class" role="combobox" aria-label={`Classe ${editedActivity}`} aria-autocomplete="list" aria-expanded={classSuggestions.length > 0} aria-controls="activity-class-suggestions" aria-activedescendant={classSuggestions.length ? `activity-class-${Math.min(classIndex, classSuggestions.length - 1)}` : undefined}
          autoFocus={!!editedHour.disabled} disabled={busy || !editedHour.disabled} autoComplete="off" placeholder="Scrivi la classe, es. 3a" value={classEdit.query ?? classEdit.value}
          onChange={e => { setClassEdit({ ...classEdit, value: '', query: e.target.value }); setClassIndex(0); }}
          onKeyDown={e => {
            if (e.nativeEvent?.isComposing) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setClassIndex((classIndex + (e.key === 'ArrowDown' ? 1 : classSuggestions.length - 1)) % Math.max(1, classSuggestions.length)); }
            if (e.key === 'Enter') { e.preventDefault(); const c = classSuggestions[classIndex]; if (c) chooseClass(c); }
          }} />
        {!!classSuggestions.length && <div className="sug" role="listbox" id="activity-class-suggestions" aria-label="Classi suggerite">{classSuggestions.map((c, i) => <button type="button" role="option" id={`activity-class-${i}`} key={c} aria-selected={classIndex === i} className={classIndex === i ? 'on' : ''} onClick={() => chooseClass(c)}>{c}<small>classe</small></button>)}</div>}
      </div>
      {!!classEdit.query && !classSuggestions.length && <p className="sub" role="status">Nessuna classe trovata.</p>}
      {editedHour.disabled ? <button type="button" className="lk orari-clear-class" disabled={busy || (!classEdit.value && !classEdit.query)} onClick={() => chooseClass('')}>Nessuna classe</button> : <p className="sub">Disabilita {editedActivity} per associare una classe.</p>}
      <fieldset className="orari-campus-choice" disabled={busy}><legend>Sede</legend><div className="opt" aria-label={`Sede ${editedActivity}`}>{[['centrale', 'Centrale'], ['succursale', 'Staccata'], ['', 'Non indicata']].map(([site, label]) => <button type="button" key={site} className={classEdit.site === site ? 'on' : ''} aria-pressed={classEdit.site === site} onClick={() => setClassEdit({ ...classEdit, site })}>{label}</button>)}</div></fieldset>
      <div className="orari-activity-actions"><button type="button" className="ui-button" disabled={busy} aria-label="Annulla modifica attività" onClick={closeActivityEditor}>Annulla</button><button type="button" className="ui-button ui-button-primary" disabled={busy || !!classEdit.query} onClick={() => { change({ cells: { ...draft!.cells, [classEdit.slot]: { ...editedHour, classes: editedHour.disabled && classEdit.value ? [classEdit.value] : [], site: classEdit.site || null } }, reset: false }); closeActivityEditor(); }}>Applica</button></div>
    </dialog>}
    {drag && dragged && <div className="orari-drag-preview" aria-hidden="true" style={{ left: drag.x + 14, top: drag.y + 14 }}>
      <span className={`orari-session orari-special campus-${dragged.site || 'unknown'}${dragged.disabled ? ' orari-disabled' : ''}`}><span>{(dragged.activities || [dragged.special]).join(' · ')}</span><span className="orari-site">{dragged.site === 'centrale' ? 'C' : dragged.site === 'succursale' ? 'S' : '?'}</span></span>
      <small>{drag.target ? `${draft?.cells[drag.target] ? 'Scambia' : 'Sposta'} · ${DAY_LABELS[drag.target.split('|')[0]]} ${drag.target.split('|')[1]}ª` : 'Posizione non disponibile'}</small>
    </div>}
  </section>;
}
